import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import {
  amountForMaterial,
  strengthAtAge,
  type SustainableConcreteMixResult,
} from './calculations';
import {
  SUSTAINABLE_MATERIAL_DEFINITIONS,
  STRENGTH_AGES,
  type EmissionFactors,
  type StrengthValues,
} from './types';

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function csvCell(value: string | number | null | undefined): string {
  if (value == null) return '';
  const text = String(value);
  return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function resultRow(result: SustainableConcreteMixResult): Array<string | number | null> {
  const { mix, waste, carbon, strengths } = result;
  const ageUnknownMeasurements = (mix.compressiveStrengthMeasurements ?? [])
    .filter((measurement) => measurement.ageDays == null)
    .map((measurement) => `${measurement.valueMpa} MPa`)
    .join(' | ') || null;
  return [
    mix.name,
    mix.mixNo ?? null,
    mix.materialSystem ?? null,
    mix.sourceRow ?? null,
    mix.literatureStudy ?? null,
    mix.sourceUrl ?? null,
    mix.cementKgM3,
    mix.flyAshKgM3,
    mix.ggbfsKgM3,
    mix.silicaFumeKgM3,
    mix.metakaolinKgM3,
    mix.naturalAggregateKgM3,
    mix.recycledAggregateKgM3,
    mix.waterKgM3,
    result.totalBinderKgM3,
    waste.mineralWasteKgM3,
    waste.mineralWastePercentOfBinder,
    waste.alternativeMineralKgM3,
    waste.alternativeMineralPercentOfBinder,
    waste.recycledAggregateWasteKgM3,
    waste.recycledAggregatePercentOfAggregate,
    waste.totalWasteKgM3,
    waste.wasteUseRatePercent,
    waste.circularAlternativeKgM3,
    waste.circularAlternativeRatePercent,
    strengths[7].mixMpa,
    strengths[28].mixMpa,
    strengths[56].mixMpa,
    strengths[90].mixMpa,
    ageUnknownMeasurements,
    carbon.totalKgCo2eM3,
    carbon.reductionPercent,
  ];
}

const RESULT_HEADERS = [
  'Karışım',
  'Karışım No',
  'Malzeme sistemi',
  'Kaynak satırı',
  'Literatür çalışma',
  'Kaynak URL',
  'Çimento (kg/m³)',
  'Uçucu kül (kg/m³)',
  'GGBFS (kg/m³)',
  'Silis dumanı (kg/m³)',
  'Metakaolin (kg/m³)',
  'Doğal agrega (kg/m³)',
  'Geri dönüştürülmüş agrega (kg/m³)',
  'Su (kg/m³)',
  'Toplam bağlayıcı (kg/m³)',
  'Geri kazanılmış mineral yan ürün (kg/m³)',
  'Geri kazanılmış mineral yan ürün / bağlayıcı (%)',
  'Alternatif mineral — metakaolin (kg/m³)',
  'Alternatif mineral / bağlayıcı (%)',
  'Geri dönüştürülmüş agrega atığı (kg/m³)',
  'Geri dönüştürülmüş agrega / agrega (%)',
  'Toplam geri kazanılmış/atık malzeme (kg/m³)',
  'Geri kazanılmış/atık kullanım oranı (%)',
  'Üst döngüsellik + alternatif malzeme (kg/m³)',
  'Üst döngüsellik + alternatif malzeme oranı (%)',
  '7 gün (MPa)',
  '28 gün (MPa)',
  '56 gün (MPa)',
  '90 gün (MPa)',
  'Yaşı belirtilmeyen ölçüm',
  'Karbon ayak izi (kg CO₂e/m³)',
  'CO₂ azaltımı (%)',
];

export function exportSustainableConcreteToCsv(
  results: SustainableConcreteMixResult[],
  filename = 'surdurulebilir-beton-sonuclari.csv',
): void {
  const lines = [
    RESULT_HEADERS.map(csvCell).join(';'),
    ...results.map((result) => resultRow(result).map(csvCell).join(';')),
  ];
  downloadBlob(new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' }), filename);
}

function styleWorksheetHeader(row: ExcelJS.Row): void {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF164E63' } };
  row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  row.height = 32;
}

function addRowsAsTable(worksheet: ExcelJS.Worksheet, headers: string[], rows: Array<Array<string | number | null>>): void {
  worksheet.addRow(headers);
  styleWorksheetHeader(worksheet.getRow(1));
  rows.forEach((values, index) => {
    const row = worksheet.addRow(values);
    row.alignment = { vertical: 'middle' };
    if (index % 2 === 1) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDFA' } };
  });
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + Math.min(headers.length, 26))}1` };
  worksheet.columns.forEach((column) => {
    column.width = Math.min(34, Math.max(14, (column.header?.toString().length ?? 12) + 3));
  });
}

export async function exportSustainableConcreteToExcel(payload: {
  results: SustainableConcreteMixResult[];
  factors: EmissionFactors;
  referenceStrengths: StrengthValues;
  selected?: SustainableConcreteMixResult;
  filename?: string;
}): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'StructFlow';
  workbook.created = new Date();

  const resultSheet = workbook.addWorksheet('Karışım sonuçları');
  addRowsAsTable(resultSheet, RESULT_HEADERS, payload.results.map(resultRow));

  const factorSheet = workbook.addWorksheet('Emisyon faktörleri');
  addRowsAsTable(
    factorSheet,
    ['Malzeme', 'Faktör (kg CO₂e/kg)', 'Durum'],
    SUSTAINABLE_MATERIAL_DEFINITIONS.map(({ key, label }) => [
      label,
      payload.factors[key],
      payload.factors[key] == null ? 'Eksik — karbon hesaplanamaz' : 'Girildi',
    ]),
  );

  const referenceSheet = workbook.addWorksheet('Referans ve formüller');
  addRowsAsTable(referenceSheet, ['Kalem', 'Değer', 'Birim / açıklama'], [
    ['Referans 7 gün dayanımı', payload.referenceStrengths.strength7DaysMpa, 'MPa'],
    ['Referans 28 gün dayanımı', payload.referenceStrengths.strength28DaysMpa, 'MPa'],
    ['Referans 56 gün dayanımı', payload.referenceStrengths.strength56DaysMpa, 'MPa'],
    ['Referans 90 gün dayanımı', payload.referenceStrengths.strength90DaysMpa, 'MPa'],
    ['Toplam bağlayıcı', 'Çimento + uçucu kül + GGBFS + silis dumanı + metakaolin', 'kg/m³'],
    ['Geri kazanılmış mineral yan ürün', 'Uçucu kül + GGBFS + silis dumanı', 'kg/m³'],
    ['Alternatif mineral malzeme', 'Metakaolin (geri dönüştürülmüş atık olarak sınıflandırılmaz)', 'kg/m³'],
    ['Toplam geri kazanılmış/atık malzeme', 'Geri kazanılmış mineral yan ürün + geri dönüştürülmüş agrega', 'kg/m³'],
    ['Geri kazanılmış/atık kullanım oranı', 'Toplam geri kazanılmış/atık malzeme / (toplam bağlayıcı + toplam agrega) × 100', '% kuru katı'],
    ['Üst döngüsellik + alternatif malzeme', 'Toplam geri kazanılmış/atık malzeme + metakaolin', 'kg/m³'],
    ['Üst döngüsellik + alternatif oranı', '(Toplam geri kazanılmış/atık malzeme + metakaolin) / (toplam bağlayıcı + toplam agrega) × 100', '% kuru katı'],
    ['Referans modu', payload.selected?.referenceMode ?? 'Seçilmedi', 'none / selected / theoretical'],
    ['Referans karışımı', payload.selected?.referenceMix.name ?? 'Referans seçilmedi', payload.selected?.referenceMode === 'theoretical' ? 'Açıkça seçilmiş teorik referans' : 'Literatür seçimi veya yok'],
    ['Karbon ayak izi', 'Kullanılan malzeme miktarı × emisyon faktörü', 'kg CO₂e/m³'],
  ]);

  if (payload.selected) {
    const selectedSheet = workbook.addWorksheet('Seçili karışım');
    const selected = payload.selected;
    addRowsAsTable(selectedSheet, ['Girdi / sonuç', 'Değer', 'Birim'], [
      ['Karışım', selected.mix.name, ''],
      ['Toplam bağlayıcı', selected.totalBinderKgM3, 'kg/m³'],
      ['Geri kazanılmış mineral yan ürün', selected.waste.mineralWasteKgM3, 'kg/m³'],
      ['Alternatif mineral — metakaolin', selected.waste.alternativeMineralKgM3, 'kg/m³'],
      ['Geri dönüştürülmüş agrega atığı', selected.waste.recycledAggregateWasteKgM3, 'kg/m³'],
      ['Toplam geri kazanılmış/atık malzeme', selected.waste.totalWasteKgM3, 'kg/m³'],
      ['Geri kazanılmış/atık kullanım oranı', selected.waste.wasteUseRatePercent, '%'],
      ['Üst döngüsellik + alternatif malzeme', selected.waste.circularAlternativeKgM3, 'kg/m³'],
      ['Üst döngüsellik + alternatif malzeme oranı', selected.waste.circularAlternativeRatePercent, '%'],
      ['Karbon ayak izi', selected.carbon.totalKgCo2eM3, 'kg CO₂e/m³'],
      ['CO₂ azaltımı', selected.carbon.reductionPercent, '%'],
      ...STRENGTH_AGES.map((age) => [`${age} gün basınç dayanımı`, strengthAtAge(selected.mix, age), 'MPa']),
    ]);
    const composition = selectedSheet.addRow([]);
    composition.getCell(1).value = 'Referans karışımı bileşimi';
    composition.font = { bold: true, color: { argb: 'FF0F766E' } };
    Object.entries(selected.referenceMix).forEach(([key, value]) => selectedSheet.addRow([key, value, 'kg/m³']));
  }

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), payload.filename ?? 'surdurulebilir-beton-raporu.xlsx');
}

function pdfValue(value: number | null, digits = 2): string {
  return value == null ? '—' : value.toLocaleString('tr-TR', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function exportSustainableConcreteToPdf(
  result: SustainableConcreteMixResult,
  filename = 'surdurulebilir-beton-secili-karisim.pdf',
): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const left = 16;
  let y = 18;
  const write = (text: string, size = 9, color = [30, 41, 59] as [number, number, number]): void => {
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(text, left, y);
    y += size >= 14 ? 8 : 5;
  };

  write('StructFlow — Sürdürülebilir beton raporu', 16, [15, 118, 110]);
  write(result.mix.name, 12);
  write(`Kaynak: ${result.mix.source ?? 'Belirtilmedi'}`, 8, [71, 85, 105]);
  y += 3;
  write('Girdiler', 11, [15, 118, 110]);
  for (const definition of SUSTAINABLE_MATERIAL_DEFINITIONS) {
    write(`${definition.label}: ${pdfValue(amountForMaterial(result.mix, definition.key))} kg/m³`, 9);
  }
  write(`Su: ${pdfValue(result.mix.waterKgM3)} kg/m³`, 9);
  y += 2;
  write('Hesaplanan sonuçlar', 11, [15, 118, 110]);
  write(`Toplam bağlayıcı: ${pdfValue(result.totalBinderKgM3)} kg/m³`, 9);
  write(`Geri kazanılmış mineral yan ürün: ${pdfValue(result.waste.mineralWasteKgM3)} kg/m³ (${pdfValue(result.waste.mineralWastePercentOfBinder, 1)}%)`, 9);
  write(`Alternatif mineral — metakaolin: ${pdfValue(result.waste.alternativeMineralKgM3)} kg/m³ (${pdfValue(result.waste.alternativeMineralPercentOfBinder, 1)}%)`, 9);
  write(`Geri dönüştürülmüş agrega atığı: ${pdfValue(result.waste.recycledAggregateWasteKgM3)} kg/m³ (${pdfValue(result.waste.recycledAggregatePercentOfAggregate, 1)}%)`, 9);
  write(`Toplam geri kazanılmış/atık malzeme: ${pdfValue(result.waste.totalWasteKgM3)} kg/m³; oran: ${pdfValue(result.waste.wasteUseRatePercent, 1)}%`, 9);
  write(`Üst döngüsellik + alternatif malzeme: ${pdfValue(result.waste.circularAlternativeKgM3)} kg/m³; oran: ${pdfValue(result.waste.circularAlternativeRatePercent, 1)}%`, 9);
  write(`Karbon ayak izi: ${pdfValue(result.carbon.totalKgCo2eM3)} kg CO2e/m³; azaltım: ${pdfValue(result.carbon.reductionPercent, 1)}%`, 9);
  y += 2;
  write('Basınç dayanımı / referans karşılaştırması', 11, [15, 118, 110]);
  for (const age of STRENGTH_AGES) {
    const strength = result.strengths[age];
    write(`${age} gün: ${pdfValue(strength.mixMpa)} MPa | referans ${pdfValue(strength.referenceMpa)} MPa | fark ${pdfValue(strength.differenceMpa)} MPa (${pdfValue(strength.differencePercent, 1)}%)`, 9);
  }
  y += 2;
  write('Formüller ve varsayımlar', 11, [15, 118, 110]);
  [
    'Toplam bağlayıcı = çimento + uçucu kül + GGBFS + silis dumanı + metakaolin',
    'Geri kazanılmış mineral yan ürün = uçucu kül + GGBFS + silis dumanı; metakaolin bu atık toplamına dahil değildir',
    'Toplam geri kazanılmış/atık malzeme = geri kazanılmış mineral yan ürün + geri dönüştürülmüş agrega',
    'Üst döngüsellik + alternatif malzeme = toplam geri kazanılmış/atık malzeme + metakaolin',
    result.referenceMode === 'theoretical'
      ? 'Referans = aynı bağlayıcı miktarı tamamen çimento; bu senaryoda teorik olduğu açıkça belirtilir'
      : result.referenceMode === 'selected'
        ? 'Referans = kullanıcı tarafından seçilmiş literatür karışımı'
        : 'Referans seçilmedi; karşılaştırma farkları hesaplanmadı',
    'Karbon = kullanılan malzeme miktarı × emisyon faktörü; eksik faktör uydurulmaz',
  ].forEach((line) => {
    const wrapped = doc.splitTextToSize(line, 178) as string[];
    wrapped.forEach((part) => write(`• ${part}`, 8, [71, 85, 105]));
  });
  doc.save(filename);
}
