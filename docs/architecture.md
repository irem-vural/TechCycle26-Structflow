# StructFlow Teknik Mimarisi

StructFlow bu repoda tek çalışma alanına sahiptir: **İstinat Duvarı Analiz & Tasarım**. Mimari, ürün kodunu proje yaşam döngüsü ve native masaüstü yetkilerinden ayırır.

## 1. Katmanlar

```text
Next.js giriş        src/app/
        ↓
Uygulama kabuğu      src/shell/
        ↓
İstinat ürünü        src/retaining-wall/
        ↓
Ortak çekirdek       src/core/
        ↓
Native masaüstü      desktop/electron/
```

### `src/app/`

`layout.tsx` metadata/tema sınırıdır. `page.tsx` doğrudan `ProjectShell` açar.

### `src/shell/`

`src/shell/project/ProjectShell.tsx` tek istinat store'unu hydrate eder, açık proje sekmelerini yönetir, dirty state'i takip eder ve açma/kaydetme/kapanış akışlarını koordine eder.

- `useProjectTabs.ts` — React sekme state'i.
- `projectPayloadFactory.ts` — yeni istinat payloadı ve document session.
- `projectTabTransition.ts` — save ownership ve sekme geçişleri.
- `useProjectPersistence.ts` — `.sfl` I/O, recent projects ve decode worker.
- `UnsavedChangesDialog.tsx` — kapanış kararı.

Project Hub bileşenleri `src/components/structflow/project-hub/` altındadır ve yalnız istinat projeleri oluşturur/gösterir.

## 2. Proje veri katmanı

`src/core/workspace/projectTypes.ts` tek proje tipini tanımlar: `retaining-wall`.

`src/core/workspace/sflowFormat.ts` `.sfl` v3 ZIP kapsayıcısının encode/decode sınırıdır. `project.json` proje verisini, `metadata.json` kapsayıcı metadata'sını taşır.

`src/core/workspace/projectSchemas.ts` v3 doğrulamasını ve eski istinat v1/v2 veri biçimlerinin migration'ını yürütür. Tanınmayan proje tipleri reddedilir.

Decode ana UI thread dışında çalışabilir:

- `projectDecode.worker.ts`
- `projectDecodeClient.ts`
- `projectDecodeProtocol.ts`
- `projectDecodeError.ts`
- `sflowLimits.ts`

## 3. İstinat ürün alanı

Ana facade `src/retaining-wall/index.ts`, state kaynağı `store/useRetainingWallStore.ts`, ana UI `components/RetainingWallWorkspace.tsx` dosyasıdır.

Hesap pipeline'ı `engine/index.ts` tarafından şu sırada yürütülür:

1. `engine/geometry.ts` — kesit metrikleri.
2. `engine/earth-pressure.ts` — nihai mimaride Coulomb yanal toprak basıncı sonuçları.
3. `engine/stability.ts` — kayma, devrilme, eksantrisite ve taşıma gücü.
4. `engine/reinforcement.ts` — gövde/burun/topuk betonarme donatı ön tasarımı; normatif RC kapsamı ACI CODE-318-25'tir.
5. `engine/quantities.ts` — metraj.
6. `material-selection/` — beton reçetesi ve fiyat/optimizasyon verisi.
7. `engine/emissions/` — makine/malzeme/lojistik emisyonu.
8. `engine/cost.ts` — proje maliyeti.

Betonarme yardımcıları `src/core/standards/aci318-25.ts` içindedir ve yalnız RC kesit/donatı ön tasarımını kapsar. Geoteknik hesaplar Coulomb/Terzaghi metodolojisiyle ayrı tutulur; ayrıntılı kapsam ve benchmark politikası [`methodology.md`](methodology.md) belgesindedir. Beton karışım reçeteleri bir betonarme tasarım standardının tanımladığı reçeteler olarak sunulmaz.

3B görünüm `components/Geometry3DViewer.tsx`, görüntü kontrolleri `components/ViewToolbar.tsx`, harita/lojistik `MapComponent.tsx` ve `MapModal.tsx` üzerinden yürür.

Raporlama:

- `export/exportExcel.ts`
- `export/exportPdf.ts`
- `export/reportModel.ts` — PDF ve Excel için ortak metrik/yöntem semantiği
- `sustainable-concrete/exports.ts`

Detay: [`retaining-wall.md`](retaining-wall.md)

## 4. State ve veri akışı

Tipik kullanıcı değişikliği:

```text
UI input
  → useRetainingWallStore
  → validation
  → engine/index.ts
  → Scenario
  → results / 3B / report
```

Kaydetme akışı:

```text
RetainingWall store
  → ProjectPayload
  → writeSflow()
  → preload DesktopApi
  → Electron main
  → AtomicFileWriter
  → .sfl
```

Açma akışı ters yönde decode worker ve schema migration üzerinden store hydration'a ulaşır.

## 5. Workspace olayları

`src/core/workspace/workspaceEventBus.ts` yalnız ortak gereken sinyalleri taşır: workspace ready, warning ve focus bilgisi. Port dosyaları shell ile ürün alanı arasındaki doğrudan bağımlılığı azaltır.

## 6. Electron sınırı

Renderer Node.js filesystem API'sine doğrudan erişmez. `desktop/electron/main.ts` pencere ve dosya yetkilerini taşır; `preload.ts` yalnız `DesktopApi` yüzeyini expose eder.

- `ipcSecurity.ts` — trusted sender kontrolü.
- `fileCapabilities.ts` — proje dosyası capability modeli ve boyut sınırı.
- `atomicFileWriter.ts` — atomik save ve sequence koruması.
- `recentProjectStore.ts` — recent listesi.
- `quitCoordinator.ts` — dirty state kapanış koordinasyonu.

Detay: [`desktop.md`](desktop.md)

## 7. Statik varlıklar

- `public/textures/` — istinat 3B yüzey texture'ları.
- `public/structflow_svg_icons/` — arayüz ikonları.
- `public/audio/` — tanıtım medyası.
- public kök görselleri — logo/favicon/genel UI.

## 8. Build

Normal web build: `npm run build`.

Electron zinciri: TypeScript kontrolü → Next static export → Electron compile → Electron Builder. Yapılandırma `next.config.ts`, `tsconfig.electron.json` ve `package.json` içindedir.

## 9. Değişiklik yönlendirmesi

| Değişiklik | Öncelikli yer |
|---|---|
| Geometri | `src/retaining-wall/engine/geometry.ts` |
| Toprak basıncı | `src/retaining-wall/engine/earth-pressure.ts` |
| Stabilite | `src/retaining-wall/engine/stability.ts` |
| Donatı | `src/retaining-wall/engine/reinforcement.ts` |
| Metraj | `src/retaining-wall/engine/quantities.ts` |
| Emisyon | `src/retaining-wall/engine/emissions/` |
| Maliyet | `src/retaining-wall/engine/cost.ts` |
| Beton reçetesi | `src/retaining-wall/material-selection/` |
| UI / 3B | `src/retaining-wall/components/` |
| Store/default | `src/retaining-wall/store/` |
| `.sfl` / migration | `src/core/workspace/` |
| Native dosya I/O | `desktop/electron/` |

Tam dosya indeksi: [`file-map.md`](file-map.md).
