const fs = require('fs');
const path = require('path');

const report = JSON.parse(fs.readFileSync(path.resolve('artifacts/generated/dataset-audit/full-audit.json'), 'utf8'));

const anomalies = [];
for (const item of report.cases) {
  for (const [field, value] of Object.entries(item.rawValues || {})) {
    const numeric = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
    if (Number.isFinite(numeric) && numeric > 3000) {
      anomalies.push({ id: item.testId, row: item.sourceRow, name: item.name, field, value });
    }
  }
}

const incomplete = report.cases
  .filter((item) => item.status === 'INCOMPLETE_OUTPUT')
  .map((item) => ({ id: item.testId, row: item.sourceRow, name: item.name, missing: item.missing, rawValues: item.rawValues }));

const groups = new Map();
for (const item of report.cases) {
  const raw = { ...(item.rawValues || {}) };
  delete raw.Link;
  delete raw['Literatür çalışma'];
  delete raw['Karışım No'];
  const key = JSON.stringify(raw);
  groups.set(key, [...(groups.get(key) || []), item.testId]);
}
const duplicateGroups = [...groups.values()].filter((group) => group.length > 1);

const wbOutside = report.cases
  .filter((item) => {
    const ratio = item.keyOutputs?.waterBinderRatio;
    return typeof ratio === 'number' && Number.isFinite(ratio) && (ratio < 0.3 || ratio > 0.7);
  })
  .map((item) => ({ id: item.testId, name: item.name, wb: item.keyOutputs.waterBinderRatio }));

const strengths = report.cases.map((item) => ({
  id: item.testId,
  name: item.name,
  rawStrength: item.rawValues?.['Basınç dayanımı (MPa)'] ?? null,
  normalizedMeasurements: item.normalizedInputs?.compressiveStrengthMeasurements ?? [],
}));

const summary = {
  totals: report.totals,
  anomalies,
  incomplete,
  duplicateGroups,
  wbOutside,
  strengths,
};
fs.writeFileSync(path.resolve('artifacts/generated/dataset-audit/analysis-summary.json'), JSON.stringify(summary, null, 2), 'utf8');
console.log(JSON.stringify({
  totals: summary.totals,
  anomalies: summary.anomalies,
  incomplete: summary.incomplete.map(({ rawValues, ...rest }) => rest),
  duplicateGroups: summary.duplicateGroups,
  wbOutside: summary.wbOutside,
}, null, 2));
