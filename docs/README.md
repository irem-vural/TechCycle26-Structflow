# StructFlow Teknik Dokümantasyon

Bu klasör, tek ürün olan **İstinat Duvarı Analiz & Tasarım** uygulamasının teknik dokümantasyon merkezidir.

## Çalışma zinciri

`src/app/` uygulamayı başlatır → `src/shell/` proje/sekme yaşam döngüsünü yönetir → `src/retaining-wall/` istinat çalışma alanını çalıştırır → `src/core/` proje formatı ve ortak altyapıyı sağlar → `desktop/electron/` native dosya işlemlerini güvenli sınırda yürütür.

## Ana kaynaklar

- Giriş: `src/app/page.tsx`
- Ana orkestrasyon: `src/shell/project/ProjectShell.tsx`
- Proje açma/kaydetme: `src/shell/project/useProjectPersistence.ts`
- Ürün girişi: `src/retaining-wall/index.ts`
- State: `src/retaining-wall/store/useRetainingWallStore.ts`
- Hesap motoru: `src/retaining-wall/engine/index.ts`
- UI: `src/retaining-wall/components/`
- Beton reçetesi: `src/retaining-wall/material-selection/`
- Sürdürülebilir beton: `src/retaining-wall/sustainable-concrete/`
- Proje formatı: `src/core/workspace/`
- Electron: `desktop/electron/`

## Hangi belge?

| İhtiyaç | Belge |
|---|---|
| Genel mimari | [`architecture.md`](architecture.md) |
| Dosya nerede? | [`file-map.md`](file-map.md) |
| Çalıştırma/build | [`development.md`](development.md) |
| Hesap yöntemi / formüller / benchmark / provenance | [`methodology.md`](methodology.md) |
| `.sfl` ve kayıt akışı | [`project-data.md`](project-data.md) |
| İstinat hesap/state/UI | [`retaining-wall.md`](retaining-wall.md) |
| Electron/native I/O | [`desktop.md`](desktop.md) |
| Lisans | [`legal/`](legal/) |

## Klasör politikası

- Ürün kodu → `src/`
- İstinat ürün alanı → `src/retaining-wall/`
- Masaüstü kodu → `desktop/`
- Statik runtime varlıkları → `public/`
- Araçlar → `tooling/`
- Dokümantasyon → `docs/`
- Kaynak olmayan çalışma/çıktılar → `artifacts/`
