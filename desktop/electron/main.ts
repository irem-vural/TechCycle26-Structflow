import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import * as path from 'path';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import type {
  DesktopBinary,
  PdfReportExportRequest,
  ProjectOpenResult,
  ProjectSaveToken,
  ProjectType,
} from '../../src/core/desktop/desktopContracts';
import { AtomicFileWriter } from './atomicFileWriter';
import { FILE_LIMITS, assertBoundedSize, FileCapabilityStore, projectExtension } from './fileCapabilities';
import { RecentProjectStore } from './recentProjectStore';
import { QuitCoordinator } from './quitCoordinator';
import { isTrustedIpcSender } from './ipcSecurity';

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;
let fileToOpen: string | null = null;
let isRendererReady = false;
let quitCoordinator: QuitCoordinator | null = null;
const capabilities = new FileCapabilityStore();
const atomicWriter = new AtomicFileWriter();
let recentProjects: RecentProjectStore | null = null;

const WINDOW_TITLEBAR_COLOR = '#111214';
const WINDOW_TITLEBAR_SYMBOL_COLOR = '#C7C8CC';
const WINDOW_TITLEBAR_HEIGHT = 36;

function parseArgvForFile(argv: string[]): string | null {
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('-') || ['.', './', '.\\', '..', '../'].includes(arg)) continue;
    const extension = path.extname(arg).toLowerCase();
    if (extension !== '.srw' && extension !== '.sfl' && extension !== '.sflow' && extension !== '.json') continue;
    try {
      const fullPath = path.resolve(arg);
      if (fsSync.existsSync(fullPath) && fsSync.statSync(fullPath).isFile()) return fullPath;
    } catch {
      // Invalid command-line paths are ignored; the normal project hub remains available.
    }
  }
  return null;
}

fileToOpen = parseArgvForFile(process.argv);

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    focusMainWindow();
    const filePath = parseArgvForFile(commandLine);
    if (!filePath) return;
    if (isRendererReady && mainWindow && !mainWindow.isDestroyed()) {
      void sendProjectOpenRequest(filePath);
    } else {
      fileToOpen = filePath;
    }
  });

  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    if (isRendererReady && mainWindow && !mainWindow.isDestroyed()) {
      void sendProjectOpenRequest(filePath);
    } else {
      fileToOpen = filePath;
    }
  });
}

function focusMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

function resolvePreloadPath(): string {
  return path.join(__dirname, 'preload.js');
}

function resolveIndexHtmlPath(): string {
  return isDev ? path.join(app.getAppPath(), 'out', 'index.html') : path.join(process.resourcesPath, 'out', 'index.html');
}

function resolveIconPath(): string {
  return isDev ? path.join(app.getAppPath(), 'public', 'favicon.ico') : path.join(process.resourcesPath, 'out', 'favicon.ico');
}

function assertTrustedSender(event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent, window: BrowserWindow): void {
  if (!isTrustedIpcSender(event.sender, window.webContents)) throw new Error('Güvenilmeyen IPC göndericisi.');
}

function isWindowThemeColors(value: unknown): value is { titlebar: string; symbol: string } {
  if (!value || typeof value !== 'object') return false;
  const colors = value as Record<string, unknown>;
  const hex = /^#[0-9a-f]{6}$/i;
  return typeof colors.titlebar === 'string' && hex.test(colors.titlebar) && typeof colors.symbol === 'string' && hex.test(colors.symbol);
}

function asBytes(value: unknown): DesktopBinary | null {
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return null;
}

function openError(errorCode: string, error: string): ProjectOpenResult {
  return { canceled: false, errorCode, error };
}

function pdfReportRequestFromUnknown(value: unknown): PdfReportExportRequest | null {
  if (!isRecord(value)) return null;
  const html = value.html;
  const defaultName = value.defaultName;
  if (typeof html !== 'string' || typeof defaultName !== 'string') return null;
  if (html.length === 0 || html.length > 2_000_000 || defaultName.length > 180) return null;
  return { html, defaultName };
}

function safePdfFileName(value: string): string {
  const base = path.basename(value).replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
  const name = base || 'istinat-duvari-raporu.pdf';
  return name.toLowerCase().endsWith('.pdf') ? name : `${name}.pdf`;
}

