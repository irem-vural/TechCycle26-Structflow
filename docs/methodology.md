# Hesap Metodolojisi, Benchmark ve Veri Kökeni

Bu belge TEKNOFEST teslimi için StructFlow istinat duvarı hesabının **hangi yöntemi nerede kullandığını**, rapor metriklerinin nasıl tanımlandığını ve kullanıcı-onaylı benchmark verisinin nasıl korunacağını açıklar. Amaç bir standardın kapsamını başka bir disipline taşımamak ve PDF/Excel/UI arasında aynı kavramlara aynı adı vermektir.

> **Kapsam ilkesi:** yanal toprak basıncı için **Coulomb**, temel taşıma gücü için **Terzaghi**, betonarme kesit/donatı tasarımı için yalnız **ACI CODE-318-25** kullanılır. ACI 318 geoteknik kayma, devrilme, yanal toprak basıncı veya zemin taşıma gücü standardı gibi sunulmaz.

## 1. Geometri ve işaretler

- `H`: taban plağının **üst kotundan** duvar tepesine kadar serbest gövde yüksekliği. Taban plağı kalınlığı `H` içine eklenmez.
- `L`: duvarın boyuna uzunluğu; toplam metraj ve proje-toplamı sonuçlarını 1 m şerit sonuçlarından ayırır.
- `Df`: doğal/nihai zemin yüzeyinden temel plağının **alt kotuna** kadar düşey temel gömme derinliği.
- Pasif yanal zemin basıncı derinliği: ön taraftaki gömülü düşey yüz boyunca **tam `Df`** alınır.
- Burun plağı üstündeki zemin örtüsü yüksekliği: yalnız plağın üstünde kalan düşey zemin yüksekliğidir ve `h_toe = max(0, Df - x5)` olarak alınır. Bu değer pasif basınç derinliği değildir.
- `B` / `x1`: toplam temel genişliği.
- `B' = B - 2e`: eksantrisiteye bağlı **diagnostik etkili genişlik**. Nihai Terzaghi `q_ult` denkleminde kapasite genişliği olarak kullanılmaz; eksantrisite etkisi gerçek taban temas basıncı `qMax` içinde taşınır.
- Kesme anahtarı (shear key) nihai mimariden kaldırılmıştır. Kayma veya taşıma gücü hesabında shear-key kaynaklı ek direnç raporlanmaz.

## 2. Yanal toprak basıncı — Coulomb

Nihai hesap mimarisinde yanal toprak basıncı için tek yöntem Coulomb'dur. Temel değişkenler:

- `φ`: dolgu içsel sürtünme açısı,
- `δ`: duvar-zemin arayüz sürtünme açısı,
- `β`: dolgu yüzeyi eğimi,
- `γ`: dolgu birim hacim ağırlığı,
- `q`: düzgün yayılı sürşarj,
- `H`: serbest gövde yüksekliği.

Aktif itkinin zemin ve sürşarj bileşenleri rapor seviyesinde şu ayrımla okunur:

```text
Pγ = 1/2 · Ka · γ · H²
Pq = Ka · q · H
Pa = Pγ + Pq
```

Ön taraftaki pasif direnç için bu fiziksel modelde düşey etkime derinliği temel taban alt kotuna kadar olan tam gömülme derinliği `Df`'dir:

```text
Pp = 1/2 · Kp · γfoundation · Df²
```

Burun plağı üzerinde düşey ağırlık/sürşarj oluşturan zemin yüksekliği ise ayrı bir geometrik büyüklüktür:

```text
h_toe = max(0, Df - x5)
```

Dolayısıyla `Df` pasif yanal basınç derinliğinde kullanılırken `h_toe` yalnız burun plağı üstündeki düşey zemin ağırlığı hesabını temsil eder; iki büyüklük birbirinin yerine kullanılamaz.

Final aktif basınç modeli **topuk kenarında düşey sanal düzlem** kullanır. Nihai senaryo konvansiyonu:

```text
aktif düzlem = heel-edge vertical virtual plane
ε = 90°
δ = 0°
β = 0°
Pa_v = 0
```

