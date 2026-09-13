# Artifacts Alanı

Bu klasör ürün kaynak kodundan ayrı tutulması gereken çıktı, arşiv ve geçici çalışma materyalleri içindir. Yeni render, rapor hazırlık dosyası veya deneysel çıktı doğrudan proje köküne yazılmamalıdır.

## `archive/`

Geçmişte proje kökünde bulunan ve silinmesi yerine korunması gereken çıktılar burada tutulur.

- `archive/output/` — geçmiş export/rapor çıktıları.
- `archive/outputs/` — geçmiş video, spreadsheet ve yardımcı çıktı setleri.

Runtime uygulama kodunun parçası değildir.

## `generated/`

Yeni otomatik üretilen dosyalar içindir ve Git'e alınmaz. Remotion render/poster çıktıları `generated/video/` altına gider.

## `workbench/`

Geçici hazırlık ve ara çalışma dosyaları içindir; yeni içerikleri Git'e alınmaz.

- `workbench/pdf-preparation/` — PDF hazırlama/QA ara dosyaları.
- `workbench/hallmark/` — araç çalışma kayıtları.
- `workbench/spreadsheet-runtime/` — spreadsheet inceleme/üretim ara verileri.

Bu alan uygulamanın çalışması için gerekli değildir.
