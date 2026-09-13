const { openBrowser } = require('@remotion/renderer');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const SOURCE = path.join(ROOT, 'artifacts', 'generated', 'dataset-audit', 'full-audit.json');
const OUT_DIR = path.join(ROOT, 'artifacts', 'generated', 'ui-dataset-audit');
const OUT_JSON = path.join(OUT_DIR, 'ui-audit.json');
const PORT = Number(process.env.STRUCTFLOW_UI_AUDIT_PORT || 3013);
const BASE_URL = process.env.STRUCTFLOW_UI_AUDIT_URL || `http://127.0.0.1:${PORT}`;
const LIMIT = Math.max(0, Number(process.argv[2] || process.env.STRUCTFLOW_UI_AUDIT_LIMIT || 0));
const START_INDEX = Math.max(0, Number(process.argv[3] || process.env.STRUCTFLOW_UI_AUDIT_START || 0));

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForUrl(url, timeoutMs = 90000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.status >= 200 && response.status < 500) return;
    } catch {}
    await delay(250);
  }
  throw new Error(`UI audit server did not become ready: ${url}`);
}

async function waitFor(page, predicate, label, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      if (await page.evaluate(predicate)) return;
    } catch {}
    await delay(50);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function nonZero(value) {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) > 1e-9;
}

function sourceOnlyFields(input) {
  const fields = [];
  if (nonZero(input.lightweightAggregateKgM3)) fields.push({ field: 'Hafif agrega', value: input.lightweightAggregateKgM3, reason: 'Programın beton malzeme kataloğunda hafif agrega için doğrudan dozaj girdisi yok.' });
  if (nonZero(input.heavyweightAggregateKgM3)) fields.push({ field: 'Ağır agrega', value: input.heavyweightAggregateKgM3, reason: 'Programın beton malzeme kataloğunda ağır agrega için doğrudan dozaj girdisi yok.' });
  if (nonZero(input.acceleratorRetarderKgM3)) fields.push({ field: 'Priz hızlandırıcı/geciktirici', value: input.acceleratorRetarderKgM3, reason: 'Kaynak tek bir birleşik alan veriyor; program hızlandırıcı ve geciktiriciyi ayrı girdiler olarak tutuyor. Tür uydurulmadı.' });
  if (nonZero(input.fiberKgM3)) fields.push({ field: 'Fiber', value: input.fiberKgM3, reason: 'Kaynak fiber türünü belirtmiyor; program çelik/PP/cam/diğer fiberi ayrı girdiler olarak tutuyor. Tür uydurulmadı.' });
  return fields;
}

const FIELD_TO_MATERIAL = [
  ['cementKgM3', 'cement'],
  ['flyAshKgM3', 'fly_ash'],
  ['ggbfsKgM3', 'slag'],
  ['silicaFumeKgM3', 'silica_fume'],
  ['metakaolinKgM3', 'metakaolin'],
  ['naturalFineAggregateKgM3', 'natural_fine_aggregate'],
  ['naturalCoarseAggregateKgM3', 'natural_coarse_aggregate'],
  ['recycledAggregateUnspecifiedKgM3', 'recycled_aggregate_unspecified'],
  ['recycledFineAggregateKgM3', 'recycled_fine_aggregate'],
  ['recycledCoarseAggregateKgM3', 'recycled_coarse_aggregate'],
  ['waterKgM3', 'water'],
  ['sodiumHydroxideKgM3', 'sodium_hydroxide'],
  ['sodiumSilicateKgM3', 'sodium_silicate'],
  ['alkaliActivatorKgM3', 'alkali_activator'],
  ['superplasticizerKgM3', 'superplasticizer'],
  // Hava sürükleyici katkı dozajı malzeme satırıdır; hedef hava yüzdesi ayrı UI girdisidir.
  ['airEntrainingKgM3', 'air_entraining'],
];

