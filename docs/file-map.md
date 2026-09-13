# StructFlow Dosya Haritası

Bu belge mevcut tek-istinat kaynak ağacını yol bazında indeksler. Kaynak kodu tekrar etmez; bir davranışın hangi dosyada bulunduğunu gösterir.

> `npm run docs:file-map` komutu ile mevcut disk ağacından yeniden üretilir.

## Kök yapılandırma dosyaları

| Dosya | Sorumluluk |
|---|---|
| `.gitignore` | Build, cache ve geçici dosyaların Git dışında tutulma politikası. |
| `components.json` | UI component üretim stili ve alias yapılandırması. |
| `eslint.config.mjs` | ESLint 9 flat config. |
| `next-env.d.ts` | Next.js TypeScript ortam declaration dosyası. |
| `next.config.ts` | Web ve Electron static export davranışı. |
| `package-lock.json` | Kilitli npm bağımlılık ağacı. |
| `package.json` | Metadata, bağımlılıklar, npm scriptleri ve Electron Builder ayarları. |
| `postcss.config.mjs` | PostCSS/Tailwind build pipeline yapılandırması. |
| `README.md` | Ana hızlı başlangıç ve dokümantasyon giriş belgesi. |
| `tsconfig.electron.json` | Electron TypeScript derleme hedefi. |
| `tsconfig.json` | Ana TypeScript yapılandırması. |
| `vitest.config.ts` | Vitest yapılandırması. |

## Next.js App Router

| Dosya | Sorumluluk |
|---|---|
| `src/app/globals.css` | Global CSS giriş noktası ve tema importları. |
| `src/app/layout.tsx` | Root layout; metadata, global stil ve tema aktivasyonunu bağlar. |
| `src/app/page.tsx` | Next.js ana sayfası; ProjectShell bileşenini açar. |
| `src/app/ThemeController.tsx` | Kaynak dosya: Theme Controller. |

## Uygulama Shell

| Dosya | Sorumluluk |
|---|---|
| `src/shell/hub/ProjectHub.tsx` | Uygulama kabuğu ve proje yaşam döngüsü kaynağı: Project Hub. |
| `src/shell/hub/ProjectLoadingScreen.tsx` | Uygulama kabuğu ve proje yaşam döngüsü kaynağı: Project Loading Screen. |
| `src/shell/hub/SplashScreen.tsx` | Uygulama kabuğu ve proje yaşam döngüsü kaynağı: Splash Screen. |
| `src/shell/project/projectPayloadFactory.ts` | Yeni istinat projesi payloadı, document session ve güvenli dosya adı yardımcıları. |
| `src/shell/project/ProjectShell.tsx` | Tek istinat çalışma alanının proje merkezi, sekme, dirty state, hydration ve kapanış orkestrasyonu. |
| `src/shell/project/projectTabTransition.ts` | Document session ve save-completion sahipliği için saf sekme geçiş kuralları. |
| `src/shell/project/UnsavedChangesDialog.tsx` | Uygulama kabuğu ve proje yaşam döngüsü kaynağı: Unsaved Changes Dialog. |
| `src/shell/project/useProjectPersistence.ts` | .sfl açma/kaydetme, recent projects ve decode worker akışının renderer katmanı. |
| `src/shell/project/useProjectTabs.ts` | Uygulama kabuğu ve proje yaşam döngüsü kaynağı: use Project Tabs. |

## Ortak Core

