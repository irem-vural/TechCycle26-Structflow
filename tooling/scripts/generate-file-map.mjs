import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const output = path.join(root, 'docs', 'file-map.md');
const slash = (value) => value.split(path.sep).join('/');
const relative = (value) => slash(path.relative(root, value));

function filesUnder(folder, predicate = () => true) {
  const result = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (predicate(full)) result.push(full);
    }
  };
  walk(path.join(root, folder));
  return result.sort((a, b) => relative(a).localeCompare(relative(b)));
}

function label(file) {
  return path.basename(file, path.extname(file))
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim();
}

const exact = new Map(Object.entries({
  'src/app/page.tsx': 'Next.js ana sayfası; ProjectShell bileşenini açar.',
  'src/app/layout.tsx': 'Root layout; metadata, global stil ve tema aktivasyonunu bağlar.',
  'src/app/globals.css': 'Global CSS giriş noktası ve tema importları.',
  'src/shell/project/ProjectShell.tsx': 'Tek istinat çalışma alanının proje merkezi, sekme, dirty state, hydration ve kapanış orkestrasyonu.',
  'src/shell/project/useProjectPersistence.ts': '.sfl açma/kaydetme, recent projects ve decode worker akışının renderer katmanı.',
  'src/shell/project/projectTabTransition.ts': 'Document session ve save-completion sahipliği için saf sekme geçiş kuralları.',
  'src/shell/project/projectPayloadFactory.ts': 'Yeni istinat projesi payloadı, document session ve güvenli dosya adı yardımcıları.',
  'src/core/workspace/sflowFormat.ts': '.sfl v3 ZIP kapsayıcısını encode/decode eder ve eski istinat JSON biçimlerini okuyabilir.',
  'src/core/workspace/projectSchemas.ts': 'İstinat proje şeması, doğrulama ve v1/v2 → v3 migration sınırı.',
  'src/core/workspace/projectPersistence.ts': 'Proje payload normalizasyonu ve persistence sınırı.',
  'src/core/workspace/projectTypes.ts': 'Tek proje tipi, payload, schema version ve .sfl sabitleri.',
  'src/core/workspace/projectDecodeClient.ts': 'Decode Web Worker istemcisi; öncelik, abort ve yaşam döngüsü.',
  'src/core/workspace/projectDecode.worker.ts': '.sfl parse/migration işini renderer ana thread dışında çalıştırır.',
  'src/core/desktop/desktopContracts.ts': 'Renderer ile Electron main/preload arasındaki sınırlı masaüstü API sözleşmesi.',
  'src/core/standards/aci318-25.ts': 'ACI CODE-318-25 kapsamındaki betonarme kesit/donatı ön tasarım yardımcıları; geoteknik hesap içermez.',
  'src/retaining-wall/index.ts': 'İstinat ürün alanının public facade dosyası.',
  'src/retaining-wall/types.ts': 'Geometri, zemin, stabilite, donatı, metraj, emisyon, maliyet ve senaryo tipleri.',
  'src/retaining-wall/store/useRetainingWallStore.ts': 'İstinat Zustand store; girdiler, hesap sonucu, beton ve görünüm stateini yönetir.',
  'src/retaining-wall/engine/index.ts': 'Hesap pipeline orkestratörü; geometri → basınç → stabilite → donatı → metraj → emisyon → maliyet.',
  'src/retaining-wall/engine/earth-pressure.ts': 'Nihai mimaride Coulomb aktif/pasif yanal toprak basıncı hesabı.',
  'src/retaining-wall/engine/stability.ts': 'Kayma, devrilme, eksantrisite, taban basıncı ve taşıma gücü kontrolleri.',
  'src/retaining-wall/engine/reinforcement.ts': 'Gövde, burun ve topuk için ACI CODE-318-25 kapsamındaki betonarme donatı ön tasarımı.',
  'src/retaining-wall/export/reportModel.ts': 'PDF ve Excel için ortak yöntem, benchmark, kapsam ve rapor metriği tanımları.',
  'src/retaining-wall/engine/quantities.ts': 'Beton, donatı, kalıp, kazı ve dolgu metrajları.',
  'src/retaining-wall/engine/cost.ts': 'Malzeme, işçilik, nakliye, genel gider ve KDV maliyeti.',
  'src/retaining-wall/engine/geometry.ts': 'Kesit geometrisinden alan, hacim ve ağırlık merkezi metrikleri.',
  'src/retaining-wall/engine/validation.ts': 'Geometri/input validasyon hata ve uyarıları.',
  'src/retaining-wall/components/RetainingWallWorkspace.tsx': 'İstinat çalışma alanının üst seviye React bileşeni.',
  'desktop/electron/main.ts': 'Electron main process; güvenli proje I/O, recent projects, pencere ve kapanış yaşam döngüsü.',
  'desktop/electron/preload.ts': 'Sınırlı DesktopApi yüzeyini renderer ortamına açar.',
  'desktop/electron/atomicFileWriter.ts': 'Atomik dosya yazımı ve save-token sıralaması.',
  'desktop/electron/fileCapabilities.ts': 'Proje dosyası capability kimlikleri ve boyut sınırları.',
  'desktop/electron/ipcSecurity.ts': 'IPC sender doğrulaması.',
  'desktop/electron/recentProjectStore.ts': 'Recent project descriptorlarını Electron userData altında saklar.',
  'desktop/electron/quitCoordinator.ts': 'Native kapanış ile renderer dirty-state kararını koordine eder.',
  'tooling/remotion/index.ts': 'Remotion registerRoot giriş noktası.',
  'tooling/remotion/Root.tsx': 'Tanıtım videosu composition tanımı.',
  'tooling/remotion/PromoVideo.tsx': 'Tanıtım videosu sahneleri ve zaman çizelgesi.',
  'tooling/scripts/generate-license-inventory.mjs': 'Kurulu bağımlılıkları tarayıp docs/legal altında lisans envanteri üretir.',
  'tooling/scripts/generate-file-map.mjs': 'Mevcut kaynak ağacından bu dosya haritasını yeniden üretir.',
}));