Bu nedenle final benchmark/stabilite yolunda aktif itki yataydır ve faydalı bir `Pa_v` düşey bileşeni kullanılmaz. Generic Coulomb yardımcı fonksiyonu farklı açı kombinasyonlarını hesaplayabilse de final senaryo modeli `δ=0°` ve `β=0°` konvansiyonuna normalize edilir / bu koşulu zorunlu tutar.

Varsayılan arka dolgu sürtünme açısı `φ_backfill = 30°` **modelleme varsayımıdır**; bu dokümanda saha deneyi veya zemin etüdü ile kaynaklanmış bir değer olarak sunulmaz. Proje özelinde geoteknik raporla değiştirilmesi/doğrulanması gerekir.

`Ka` Coulomb geometrisi ve final konvansiyondaki `φ, δ=0, β=0, ε=90°` ile belirlenir. PDF ve Excel hesap motorundaki `Scenario.earthPressures` sonucunu raporlar; rapor katmanı farklı bir `Ka` hesabı yapmaz.

**Kaynak çerçevesi:** FHWA GEC No. 6, Coulomb lateral earth pressure definitions: <https://www.fhwa.dot.gov/engineering/geotech/pubs/010943.pdf>

## 3. Dış stabilite

### Kayma

Temel sürtünmesi, varsa temel-zemin kohezyon/adezyon katkısı ve modelde açıkça kullanılan pasif direnç sürücü yatay kuvvete karşı değerlendirilir. Genel rapor gösterimi:

```text
FS_sliding = R_horizontal / D_horizontal
```

Nihai model taban arayüzü sürtünme açısını `δbase = 2/3 · φfoundation` alır. Bu oran **proje/modelleme varsayımıdır**; ayrı bir kaynak veya proje-zemin arayüz deneyiyle desteklenmedikçe bir kod hükmü ya da saha ölçümü gibi sunulmaz.

TEKNOFEST benchmark minimumu: **1.50**. Shear key olmadığı için anahtar kaynaklı ek direnç yoktur.

### Devrilme

Burun referansına göre direnç ve devirici momentler ayrıştırılır:

```text
FS_overturning = ΣM_resisting / ΣM_driving
```

TEKNOFEST benchmark minimumu: **1.50**.

### Taban basıncı

Sonuç bileşkesinin eksantrisitesi `e` ile `qMax/qMin` raporlanır. Tam temas bölgesinde taban reaksiyonu `e` üzerinden doğrusal olarak değişir; çekme oluşacaksa zemin çekme almadığı kabul edilerek kısmi temas/üçgensel basınç dağılımı kullanılır. Dolayısıyla eksantrisite cezası **`qMax` talep tarafında zaten taşınır**. PDF/Excel yalnız hesap motorunun senaryo sonucunu taşır.

## 4. Taşıma gücü — Terzaghi

Klasik sığ temel taşıma gücü biçimi:

```text
q_ult = c·Nc + q0·Nq + 1/2·γ·B·Nγ
q0 = γ·Df
FS_bearing = q_ult / qMax
```

Buradaki `B`, fiziksel temel genişliği `x1`'dir. `B' = B - 2e` raporda diagnostik olarak gösterilebilir ancak `q_ult` hesabında ikinci kez kapasite azaltımı için kullanılmaz; eksantrisite ve kısmi temas etkisi `qMax` hesabında yer alır. Böylece aynı eksantrisite etkisi hem kapasite (`B'`) hem talep (`qMax`) tarafında iki kez uygulanmaz.

TEKNOFEST benchmark minimum güvenlik katsayısı: **3.00**.

### φ = 34° benchmark kilidi

Kullanıcı-onaylı Excel benchmarkı aşağıdaki katsayıları içerir:

| Parametre | Onaylı değer |
|---|---:|
| `φ_foundation` | 34° |
| `Nc` | 52.64 |
| `Nq` | 36.50 |
| `Nγ` | 38.04 |