| Dosya | Sorumluluk |
|---|---|
| `src/core/desktop/desktopContracts.ts` | Renderer ile Electron main/preload arasındaki sınırlı masaüstü API sözleşmesi. |
| `src/core/standards/aci318-25.ts` | ACI CODE-318-25 kapsamındaki betonarme kesit/donatı ön tasarım yardımcıları; geoteknik hesap içermez. |
| `src/core/theme/structflowTheme.ts` | Tema altyapısı: structflow Theme. |
| `src/core/theme/ThemeActivation.tsx` | Tema altyapısı: Theme Activation. |
| `src/core/workspace/__tests__/projectSchemas.test.ts` | Proje/workspace yaşam döngüsü altyapısı: project Schemas.test. |
| `src/core/workspace/projectDecode.worker.ts` | .sfl parse/migration işini renderer ana thread dışında çalıştırır. |
| `src/core/workspace/projectDecodeClient.ts` | Decode Web Worker istemcisi; öncelik, abort ve yaşam döngüsü. |
| `src/core/workspace/projectDecodeError.ts` | Proje/workspace yaşam döngüsü altyapısı: project Decode Error. |
| `src/core/workspace/projectDecodeProtocol.ts` | Proje/workspace yaşam döngüsü altyapısı: project Decode Protocol. |
| `src/core/workspace/projectPersistence.ts` | Proje payload normalizasyonu ve persistence sınırı. |
| `src/core/workspace/projectSchemas.ts` | İstinat proje şeması, doğrulama ve v1/v2 → v3 migration sınırı. |
| `src/core/workspace/projectTypes.ts` | Tek proje tipi, payload, schema version ve .sfl sabitleri. |
| `src/core/workspace/sflowFormat.ts` | .sfl v3 ZIP kapsayıcısını encode/decode eder ve eski istinat JSON biçimlerini okuyabilir. |
| `src/core/workspace/sflowLimits.ts` | Proje/workspace yaşam döngüsü altyapısı: sflow Limits. |
| `src/core/workspace/workspaceEventBus.ts` | Proje/workspace yaşam döngüsü altyapısı: workspace Event Bus. |
| `src/core/workspace/WorkspaceEventContext.tsx` | Proje/workspace yaşam döngüsü altyapısı: Workspace Event Context. |
| `src/core/workspace/workspaceFocusPort.ts` | Proje/workspace yaşam döngüsü altyapısı: workspace Focus Port. |
| `src/core/workspace/workspaceLifecyclePort.ts` | Proje/workspace yaşam döngüsü altyapısı: workspace Lifecycle Port. |
| `src/core/workspace/workspaceWarningPort.ts` | Proje/workspace yaşam döngüsü altyapısı: workspace Warning Port. |

## İstinat Duvarı

