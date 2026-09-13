import { contextBridge, ipcRenderer } from 'electron';
import type {
  DesktopApi,
  DesktopBinary,
  ProjectSaveToken,
} from '../../src/core/desktop/desktopContracts';

const api: DesktopApi = {
  setWindowTheme: (colors) => ipcRenderer.send('desktop-window-theme', colors),
  minimizeWindow: () => ipcRenderer.send('desktop-window-minimize'),
  toggleMaximizeWindow: () => ipcRenderer.send('desktop-window-toggle-maximize'),
  requestWindowClose: () => ipcRenderer.send('desktop-window-request-close'),
  confirmWindowClose: () => ipcRenderer.send('desktop-window-confirm-close'),
  cancelWindowClose: () => ipcRenderer.send('desktop-window-cancel-close'),
  splashReady: () => ipcRenderer.send('desktop-splash-ready'),
  splashFinished: () => ipcRenderer.send('desktop-splash-finished'),
  getStartupProject: () => ipcRenderer.invoke('desktop-project-startup'),
  openProjectDialog: () => ipcRenderer.invoke('desktop-project-open-dialog'),
  openProjectCapability: (capabilityId: string) => ipcRenderer.invoke('desktop-project-open-capability', capabilityId),
  openRecentProject: (recentId: string) => ipcRenderer.invoke('desktop-project-open-recent', recentId),
  selectProjectSavePath: (defaultName?: string) => ipcRenderer.invoke('desktop-project-select-save-path', defaultName),
  saveProject: (capabilityId: string, bytes: DesktopBinary, token: ProjectSaveToken) =>
    ipcRenderer.invoke('desktop-project-save', capabilityId, bytes, token),
  listRecentProjects: () => ipcRenderer.invoke('desktop-recent-list'),
  rememberRecentProject: (capabilityId, name, at, projectType) =>
    ipcRenderer.invoke('desktop-recent-remember', capabilityId, name, at, projectType),
  forgetRecentProject: (id: string) => ipcRenderer.invoke('desktop-recent-forget', id),
  exportPdfReport: (request) => ipcRenderer.invoke('desktop-report-export-pdf', request),
  onProjectOpenRequest: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, capabilityId: string) => callback(capabilityId);
    ipcRenderer.on('desktop-project-open-request', listener);
    return () => ipcRenderer.removeListener('desktop-project-open-request', listener);
  },
  onCloseRequest: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('desktop-close-request', listener);
    return () => ipcRenderer.removeListener('desktop-close-request', listener);
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
