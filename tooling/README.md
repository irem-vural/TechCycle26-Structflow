# Tooling

Bu klasör ürün runtime koduna dahil olmayan geliştirme, tanıtım ve raporlama araçlarını içerir.

## `remotion/`

StructFlow tanıtım videosunun Remotion kaynaklarıdır.

- `index.ts` — Remotion giriş noktası.
- `Root.tsx` — composition kaydı.
- `PromoVideo.tsx` — tanıtım videosunun sahneleri ve zaman akışı.

Komutlar `package.json` içindeki `video:*` scriptleridir. Yeni render çıktıları `artifacts/generated/video/` altına gider.

## `scripts/`

- `generate-license-inventory.mjs` — kurulu npm bağımlılıklarının lisans envanterini üretir.
- `generate-file-map.mjs` — mevcut kaynak ağacından `docs/file-map.md` üretir.

Bu scriptlerin dokümantasyon çıktıları `docs/legal/` dizininde tutulur.