| Dosya | Sorumluluk |
|---|---|
| `src/retaining-wall/__tests__/engineering-engine.test.ts` | İstinat duvarı otomatik testi: engineering engine.test. |
| `src/retaining-wall/__tests__/materials-and-importer.test.ts` | İstinat duvarı otomatik testi: materials and importer.test. |
| `src/retaining-wall/__tests__/optimization.test.ts` | İstinat duvarı otomatik testi: optimization.test. |
| `src/retaining-wall/__tests__/zero-waste-impact.test.ts` | İstinat duvarı otomatik testi: zero waste impact.test. |
| `src/retaining-wall/coefficients/defaults.ts` | İstinat katsayı veri katmanı: defaults. |
| `src/retaining-wall/coefficients/materialData.ts` | İstinat katsayı veri katmanı: material Data. |
| `src/retaining-wall/coefficients/schema.ts` | İstinat katsayı veri katmanı: schema. |
| `src/retaining-wall/components/CanvasPanel.tsx` | İstinat kullanıcı arayüzü/görselleştirme bileşeni: Canvas Panel. |
| `src/retaining-wall/components/EngineeringInputPanel.tsx` | İstinat kullanıcı arayüzü/görselleştirme bileşeni: Engineering Input Panel. |
| `src/retaining-wall/components/EngineeringResultsPanel.tsx` | İstinat kullanıcı arayüzü/görselleştirme bileşeni: Engineering Results Panel. |
| `src/retaining-wall/components/Geometry3DViewer.tsx` | İstinat kullanıcı arayüzü/görselleştirme bileşeni: Geometry3 DViewer. |
| `src/retaining-wall/components/GeometryWireframePreview.tsx` | İstinat kullanıcı arayüzü/görselleştirme bileşeni: Geometry Wireframe Preview. |
| `src/retaining-wall/components/MapComponent.tsx` | İstinat kullanıcı arayüzü/görselleştirme bileşeni: Map Component. |
| `src/retaining-wall/components/MapModal.tsx` | İstinat kullanıcı arayüzü/görselleştirme bileşeni: Map Modal. |
| `src/retaining-wall/components/RebarCage.tsx` | İstinat kullanıcı arayüzü/görselleştirme bileşeni: Rebar Cage. |
| `src/retaining-wall/components/RetainingWallMenuBar.tsx` | İstinat kullanıcı arayüzü/görselleştirme bileşeni: Retaining Wall Menu Bar. |
| `src/retaining-wall/components/RetainingWallWorkspace.tsx` | İstinat çalışma alanının üst seviye React bileşeni. |
| `src/retaining-wall/components/ThemeToggle.tsx` | İstinat kullanıcı arayüzü/görselleştirme bileşeni: Theme Toggle. |
| `src/retaining-wall/components/ViewToolbar.tsx` | İstinat kullanıcı arayüzü/görselleştirme bileşeni: View Toolbar. |
| `src/retaining-wall/components/VrManager.tsx` | İstinat kullanıcı arayüzü/görselleştirme bileşeni: Vr Manager. |
| `src/retaining-wall/components/ZeroWastePanel.tsx` | İstinat kullanıcı arayüzü/görselleştirme bileşeni: Zero Waste Panel. |
| `src/retaining-wall/engine/constants.ts` | Mühendislik hesap motoru parçası: constants. |
| `src/retaining-wall/engine/cost.ts` | Malzeme, işçilik, nakliye, genel gider ve KDV maliyeti. |
| `src/retaining-wall/engine/earth-pressure.ts` | Nihai mimaride Coulomb aktif/pasif yanal toprak basıncı hesabı. |
| `src/retaining-wall/engine/emissions/index.ts` | Emisyon hesap motoru parçası: index. |
| `src/retaining-wall/engine/emissions/machinery.ts` | Emisyon hesap motoru parçası: machinery. |
| `src/retaining-wall/engine/emissions/materials.ts` | Emisyon hesap motoru parçası: materials. |
| `src/retaining-wall/engine/geometry.ts` | Kesit geometrisinden alan, hacim ve ağırlık merkezi metrikleri. |
| `src/retaining-wall/engine/index.ts` | Hesap pipeline orkestratörü; geometri → basınç → stabilite → donatı → metraj → emisyon → maliyet. |
| `src/retaining-wall/engine/quantities.ts` | Beton, donatı, kalıp, kazı ve dolgu metrajları. |
| `src/retaining-wall/engine/reinforcement.ts` | Gövde, burun ve topuk için ACI CODE-318-25 kapsamındaki betonarme donatı ön tasarımı. |
| `src/retaining-wall/engine/stability.ts` | Kayma, devrilme, eksantrisite, taban basıncı ve taşıma gücü kontrolleri. |
| `src/retaining-wall/engine/validation.ts` | Geometri/input validasyon hata ve uyarıları. |
| `src/retaining-wall/export/__tests__/reportModel.test.ts` | Rapor/dosya dışa aktarım kaynağı: report Model.test. |
| `src/retaining-wall/export/exportExcel.ts` | Rapor/dosya dışa aktarım kaynağı: export Excel. |
| `src/retaining-wall/export/exportPdf.ts` | Rapor/dosya dışa aktarım kaynağı: export Pdf. |
| `src/retaining-wall/export/reportModel.ts` | PDF ve Excel için ortak yöntem, benchmark, kapsam ve rapor metriği tanımları. |
| `src/retaining-wall/index.ts` | İstinat ürün alanının public facade dosyası. |
| `src/retaining-wall/material-selection/defaultPrices.ts` | Beton reçetesi, fiyat veya optimizasyon domain servisi: default Prices. |
| `src/retaining-wall/material-selection/materialCatalog.ts` | Beton reçetesi, fiyat veya optimizasyon domain servisi: material Catalog. |
| `src/retaining-wall/material-selection/MaterialSelectionPanel.tsx` | Beton reçetesi, fiyat veya optimizasyon domain servisi: Material Selection Panel. |
| `src/retaining-wall/material-selection/mixModel.ts` | Beton reçetesi, fiyat veya optimizasyon domain servisi: mix Model. |
| `src/retaining-wall/material-selection/optimization.ts` | Beton reçetesi, fiyat veya optimizasyon domain servisi: optimization. |
| `src/retaining-wall/material-selection/referenceConcreteProfiles.ts` | Beton reçetesi, fiyat veya optimizasyon domain servisi: reference Concrete Profiles. |
| `src/retaining-wall/material-selection/types.ts` | Beton reçetesi, fiyat veya optimizasyon domain servisi: types. |
| `src/retaining-wall/material-selection/units.ts` | Beton reçetesi, fiyat veya optimizasyon domain servisi: units. |
| `src/retaining-wall/material-selection/zeroWasteImpact.ts` | Beton reçetesi, fiyat veya optimizasyon domain servisi: zero Waste Impact. |
| `src/retaining-wall/store/useRetainingWallStore.ts` | İstinat Zustand store; girdiler, hesap sonucu, beton ve görünüm stateini yönetir. |
| `src/retaining-wall/sustainable-concrete/adapter.ts` | Sürdürülebilir beton veri/hesap/import-export kaynağı: adapter. |
| `src/retaining-wall/sustainable-concrete/calculations.ts` | Sürdürülebilir beton veri/hesap/import-export kaynağı: calculations. |
| `src/retaining-wall/sustainable-concrete/defaults.ts` | Sürdürülebilir beton veri/hesap/import-export kaynağı: defaults. |
| `src/retaining-wall/sustainable-concrete/exports.ts` | Sürdürülebilir beton veri/hesap/import-export kaynağı: exports. |
| `src/retaining-wall/sustainable-concrete/importers.ts` | Sürdürülebilir beton veri/hesap/import-export kaynağı: importers. |
| `src/retaining-wall/sustainable-concrete/index.ts` | Sürdürülebilir beton veri/hesap/import-export kaynağı: index. |
| `src/retaining-wall/sustainable-concrete/types.ts` | Sürdürülebilir beton veri/hesap/import-export kaynağı: types. |
| `src/retaining-wall/types.ts` | Geometri, zemin, stabilite, donatı, metraj, emisyon, maliyet ve senaryo tipleri. |

