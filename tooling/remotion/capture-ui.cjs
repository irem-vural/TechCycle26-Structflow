const { openBrowser } = require('@remotion/renderer');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const CAPTURE_DIR = path.join(PROJECT_ROOT, 'public', 'remotion', 'ui');
const PORT = Number(process.env.STRUCTFLOW_CAPTURE_PORT || 3011);
const BASE_URL = process.env.STRUCTFLOW_CAPTURE_URL || `http://127.0.0.1:${PORT}`;
const VIEWPORT = { width: 1920, height: 1080, deviceScaleFactor: 1 };

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForUrl(url, timeoutMs = 60000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.status >= 200 && response.status < 500) return;
    } catch {
      // Server is still starting.
    }
    await delay(250);
  }
  throw new Error(`StructFlow capture server did not become ready: ${url}`);
}

async function waitFor(page, predicate, label, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      if (await page.evaluate(predicate)) return;
    } catch {
      // Page may be navigating or hydrating.
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function capture(page, name, settleMs = 250) {
  await delay(settleMs);
  const result = await page._client().send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
  });
  const file = path.join(CAPTURE_DIR, `${name}.png`);
  fs.writeFileSync(file, Buffer.from(result.value.data, 'base64'));
  console.log(`[capture-ui] ${name}.png`);
}

async function setCaptureState(page, inputCategory, resultTab) {
  await page.evaluate((input, result) => {
    window.__structflowCapture?.setInputCategory?.(input);
    window.__structflowCapture?.setResultTab?.(result);
  }, inputCategory, resultTab);
}

async function runCapture() {
  fs.mkdirSync(CAPTURE_DIR, { recursive: true });
  for (const file of fs.readdirSync(CAPTURE_DIR)) {
    if (file.endsWith('.png')) fs.rmSync(path.join(CAPTURE_DIR, file));
  }

  let server = null;
  let browser = null;
  try {
    if (!process.env.STRUCTFLOW_CAPTURE_URL) {
      const nextBin = path.join(PROJECT_ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');
      server = spawn(process.platform === 'win32' ? 'node.exe' : 'node', [nextBin, 'start', '-p', String(PORT)], {
        cwd: PROJECT_ROOT,
        env: { ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' },
        stdio: 'ignore',
        windowsHide: true,
      });
    }

    await waitForUrl(BASE_URL);

    browser = await openBrowser('chrome', {
      chromiumOptions: {
        headless: true,
        gl: 'angle',
        darkMode: true,
      },
      forceDeviceScaleFactor: 1,
      logLevel: 'error',
    });

    const page = await browser.newPage({
      context: () => null,
      logLevel: 'error',
      indent: false,
      pageIndex: 0,
      onBrowserLog: null,
      onLog: () => undefined,
    });
    await page.setViewport(VIEWPORT);
    page.setDefaultNavigationTimeout(60000);
    page.setDefaultTimeout(30000);
    await page.goto({ url: `${BASE_URL}/?capture=1`, timeout: 60000 });

    await waitFor(page, () => Boolean(document.querySelector('.splash-root')), 'StructFlow splash');
    await capture(page, '01-splash', 300);

    await waitFor(page, () => Boolean(window.__structflowCapture?.showHub), 'capture bridge');
    await page.evaluate(() => {
      const style = document.createElement('style');
      style.id = 'structflow-remotion-capture-style';
      style.textContent = '.splash-root:not(.project-load-root){display:none!important;pointer-events:none!important}';
      document.head.appendChild(style);
      window.__structflowCapture?.showHub?.();
    });
    await waitFor(page, () => Boolean(document.querySelector('[data-structflow-project-hub]')), 'project hub');
    await capture(page, '02-project-hub', 400);

    await page.evaluate(() => window.__structflowCapture?.openWorkspace?.());
    await waitFor(page, () => Boolean(document.querySelector('#geometry-field-H')), 'geometry workspace', 30000);
    await waitFor(page, () => Boolean(document.querySelector('canvas')), '3D canvas', 30000);
    await waitFor(page, () => Boolean(window.__structflowCapture?.setResultTab), 'result capture bridge', 15000);
    await setCaptureState(page, 'geometry', 'overview');
    await capture(page, '03-workspace-overview', 1500);

    await setCaptureState(page, 'params', 'overview');
    await waitFor(page, () => [...document.querySelectorAll('button')].some((button) => button.textContent?.trim() === 'Zemin' && button.getAttribute('aria-selected') === 'true'), 'soil inputs');
    await capture(page, '04-soil-inputs', 650);

    await setCaptureState(page, 'geometry', 'engineering');
    await waitFor(page, () => [...document.querySelectorAll('button')].some((button) => button.textContent?.trim() === 'Mühendislik' && button.getAttribute('aria-selected') === 'true'), 'engineering results');
    await capture(page, '05-engineering-results', 650);

    await setCaptureState(page, 'concrete', 'sustainability');
    await waitFor(page, () => [...document.querySelectorAll('button')].some((button) => button.textContent?.trim() === 'Sürdürülebilirlik' && button.getAttribute('aria-selected') === 'true'), 'sustainability results');
    await capture(page, '06-sustainability', 750);

    await setCaptureState(page, 'logistics', 'cost-logistics');
    await waitFor(page, () => [...document.querySelectorAll('button')].some((button) => button.textContent?.trim() === 'Maliyet & Lojistik' && button.getAttribute('aria-selected') === 'true'), 'cost and logistics results');
    await capture(page, '07-cost-logistics', 650);

    await setCaptureState(page, 'rebar', 'engineering');
    await waitFor(page, () => [...document.querySelectorAll('button')].some((button) => button.textContent?.trim() === 'Donatı' && button.getAttribute('aria-selected') === 'true'), 'reinforcement inputs');
    await capture(page, '08-reinforcement', 650);

    await setCaptureState(page, 'geometry', 'overview');
    await capture(page, '09-workspace-final', 650);
  } finally {
    if (browser) await browser.close({ silent: true }).catch(() => undefined);
    if (server && !server.killed) server.kill();
  }
}

runCapture().catch((error) => {
  console.error('[capture-ui] failed', error);
  process.exitCode = 1;
});