Bu üç katsayı **benchmark gerçeği** olarak korunur. Farklı bir kitap/tablo/formül ailesi aynı `φ` için farklı katsayı üretirse yazılım onaylı Excel değerini sessizce değiştirmez. Excel raporunun `Yöntem & Kaynak` sayfası senaryoda hesaplanan değerleri benchmark ile yan yana gösterir ve uyuşmazlığı QA uyarısı olarak görünür kılar.

Bu politika önemlidir çünkü `Nγ` başta olmak üzere taşıma gücü katsayıları literatürde seçilen formül ailesine göre değişebilir. FHWA da `Nγ` için farklı araştırmacıların farklı değerler verdiğini açıkça not eder. Bu nedenle “Terzaghi” adı tek başına bir katsayı tablosu seçimini belirsiz bırakmamalıdır.

**Kaynaklar:**

- Terzaghi, K. (1943), *Theoretical Soil Mechanics*, Wiley, DOI: <https://doi.org/10.1002/9780470172766>
- FHWA GEC No. 6, shallow-foundation bearing-capacity equation and factor discussion: <https://www.fhwa.dot.gov/engineering/geotech/pubs/010943.pdf>

## 5. Betonarme ön tarama — ACI CODE-318-25 referanslı

Betonarme gövde, burun ve topuk kesitlerinde kullanılan kesit/donatı yardımcılarının normatif referansı **ACI CODE-318-25: Building Code for Structural Concrete — Code Requirements and Commentary**'dir. Uygulamanın ürettiği RC sonuçları **ön boyutlandırma / preliminary screening** niteliğindedir; “tam ACI tasarımı”, “ACI uyumluluk sertifikası” veya nihai statik proje sonucu olarak sunulmaz.

ACI 318-25'in bu projedeki kapsamı:

- beton ve donatı tasarım özellikleri,
- kesit dayanımı,
- minimum/maksimum donatı ve detaylandırma kontrolleri,
- geliştirme/kenetlenme ve uygulanabilir RC şartları,
- dayanıklılık/örtü gibi RC tasarım konuları.

ACI 318-25 **şunların kaynağı değildir:** Coulomb toprak basıncı, kayma/devirilme geoteknik güvenliği, Terzaghi taşıma gücü, beton karışım reçetesi dozajı veya malzeme fiyatı/emisyon faktörü.

Ön tarama; moment/kesme talebi, temel donatı alanı, seçilen çap/aralık ve sınırlı kapasite kontrolleri sağlar. Nihai projede yük katsayıları ve tüm yük kombinasyonları, servisabilite/çatlak, dayanıklılık ve maruziyet, tam kesme/donatı tasarımı, ankraj/geliştirme, bindirme/kanca ve tüm detaylandırma hükümleri ayrıca mühendis tarafından uygulanmalıdır. Bu nedenle rapordaki RC `safe/marginal/unsafe` benzeri durumlar yalnız **ön tarama durumudur**.

TEKNOFEST benchmark RC girdileri `fy = 400 MPa`, `f'c = 21 MPa`, pas payı `70 mm` ve rötre/sıcaklık oranı `0.002` olarak kullanıcı tarafından onaylanmıştır. Bu değerler “ACI tarafından otomatik verilmiş reçete” diye etiketlenmez; proje/benchmark girdisi olarak ayrıştırılır.

**Resmî kaynak:** ACI'nin 2025 kod sayfası: <https://www.concrete.org/publications/typesofpublications/standards(codesandspecs)/suiteofcodes.aspx>

## 6. TEKNOFEST benchmark girdileri ve modelleme varsayımları

Bu tablo, kullanıcı-onaylı Excel değerlerinin rapor ve regresyon kontrollerinde referans alınan özetidir. Rapor katmanı farklı bir kaynaktan bulduğu değerle bunları otomatik güncellemez.

