import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const nodeModulesRoot = path.join(root, 'node_modules');
const rootPackagePath = path.join(root, 'package.json');
const lockfilePath = path.join(root, 'package-lock.json');

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function sha256(filePath) {
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  } catch {
    return null;
  }
}

function relativePath(filePath) {
  return path.relative(root, filePath).split(path.sep).join('/');
}

function licenseValue(meta) {
  if (typeof meta?.license === 'string') return meta.license;
  if (meta?.license && typeof meta.license === 'object') {
    if (typeof meta.license.type === 'string') return meta.license.type;
    if (typeof meta.license.name === 'string') return meta.license.name;
  }
  if (Array.isArray(meta?.licenses)) {
    return meta.licenses.map((item) => {
      if (typeof item === 'string') return item;
      return item?.type || item?.name || item?.url || null;
    }).filter(Boolean).join(' OR ');
  }
  return 'UNKNOWN';
}

function findLicenseFiles(packageDir) {
  try {
    return fs.readdirSync(packageDir)
      .filter((name) => /^(licen[cs]e|copying|notice|readme)(\.|$)/i.test(name))
      .sort();
  } catch {
    return [];
  }
}

function recordPackage(packageJsonPath, records) {
  const meta = readJson(packageJsonPath);
  if (!meta?.name || !meta?.version) return;
  const packageDir = path.dirname(packageJsonPath);
  const key = `${meta.name}@${meta.version}`;
  const existing = records.get(key);
  const record = existing || {
    name: meta.name,
    version: meta.version,
    license: licenseValue(meta),
    repository: typeof meta.repository === 'string' ? meta.repository : (meta.repository?.url || null),
    homepage: meta.homepage || null,
    paths: [],
    licenseFiles: findLicenseFiles(packageDir),
    scopes: [],
  };
  const installPath = relativePath(packageDir);
  if (!record.paths.includes(installPath)) record.paths.push(installPath);
  records.set(key, record);
}

function walkAllPackageDirectories(dir, records) {
  if (!fs.existsSync(dir)) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === '.bin') continue;
    const entryPath = path.join(dir, entry.name);
    const packageJsonPath = path.join(entryPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) recordPackage(packageJsonPath, records);
    walkAllPackageDirectories(entryPath, records);
  }
}

function dependencyNames(field) {
  return new Set(Object.keys(field || {}));
}

function classify(record, runtimeNames, devNames) {
  const isRuntime = runtimeNames.has(record.name);
  const isDev = devNames.has(record.name);
  if (isRuntime && isDev) return 'direct runtime + dev';
  if (isRuntime) return 'direct runtime';
  if (isDev) return 'direct dev';
  return 'transitive';
}

function flagReasons(license) {
  const value = String(license || 'UNKNOWN');
  const reasons = [];
  if (/Hippocratic/i.test(value)) reasons.push('Hippocratic-2.1 / use restriction requires legal review');
  if (/AGPL/i.test(value)) reasons.push('AGPL copyleft');
  if (/(?<!A)GPL/i.test(value)) reasons.push('GPL copyleft or dual-license option');
  if (/LGPL/i.test(value)) reasons.push('LGPL notice/linking obligations');
  if (/Remotion/i.test(value) || /SEE LICENSE/i.test(value)) reasons.push('vendor/custom license text must be reviewed');
  if (/MPL/i.test(value)) reasons.push('MPL file-level copyleft');
  if (/CC-BY/i.test(value)) reasons.push('attribution required');
  if (/UNKNOWN/i.test(value)) reasons.push('license not declared in package metadata');
  if (/WTFPL|Unlicense|BlueOak|Python-2\.0/i.test(value)) reasons.push('non-standard or permissive license text requires notice review');
  if (/\s(?:OR|AND)\s|\(|\)/i.test(value) && reasons.length === 0) reasons.push('multiple license choices or combined obligations');
  return reasons;
}

function escapeMarkdown(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

const rootPackage = readJson(rootPackagePath) || {};
const runtimeNames = dependencyNames(rootPackage.dependencies);
const devNames = dependencyNames(rootPackage.devDependencies);
const records = new Map();
walkAllPackageDirectories(nodeModulesRoot, records);

const packages = [...records.values()]
  .map((record) => ({
    ...record,
    scope: classify(record, runtimeNames, devNames),
    flagReasons: flagReasons(record.license),
    paths: [...record.paths].sort(),
  }))
  .sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));

const licenseSummary = {};
for (const record of packages) licenseSummary[record.license] = (licenseSummary[record.license] || 0) + 1;

const generatedAt = new Date().toISOString();
const metadata = {
  generatedAt,
  project: rootPackage.name || 'unknown',
  projectVersion: rootPackage.version || null,
  packageJsonSha256: sha256(rootPackagePath),
  packageLockSha256: sha256(lockfilePath),
  installedPackageManifestCount: packages.length,
  directRuntimeCount: runtimeNames.size,
  directDevCount: devNames.size,
  flaggedPackageRecordCount: packages.filter((record) => record.flagReasons.length > 0).length,
  method: 'Recursive scan of installed node_modules package.json files; one row per unique package name@version, with all install paths retained.',
};