## Paylaşılan Bileşenler

| Dosya | Sorumluluk |
|---|---|
| `src/components/badge.tsx` | Paylaşılan React UI bileşeni: badge. |
| `src/components/button.tsx` | Paylaşılan React UI bileşeni: button. |
| `src/components/card.tsx` | Paylaşılan React UI bileşeni: card. |
| `src/components/dialog.tsx` | Paylaşılan React UI bileşeni: dialog. |
| `src/components/input.tsx` | Paylaşılan React UI bileşeni: input. |
| `src/components/label.tsx` | Paylaşılan React UI bileşeni: label. |
| `src/components/MenuBar.tsx` | Paylaşılan React UI bileşeni: Menu Bar. |
| `src/components/popover.tsx` | Paylaşılan React UI bileşeni: popover. |
| `src/components/resizable.tsx` | Paylaşılan React UI bileşeni: resizable. |
| `src/components/scroll-area.tsx` | Paylaşılan React UI bileşeni: scroll area. |
| `src/components/select.tsx` | Paylaşılan React UI bileşeni: select. |
| `src/components/separator.tsx` | Paylaşılan React UI bileşeni: separator. |
| `src/components/sheet.tsx` | Paylaşılan React UI bileşeni: sheet. |
| `src/components/structflow/project-hub/NewProjectDialog.tsx` | Project Hub kullanıcı arayüzü bileşeni: New Project Dialog. |
| `src/components/structflow/project-hub/ProjectActionsMenu.tsx` | Project Hub kullanıcı arayüzü bileşeni: Project Actions Menu. |
| `src/components/structflow/project-hub/ProjectHubEmptyState.tsx` | Project Hub kullanıcı arayüzü bileşeni: Project Hub Empty State. |
| `src/components/structflow/project-hub/ProjectHubFrame.tsx` | Project Hub kullanıcı arayüzü bileşeni: Project Hub Frame. |
| `src/components/structflow/project-hub/ProjectHubProjectList.tsx` | Project Hub kullanıcı arayüzü bileşeni: Project Hub Project List. |
| `src/components/structflow/project-hub/ProjectHubRibbon.tsx` | Project Hub kullanıcı arayüzü bileşeni: Project Hub Ribbon. |
| `src/components/structflow/project-hub/ProjectHubTemplates.tsx` | Project Hub kullanıcı arayüzü bileşeni: Project Hub Templates. |
| `src/components/structflow/project-hub/projectHubUtils.ts` | Project Hub kullanıcı arayüzü bileşeni: project Hub Utils. |
| `src/components/structflow/project-hub/types.ts` | Project Hub kullanıcı arayüzü bileşeni: types. |
| `src/components/structflow/ProjectHub.tsx` | Paylaşılan React UI bileşeni: Project Hub. |
| `src/components/structflow/ProjectLoadingScreen.tsx` | Paylaşılan React UI bileşeni: Project Loading Screen. |
| `src/components/structflow/SplashScreen.tsx` | Paylaşılan React UI bileşeni: Splash Screen. |
| `src/components/structflow/ViewCubeGizmo.tsx` | Paylaşılan React UI bileşeni: View Cube Gizmo. |
| `src/components/tabs.tsx` | Paylaşılan React UI bileşeni: tabs. |
| `src/components/TitleBar.tsx` | Paylaşılan React UI bileşeni: Title Bar. |
| `src/components/tooltip.tsx` | Paylaşılan React UI bileşeni: tooltip. |
| `src/components/ui/badge.tsx` | Paylaşılan UI primitive/bileşeni: badge. |
| `src/components/ui/button.tsx` | Paylaşılan UI primitive/bileşeni: button. |
| `src/components/ui/card.tsx` | Paylaşılan UI primitive/bileşeni: card. |
| `src/components/ui/dialog.tsx` | Paylaşılan UI primitive/bileşeni: dialog. |
| `src/components/ui/input.tsx` | Paylaşılan UI primitive/bileşeni: input. |
| `src/components/ui/label.tsx` | Paylaşılan UI primitive/bileşeni: label. |
| `src/components/ui/MenuBar.tsx` | Paylaşılan UI primitive/bileşeni: Menu Bar. |
| `src/components/ui/popover.tsx` | Paylaşılan UI primitive/bileşeni: popover. |
| `src/components/ui/resizable.tsx` | Paylaşılan UI primitive/bileşeni: resizable. |
| `src/components/ui/scroll-area.tsx` | Paylaşılan UI primitive/bileşeni: scroll area. |
| `src/components/ui/select.tsx` | Paylaşılan UI primitive/bileşeni: select. |
| `src/components/ui/separator.tsx` | Paylaşılan UI primitive/bileşeni: separator. |
| `src/components/ui/sheet.tsx` | Paylaşılan UI primitive/bileşeni: sheet. |
| `src/components/ui/tabs.tsx` | Paylaşılan UI primitive/bileşeni: tabs. |
| `src/components/ui/TitleBar.tsx` | Paylaşılan UI primitive/bileşeni: Title Bar. |
| `src/components/ui/tooltip.tsx` | Paylaşılan UI primitive/bileşeni: tooltip. |