| Girdi | Değer | Statü / köken |
|---|---:|---|
| Sürşarj `q` | 30 kPa | TEKNOFEST benchmark girdisi |
| Dolgu eğimi `β` | 0° | Final sanal-düzlem konvansiyonu |
| Duvar/sanal-düzlem arayüzü `δ` | 0° | Final sanal-düzlem konvansiyonu; faydalı `Pa_v` yok |
| Dolgu `φ` | 30° | **Modelleme varsayımı**; saha/geoteknik kaynakla doğrulanmalı |
| Dolgu `γr` | 17.5 kN/m³ | TEKNOFEST benchmark girdisi |
| Temel zemini / ikinci zemin `γb` | 18.5 kN/m³ | TEKNOFEST benchmark girdisi |
| Beton `γc` | 23.5 kN/m³ | TEKNOFEST benchmark girdisi |
| Zemin kohezyonu `c` | 0 kPa | TEKNOFEST benchmark girdisi |
| Temel gömme derinliği `Df` | 0.75 m, zemin yüzeyinden temel alt kotuna | TEKNOFEST benchmark girdisi |
| Temel zemini `φ` | 34° | TEKNOFEST benchmark girdisi |
| Taban arayüzü `δbase` | `2/3 · φfoundation` | **Modelleme varsayımı**; kod/saha ölçümü diye sunulmaz |
| Kayma FS min | 1.50 | TEKNOFEST benchmark kabul eşiği |
| Devrilme FS min | 1.50 | TEKNOFEST benchmark kabul eşiği |
| Taşıma gücü FS min | 3.00 | TEKNOFEST benchmark kabul eşiği |
| Donatı akma dayanımı `fy` | 400 MPa | Proje/benchmark RC girdisi |
| Beton basınç dayanımı `f'c` | 21 MPa | Proje/benchmark RC girdisi |
| Pas payı | 0.07 m | Proje/benchmark RC girdisi |
| Rötre/sıcaklık oranı | 0.002 | Proje/benchmark RC girdisi |

`γr / γb / γc` isimleri kaynak Excel'deki sembol adlarını korur; rapor ekranında ayrıca fiziksel rol açıklaması gösterilmelidir.

## 7. Karbon metrikleri

### Aktif beton reçetesi üretim emisyonu

Her aktif malzeme için:

```text
E_i,m3 = amount_i [kg/m³] × EF_i [kgCO₂e/kg]
E_recipe,m3 = Σ E_i,m3
```

Bu metrik **donatı çeliğini içermez**. Donatı ayrı proje kalemidir.

### Toplam proje emisyonu

Raporlama ayrımı:

```text
E_project = E_recipe,project
          + E_rebar
          + E_site_machinery
          + E_concrete_logistics
```

Beton mikseri ve pompası makine hesabının parçasıysa `E_site_machinery`, bu iki alt kalem çıkarılarak sunulur; böylece lojistik ikinci kez toplanmaz. `E_project / concrete volume` ile `E_recipe,m3` farklı metriklerdir ve aynı etiket altında gösterilmez.

### Kullanıcı-onaylı emisyon faktörleri

| Malzeme | kgCO₂e/kg |
|---|---:|
| Çimento | 0.8 |
| Uçucu kül | 0.01 |
| GGBFS | 0.09 |
| Silis dumanı | 0.025 |
| Metakaolin | 0.33 |
| Doğal iri agrega | 0.04 |
| Doğal ince agrega | 0.004 |
| RCA, merkezi değer | 0.008 |
| RCA, izin verilen referans aralığı | 0.004–0.012 |
| Su | 0.0003 |
| Süperakışkanlaştırıcı | 1.88 |
| Donatı çeliği | 0.7 |
| NaOH | 1.915 |

Faktörler raporda `source/sourceUrl/region/year/notes` metadata'sıyla birlikte tutulmalıdır. Yukarıdaki sayılar kullanıcı-onaylı benchmark değerleridir; harici bir kaynakla sessizce değiştirilmez.

### Kaynaklı tamamlayıcı varsayılan

Kaynak veri setinde pozitif dozajla kullanılan ancak kullanıcı-onaylı Excel emisyon tablosunda ayrı katsayısı bulunmayan **hava sürükleyici katkı** için program, kullanıcı-onaylı benchmark tablosuna ekleme yapmadan ayrı bir tamamlayıcı varsayılan kullanır: **0.4393 kgCO₂e/kg**. Kaynak, EFCA / IBU doğrulanmış Model EPD `EPD-EFC-20210193-IBG1-EN` içindeki 1 kg beyan birimi için A1–A3 GWP-total değeridir. Bu kayıt `EF_air_entraining` olarak kaynak URL/yıl/metadata ile tutulur; kullanıcı tanımlı katsayıyla değiştirilebilir ve hiçbir zaman süperakışkanlaştırıcı katsayısıyla vekil olarak hesaplanmaz.