const jsonOutput = {
  metadata,
  licenseSummary,
  packages,
};

const legalDocsRoot = path.join(root, 'docs', 'legal');
fs.mkdirSync(legalDocsRoot, { recursive: true });
const outputJsonPath = path.join(legalDocsRoot, 'THIRD-PARTY-NOTICES.json');
const outputMarkdownPath = path.join(legalDocsRoot, 'THIRD-PARTY-NOTICES.md');
fs.writeFileSync(outputJsonPath, `${JSON.stringify(jsonOutput, null, 2)}\n`, 'utf8');

const summaryRows = Object.entries(licenseSummary)
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

const directPackages = packages.filter((record) => record.scope !== 'transitive');
const flaggedPackages = packages.filter((record) => record.flagReasons.length > 0);

const lines = [];
lines.push('# THIRD-PARTY-NOTICES — StructFlow');
lines.push('');
lines.push('Bu dosya, `node_modules` altında kurulu paket manifestlerinin otomatik envanteridir. Ana raporun eki olarak tutulur; lisans metinlerinin kendisi paket klasörlerindeki `LICENSE`, `COPYING`, `NOTICE` veya benzeri dosyalardan ayrıca doğrulanmalıdır.');
lines.push('');
lines.push(`- Tarama tarihi: ${generatedAt}`);
lines.push(`- Proje: ${metadata.project}${metadata.projectVersion ? ` ${metadata.projectVersion}` : ''}`);
lines.push(`- Benzersiz paket adı/sürüm kaydı: ${metadata.installedPackageManifestCount}`);
lines.push(`- Doğrudan çalışma zamanı bağımlılığı: ${metadata.directRuntimeCount}`);
lines.push(`- Doğrudan geliştirme bağımlılığı: ${metadata.directDevCount}`);
lines.push(`- Lisans/notice incelemesi işaretli kayıt: ${metadata.flaggedPackageRecordCount}`);
lines.push('- package.json SHA-256: `' + (metadata.packageJsonSha256 || 'N/A') + '`');
lines.push('- package-lock.json SHA-256: `' + (metadata.packageLockSha256 || 'N/A') + '`');
lines.push('');
lines.push('## Lisans dağılımı');
lines.push('');
lines.push('| Lisans beyanı | Benzersiz kayıt |');
lines.push('|---|---:|');
for (const [license, count] of summaryRows) lines.push(`| ${escapeMarkdown(license)} | ${count} |`);
lines.push('');
lines.push('## Doğrudan bağımlılıklar');
lines.push('');
lines.push('| Paket | Sürüm | Kapsam | Lisans |');
lines.push('|---|---|---|---|');
for (const record of directPackages) {
  lines.push(`| ${escapeMarkdown(record.name)} | ${escapeMarkdown(record.version)} | ${escapeMarkdown(record.scope)} | ${escapeMarkdown(record.license)} |`);
}
lines.push('');
lines.push('## İnceleme gerektiren kayıtlar');
lines.push('');
lines.push('Aşağıdaki kayıtlar copyleft, attribution, özel/ticari lisans, bilinmeyen lisans veya çoklu lisans seçeneği nedeniyle teslim öncesi ayrıca değerlendirilmelidir.');
lines.push('');
lines.push('| Paket | Sürüm | Kapsam | Lisans | Gerekçe |');
lines.push('|---|---|---|---|---|');
for (const record of flaggedPackages) {
  lines.push(`| ${escapeMarkdown(record.name)} | ${escapeMarkdown(record.version)} | ${escapeMarkdown(record.scope)} | ${escapeMarkdown(record.license)} | ${escapeMarkdown(record.flagReasons.join('; '))} |`);
}
lines.push('');
lines.push('## Eksiksiz kurulu paket envanteri');
lines.push('');
lines.push('| Paket | Sürüm | Kapsam | Lisans | Kurulum yolu | Lisans dosyaları | Repository |');
lines.push('|---|---|---|---|---|---|---|');
for (const record of packages) {
  const paths = record.paths.join('<br>');
  const licenseFiles = record.licenseFiles.length ? record.licenseFiles.join('<br>') : '—';
  const repository = record.repository || record.homepage || '—';
  lines.push(`| ${escapeMarkdown(record.name)} | ${escapeMarkdown(record.version)} | ${escapeMarkdown(record.scope)} | ${escapeMarkdown(record.license)} | ${escapeMarkdown(paths)} | ${escapeMarkdown(licenseFiles)} | ${escapeMarkdown(repository)} |`);
}
lines.push('');
lines.push('## Kullanım notu');
lines.push('');
lines.push('Bu ek, kurulu bağımlılık ağacını belgelemek için hazırlanmıştır. Nihai dağıtımda gerçekten paketlenen dosyalar ayrıca kontrol edilmeli; Electron paketine girmeyen geliştirme araçları, opsiyonel ikililer ve sadece build sırasında kullanılan paketler ana rapordaki kapsam tablosunda doğru şekilde sınıflandırılmalıdır.');
lines.push('');

fs.writeFileSync(outputMarkdownPath, `${lines.join('\n')}\n`, 'utf8');
console.log(JSON.stringify({ outputMarkdownPath, outputJsonPath, metadata }, null, 2));
