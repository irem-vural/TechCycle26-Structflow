# İstinat Duvarı — Düzeltme ve Regresyon Raporu

- Tarih: 12 Eylül 2026
- Kapsam: 121 deneylik UI/test raporunda görülen eksikler, veri-kalite sorunları, uyarı davranışı, CO₂/maliyet bütünlüğü ve ilgili istinat duvarı kullanıcı akışları.
- Yaklaşım: Program mimarisi ve mevcut UI korunarak hedefli düzeltmeler yapıldı; kaynağı belirsiz mühendislik değerleri tahmin edilmedi.

## Düzeltilen kritik konular

- **Hava hedefi (%) arayüze eklendi.**
  - Beton sınıfı alanının altında mevcut tasarım diline uygun, kompakt bir `Hava hedefi` girdisi eklendi.
  - Hava hedefi, hava sürükleyici katkının `kg/m³` dozajından ayrı tutuluyor.
  - Sonuçlardaki reçete kontrolünde hava hedefi ayrıca gösteriliyor.
  - Hava hedefi değiştiğinde mevcut sonuçların eski olduğu algılanıyor ve sonuç yenileme akışı korunuyor.

- **Excel tarih/seri numarası gibi görünen bozuk mühendislik verileri karantinaya alındı.**
  - `46xxx` biçimindeki hava hedefi ve basınç dayanımı değerleri artık gerçek yüzde/MPa gibi aktif hesaba sokulmuyor.
  - D-051 ve D-052'deki `46173 / 46263 MPa` değerleri aktif dayanım girdisine aktarılmıyor.
  - D-053–D-056 ve D-073–D-081 aralığındaki `46xxx` hava hedefleri aktif yüzde girdisine aktarılmıyor.
  - Ham kaynak değeri kaybolmuyor; kaynak kaydında korunuyor ve importer veri uyarısı üretiyor.
  - Program bu değerleri sessizce yüzdeye veya tarihten türetilmiş başka bir sayıya çevirmiyor.

- **D-105–D-109 CO₂ eksikliği giderildi.**
  - Hava sürükleyici katkı için kaynaklı `EF_air_entraining = 0.4393 kgCO₂e/kg` emisyon faktörü eklendi.
  - Kaynak: EFCA / IBU Model EPD, `Concrete admixtures – Air entrainers`, `EPD-EFC-20210193-IBG1-EN`.
  - Faktör A1–A3 GWP-total değeridir ve 1 kg beyan birimine dayanır.
  - Hava sürükleyici katkı artık başka bir katkının faktörüyle vekâleten hesaplanmıyor.
  - Eski raporda eksik toplam üreten beş deney artık tam CO₂ sonucu üretiyor.

- **Silis dumanı maliyet kaynağı güncellendi ve doğrulandı.**
  - Birim değer `49.94 TL/kg + KDV` olarak korundu.
  - 12 Eylül 2026 canlı ürün fiyatı ile kaynak/tarih/URL metadata'sı güncellendi.
  - Kaynak: Kompozit Pazarı, `Mikrosilika (Silis Dumanı) 1000 kg`.
  - Programın malzeme fiyatı KDV hariç mantığı korunuyor; KDV proje toplamında ayrı uygulanıyor.

## Uyarı sistemi ve yönlendirme

- Reçete doğrulama mesajlarına yapılandırılmış hedef bilgisi eklendi.
- Uyarı kartlarına **`İlgili girdiye git`** aksiyonu eklendi.
- İlgili alan kapalı bir detay bloğundaysa blok açılıyor, ilgili input ekrana getiriliyor ve odaklanıyor.
- Uyarıların ilk beş taneyle kesilmesi kaldırıldı; kullanıcı gerçek aktif uyarıların tamamını görebiliyor.
- Dayanım ölçümünde yaş/kaynak eksikliği tek bir anlamlı veri-kalitesi uyarısında birleştirildi.
- Reçete değişimi sonrası doğrulanmamış dayanım uyarısı, zaten yaş/kaynak eksikse ikinci kez yinelenmiyor.
- Su/bağlayıcı uyarıları artık tasarım reddi gibi davranmıyor; `0.30–0.70` aralığı açıkça **ön kontrol / inceleme aralığı** olarak ifade ediliyor.
- Donatı metrajı kapsam notları gibi bilgilendirme metinleri genel hata/uyarı sayacından çıkarıldı.
- Betonarme ön kontrolde gerçekten müdahale gerektiren gövde/burun/topuk bulguları ayrıca görünür hale getirildi ve **Donatı girdilerine git** aksiyonu eklendi.
- Betonarme kapsam açıklaması uyarı rengi yerine bilgi/ön kontrol notu olarak gösteriliyor.

## Oto düzeltme

- **Geçersiz hava hedefini temizle:** Bozuk yüzde/seri değerini yalnız kullanıcı aksiyonuyla temizler.
- **Açık dayanım aykırısını kaldır:** `>300 MPa` gibi açıkça şüpheli ölçümü yalnız kullanıcı aksiyonuyla kaldırır.
- **Su/bağlayıcı ön kontrol düzeltmesi:** Oranı en yakın `0.30` veya `0.70` sınırına getirecek su dozajını hesaplar.
  - Düzeltme uygulanmadan önce önerilen yeni su dozajı ve hedef w/b uyarı metninde gösterilir.
  - Bu işlem reçeteyi değiştirdiği için sessizce çalışmaz; kullanıcı `Oto düzelt` butonuna basmalıdır.