## 8. Maliyet metrikleri

Reçete-bazlı birim maliyet:

```text
C_recipe,m3 = Σ(amount_i [kg/m³] × unit_price_i [TL/kg])
```

Onaylı malzeme fiyatları **KDV hariç** baz fiyatlardır:

| Malzeme | TL/kg, KDV hariç |
|---|---:|
| Çimento | 3.3119 |
| Uçucu kül | 0.1420 |
| GGBFS | 2.40 |
| Silis dumanı | 49.94 |
| Metakaolin | 40.00 |
| Doğal iri agrega | 0.62 |
| Doğal ince agrega | 0.72 |
| RCA | 0.125 |
| Su | 0.0648 |
| Süperakışkanlaştırıcı | 42.00 |
| Donatı | 30.76 |
| NaOH | 73.4 |

Proje toplamında ayrıca KDV uygulanıyorsa bu, malzeme birim fiyatının parçası gibi gizlenmez; `vatPercent` gibi ayrı proje girdisiyle raporlanır.

Silis dumanı için **49.94 TL/kg + KDV** değeri 12 Eylül 2026 tarihinde Kompozit Pazarı'nın 1000 kg Mikrosilika (Silis Dumanı) ürün sayfasındaki canlı birim fiyatla yeniden doğrulanmıştır. Program malzeme fiyatını KDV hariç tutar; KDV proje toplamında ayrı uygulanır.

## 9. Döngüsellik / alternatif malzeme sınıflandırması

Döngüsellik üst metriği tek bir “geri dönüştürülmüş atık” kovası değildir. Köken etiketi korunur:

- `industrial_byproduct` — endüstriyel yan ürün,
- `recycled_waste` — geri dönüştürülmüş atık,
- `secondary_material` — alternatif mineral / ikincil malzeme,
- `alternative_mineral` — alternatif mineral / ikincil malzeme; metakaolin için tercih edilen açık sınıf,
- `virgin` — birincil malzeme,
- `unknown` — sınıflandırılmamış.

**Metakaolin**, kullanıcı-onaylı TEKNOFEST yaklaşımında üst döngüsellik/alternatif-malzeme metriğine dahil edilir ancak **geri dönüştürülmüş atık diye adlandırılmaz**. Raporlama etiketi `alternatif mineral / ikincil malzeme` olmalıdır.

## 10. Veri kökeni ve çatışma politikası

Öncelik sırası:

1. Kullanıcı-onaylı TEKNOFEST Excel benchmarkı — sayısal kabul testi kaynağı.
2. Senaryoda saklanan gerçek kullanıcı girdileri ve kaynak metadata'sı.
3. Yöntem/standart kaynakları — formülün ve kapsamın gerekçesi.
4. Genel varsayılanlar — yalnız açıkça “varsayılan” diye etiketlendiğinde.

Bir dış kaynak, tablo veya alternatif formül kullanıcı-onaylı Excel sayısıyla çelişirse rapor katmanı değeri **değiştirmez**. Çatışma QA uyarısı olarak görünür hale getirilir ve kök neden hesap motorunda/kaynak seçiminde çözülür.

## 11. Rapor parity kuralı

`src/retaining-wall/export/reportModel.ts`, PDF ve Excel'in ortak rapor semantiğidir. Yeni bir metrik eklenirken:

1. tanım önce ortak modelde yapılır,
2. PDF ve Excel aynı model alanını kullanır,
3. birim ve kapsam etiketi açık yazılır,
4. eksik veri `0` ile maskelenmez,
5. benchmark farkı sessizce normalize edilmez,
6. `src/retaining-wall/export/__tests__/reportModel.test.ts` parity/regresyon testi güncellenir.
