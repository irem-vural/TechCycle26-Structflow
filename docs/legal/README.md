# Lisans ve Hukuki Belgeler

Bu klasör, **TechCycle26-Structflow** projesinin ana lisans durumu ile üçüncü taraf yazılım/varlık envanterini birbirinden ayırır.

## Ana proje lisansı

Repository kökündeki [`LICENSE`](../../LICENSE) dosyası projenin özgün kaynak kodu, dokümantasyonu ve özgün varlıkları için geçerlidir.

Proje **proprietary / All Rights Reserved** statüsündedir. Repository'nin public olması; kodu kullanma, değiştirme, dağıtma veya ticari olarak değerlendirme izni vermez.

Kısa bildirim için repository kökündeki [`NOTICE`](../../NOTICE) dosyasına bakın.

## Üçüncü taraf bağımlılıklar

Üçüncü taraf npm paketleri ana proje lisansından bağımsızdır ve kendi lisans koşullarına tabidir.

- [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md) — insan okunabilir bağımlılık/lisans envanteri
- [`THIRD-PARTY-NOTICES.json`](THIRD-PARTY-NOTICES.json) — makine okunabilir envanter
- [`TEKNOFEST-10.4-Acik-Kaynak-Lisans-Uygunlugu-Raporu.md`](TEKNOFEST-10.4-Acik-Kaynak-Lisans-Uygunlugu-Raporu.md) — teknik uygunluk raporu

Envanteri güncellemek için:

```bash
npm run licenses:inventory
```

Bu envanter teknik takip amacı taşır ve hukuki mütalaa değildir. Dağıtım öncesinde üçüncü taraf lisans/attribution yükümlülükleri ayrıca doğrulanmalıdır.