function describe(rel) {
  if (exact.has(rel)) return exact.get(rel);
  const name = label(rel);
  if (rel.startsWith('src/retaining-wall/__tests__/')) return `İstinat duvarı otomatik testi: ${name}.`;
  if (rel.startsWith('src/retaining-wall/coefficients/')) return `İstinat katsayı veri katmanı: ${name}.`;
  if (rel.startsWith('src/retaining-wall/components/')) return `İstinat kullanıcı arayüzü/görselleştirme bileşeni: ${name}.`;
  if (rel.startsWith('src/retaining-wall/engine/emissions/')) return `Emisyon hesap motoru parçası: ${name}.`;
  if (rel.startsWith('src/retaining-wall/engine/')) return `Mühendislik hesap motoru parçası: ${name}.`;
  if (rel.startsWith('src/retaining-wall/export/')) return `Rapor/dosya dışa aktarım kaynağı: ${name}.`;
  if (rel.startsWith('src/retaining-wall/material-selection/')) return `Beton reçetesi, fiyat veya optimizasyon domain servisi: ${name}.`;
  if (rel.startsWith('src/retaining-wall/sustainable-concrete/')) return `Sürdürülebilir beton veri/hesap/import-export kaynağı: ${name}.`;
  if (rel.startsWith('src/retaining-wall/store/')) return `İstinat state yönetimi kaynağı: ${name}.`;
  if (rel.startsWith('src/components/ui/')) return `Paylaşılan UI primitive/bileşeni: ${name}.`;
  if (rel.startsWith('src/components/structflow/project-hub/')) return `Project Hub kullanıcı arayüzü bileşeni: ${name}.`;
  if (rel.startsWith('src/components/')) return `Paylaşılan React UI bileşeni: ${name}.`;
  if (rel.startsWith('src/core/workspace/')) return `Proje/workspace yaşam döngüsü altyapısı: ${name}.`;
  if (rel.startsWith('src/core/theme/')) return `Tema altyapısı: ${name}.`;
  if (rel.startsWith('src/core/standards/')) return `Mühendislik standardı/katsayı yardımcısı: ${name}.`;
  if (rel.startsWith('src/core/desktop/')) return `Masaüstü ortak sözleşme/yardımcısı: ${name}.`;
  if (rel.startsWith('src/shell/')) return `Uygulama kabuğu ve proje yaşam döngüsü kaynağı: ${name}.`;
  if (rel.startsWith('src/hooks/')) return `Paylaşılan React hook: ${name}.`;
  if (rel.startsWith('src/i18n/')) return `Yerelleştirme sözlüğü/kaynağı: ${name}.`;
  if (rel.startsWith('src/lib/')) return `Paylaşılan uygulama yardımcısı: ${name}.`;
  if (rel.startsWith('src/store/')) return `Uygulama genel Zustand state kaynağı: ${name}.`;
  if (rel.startsWith('src/styles/')) return `Tema/stil kaynağı: ${name}.`;
  if (rel.startsWith('src/types/')) return `Genel TypeScript declaration/tip kaynağı: ${name}.`;
  if (rel.startsWith('desktop/electron/')) return `Electron main-process yardımcısı: ${name}.`;
  if (rel.startsWith('tooling/')) return `Geliştirme/üretim aracı: ${name}.`;
  return `Kaynak dosya: ${name}.`;
}