- Deney yaşı, kaynak, zemin, donatı veya belirsiz fiyat/emisyon verisi **uydurularak otomatik doldurulmaz**.

## Veri bütünlüğü ve hesap davranışı

- Hava hedefi aktif reçete modelinde ve UI readback akışında korunuyor.
- Hava hedefi yalnız reçete hedefi/kalite bilgisi; yapısal hesabı, maliyeti veya CO₂'yi yapay olarak değiştirmiyor.
- Hava sürükleyici katkı dozajı ise gerçek malzeme miktarı olarak maliyet ve CO₂ hesabına dahil ediliyor.
- Kullanıcı tanımlı emisyon faktörü varsa önceliği korunuyor; sonra onaylı benchmark, ardından kaynaklı tamamlayıcı varsayılan kullanılıyor.
- Geopolimer reçetede alkali aktivatör eksikse kullanıcı doğrudan aktivatör girdisine yönlendiriliyor; program eksik miktar uydurmuyor.
- Audit betiğindeki eski hava hedefini sıfırlama ve hava sürükleyici katkıyı devre dışı bırakma hilesi kaldırıldı.
- Audit artık gerçek reçeteyi olduğu gibi çalıştırıyor.

## Audit/test altyapısı düzeltmeleri

- 121 deneylik motor denetimi artık tam olarak `121` deney bekliyor.
- Motor denetimi aşağıdaki durumlarda başarısız olacak şekilde sertleştirildi:
  - runtime hata,
  - validation error,
  - eksik çıktı,
  - hava sürükleyici emisyon faktörü eksikliği.
- Gerçek UI audit'i artık:
  - hava hedefi inputuna değer yazıyor ve geri okuyor,
  - dayanımın kaynak/URL/satır metadata'sını UI'ya giriyor,
  - input readback uyuşmazlığını hata sayıyor,
  - eksik fiyat/emisyon/miktar sonucunu hata sayıyor,
  - UI exception, input error, mismatch, hesap bloklanması veya eksik veri varsa süreçten hata koduyla çıkıyor.
- Kompakt UI audit raporundaki alan adı hatası düzeltildi.
- Veri özetleme betiğinde `null` su/bağlayıcı oranının yanlışlıkla `0` kabul edilmesi düzeltildi.

## Son test sonuçları

- `npm run typecheck` → **BAŞARILI**
- Odak malzeme/importer testleri → **35 / 35 BAŞARILI**
- İstinat modülü testleri → **83 / 83 BAŞARILI**
- Tüm proje test paketi → **93 / 93 BAŞARILI**
- 121 deneylik gerçek motor dataset audit'i → **121 / 121 tamamlandı**
  - runtime error: **0**
  - validation error: **0**
  - incomplete output: **0**
- Next.js production build → **BAŞARILI**
- 121 deneylik gerçek UI audit'i → **121 / 121 tamamlandı**
  - UI exception: **0**
  - UI input error: **0**
  - UI input mismatch: **0**
  - hesap bloklanması: **0**
  - eksik veri: **0**
  - desteklenmeyen kaynak alanı: **0**
  - `UI_COMPLETED`: **2**
  - `UI_COMPLETED_WITH_WARNINGS`: **119**
- D-105–D-109 → **5 / 5 tam sonuç**, hava sürükleyici dozajı korunuyor ve eksik CO₂ faktörü kalmadı.
- `git diff --check` → **BAŞARILI / whitespace hatası yok**

## Bilinçli olarak kalan uyarılar

- Kaynak çalışmada deney yaşı verilmemişse program bunu `28 gün` olarak varsaymıyor; kullanıcıya veri-kalitesi uyarısı gösteriyor.
- Kaynak reçetede w/b ön kontrol aralığının dışındaysa sonuç üretilmeye devam ediyor fakat reçete inceleme uyarısı gösteriliyor.
- D-046–D-049 yüksek w/b; D-057–D-059 ve D-073–D-075 düşük w/b nedeniyle inceleme uyarısı almaya devam ediyor.
- Bu uyarılar program hatası olarak susturulmadı; kullanıcıyı doğrudan ilgili girdiye götürecek şekilde bırakıldı.
- Kaynak veri içinde bulunan tekrar deney grupları veri setinden otomatik silinmedi; literatür satırları korunuyor.

## Kaynak notları

- Silis dumanı güncel fiyatı: https://kompozitpazari.com/urun/mikrosilika-silis-dumani/
- Hava sürükleyici katkı EPD verisi: https://ibudata.lca-data.com/datasetdetail/process.xhtml?uuid=3063f481-9b3c-425c-92dc-d7f6608cd90b&version=00.01.000

## Sonuç

- Raporda görülen ana uygulama kaynaklı eksikler hedefli olarak giderildi.
- Programın genel UI/mimari yapısı yeniden yazılmadı; mevcut tema ve panel düzeni korundu.
- Sonuçların zorla “doğru” gösterilmesi yerine bozuk veya eksik kaynak verileri ayrıştırıldı.
- 121 deney hem gerçek hesap motorundan hem de derlenmiş gerçek UI akışından yeniden geçirildi.
- Kritik regresyon veya eksik hesap sonucu tespit edilmedi.