## Hooklar

| Dosya | Sorumluluk |
|---|---|
| `src/hooks/useMobileViewport.ts` | Paylaşılan React hook: use Mobile Viewport. |

## Yerelleştirme

| Dosya | Sorumluluk |
|---|---|
| `src/i18n/en.ts` | Yerelleştirme sözlüğü/kaynağı: en. |
| `src/i18n/tr.ts` | Yerelleştirme sözlüğü/kaynağı: tr. |

## Paylaşılan Lib

| Dosya | Sorumluluk |
|---|---|
| `src/lib/__tests__/publicAsset.test.ts` | Paylaşılan uygulama yardımcısı: public Asset.test. |
| `src/lib/logisticsPlaces.ts` | Paylaşılan uygulama yardımcısı: logistics Places. |
| `src/lib/publicAsset.ts` | Paylaşılan uygulama yardımcısı: public Asset. |
| `src/lib/routing.ts` | Paylaşılan uygulama yardımcısı: routing. |
| `src/lib/utils.ts` | Paylaşılan uygulama yardımcısı: utils. |

## Genel Store

| Dosya | Sorumluluk |
|---|---|
| `src/store/useLocaleStore.ts` | Uygulama genel Zustand state kaynağı: use Locale Store. |

## Stiller

| Dosya | Sorumluluk |
|---|---|
| `src/styles/themes/component-mappings.css` | Tema/stil kaynağı: component mappings. |
| `src/styles/themes/legacy-aliases.css` | Tema/stil kaynağı: legacy aliases. |
| `src/styles/themes/primitives.css` | Tema/stil kaynağı: primitives. |
| `src/styles/themes/structflow-dark.css` | Tema/stil kaynağı: structflow dark. |
| `src/styles/themes/structflow-light.css` | Tema/stil kaynağı: structflow light. |