async function grantAndReadProject(filePath: string): Promise<ProjectOpenResult> {
  const resolvedPath = path.resolve(filePath);
  const extension = projectExtension(resolvedPath);
  if (!extension) return openError('unsupported-project-extension', 'Yalnızca SFL ve JSON proje dosyaları açılabilir.');
  try {
    const stat = await fs.stat(resolvedPath);
    if (!stat.isFile()) return openError('not-a-file', 'Seçilen yol bir dosya değil.');
    assertBoundedSize(stat.size, FILE_LIMITS.maxProjectInputBytes, 'Proje dosyası');
    const capability = capabilities.grant(resolvedPath, 'project');
    const bytes = new Uint8Array(await fs.readFile(resolvedPath));
    return {
      canceled: false,
      capabilityId: capability.id,
      filePath: capability.filePath,
      fileName: capability.fileName,
      bytes,
    };
  } catch (error) {
    return openError('project-open-failed', error instanceof Error ? error.message : String(error));
  }
}

async function sendProjectOpenRequest(filePath: string): Promise<void> {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const result = await grantAndReadProject(filePath);
  if (result.canceled === false && 'capabilityId' in result) {
    mainWindow.webContents.send('desktop-project-open-request', result.capabilityId);
  }
}

function registerIpcHandlers(window: BrowserWindow): void {
  const channelNames = [
    'desktop-window-minimize',
    'desktop-window-toggle-maximize',
    'desktop-window-request-close',
    'desktop-window-confirm-close',
    'desktop-window-cancel-close',
    'desktop-splash-ready',
    'desktop-splash-finished',
    'desktop-window-theme',
  ] as const;
  for (const channel of channelNames) ipcMain.removeAllListeners(channel);
  for (const channel of [
    'desktop-project-startup',
    'desktop-project-open-dialog',
    'desktop-project-open-capability',
    'desktop-project-open-recent',
    'desktop-project-select-save-path',
    'desktop-project-save',
    'desktop-recent-list',
    'desktop-recent-remember',
    'desktop-recent-forget',
    'desktop-report-export-pdf',
  ]) ipcMain.removeHandler(channel);

  quitCoordinator?.dispose();
  quitCoordinator = new QuitCoordinator({
    requestRendererDecision: () => {
      if (!window.isDestroyed()) window.webContents.send('desktop-close-request');
    },
    quit: () => app.quit(),
    forceExit: () => app.exit(0),
  });

  ipcMain.on('desktop-window-minimize', (event) => {
    assertTrustedSender(event, window);
    window.minimize();
  });
  ipcMain.on('desktop-window-theme', (event, colors: unknown) => {
    assertTrustedSender(event, window);
    if (process.platform !== 'win32' || !isWindowThemeColors(colors)) return;
    window.setTitleBarOverlay({ color: colors.titlebar, symbolColor: colors.symbol, height: 36 });
  });
  ipcMain.on('desktop-window-toggle-maximize', (event) => {
    assertTrustedSender(event, window);
    if (window.isMaximized()) window.unmaximize();
    else window.maximize();
  });
  ipcMain.on('desktop-window-request-close', (event) => {
    assertTrustedSender(event, window);
    window.close();
  });
  ipcMain.on('desktop-window-confirm-close', (event) => {
    assertTrustedSender(event, window);
    quitCoordinator?.confirm();
  });
  ipcMain.on('desktop-window-cancel-close', (event) => {
    assertTrustedSender(event, window);
    quitCoordinator?.cancel();
  });
  ipcMain.on('desktop-splash-ready', (event) => {
    assertTrustedSender(event, window);
    if (!window.isDestroyed()) window.show();
  });
  ipcMain.on('desktop-splash-finished', (event) => {
    assertTrustedSender(event, window);
    if (window.isDestroyed()) return;
    if (process.platform === 'win32') {
      window.setTitleBarOverlay({
        color: WINDOW_TITLEBAR_COLOR,
        symbolColor: WINDOW_TITLEBAR_SYMBOL_COLOR,
        height: WINDOW_TITLEBAR_HEIGHT,
      });
    } else if (process.platform === 'darwin') {
      window.setWindowButtonVisibility(true);
    }
  });

  ipcMain.handle('desktop-project-startup', async (event) => {
    assertTrustedSender(event, window);
    isRendererReady = true;
    const startupPath = fileToOpen;
    fileToOpen = null;
    return startupPath ? grantAndReadProject(startupPath) : null;
  });
  ipcMain.handle('desktop-project-open-dialog', async (event) => {
    assertTrustedSender(event, window);
    const selection = await dialog.showOpenDialog(window, {
      title: 'Proje Aç',
      properties: ['openFile'],
      filters: [
        { name: 'StructFlow Project', extensions: ['sfl'] },
        { name: 'Legacy StructFlow Project', extensions: ['sflow'] },
        { name: 'Legacy JSON', extensions: ['json'] },
      ],
    });
    if (selection.canceled || selection.filePaths.length === 0) return { canceled: true };
    return grantAndReadProject(selection.filePaths[0]);
  });
  ipcMain.handle('desktop-project-open-capability', async (event, capabilityId: unknown) => {
    assertTrustedSender(event, window);
    if (typeof capabilityId !== 'string') return openError('invalid-capability', 'Dosya yeteneği geçersiz.');
    const capability = capabilities.resolve(capabilityId, 'project');
    if (!capability) return openError('capability-expired', 'Dosya yeteneğinin süresi dolmuş.');
    return grantAndReadProject(capability.filePath);
  });
  ipcMain.handle('desktop-project-open-recent', async (event, recentId: unknown) => {
    assertTrustedSender(event, window);
    if (typeof recentId !== 'string' || !recentProjects) return openError('invalid-recent-project', 'Son proje seçimi geçersiz.');
    const recent = await recentProjects.get(recentId);
    return recent ? grantAndReadProject(recent.filePath) : openError('recent-project-not-found', 'Son proje bulunamadı.');
  });
  ipcMain.handle('desktop-project-select-save-path', async (event, defaultName: unknown) => {
    assertTrustedSender(event, window);
    const selection = await dialog.showSaveDialog(window, {
      title: 'Projeyi Kaydet',
      defaultPath: typeof defaultName === 'string' && defaultName ? defaultName : 'project.sfl',
      filters: [
        { name: 'StructFlow Project', extensions: ['sfl'] },
      ],
    });
    if (selection.canceled || !selection.filePath) return { canceled: true };
    const capability = capabilities.grant(selection.filePath, 'project');
    return { canceled: false, capabilityId: capability.id, filePath: capability.filePath, fileName: capability.fileName };
  });
  ipcMain.handle('desktop-project-save', async (event, capabilityId: unknown, rawBytes: unknown, rawToken: unknown) => {
    assertTrustedSender(event, window);
    if (typeof capabilityId !== 'string') return { ok: false, errorCode: 'invalid-capability', message: 'Dosya yeteneği geçersiz.' };
    const capability = capabilities.resolve(capabilityId, 'project');
    const bytes = asBytes(rawBytes);
    const token = projectSaveTokenFromUnknown(rawToken);
    if (!capability || !bytes || !token) return { ok: false, errorCode: 'invalid-save-request', message: 'Kaydetme isteği geçersiz.' };
    try {
      assertBoundedSize(bytes.byteLength, FILE_LIMITS.maxProjectInputBytes, 'Proje dosyası');
      const result = await atomicWriter.write(capability.filePath, bytes, token);
      if (!result.written) return { ok: false, errorCode: 'stale-save', message: 'Daha yeni bir proje sürümü zaten kaydedildi.' };
      return { ok: true };
    } catch (error) {
      return { ok: false, errorCode: 'project-save-failed', message: error instanceof Error ? error.message : String(error) };
    }
  });
  ipcMain.handle('desktop-recent-list', async (event) => {
    assertTrustedSender(event, window);
    return recentProjects ? recentProjects.list() : [];
  });
  ipcMain.handle('desktop-recent-remember', async (event, capabilityId: unknown, name: unknown, at: unknown, projectType: unknown) => {
    assertTrustedSender(event, window);
    if (typeof capabilityId !== 'string' || typeof name !== 'string' || typeof at !== 'string' || !recentProjects) return null;
    const capability = capabilities.resolve(capabilityId, 'project');
    if (!capability) return null;
    return recentProjects.remember(capability.filePath, name, at, isProjectType(projectType) ? projectType : undefined);
  });
  ipcMain.handle('desktop-recent-forget', async (event, id: unknown) => {
    assertTrustedSender(event, window);
    if (typeof id === 'string') await recentProjects?.remove(id);
  });
  ipcMain.handle('desktop-report-export-pdf', async (event, rawRequest: unknown) => {
    assertTrustedSender(event, window);
    const request = pdfReportRequestFromUnknown(rawRequest);
    if (!request) return { canceled: false, errorCode: 'invalid-pdf-report', error: 'PDF rapor isteği geçersiz.' };

    const selection = await dialog.showSaveDialog(window, {
      title: 'PDF Raporunu Kaydet',
      defaultPath: safePdfFileName(request.defaultName),
      filters: [{ name: 'PDF Raporu', extensions: ['pdf'] }],
    });
    if (selection.canceled || !selection.filePath) return { canceled: true };

    let reportWindow: BrowserWindow | null = null;
    try {
      reportWindow = new BrowserWindow({
        show: false,
        width: 794,
        height: 1123,
        backgroundColor: '#ffffff',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
        },
      });
      await reportWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(request.html)}`);
      await reportWindow.webContents.executeJavaScript(
        'document.fonts && document.fonts.ready ? document.fonts.ready.then(() => true) : true',
        true,
      );
      const pdf = await reportWindow.webContents.printToPDF({
        pageSize: 'A4',
        landscape: false,
        printBackground: true,
        displayHeaderFooter: false,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      });
      await fs.writeFile(selection.filePath, pdf);
      return { canceled: false, filePath: selection.filePath };
    } catch (error) {
      return {
        canceled: false,
        errorCode: 'pdf-report-export-failed',
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      if (reportWindow && !reportWindow.isDestroyed()) reportWindow.destroy();
    }
  });

  window.on('close', (event) => {
    if (!quitCoordinator?.handleWindowClose()) event.preventDefault();
  });
}

function isProjectType(value: unknown): value is ProjectType {
  return value === 'retaining-wall';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function projectSaveTokenFromUnknown(value: unknown): ProjectSaveToken | null {
  if (!isRecord(value)) return null;
  const documentSessionId = value.documentSessionId;
  const requestSequence = value.requestSequence;
  if (
    typeof documentSessionId !== 'string'
    || documentSessionId.length === 0
    || documentSessionId.length > 128
    || !Number.isSafeInteger(requestSequence)
    || (requestSequence as number) < 1
  ) {
    return null;
  }
  return { documentSessionId, requestSequence: requestSequence as number };
}

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    title: 'StructFlow',
    show: false,
    backgroundColor: WINDOW_TITLEBAR_COLOR,
    webPreferences: { preload: resolvePreloadPath(), nodeIntegration: false, contextIsolation: true },
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: process.platform === 'win32'
      ? { color: WINDOW_TITLEBAR_COLOR, symbolColor: WINDOW_TITLEBAR_SYMBOL_COLOR, height: WINDOW_TITLEBAR_HEIGHT }
      : false,
    autoHideMenuBar: true,
    icon: resolveIconPath(),
  });
  mainWindow = window;
  recentProjects = new RecentProjectStore(path.join(app.getPath('userData'), 'recent-projects.json'), () => `recent-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  window.maximize();
  if (process.platform === 'darwin') window.setWindowButtonVisibility(false);
  registerIpcHandlers(window);
  window.webContents.on('did-finish-load', () => console.log('[Electron] Page loaded:', window.webContents.getURL()));
  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => console.error('[Electron] did-fail-load:', { errorCode, errorDescription, validatedURL }));
  window.webContents.on('render-process-gone', (_event, details) => console.error('[Electron] render-process-gone:', details));
  if (isDev) {
    await window.loadURL('http://localhost:3000');
  } else {
    const indexHtmlPath = resolveIndexHtmlPath();
    try { await fs.access(indexHtmlPath); await window.loadFile(indexHtmlPath); }
    catch (error) {
      console.error('[Electron] Failed to load production file:', error);
      await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<html><body style="font-family:sans-serif;padding:32px"><h1>StructFlow failed to load</h1><pre>${indexHtmlPath}</pre></body></html>`)}`);
    }
  }
}

if (gotTheLock) {
  if (process.platform === 'win32') app.setAppUserModelId('com.structflow.app');
  app.on('before-quit', (event) => quitCoordinator?.handleBeforeQuit(event));
  app.whenReady().then(() => {
    void createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) void createWindow();
    });
  });
  app.on('window-all-closed', () => {
    if (process.platform === 'darwin') return;
    if (quitCoordinator?.getState() !== 'exiting') app.quit();
  });
}