function assetDescription(rel) {
  const name = label(rel);
  if (rel.startsWith('public/audio/')) return `Tanıtım/medya akışında kullanılan ses varlığı: ${name}.`;
  if (rel.startsWith('public/structflow_svg_icons/')) return `Arayüzde kullanılan SVG ikon varlığı: ${name}.`;
  if (rel.startsWith('public/textures/')) return `İstinat 3B yüzey materyali texture varlığı: ${name}.`;
  const ext = path.extname(rel).toLowerCase();
  if (ext === '.svg') return `Statik SVG arayüz/marka varlığı: ${name}.`;
  if (ext === '.ico') return `Uygulama ikon/favicon varlığı: ${name}.`;
  if (ext === '.png') return `Statik PNG görsel varlığı: ${name}.`;
  return `Statik runtime varlığı: ${name}.`;
}

const lines = [];
const addTable = (title, rows) => {
  if (!rows.length) return;
  lines.push('', `## ${title}`, '', '| Dosya | Sorumluluk |', '|---|---|');
  for (const [file, responsibility] of rows) lines.push(`| \`${file}\` | ${responsibility} |`);
};

lines.push('# StructFlow Dosya Haritası', '');
lines.push('Bu belge mevcut tek-istinat kaynak ağacını yol bazında indeksler. Kaynak kodu tekrar etmez; bir davranışın hangi dosyada bulunduğunu gösterir.', '');
lines.push('> `npm run docs:file-map` komutu ile mevcut disk ağacından yeniden üretilir.');

const rootDescriptions = {
  '.gitignore': 'Build, cache ve geçici dosyaların Git dışında tutulma politikası.',
  'components.json': 'UI component üretim stili ve alias yapılandırması.',
  'eslint.config.mjs': 'ESLint 9 flat config.',
  'next-env.d.ts': 'Next.js TypeScript ortam declaration dosyası.',
  'next.config.ts': 'Web ve Electron static export davranışı.',
  'package-lock.json': 'Kilitli npm bağımlılık ağacı.',
  'package.json': 'Metadata, bağımlılıklar, npm scriptleri ve Electron Builder ayarları.',
  'postcss.config.mjs': 'PostCSS/Tailwind build pipeline yapılandırması.',
  'README.md': 'Ana hızlı başlangıç ve dokümantasyon giriş belgesi.',
  'tsconfig.electron.json': 'Electron TypeScript derleme hedefi.',
  'tsconfig.json': 'Ana TypeScript yapılandırması.',
  'vitest.config.ts': 'Vitest yapılandırması.',
};
addTable('Kök yapılandırma dosyaları', Object.entries(rootDescriptions).sort(([a], [b]) => a.localeCompare(b)));

const source = filesUnder('src', (file) => ['.ts', '.tsx', '.css'].includes(path.extname(file)));
for (const [title, prefix] of [
  ['Next.js App Router', 'src/app/'],
  ['Uygulama Shell', 'src/shell/'],
  ['Ortak Core', 'src/core/'],
  ['İstinat Duvarı', 'src/retaining-wall/'],
  ['Paylaşılan Bileşenler', 'src/components/'],
  ['Hooklar', 'src/hooks/'],
  ['Yerelleştirme', 'src/i18n/'],
  ['Paylaşılan Lib', 'src/lib/'],
  ['Genel Store', 'src/store/'],
  ['Stiller', 'src/styles/'],
  ['Genel Tipler', 'src/types/'],
]) {
  addTable(title, source.map(relative).filter((rel) => rel.startsWith(prefix)).map((rel) => [rel, describe(rel)]));
}

addTable('Desktop / Electron', filesUnder('desktop').map((file) => {
  const rel = relative(file);
  return [rel, path.extname(file) === '.ts' ? describe(rel) : `Electron paketleme/ikon varlığı: ${label(file)}.`];
}));

addTable('Tooling', filesUnder('tooling', (file) => path.basename(file) !== 'README.md').map((file) => {
  const rel = relative(file);
  return [rel, describe(rel)];
}));

lines.push('', '## Public statik varlıklar', '', '| Dosya | Kullanım ailesi |', '|---|---|');
for (const file of filesUnder('public')) {
  const rel = relative(file);
  lines.push(`| \`${rel}\` | ${assetDescription(rel)} |`);
}

addTable('Dokümantasyon dosyaları', filesUnder('docs', (file) => path.dirname(file) === path.join(root, 'docs')).map((file) => {
  const rel = relative(file);
  return [rel, 'Tek-istinat proje teknik dokümantasyonu.'];
}));

lines.push('', '## Artifacts', '', '`artifacts/` kaynak kod değildir. `archive/` geçmiş çıktıları, `generated/` otomatik çıktıları, `workbench/` geçici çalışma materyallerini barındırır.', '');

fs.writeFileSync(output, `${lines.join('\n')}\n`, 'utf8');
console.log(JSON.stringify({
  output: relative(output),
  sourceFiles: source.length,
  desktopFiles: filesUnder('desktop').length,
  toolingFiles: filesUnder('tooling', (file) => path.basename(file) !== 'README.md').length,
  publicFiles: filesUnder('public').length,
}, null, 2));