async function prepareConcreteUi(page) {
  await page.evaluate(() => window.__structflowCapture?.setInputCategory?.('concrete'));
  await waitFor(page, () => [...document.querySelectorAll('button[role="tab"]')].some((b) => b.textContent?.trim() === 'Beton' && b.getAttribute('aria-selected') === 'true'), 'concrete tab');

  const materialIds = FIELD_TO_MATERIAL.map(([, id]) => id);
  await page.evaluate(async (ids) => {
    const frame = () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
    for (const id of ids) {
      const enable = document.querySelector(`[data-enable-material-id="${id}"]`);
      if (enable instanceof HTMLButtonElement) {
        enable.click();
        await frame();
        await frame();
      }
    }
    for (const id of ids) {
      const select = document.querySelector(`[data-material-unit="${id}"]`);
      if (!(select instanceof HTMLSelectElement)) continue;
      if (select.value !== 'kg/m³') {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(select, 'kg/m³');
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));
        await frame();
        await frame();
      }
    }
  }, materialIds);
}

async function applyCaseInputs(page, input) {
  return page.evaluate(async ({ pairs, normalized, measurement }) => {
    const frame = () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
    const setInput = async (selector, value) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLInputElement)) return { ok: false, reason: 'input_not_found', selector };
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      const text = value == null ? '' : String(value);
      setter?.call(element, text);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      await frame();
      await frame();
      const current = document.querySelector(selector);
      return { ok: current instanceof HTMLInputElement, value: current instanceof HTMLInputElement ? current.value : null };
    };

    const errors = [];
    // First clear every supported UI field. This is deliberately a separate
    // pass: normalizeConcreteMix may migrate legacy/general RCA into explicit
    // coarse RCA after an input event, so writing a later source-null field as
    // zero could otherwise erase a value that the program itself just migrated.
    for (const [field, materialId] of pairs) {
      const result = await setInput(`[data-material-dose="${materialId}"]`, 0);
      if (!result.ok) errors.push(`${field}/${materialId}: ${result.reason}`);
    }
    // Then apply only actual non-zero source values. Zero/null values are
    // already cleared above and must not overwrite program-side migrations.
    for (const [field, materialId] of pairs) {
      const expected = normalized[field];
      const target = expected == null || !Number.isFinite(Number(expected)) ? 0 : Number(expected);
      if (Math.abs(target) <= 1e-12) continue;
      const result = await setInput(`[data-material-dose="${materialId}"]`, target);
      if (!result.ok) errors.push(`${field}/${materialId}: ${result.reason}`);
    }

    const airTarget = await setInput('[data-air-target-input]', normalized.airTargetContentPercent ?? null);
    if (!airTarget.ok) errors.push(`airTargetContentPercent: ${airTarget.reason}`);

    // Remove catalog/default strength measurements and enter only the source measurement for this experiment.
    for (;;) {
      const remove = document.querySelector('button[title="Deney kaydını kaldır"]');
      if (!(remove instanceof HTMLButtonElement)) break;
      remove.click();
      await frame();
      await frame();
    }
    if (measurement && Number.isFinite(Number(measurement.valueMpa)) && Number(measurement.valueMpa) > 0) {
      const add = [...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Deney sonucu ekle');
      if (add instanceof HTMLButtonElement) {
        add.click();
        await frame();
        await frame();
        if (measurement.ageDays != null) await setInput('input[title="Deney yaşı (gün)"]', measurement.ageDays);
        await setInput('input[title="Basınç dayanımı"]', measurement.valueMpa);
        if (measurement.source) await setInput('input[placeholder="Deney kaynağı"]', measurement.source);
        if (measurement.sourceUrl) await setInput('input[placeholder="Kaynak bağlantısı"]', measurement.sourceUrl);
        if (measurement.sourceRow != null) await setInput('input[placeholder="Kaynak satırı"]', measurement.sourceRow);
      } else {
        errors.push('strength: add_button_not_found');
      }
    }

    // Final readback is taken after all React/Zustand normalization has run.
    // This is the value that is actually left visible in the program UI.
    const readback = {};
    for (const [field, materialId] of pairs) {
      const current = document.querySelector(`[data-material-dose="${materialId}"]`);
      readback[field] = current instanceof HTMLInputElement && current.value !== '' ? Number(current.value) : null;
    }
    const airTargetInput = document.querySelector('[data-air-target-input]');
    readback.airTargetContentPercent = airTargetInput instanceof HTMLInputElement && airTargetInput.value !== '' ? Number(airTargetInput.value) : null;

    const warnings = [...document.querySelectorAll('[data-mix-issue-box="warning"] [data-mix-issue-message]')]
      .map((item) => item.textContent?.trim() ?? '')
      .filter(Boolean);
    const lockedText = [...document.querySelectorAll('[role="alert"]')].map((el) => el.textContent?.trim() ?? '').find((text) => text.includes('Sonuçlar kilitli')) ?? '';
    return { readback, errors, warnings, lockedText };
  }, { pairs: FIELD_TO_MATERIAL, normalized: input, measurement: input.compressiveStrengthMeasurements?.[0] ?? null });
}

