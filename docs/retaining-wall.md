# İstinat Duvarı Teknik Yapısı

`src/retaining-wall/` bu reponun tek ürün alanıdır. State, mühendislik hesapları, 3B/harita arayüzü, beton reçetesi, sürdürülebilirlik ve raporlama burada bulunur.

## Giriş

`src/retaining-wall/index.ts` dışarı açılan facade dosyasıdır. `ProjectShell.tsx` `RetainingWallWorkspace` ve `useRetainingWallStore` üzerinden bu alanı çalıştırır.

## Veri tipleri

`types.ts` geometri, zemin, malzeme sınıfı, lojistik, stabilite, donatı, metraj, emisyon, maliyet ve senaryo sözleşmelerini tanımlar.

## State

`store/useRetainingWallStore.ts`:

- duvar ve zemin girdileri,
- lojistik/maliyet girdileri,
- beton reçetesi,
- sürdürülebilir beton verisi,
- custom coefficients,
- validation,
- aktif hesap senaryosu,
- 3B görünüm state'i

tutar ve değişikliklerden sonra hesap zincirini tetikler.

## Hesap pipeline'ı

Ana orkestratör `engine/index.ts`.

### 1. Geometri

`engine/geometry.ts`: kesit alanları, beton hacmi, ağırlık merkezi, topuk/burun ve metraj girdileri.

### 2. Toprak basıncı

`engine/earth-pressure.ts`: nihai mimaride Coulomb aktif/pasif katsayılar, toprak ve sürşarj kuvvetleri. Final aktif konvansiyon topuk kenarında düşey sanal düzlem (`ε=90°`, `δ=0°`, `β=0°`) olup faydalı `Pa_v` kullanılmaz. Varsayılan `φ_backfill=30°` kaynaklanmış saha değeri değil, açık bir modelleme varsayımıdır. `Df` zemin yüzeyinden temel alt kotuna kadar gömülme derinliğidir ve ön taraftaki pasif yanal basınç tam `Df` boyunca etkir; burun plağı üstündeki düşey zemin örtüsü ise ayrı olarak `max(0, Df - x5)` yüksekliğidir. Raporlama katmanı alternatif bir teoriyle sonucu yeniden hesaplamaz.

### 3. Dış stabilite

`engine/stability.ts`: kayma, devrilme, eksantrisite, `qMax/qMin` ve taşıma gücü güvenliği. Terzaghi `q_ult` tam fiziksel temel genişliği `B=x1` ile hesaplanır; eksantrisite etkisi `qMax` taban temas basıncında taşınır ve diagnostik `B'=B-2e` kapasite denklemine ikinci kez uygulanmaz. Kaymada kullanılan `δbase=2/3·φfoundation` açık bir modelleme varsayımıdır.

### 4. Donatı ön tasarımı

`engine/reinforcement.ts`: gövde, burun ve topuk moment/kesme talebi, donatı alanı, çap/aralık ve kapasite **ön taraması**. Betonarme yardımcıları `src/core/standards/aci318-25.ts` içindedir; normatif referans **ACI CODE-318-25** ile sınırlıdır. Çıktılar preliminary screening/ön boyutlandırmadır; tam ACI tasarımı veya nihai code-compliance sonucu değildir. Bu standart geoteknik hesap veya beton karışım reçetesi kaynağı olarak kullanılmaz.

### 5. Metraj

`engine/quantities.ts`: beton, donatı, kalıp, kazı ve geri dolgu; toplam ve metre başına değerler.

### 6. Beton reçetesi

`material-selection/`:

- `mixModel.ts`
- `materialCatalog.ts`
- `defaultPrices.ts`
- `optimization.ts`
- `zeroWasteImpact.ts`

### 7. Emisyon

`engine/emissions/`: makine yakıtı, malzeme emisyon faktörleri ve lojistik etkileri.

### 8. Maliyet

`engine/cost.ts`: beton, donatı, kazı, dolgu, kalıp, işçilik, nakliye, yakıt, genel gider ve KDV.

## Validation ve katsayılar

- `engine/validation.ts` — geometri limitleri ve bloklayıcı hata/warning.
- `coefficients/defaults.ts` — başlangıç katsayıları.
- `coefficients/schema.ts` — katsayı doğrulaması.

## Sürdürülebilir beton

`sustainable-concrete/` veri modeli, hesap, import, export ve adaptasyon kodlarını taşır.

## UI

Önemli dosyalar:

- `components/RetainingWallWorkspace.tsx` — ana çalışma alanı.
- `components/EngineeringInputPanel.tsx` — girdiler.
- `components/EngineeringResultsPanel.tsx` — sonuçlar.
- `components/CanvasPanel.tsx` — görsel alan.
- `components/Geometry3DViewer.tsx` — Three.js 3B görünüm.
- `components/ViewToolbar.tsx` — kamera/render/layer kontrolleri.
- `components/RebarCage.tsx` — donatı görünümü.
- `components/MapComponent.tsx` ve `MapModal.tsx` — lojistik haritası.
- `components/ZeroWastePanel.tsx` — çevresel/sıfır-atık görünümü.

## Raporlama

- `export/exportExcel.ts`
- `export/exportPdf.ts`
- `export/reportModel.ts` — PDF ve Excel'in ortak yöntem, birim ve karbon-metrik tanımları
- `sustainable-concrete/exports.ts`

`reportModel.ts` hesap motorunu tekrar çalıştırmaz. Senaryodaki sonuçları aynı kapsam/birim tanımlarıyla iki dışa aktarıma taşır; Coulomb/Terzaghi yöntem sapmalarını ve kullanıcı-onaylı benchmark uyuşmazlıklarını QA uyarısı olarak görünür kılar. Formüller ve veri kökeni: [`methodology.md`](methodology.md).

## Testler

- `__tests__/materials-and-importer.test.ts`
- `__tests__/optimization.test.ts`
- `__tests__/zero-waste-impact.test.ts`

## Değişiklik yönlendirmesi

| İstenen değişiklik | Yer |
|---|---|
| Geometri | `engine/geometry.ts` |
| Coulomb yanal toprak basıncı | `engine/earth-pressure.ts` |
| Stabilite | `engine/stability.ts` |
| Donatı | `engine/reinforcement.ts` |
| Metraj | `engine/quantities.ts` |
| Emisyon | `engine/emissions/` |
| Maliyet | `engine/cost.ts` |
| Varsayılan state | `store/useRetainingWallStore.ts` |
| Beton reçetesi | `material-selection/` |
| Sürdürülebilir beton | `sustainable-concrete/` |
| UI / 3B | `components/` |