## Genel Tipler

| Dosya | Sorumluluk |
|---|---|
| `src/types/electron.d.ts` | Genel TypeScript declaration/tip kaynağı: electron.d. |

## Desktop / Electron

| Dosya | Sorumluluk |
|---|---|
| `desktop/assets/icons/1024x1024.png` | Electron paketleme/ikon varlığı: 1024x1024. |
| `desktop/assets/icons/16x16.png` | Electron paketleme/ikon varlığı: 16x16. |
| `desktop/assets/icons/256x256.png` | Electron paketleme/ikon varlığı: 256x256. |
| `desktop/assets/icons/32x32.png` | Electron paketleme/ikon varlığı: 32x32. |
| `desktop/assets/icons/48x48.png` | Electron paketleme/ikon varlığı: 48x48. |
| `desktop/assets/icons/512x512.png` | Electron paketleme/ikon varlığı: 512x512. |
| `desktop/assets/sflow-file-source.svg` | Electron paketleme/ikon varlığı: sflow file source. |
| `desktop/assets/sflow-file.icns` | Electron paketleme/ikon varlığı: sflow file. |
| `desktop/assets/sflow-file.ico` | Electron paketleme/ikon varlığı: sflow file. |
| `desktop/assets/sflow-file.png` | Electron paketleme/ikon varlığı: sflow file. |
| `desktop/electron/atomicFileWriter.ts` | Atomik dosya yazımı ve save-token sıralaması. |
| `desktop/electron/fileCapabilities.ts` | Proje dosyası capability kimlikleri ve boyut sınırları. |
| `desktop/electron/ipcSecurity.ts` | IPC sender doğrulaması. |
| `desktop/electron/main.ts` | Electron main process; güvenli proje I/O, recent projects, pencere ve kapanış yaşam döngüsü. |
| `desktop/electron/preload.ts` | Sınırlı DesktopApi yüzeyini renderer ortamına açar. |
| `desktop/electron/quitCoordinator.ts` | Native kapanış ile renderer dirty-state kararını koordine eder. |
| `desktop/electron/recentProjectStore.ts` | Recent project descriptorlarını Electron userData altında saklar. |

## Tooling

