# TEKNOFEST 10.4 — Açık Kaynak ve Lisans Uygunluğu

## Kapsam

Bu rapor mevcut **StructFlow — İstinat Duvarı Analiz & Tasarım** reposunun üçüncü taraf yazılım, API/veri ve statik varlık kapsamını özetler. Kaynak kapsamı yalnız `src/retaining-wall/`, ortak `src/core/` / `src/shell/` altyapısı, `desktop/electron/`, `public/` ve `tooling/` alanlarıdır.

Ana projenin kullanım hakları repository kökündeki `LICENSE` dosyasında tanımlanır. Bu teknik uygunluk raporu, ana proje veya üçüncü taraf bileşenler için ek bir kullanım hakkı ya da açık kaynak lisansı vermez.

## Yazılım bağımlılıkları

Kurulu npm bağımlılıklarının makine okunabilir ve insan okunabilir tam envanteri şu dosyalarda tutulur:

- `THIRD-PARTY-NOTICES.json`
- `THIRD-PARTY-NOTICES.md`

Envanter `npm run licenses:inventory` komutuyla `package.json`, `package-lock.json` ve kurulu `node_modules` ağacından yeniden üretilir. Teslimden önce temiz `npm ci` kurulumu üzerinden tekrar çalıştırılmalıdır.

## Harita ve dış servisler

İstinat lojistik ekranı `src/retaining-wall/components/MapComponent.tsx` üzerinden OpenStreetMap tile verisini kullanır ve görünür attribution gösterir. Leaflet marker görselleri çalışma zamanında cdnjs üzerinden çağrılır.

Harita/veri kullanım koşulları yazılım paket lisanslarından ayrı değerlendirilmelidir. Teslimde kullanılan dış servislerin kullanım şartları, attribution gereklilikleri ve erişim politikaları ayrıca doğrulanmalıdır.

## Mühendislik ve çevresel veri kaynakları

Emisyon/katsayı kaynak metadata'sı `src/retaining-wall/coefficients/defaults.ts` içinde kaynak adı/URL alanlarıyla tutulur. Beton reçetesi ve sürdürülebilirlik verilerinin provenance bilgisi ilgili `material-selection/` ve `sustainable-concrete/` alanlarında korunmalıdır.

## Statik varlıklar

Runtime statik varlıkları `public/` altındadır:

- `public/textures/` — istinat 3B yüzey materyalleri,
- `public/structflow_svg_icons/` — arayüz ikonları,
- `public/audio/` — tanıtım medyası,
- logo/favicon/genel UI görselleri.

Her üçüncü taraf varlık için kaynak URL, lisans/attribution koşulu, indirme tarihi ve mümkünse hash kaydı tutulmalıdır. Kaynağı doğrulanamayan medya teslimden önce değiştirilmelidir.

## Dağıtım kontrolü

Teslim öncesi minimum kontrol:

1. `npm ci`
2. `npm run licenses:inventory`
3. `npm run typecheck`
4. `npm test`
5. `npm run build`
6. `npm run electron:compile`
7. final Electron paketinde gerçekten dağıtılan lisans/notice dosyalarının kontrolü

Bu belge teknik uygunluk envanteridir; hukuki mütalaa değildir.