async function clickCalculate(page) {
  const clicked = await page.evaluate(() => {
    const button = document.querySelector('button[title="Hesabı yenile"]');
    if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
    button.click();
    return true;
  });
  if (!clicked) return { clicked: false, blocked: true, message: 'Hesabı yenile butonu bulunamadı veya devre dışı.' };
  try {
    await waitFor(page, () => ![...document.querySelectorAll('[role="alert"]')].some((el) => (el.textContent ?? '').includes('Sonuçlar kilitli')), 'fresh calculated result', 10000);
  } catch {
    const message = await page.evaluate(() => [...document.querySelectorAll('[role="alert"]')].map((el) => el.textContent?.trim() ?? '').join(' | '));
    return { clicked: true, blocked: true, message };
  }
  return { clicked: true, blocked: false, message: '' };
}

async function readResultTab(page, label) {
  const action = await page.evaluate((wanted) => {
    const buttons = [...document.querySelectorAll('button[role="tab"]')];
    const button = buttons.find((item) => item.textContent?.trim() === wanted);
    if (button instanceof HTMLButtonElement && !button.disabled) {
      button.click();
      return { found: true, disabled: false, tabs: buttons.map((item) => ({ text: item.textContent?.trim(), selected: item.getAttribute('aria-selected'), disabled: item.disabled })) };
    }
    return { found: Boolean(button), disabled: button instanceof HTMLButtonElement ? button.disabled : null, tabs: buttons.map((item) => ({ text: item.textContent?.trim(), selected: item.getAttribute('aria-selected'), disabled: item.disabled })) };
  }, label);
  if (!action.found || action.disabled) throw new Error(`Result tab unavailable: ${label}; ${JSON.stringify(action)}`);
  await delay(120);
  const snapshot = await page.evaluate((wanted) => {
    const excel = [...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Excel');
    const root = excel?.closest('.sf-engineering-tabular');
    const selected = [...document.querySelectorAll('button[role="tab"]')].find((item) => item.textContent?.trim() === wanted)?.getAttribute('aria-selected');
    const headings = root ? [...root.querySelectorAll('h1,h2,h3')].map((item) => item.textContent?.trim() ?? '') : [];
    return { text: root?.innerText?.trim() ?? '', selected, headings };
  }, label);
  if (!snapshot.text) throw new Error(`Result panel text unavailable: ${label}; selected=${snapshot.selected}; headings=${JSON.stringify(snapshot.headings)}`);
  return snapshot.text;
}

function approxEqual(a, b) {
  if (a == null && (b == null || b === 0)) return true;
  if (b == null && (a == null || a === 0)) return true;
  const x = Number(a);
  const y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  return Math.abs(x - y) <= Math.max(1e-6, Math.abs(x) * 1e-8);
}

function buildInputMismatches(input, readback) {
  const mismatches = [];
  const normalizations = [];
  const generalRca = Number(input.recycledAggregateUnspecifiedKgM3 ?? 0);
  const sourceCoarseRca = Number(input.recycledCoarseAggregateKgM3 ?? 0);
  const uiGeneralRca = Number(readback.recycledAggregateUnspecifiedKgM3 ?? 0);
  const uiCoarseRca = Number(readback.recycledCoarseAggregateKgM3 ?? 0);
  const generalRcaMigrated = generalRca > 0
    && sourceCoarseRca <= 0
    && approxEqual(uiGeneralRca, 0)
    && approxEqual(uiCoarseRca, generalRca);
  if (generalRcaMigrated) {
    normalizations.push({
      sourceField: 'recycledAggregateUnspecifiedKgM3',
      sourceValue: generalRca,
      uiField: 'recycledCoarseAggregateKgM3',
      uiValue: uiCoarseRca,
      note: 'Program genel/legacy RCA dozajını otomatik olarak geri dönüştürülmüş iri agrega alanına taşıdı.',
    });
  }
  for (const [field] of FIELD_TO_MATERIAL) {
    if (generalRcaMigrated && (field === 'recycledAggregateUnspecifiedKgM3' || field === 'recycledCoarseAggregateKgM3')) continue;
    const expected = input[field] == null ? 0 : Number(input[field]);
    const actual = readback[field] == null ? 0 : Number(readback[field]);
    if (!approxEqual(expected, actual)) mismatches.push({ field, expected, actual });
  }
  if (!approxEqual(input.airTargetContentPercent ?? null, readback.airTargetContentPercent ?? null)) {
    mismatches.push({
      field: 'airTargetContentPercent',
      expected: input.airTargetContentPercent ?? null,
      actual: readback.airTargetContentPercent ?? null,
    });
  }
  return { mismatches, normalizations };
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const source = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
  let server = null;
  let browser = null;
  const browserLogs = [];
  try {
    if (!process.env.STRUCTFLOW_UI_AUDIT_URL) {
      const nextBin = path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');
      server = spawn(process.platform === 'win32' ? 'node.exe' : 'node', [nextBin, 'start', '-p', String(PORT)], {
        cwd: ROOT,
        env: { ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' },
        stdio: 'ignore',
        windowsHide: true,
      });
    }
    await waitForUrl(BASE_URL);
    browser = await openBrowser('chrome', {
      chromiumOptions: { headless: true, gl: 'angle', darkMode: true },
      forceDeviceScaleFactor: 1,
      logLevel: 'error',
    });
    const page = await browser.newPage({
      context: () => null,
      logLevel: 'error',
      indent: false,
      pageIndex: 0,
      onBrowserLog: (log) => browserLogs.push(String(log?.text ?? log)),
      onLog: () => undefined,
    });
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    page.setDefaultNavigationTimeout(90000);
    page.setDefaultTimeout(30000);
    await page.goto({ url: `${BASE_URL}/?capture=1`, timeout: 90000 });
    await waitFor(page, () => Boolean(window.__structflowCapture?.openWorkspace), 'capture bridge', 45000);
    await page.evaluate(() => window.__structflowCapture?.openWorkspace?.());
    await waitFor(page, () => Boolean(document.querySelector('#geometry-field-H')), 'workspace', 45000);
    await prepareConcreteUi(page);

    const cases = [];
    const endIndex = LIMIT > 0 ? Math.min(START_INDEX + LIMIT, source.cases.length) : source.cases.length;
    for (let index = START_INDEX; index < endIndex; index += 1) {
      const src = source.cases[index];
      const started = Date.now();
      const unsupported = sourceOnlyFields(src.normalizedInputs ?? {});
      let uiInput = { readback: {}, errors: ['not_run'], warnings: [], lockedText: '' };
      let calculation = { clicked: false, blocked: true, message: 'not_run' };
      let overviewText = '';
      let engineeringText = '';
      let sustainabilityText = '';
      let costLogisticsText = '';
      let exception = null;
      try {
        uiInput = await applyCaseInputs(page, src.normalizedInputs ?? {});
        calculation = await clickCalculate(page);
        if (!calculation.blocked) {
          overviewText = await readResultTab(page, 'Genel Bakış');
          engineeringText = await readResultTab(page, 'Mühendislik');
          sustainabilityText = await readResultTab(page, 'Sürdürülebilirlik');
          costLogisticsText = await readResultTab(page, 'Maliyet & Lojistik');
        }
      } catch (error) {
        exception = error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) };
      }
      const inputCheck = buildInputMismatches(src.normalizedInputs ?? {}, uiInput.readback ?? {});
      const mismatches = inputCheck.mismatches;
      const resultWarningMatch = overviewText.match(/(\d+)\s+uyarı/);
      const resultWarningCount = resultWarningMatch ? Number(resultWarningMatch[1]) : 0;
      const incompleteData = /Veri durumu\s+Eksik/i.test(sustainabilityText)
        || /Eksik faktör\/miktar/i.test(sustainabilityText)
        || /Fiyat verisi eksik|Malzeme miktarı çözümlenemedi/i.test(`${overviewText}\n${costLogisticsText}`);
      const status = exception ? 'UI_EXCEPTION'
        : uiInput.errors.length > 0 ? 'UI_INPUT_ERROR'
          : mismatches.length > 0 ? 'UI_INPUT_MISMATCH'
            : calculation.blocked ? 'UI_CALC_BLOCKED'
              : incompleteData ? 'UI_COMPLETED_INCOMPLETE_DATA'
                : resultWarningCount > 0 || uiInput.warnings.length > 0 || unsupported.length > 0 ? 'UI_COMPLETED_WITH_WARNINGS'
                  : 'UI_COMPLETED';

      const record = {
        testId: src.testId,
        order: src.order,
        sourceRow: src.sourceRow,
        mixNo: src.mixNo,
        name: src.name,
        literatureStudy: src.literatureStudy,
        sourceUrl: src.sourceUrl,
        rawValues: src.rawValues,
        intendedInputs: src.normalizedInputs,
        uiReadback: uiInput.readback,
        inputMismatches: mismatches,
        uiNormalizations: inputCheck.normalizations,
        uiInputErrors: uiInput.errors,
        inputPanelWarnings: uiInput.warnings,
        unsupportedSourceFields: unsupported,
        lockedBeforeCalculate: uiInput.lockedText,
        calculation,
        resultWarningCount,
        incompleteData,
        status,
        overviewText,
        engineeringText,
        sustainabilityText,
        costLogisticsText,
        exception,
        elapsedMs: Date.now() - started,
      };
      cases.push(record);
      console.log(`[ui-audit] ${record.testId} ${record.status} mismatch=${mismatches.length} unsupported=${unsupported.length} warnings=${resultWarningCount}`);
      fs.writeFileSync(OUT_JSON, JSON.stringify({ generatedAt: new Date().toISOString(), sourceDataset: source.selectedDataset, cases }, null, 2), 'utf8');
      await page.evaluate(() => window.__structflowCapture?.setInputCategory?.('concrete'));
    }

    const statusCounts = cases.reduce((acc, item) => ((acc[item.status] = (acc[item.status] ?? 0) + 1), acc), {});
    const report = {
      generatedAt: new Date().toISOString(),
      method: 'Actual StructFlow UI automation: DOM inputs -> React input/change events -> UI readback -> Results refresh button -> four result tabs scraped from rendered DOM.',
      sourceDataset: source.selectedDataset,
      totals: {
        cases: cases.length,
        statusCounts,
        uiExceptions: cases.filter((x) => x.status === 'UI_EXCEPTION').length,
        uiInputErrors: cases.filter((x) => x.status === 'UI_INPUT_ERROR').length,
        uiInputMismatches: cases.filter((x) => x.status === 'UI_INPUT_MISMATCH').length,
        uiCalcBlocked: cases.filter((x) => x.status === 'UI_CALC_BLOCKED').length,
        incompleteData: cases.filter((x) => x.incompleteData).length,
        casesWithUnsupportedSourceFields: cases.filter((x) => x.unsupportedSourceFields.length > 0).length,
        casesWithAirEntrainingDose: cases.filter((x) => nonZero(x.intendedInputs?.airEntrainingKgM3)).length,
        casesWithAirTargetSource: cases.filter((x) => nonZero(x.intendedInputs?.airTargetContentPercent)).length,
      },
      browserLogs: [...new Set(browserLogs)].slice(-200),
      cases,
    };
    fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2), 'utf8');
    fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify({ generatedAt: report.generatedAt, method: report.method, sourceDataset: report.sourceDataset, totals: report.totals }, null, 2), 'utf8');
    console.log(JSON.stringify(report.totals, null, 2));
    const hardFailures = report.totals.uiExceptions
      + report.totals.uiInputErrors
      + report.totals.uiInputMismatches
      + report.totals.uiCalcBlocked
      + report.totals.incompleteData;
    if (hardFailures > 0) {
      throw new Error(`UI dataset audit failed with ${hardFailures} hard failure(s). See ${OUT_JSON}.`);
    }
  } finally {
    if (browser) await browser.close({ silent: true }).catch(() => undefined);
    if (server && !server.killed) server.kill();
  }
}

run().catch((error) => {
  console.error('[ui-audit] failed', error);
  process.exitCode = 1;
});