| Dosya | Sorumluluk |
|---|---|
| `tooling/remotion/index.ts` | Remotion registerRoot giriş noktası. |
| `tooling/remotion/PromoVideo.tsx` | Tanıtım videosu sahneleri ve zaman çizelgesi. |
| `tooling/remotion/Root.tsx` | Tanıtım videosu composition tanımı. |
| `tooling/scripts/generate-file-map.mjs` | Mevcut kaynak ağacından bu dosya haritasını yeniden üretir. |
| `tooling/scripts/generate-license-inventory.mjs` | Kurulu bağımlılıkları tarayıp docs/legal altında lisans envanteri üretir. |

## Public statik varlıklar

| Dosya | Kullanım ailesi |
|---|---|
| `public/audio/structflow-ambient.mp3` | Tanıtım/medya akışında kullanılan ses varlığı: structflow ambient. |
| `public/banner.png` | Statik PNG görsel varlığı: banner. |
| `public/favicon.ico` | Uygulama ikon/favicon varlığı: favicon. |
| `public/file.svg` | Statik SVG arayüz/marka varlığı: file. |
| `public/globe.svg` | Statik SVG arayüz/marka varlığı: globe. |
| `public/next.svg` | Statik SVG arayüz/marka varlığı: next. |
| `public/sfl.svg` | Statik SVG arayüz/marka varlığı: sfl. |
| `public/sflogo.svg` | Statik SVG arayüz/marka varlığı: sflogo. |
| `public/structflow_svg_icons/3d.svg` | Arayüzde kullanılan SVG ikon varlığı: 3d. |
| `public/structflow_svg_icons/aks.svg` | Arayüzde kullanılan SVG ikon varlığı: aks. |
| `public/structflow_svg_icons/align.svg` | Arayüzde kullanılan SVG ikon varlığı: align. |
| `public/structflow_svg_icons/arsa.svg` | Arayüzde kullanılan SVG ikon varlığı: arsa. |
| `public/structflow_svg_icons/buildable.svg` | Arayüzde kullanılan SVG ikon varlığı: buildable. |
| `public/structflow_svg_icons/cati.svg` | Arayüzde kullanılan SVG ikon varlığı: cati. |
| `public/structflow_svg_icons/dondur.svg` | Arayüzde kullanılan SVG ikon varlığı: dondur. |
| `public/structflow_svg_icons/doseme.svg` | Arayüzde kullanılan SVG ikon varlığı: doseme. |
| `public/structflow_svg_icons/duvar.svg` | Arayüzde kullanılan SVG ikon varlığı: duvar. |
| `public/structflow_svg_icons/geri.svg` | Arayüzde kullanılan SVG ikon varlığı: geri. |
| `public/structflow_svg_icons/ileri.svg` | Arayüzde kullanılan SVG ikon varlığı: ileri. |
| `public/structflow_svg_icons/kapi.svg` | Arayüzde kullanılan SVG ikon varlığı: kapi. |
| `public/structflow_svg_icons/kiris.svg` | Arayüzde kullanılan SVG ikon varlığı: kiris. |
| `public/structflow_svg_icons/kolon.svg` | Arayüzde kullanılan SVG ikon varlığı: kolon. |
| `public/structflow_svg_icons/kopyala.svg` | Arayüzde kullanılan SVG ikon varlığı: kopyala. |
| `public/structflow_svg_icons/olcu.svg` | Arayüzde kullanılan SVG ikon varlığı: olcu. |
| `public/structflow_svg_icons/opening.svg` | Arayüzde kullanılan SVG ikon varlığı: opening. |
| `public/structflow_svg_icons/paftalar.svg` | Arayüzde kullanılan SVG ikon varlığı: paftalar. |
| `public/structflow_svg_icons/pencere.svg` | Arayüzde kullanılan SVG ikon varlığı: pencere. |
| `public/structflow_svg_icons/perde.svg` | Arayüzde kullanılan SVG ikon varlığı: perde. |
| `public/structflow_svg_icons/README.md` | Arayüzde kullanılan SVG ikon varlığı: README. |
| `public/structflow_svg_icons/sec.svg` | Arayüzde kullanılan SVG ikon varlığı: sec. |
| `public/structflow_svg_icons/sigdir.svg` | Arayüzde kullanılan SVG ikon varlığı: sigdir. |
| `public/structflow_svg_icons/sil.svg` | Arayüzde kullanılan SVG ikon varlığı: sil. |
| `public/structflow_svg_icons/structflow-toolbar-icon-pack-preview.svg` | Arayüzde kullanılan SVG ikon varlığı: structflow toolbar icon pack preview. |
| `public/structflow_svg_icons/structflow-toolbar-icons-sprite.svg` | Arayüzde kullanılan SVG ikon varlığı: structflow toolbar icons sprite. |
| `public/structflow_svg_icons/tasi.svg` | Arayüzde kullanılan SVG ikon varlığı: tasi. |
| `public/structflow_svg_icons/temel.svg` | Arayüzde kullanılan SVG ikon varlığı: temel. |
| `public/textures/concrete_wall_007_ao_2k.jpg` | İstinat 3B yüzey materyali texture varlığı: concrete wall 007 ao 2k. |
| `public/textures/concrete_wall_007_arm_2k.jpg` | İstinat 3B yüzey materyali texture varlığı: concrete wall 007 arm 2k. |
| `public/textures/concrete_wall_007_diff_2k.jpg` | İstinat 3B yüzey materyali texture varlığı: concrete wall 007 diff 2k. |
| `public/textures/concrete_wall_007_disp_2k.png` | İstinat 3B yüzey materyali texture varlığı: concrete wall 007 disp 2k. |
| `public/textures/env.exr` | İstinat 3B yüzey materyali texture varlığı: env. |
| `public/textures/ground/ao.jpg` | İstinat 3B yüzey materyali texture varlığı: ao. |
| `public/textures/ground/arm.jpg` | İstinat 3B yüzey materyali texture varlığı: arm. |
| `public/textures/ground/diff.jpg` | İstinat 3B yüzey materyali texture varlığı: diff. |
| `public/textures/ground/disp.png` | İstinat 3B yüzey materyali texture varlığı: disp. |
| `public/textures/ground/nor.jpg` | İstinat 3B yüzey materyali texture varlığı: nor. |
| `public/textures/wall/ao.jpg` | İstinat 3B yüzey materyali texture varlığı: ao. |
| `public/textures/wall/arm.jpg` | İstinat 3B yüzey materyali texture varlığı: arm. |
| `public/textures/wall/diff.jpg` | İstinat 3B yüzey materyali texture varlığı: diff. |
| `public/textures/wall/disp.jpg` | İstinat 3B yüzey materyali texture varlığı: disp. |
| `public/textures/wall/nor.jpg` | İstinat 3B yüzey materyali texture varlığı: nor. |
| `public/vercel.svg` | Statik SVG arayüz/marka varlığı: vercel. |
| `public/window.svg` | Statik SVG arayüz/marka varlığı: window. |

## Dokümantasyon dosyaları

| Dosya | Sorumluluk |
|---|---|
| `docs/architecture.md` | Tek-istinat proje teknik dokümantasyonu. |
| `docs/desktop.md` | Tek-istinat proje teknik dokümantasyonu. |
| `docs/development.md` | Tek-istinat proje teknik dokümantasyonu. |
| `docs/file-map.md` | Tek-istinat proje teknik dokümantasyonu. |
| `docs/methodology.md` | Tek-istinat proje teknik dokümantasyonu. |
| `docs/project-data.md` | Tek-istinat proje teknik dokümantasyonu. |
| `docs/README.md` | Tek-istinat proje teknik dokümantasyonu. |
| `docs/retaining-wall.md` | Tek-istinat proje teknik dokümantasyonu. |

## Artifacts

`artifacts/` kaynak kod değildir. `archive/` geçmiş çıktıları, `generated/` otomatik çıktıları, `workbench/` geçici çalışma materyallerini barındırır.

