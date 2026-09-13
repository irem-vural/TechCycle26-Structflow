import ExcelJS from 'exceljs';
import type { Scenario } from '@/retaining-wall/types';
import { calculateCost } from '@/retaining-wall/engine/cost';
import {
  evaluateActiveAgainstReference,
  evaluateOptimizationScenario,
  getOptimizationScenario,
  TEKNOFEST_DATASET_LABEL,
} from '@/retaining-wall/material-selection/optimization';
import { calculateZeroWasteImpact } from '@/retaining-wall/material-selection/zeroWasteImpact';
import { getDefaultMaterialPrice } from '@/retaining-wall/material-selection/defaultPrices';
import {
  buildScenarioReportModel,
  circularityOriginLabel,
  REPORT_REFERENCES,
  TEKNOFEST_BEARING_BENCHMARK,
  TEKNOFEST_RC_BENCHMARK,
} from './reportModel';

// ── Helpers ────────────────────────────────────────────────────

function n(v: number | null | undefined, dec = 2): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toFixed(dec);
}

function pct(num: number | null | undefined, total: number | null | undefined): string {
  if (num == null || total == null || !Number.isFinite(num) || !Number.isFinite(total) || total === 0) return '—';
  return (num / total * 100).toFixed(1) + '%';
}

function changePct(value: number | null | undefined, reference: number | null | undefined): string {
  if (value == null || reference == null || !Number.isFinite(value) || !Number.isFinite(reference) || reference === 0) return '—';
  const change = (value - reference) / Math.abs(reference) * 100;
  return `${change > 0 ? '+' : ''}${change.toFixed(1)}%`;
}

// ── Palette ────────────────────────────────────────────────────

const C = {
  headerBg:    '1E293B',  // slate-800
  headerFg:    'FFFFFF',
  sectionBg:   '334155',  // slate-700
  sectionFg:   'F1F5F9',
  titleBg:     '0F172A',  // slate-900
  titleFg:     '38BDF8',  // sky-400
  zebraLight:  'F8FAFC',
  zebradark:   'EFF6FF',
  okBg:        'DCFCE7',  // green-100
  okFg:        '166534',  // green-800
  nokBg:       'FEE2E2',  // red-100
  nokFg:       '991B1B',  // red-800
  warnBg:      'FEF9C3',
  warnFg:      '854D0E',
  subtotalBg:  'DBEAFE',
  totalBg:     'BFDBFE',
  borderColor: 'CBD5E1',
} as const;

type FillColor = string;

function fill(color: FillColor): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + color } };
}

function fontStyle(bold = false, color = '1E293B', size = 10): Partial<ExcelJS.Font> {
  return { bold, color: { argb: 'FF' + color }, size };
}

function thinBorder(): Partial<ExcelJS.Borders> {
  const s: ExcelJS.BorderStyle = 'thin';
  const c = { argb: 'FF' + C.borderColor };
  return { top: { style: s, color: c }, left: { style: s, color: c }, bottom: { style: s, color: c }, right: { style: s, color: c } };
}

// ── Row builders ───────────────────────────────────────────────

function addTitle(ws: ExcelJS.Worksheet, text: string, cols: number) {
  const row = ws.addRow([text]);
  ws.mergeCells(row.number, 1, row.number, cols);
  row.getCell(1).fill = fill(C.titleBg);
  row.getCell(1).font = fontStyle(true, C.titleFg, 13);
  row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
  row.height = 24;
}

function addHeader(ws: ExcelJS.Worksheet, values: (string | number)[], colCount: number) {
  const row = ws.addRow(values);
  for (let c = 1; c <= colCount; c++) {
    row.getCell(c).fill = fill(C.headerBg);
    row.getCell(c).font = fontStyle(true, C.headerFg, 10);
    row.getCell(c).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    row.getCell(c).border = thinBorder();
  }
  row.height = 18;
}

function addSection(ws: ExcelJS.Worksheet, label: string, cols: number) {
  const row = ws.addRow([label]);
  ws.mergeCells(row.number, 1, row.number, cols);
  row.getCell(1).fill = fill(C.sectionBg);
  row.getCell(1).font = fontStyle(true, C.sectionFg, 10);
  row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
  row.height = 16;
}

function addData(
  ws: ExcelJS.Worksheet,
  values: (string | number)[],
  colCount: number,
  rowBg?: string,
  isTotal = false,
) {
  const row = ws.addRow(values);
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    const bg = isTotal ? C.totalBg : (rowBg ?? C.zebraLight);
    cell.fill = fill(bg);
    cell.font = fontStyle(isTotal, isTotal ? '1E40AF' : '1E293B', 10);
    cell.border = thinBorder();
    if (c > 1 && typeof values[c - 1] === 'number') {
      cell.alignment = { horizontal: 'right' };
    }
  }
  row.height = 15;
}

function addStatus(ws: ExcelJS.Worksheet, label: string, fs: string, fsMin: string | number, status: string | undefined, cols: number, extra: (string | number)[] = []) {
  const normalizedStatus = status?.toLowerCase();
  const ok = normalizedStatus === 'ok' || normalizedStatus === 'pass' || normalizedStatus === 'geçti' || normalizedStatus === 'safe' || normalizedStatus === 'marginal';
  const values: (string | number)[] = [label, fs as string, fsMin as string, status ?? '—', ...extra];
  const row = ws.addRow(values);
  for (let c = 1; c <= cols; c++) {
    row.getCell(c).border = thinBorder();
    row.getCell(c).font = fontStyle(false, '1E293B', 10);
    row.getCell(c).fill = fill(ok ? C.okBg : C.nokBg);
  }
  row.getCell(4).font = fontStyle(true, ok ? C.okFg : C.nokFg, 10);
  row.getCell(4).fill = fill(ok ? C.okBg : C.nokBg);
  row.height = 15;
}

function setColWidths(ws: ExcelJS.Worksheet, widths: number[]) {
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
}

function addEmptyRow(ws: ExcelJS.Worksheet) {
  ws.addRow([]);
}

// ── Main export ────────────────────────────────────────────────

export async function buildScenarioWorkbook(scenario: Scenario, generatedAt = new Date()): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'StructFlow';
  wb.created = generatedAt;

  const { input, logistics, stability, internalStability: internal, quantities, cost, emissions, concreteMix, mixMetrics } = scenario;
  const report = buildScenarioReportModel(scenario);
  const customCoefficients = new Map(Object.entries(scenario.customCoefficients ?? {}));
  const geo = input.geometry;
  const L = report.geometry.wallLengthM ?? geo.L;
  const now = generatedAt.toLocaleString('tr-TR');
  const optimizationScenario = getOptimizationScenario(concreteMix.referenceMixId);
  const optimization = evaluateOptimizationScenario(
    optimizationScenario,
    concreteMix,
    quantities?.concreteVolume ?? 0,
    customCoefficients,
  );
  const activeReference = evaluateActiveAgainstReference(
    concreteMix,
    optimizationScenario,
    quantities?.concreteVolume ?? 0,
    customCoefficients,
  );
  const zeroWaste = calculateZeroWasteImpact(scenario);
  const emissionByMaterial = new Map((emissions?.materials.byMaterial ?? []).map((item) => [item.id, item]));
  const concreteUnitCostFor = (mix: Scenario['concreteMix']): number | null => {
    if (!quantities || !emissions) return null;
    return calculateCost({
      quantities,
      emissions,
      logistics,
      concreteClass: input.concreteClass,
      concreteMix: mix,
    }).concreteCostPerM3 ?? null;
  };
  const activeConcreteCostPerM3 = concreteUnitCostFor(concreteMix);
  const activeReferenceCostPerM3 = concreteUnitCostFor(activeReference.referenceMix);
  const optimizationReferenceCostPerM3 = concreteUnitCostFor(optimization.referenceMix);
  const optimizationCandidateCostPerM3 = concreteUnitCostFor(optimization.candidateMix);
  const zeroWasteProjectTotalLabel = zeroWaste.wallLengthM != null && zeroWaste.wallLengthM > 0
    ? `${n(zeroWaste.wallLengthM, 1)} m duvar toplamı`
    : 'Proje toplamı';

  // ── 1. ÖZET ──────────────────────────────────────────────────
  const wsOzet = wb.addWorksheet('Özet', { properties: { tabColor: { argb: 'FF0EA5E9' } } });
  setColWidths(wsOzet, [36, 20, 12, 36, 20, 14]);

  addTitle(wsOzet, 'StructFlow — İstinat Duvarı Analiz Raporu', 6);
  const infoRow = wsOzet.addRow(['Senaryo:', scenario.name, '', 'Tarih:', now, '']);
  infoRow.getCell(1).font = fontStyle(true);
  infoRow.getCell(4).font = fontStyle(true);
  addEmptyRow(wsOzet);

  addSection(wsOzet, 'GEOMETRİ PARAMETRELERİ', 6);
  addHeader(wsOzet, ['Parametre', 'Değer', 'Birim', 'Parametre', 'Değer', 'Birim'], 6);

  const geoLeft: [string, string, string][] = [
    ['H — Serbest Gövde Yüksekliği (taban plağı üstünden)', n(geo.H), 'm'],
    ['L — Duvar Uzunluğu', n(L, 1), 'm'],
    ['x1 — Temel Genişliği', n(geo.x1), 'm'],
    ['x5 — Temel Plağı Kalınlığı', n(geo.x5), 'm'],
  ];
  const geoRight: [string, string, string][] = [
    ['x2 — Burun Uzunluğu', n(geo.x2), 'm'],
    ['x3 — Gövde Alt Kalınlığı', n(geo.x3), 'm'],
    ['x4 — Gövde Üst Kalınlığı', n(geo.x4), 'm'],
    ['Df — Temel Derinliği', n(geo.Df), 'm'],
  ];
  for (let i = 0; i < 4; i++) {
    const bg = i % 2 === 0 ? C.zebraLight : C.zebradark;
    addData(wsOzet, [...geoLeft[i], ...geoRight[i]], 6, bg);
  }

  addEmptyRow(wsOzet);
  addSection(wsOzet, 'STABİLİTE SONUÇLARI', 6);
  addHeader(wsOzet, ['Kontrol', 'FS Hesaplanan', 'FS Min', 'Durum', 'e (m)', 'qMax/qMin (kPa)'], 6);
  addStatus(wsOzet, 'Kayma', n(stability?.sliding.factorOfSafety, 3), stability?.sliding.requiredFS ?? '—', stability?.sliding.status, 6, [n(stability?.eccentricity, 4), n(stability?.qMax, 2)]);
  addStatus(wsOzet, 'Devrilme', n(stability?.overturning.factorOfSafety, 3), stability?.overturning.requiredFS ?? '—', stability?.overturning.status, 6);
  addStatus(wsOzet, 'Taşıma Gücü', n(stability?.bearingCapacity.factorOfSafety, 3), stability?.bearingCapacity.requiredFS ?? '—', stability?.bearingCapacity.status, 6, ['', n(stability?.qMin, 2)]);

  addEmptyRow(wsOzet);
  addSection(wsOzet, 'MALİYET & EMİSYON ÖZETİ', 6);
  addHeader(wsOzet, ['Kalem', 'Maliyet Değer', 'Birim', 'Emisyon Kalemi', 'Değer', 'Birim'], 6);
  const summaryRows: (string | number)[][] = [
    ['Aktif reçete', concreteMix.name, '—', 'Beton sınıfı', concreteMix.targetConcreteClass, 'sabit hedef'],
    ['Toplam Maliyet (KDV dahil)', n(cost?.totalCost, 0), '₺', 'Toplam CO₂e', n(emissions?.grandTotal, 1), 'kg CO₂e'],
    ['Beton Maliyeti (m³)', n(cost?.concreteCostPerM3 ?? cost?.recipeCostPerM3, 0), '₺/m³', 'Toplam proje CO₂e / beton hacmi', n(report.carbon.grandTotalPerConcreteM3, 2), 'kg CO₂e/m³ beton'],
    ['Birim Maliyet (1 m duvar)', n(cost?.unitCostPerMeterWall, 0), '₺/m', 'Toplam proje CO₂e / 1 m duvar', n(report.carbon.grandTotalPerWallMeter, 2), 'kg CO₂e/m'],
    ['Beton Hacmi (toplam)', n(quantities?.concreteVolume, 3), 'm³', 'Duvar Uzunluğu (L)', n(L, 1), 'm'],
    ['Beton Hacmi (1 m)', n(quantities?.concreteVolumePerMeter, 3), 'm³/m', 'Aktif maliyet modu', concreteMix.priceMode, ''],
  ];
  summaryRows.forEach((r, i) => addData(wsOzet, r, 6, i % 2 === 0 ? C.zebraLight : C.zebradark));

  // ── 1B. YÖNTEM, FORMÜL VE KAYNAK ──────────────────────────────
  const wsMethod = wb.addWorksheet('Yöntem & Kaynak', { properties: { tabColor: { argb: 'FF06B6D4' } } });
  setColWidths(wsMethod, [34, 28, 20, 60, 54]);
  addTitle(wsMethod, 'Hesap Yöntemi, Varsayımlar ve Veri Kökeni', 5);
  addSection(wsMethod, 'YÖNTEM SINIRLARI', 5);
  addHeader(wsMethod, ['Konu', 'Proje yöntemi', 'Senaryoda kayıtlı', 'Kapsam / tanım', 'Kaynak'], 5);
  [
    ['Yanal toprak basıncı', report.methods.lateralEarthPressure, report.methods.scenarioLateralEarthPressure, 'Coulomb yalnız yanal toprak basıncı içindir; RC standardı geoteknik hesabı tanımlamaz.', REPORT_REFERENCES.fhwaCoulomb.label],
    ['Aktif basınç konvansiyonu', 'Düşey sanal düzlem', report.methods.activeEarthPressureConventionConsistent ? 'Uyumlu' : 'UYUMSUZ', report.methods.activeEarthPressureConvention, 'Final proje konvansiyonu'],
    ['Taşıma gücü', report.methods.bearingCapacity, report.methods.scenarioBearingCapacity, 'Sığ temel taşıma gücü kontrolü; rapor senaryo sonucunu yeniden hesaplamaz.', REPORT_REFERENCES.terzaghi1943.label],
    ['Betonarme ön tarama', report.methods.reinforcedConcrete, 'PRELIMINARY SCREENING', report.methods.reinforcedConcreteScope, REPORT_REFERENCES.aci31825.label],
  ].forEach((row, index) => addData(wsMethod, row, 5, index % 2 === 0 ? C.zebraLight : C.zebradark));

  addEmptyRow(wsMethod);
  addSection(wsMethod, 'SENARYO GİRDİLERİ VE GEOMETRİ TANIMLARI', 5);
  addHeader(wsMethod, ['Parametre', 'Değer', 'Birim', 'Tanım', 'Not'], 5);
  [
    ['H', n(report.geometry.freeStemHeightM, 3), 'm', report.geometry.freeStemHeightDefinition, 'Temel plağı kalınlığı H değerine dahil değildir.'],
    ['Kesme anahtarı', 'Yok', '', 'Shear key nihai mimariden kaldırılmıştır.', 'Raporlama katmanı x7/x8 üzerinden ek direnç iddia etmez.'],
    ['Sürşarj q', n(input.surchargeLoad, 3), 'kPa', 'Dolgu üst yüzeyindeki düzgün yayılı yük', 'Senaryo girdisi'],
    ['Dolgu eğimi β', n(input.backfillSoil.beta, 3), '°', 'Coulomb dolgu yüzeyi eğimi', 'Senaryo girdisi'],
    ['Dolgu φ', n(report.assumptions.backfillPhiDeg, 3), '°', 'Arka dolgu içsel sürtünme açısı', report.assumptions.backfillPhiBasis],
    ['Dolgu γ', n(input.backfillSoil.gamma, 3), 'kN/m³', 'Arka dolgu birim hacim ağırlığı', 'Senaryo girdisi'],
    ['Temel zemini γ', n(input.foundationSoil.gamma, 3), 'kN/m³', 'Taşıma gücü / temel zemini birim hacim ağırlığı', 'Senaryo girdisi'],
    ['Temel zemini φ', n(input.foundationSoil.phi, 3), '°', 'Temel zemini içsel sürtünme açısı', 'Senaryo girdisi'],
    ['Temel zemini c', n(input.foundationSoil.c, 3), 'kPa', 'Temel zemini kohezyonu', 'Senaryo girdisi'],
    ['Df', n(report.geometry.foundationEmbedmentDepthM, 3), 'm', report.geometry.foundationEmbedmentDepthDefinition, 'Pasif yanal basınç derinliğinin fiziksel tanımı'],
    ['Pasif basınç derinliği', n(report.geometry.passivePressureDepthM, 3), 'm', report.geometry.passivePressureDepthDefinition, report.geometry.passivePressureDepthConsistent == null ? 'Senaryo sonucunda pasif derinlik kaydı yok.' : report.geometry.passivePressureDepthConsistent ? 'Senaryo sonucu Df ile tutarlı.' : `UYUMSUZ — senaryo ${n(report.geometry.scenarioPassivePressureDepthM, 3)} m kullanıyor.`],
    ['Burun üstü zemin örtüsü', n(report.geometry.toeOverburdenHeightM, 3), 'm', report.geometry.toeOverburdenHeightDefinition, 'Yalnız burun üzerindeki düşey zemin ağırlığı için'],
    ['Taban arayüzü δbase', n(report.assumptions.baseInterfaceFrictionAngleDeg, 3), '°', '2/3 · φfoundation', report.assumptions.baseInterfaceFrictionBasis],
  ].forEach((row, index) => addData(wsMethod, row, 5, index % 2 === 0 ? C.zebraLight : C.zebradark));

  addEmptyRow(wsMethod);
  addSection(wsMethod, 'STABİLİTE EŞİKLERİ VE TAŞIMA GÜCÜ KATSAYILARI', 5);
  addHeader(wsMethod, ['Kalem', 'Senaryo', 'TEKNOFEST benchmark', 'Birim', 'QA notu'], 5);
  [
    ['Kayma FS min', n(stability?.sliding.requiredFS, 3), '1.250', '—', 'Proje kabul sınırı 1.250; senaryo değeri aynı motor sonucundan raporlanır.'],
    ['Devrilme FS min', n(stability?.overturning.requiredFS, 3), '1.500', '—', 'Senaryo değeri raporlanır; benchmark sessizce üzerine yazılmaz.'],
    ['Taşıma gücü FS min', n(stability?.bearingCapacity.requiredFS, 3), '3.000', '—', 'Senaryo değeri raporlanır; benchmark sessizce üzerine yazılmaz.'],
    ['Terzaghi kapasite genişliği B', n(report.bearingFactors.footingWidthM, 3), 'Tam fiziksel genişlik', 'm', report.assumptions.bearingWidthBasis],
    ['Diagnostik etkili genişlik B′', n(report.bearingFactors.effectiveBearingWidthM, 3), 'Kapasitede kullanılmaz', 'm', 'B′=B-2e yalnız diagnostik; q_ult teriminde kullanılmaz.'],
    ['Eksantrisite e', n(report.bearingFactors.eccentricityM, 4), 'qMax içinde', 'm', report.assumptions.qMaxBasis],
    ['qMax', n(report.bearingFactors.qMaxKpa, 3), 'FS talep tarafı', 'kPa', 'FS_bearing = q_ult / qMax; eksantrisite qMax içinde taşınır.'],
    ['Nc (φ=34° benchmark)', n(report.bearingFactors.Nc, 3), n(TEKNOFEST_BEARING_BENCHMARK.Nc, 2), '—', report.bearingFactors.benchmarkApplies ? (report.bearingFactors.benchmarkMatches ? 'Eşleşiyor' : 'EŞLEŞMİYOR — onaylı değer değiştirilmedi') : 'Benchmark yalnız φ=34° için uygulanır.'],
    ['Nq (φ=34° benchmark)', n(report.bearingFactors.Nq, 3), n(TEKNOFEST_BEARING_BENCHMARK.Nq, 2), '—', report.bearingFactors.benchmarkApplies ? (report.bearingFactors.benchmarkMatches ? 'Eşleşiyor' : 'EŞLEŞMİYOR — onaylı değer değiştirilmedi') : 'Benchmark yalnız φ=34° için uygulanır.'],
    ['Nγ (φ=34° benchmark)', n(report.bearingFactors.Ngamma, 3), n(TEKNOFEST_BEARING_BENCHMARK.Ngamma, 2), '—', report.bearingFactors.benchmarkApplies ? (report.bearingFactors.benchmarkMatches ? 'Eşleşiyor' : 'EŞLEŞMİYOR — onaylı değer değiştirilmedi') : 'Benchmark yalnız φ=34° için uygulanır.'],
    ["f'c", n(report.rcDesign.fcMpa, 3), n(TEKNOFEST_RC_BENCHMARK.fcMpa, 2), 'MPa', report.rcDesign.benchmarkMatches == null ? 'Senaryoda açık RC benchmark alanları eksik.' : report.rcDesign.benchmarkMatches ? 'Eşleşiyor' : 'EŞLEŞMİYOR — onaylı değer değiştirilmedi'],
    ['fy', n(report.rcDesign.fyMpa, 3), n(TEKNOFEST_RC_BENCHMARK.fyMpa, 2), 'MPa', 'ACI RC girdisi / proje benchmarkı'],
    ['Pas payı', n(report.rcDesign.coverMm, 1), n(TEKNOFEST_RC_BENCHMARK.coverMm, 0), 'mm', 'ACI RC girdisi / proje benchmarkı'],
    ['Rötre/sıcaklık oranı', n(report.rcDesign.shrinkageTemperatureRatio, 4), n(TEKNOFEST_RC_BENCHMARK.shrinkageTemperatureRatio, 3), '—', 'Proje-onaylı RC girdisi; beton reçetesi değildir.'],
  ].forEach((row, index) => addData(wsMethod, row, 5, index % 2 === 0 ? C.zebraLight : C.zebradark));

  addEmptyRow(wsMethod);
  addSection(wsMethod, 'METRİK TANIMLARI', 5);
  addHeader(wsMethod, ['Metrik', 'Formül / kapsam', 'Değer', 'Birim', 'Sınır'], 5);
  [
    ['Aktif beton reçetesi üretim CO₂e', 'Σ(malzeme kg/m³ × EF), donatı hariç', n(report.carbon.recipeProductionKgCo2ePerM3, 3), 'kg CO₂e/m³', 'Yalnız aktif reçete bileşenleri'],
    ['Toplam proje CO₂e', 'Reçete + donatı + şantiye makineleri', n(report.carbon.grandTotalProjectKgCo2e, 3), 'kg CO₂e', 'Beton mikseri/pompası makine toplamının içindedir; ayrıca ikinci kez toplanmaz.'],
    ['Toplam proje / beton hacmi', 'Toplam proje CO₂e / proje beton hacmi', n(report.carbon.grandTotalPerConcreteM3, 3), 'kg CO₂e/m³ beton', 'Reçete yoğunluğu ile aynı metrik değildir.'],
    ['Toplam proje / duvar boyu', 'Toplam proje CO₂e / L', n(report.carbon.grandTotalPerWallMeter, 3), 'kg CO₂e/m', 'L = aktif senaryo duvar uzunluğu'],
    ['Donatı ölçekleme esası', '1,00 m duvar şeridi kg/m × L', n(quantities?.reinforcementWeightKg, 2), 'kg', 'Kesit düzlemine dik 1,00 m şerit hesaplanır; proje toplamında L yalnız bir kez uygulanır.'],
    ['Döngüsellik sınıfları', 'industrial_byproduct + recycled_waste + secondary_material ayrı köken etiketleriyle izlenir', '', '', 'Metakaolin alternatif mineral/ikincil sınıfa alınabilir; “geri dönüştürülmüş atık” diye etiketlenmez.'],
  ].forEach((row, index) => addData(wsMethod, row, 5, index % 2 === 0 ? C.zebraLight : C.zebradark));

  addEmptyRow(wsMethod);
  addSection(wsMethod, 'KAYNAKLAR VE PROVENANS', 5);
  addHeader(wsMethod, ['Kaynak', 'Kapsam', 'URL', 'Veri politikası', ''], 5);
  [
    [REPORT_REFERENCES.aci31825.label, REPORT_REFERENCES.aci31825.scope, REPORT_REFERENCES.aci31825.url, 'RC standardı; beton reçetesi kaynağı değildir.', ''],
    [REPORT_REFERENCES.fhwaCoulomb.label, REPORT_REFERENCES.fhwaCoulomb.scope, REPORT_REFERENCES.fhwaCoulomb.url, 'Geoteknik yöntem referansı.', ''],
    [REPORT_REFERENCES.terzaghi1943.label, REPORT_REFERENCES.terzaghi1943.scope, REPORT_REFERENCES.terzaghi1943.url, 'Taşıma gücü teorisi kaynak referansı.', ''],
    ['Malzeme fiyatları / emisyon faktörleri', 'Aktif reçete ve katsayı metadata alanları', '', 'Excel/PDF raporu mevcut source/sourceUrl/date/region/year alanlarını taşır; eksik veriyi uydurmaz.', ''],
  ].forEach((row, index) => addData(wsMethod, row, 5, index % 2 === 0 ? C.zebraLight : C.zebradark));

  if (report.warnings.length > 0) {
    addEmptyRow(wsMethod);
    addSection(wsMethod, 'QA UYARILARI', 5);
    report.warnings.forEach((warning) => addData(wsMethod, ['Uyarı', warning, '', '', ''], 5, C.warnBg));
  }

  // ── 2. STABİLİTE ─────────────────────────────────────────────
  const wsStab = wb.addWorksheet('Stabilite', { properties: { tabColor: { argb: 'FF22C55E' } } });
  setColWidths(wsStab, [22, 16, 14, 12, 12, 16, 14]);
  addTitle(wsStab, 'Stabilite Analizi', 7);
  addHeader(wsStab, ['Kontrol', 'FS Hesaplanan', 'FS Minimum', 'Durum', 'e (m)', 'qMax (kPa)', 'qMin (kPa)'], 7);
  addStatus(wsStab, 'Kayma', n(stability?.sliding.factorOfSafety, 3), stability?.sliding.requiredFS ?? '—', stability?.sliding.status, 7, [n(stability?.eccentricity, 4), n(stability?.qMax, 2), n(stability?.qMin, 2)]);
  addStatus(wsStab, 'Devrilme', n(stability?.overturning.factorOfSafety, 3), stability?.overturning.requiredFS ?? '—', stability?.overturning.status, 7);
  addStatus(wsStab, 'Taşıma Gücü', n(stability?.bearingCapacity.factorOfSafety, 3), stability?.bearingCapacity.requiredFS ?? '—', stability?.bearingCapacity.status, 7);

  const checks = [stability?.sliding, stability?.overturning, stability?.bearingCapacity];
  const checkLabels = ['KAYMA HESAP ADIMLARI', 'DEVRİLME HESAP ADIMLARI', 'TAŞIMA GÜCÜ HESAP ADIMLARI'];
  checks.forEach((chk, ci) => {
    if (!chk?.steps?.length) return;
    addEmptyRow(wsStab);
    addSection(wsStab, checkLabels[ci], 7);
    addHeader(wsStab, ['#', 'Açıklama', 'Formül', 'Sonuç', 'Birim', 'Referans', ''], 7);
    chk.steps.forEach((s, i) => {
      addData(wsStab, [i + 1, s.description, s.formula ?? '', n(s.result, 4), s.unit ?? '', s.reference ?? '', ''], 7, i % 2 === 0 ? C.zebraLight : C.zebradark);
    });
  });

  // ── 3. METRAJ ─────────────────────────────────────────────────
  const wsMet = wb.addWorksheet('Metraj', { properties: { tabColor: { argb: 'FFF59E0B' } } });
  setColWidths(wsMet, [30, 18, 12, 18, 12]);
  addTitle(wsMet, 'Metraj / Keşif', 5);
  addHeader(wsMet, ['Kalem', 'Toplam', 'Birim', '1 m Şerit', 'Birim/m'], 5);
  const metRows: (string | number)[][] = [
    ['Beton Hacmi', n(quantities?.concreteVolume, 3), 'm³', n(quantities?.concreteVolumePerMeter, 4), 'm³/m'],
    ['Donatı — uygulanan', n(quantities?.reinforcementWeightKg ?? (quantities?.reinforcementWeight ?? 0) * 1000, 2), 'kg', n(quantities?.reinforcementWeightKgPerMeter ?? (quantities?.reinforcementWeightPerMeter ?? 0) * 1000, 2), 'kg/m'],
    ['Donatı — gerekli / talep', n(quantities?.reinforcementRequiredKg, 2), 'kg', n(quantities?.reinforcementRequiredKgPerMeter, 2), 'kg/m'],
    ['Kalıp Alanı', n(quantities?.formworkArea, 2), 'm²', n(quantities?.formworkAreaPerMeter, 3), 'm²/m'],
    ['Hafriyat', n(quantities?.excavationVolume, 2), 'm³', n(quantities?.excavationVolumePerMeter, 3), 'm³/m'],
    ['Geri Dolgu', n(quantities?.backfillVolume, 2), 'm³', n(quantities?.backfillVolumePerMeter, 3), 'm³/m'],
  ];
  metRows.forEach((r, i) => addData(wsMet, r, 5, i % 2 === 0 ? C.zebraLight : C.zebradark));
  addEmptyRow(wsMet);
  addData(wsMet, ['Duvar Uzunluğu (L)', n(quantities?.wallLength, 1), 'm', '', ''], 5, C.subtotalBg);
  addEmptyRow(wsMet);
  addSection(wsMet, 'DONATI ÖN METRAJ / PRELIMINARY RC SCREENING — NİHAİ ACI TASARIMI DEĞİLDİR', 5);
  addHeader(wsMet, ['Hesap modu', 'Gerekli / talep', 'Uygulanan / kapasite', 'Birim', 'Kontrol notu'], 5);
  addData(wsMet, ['Rapor statüsü', 'PRELIMINARY SCREENING', 'Tam ACI tasarımı değildir', '—', report.methods.reinforcedConcreteScope], 5, C.warnBg);
  addData(wsMet, [
    quantities?.reinforcementMode === 'structural' ? 'İç stabilite / kesit hesabı' : quantities?.reinforcementMode === 'custom' ? 'Kontrollü özel ön metraj' : 'Otomatik ön metraj',
    n(quantities?.reinforcementRequiredKgPerMeter, 2) + ' kg/m',
    n(quantities?.reinforcementWeightKgPerMeter ?? (quantities?.reinforcementWeightPerMeter ?? 0) * 1000, 2) + ' kg/m · ' + n(quantities?.reinforcementRatioKgM3, 2) + ' kg/m³',
    'kg/m ve kg/m³',
    (quantities?.reinforcementWarnings ?? []).join(' '),
  ], 5, C.zebraLight);
  if (internal) {
    ([['Gövde', internal.stem], ['Burun', internal.toe], ['Topuk', internal.heel]] as const).forEach(([label, section], index) => addData(wsMet, [
      `${label} ön tarama durumu`,
      `Eğilme: ${section.flexuralStatus}`,
      `Kesme: ${section.shearStatus}`,
      'ön tarama',
      'Bu statü preliminary screening sonucudur; nihai ACI code-compliance kararı değildir.',
    ], 5, index % 2 === 0 ? C.zebradark : C.zebraLight));
  }

  // ── 3B. AKTİF BETON REÇETESİ ─────────────────────────────────
  const wsMix = wb.addWorksheet('Beton Reçetesi', { properties: { tabColor: { argb: 'FF14B8A6' } } });
  setColWidths(wsMix, [34, 16, 16, 14, 14, 14, 16, 12, 14, 14, 16, 16, 28, 34]);
  addTitle(wsMix, 'Aktif Beton Reçetesi — girilen değer, kanonik kg/m³, maliyet ve proje toplamları', 14);
  addData(wsMix, ['Karışım adı', concreteMix.name, 'Sistem', concreteMix.materialSystem, 'Yapısal sınıf', concreteMix.targetConcreteClass, 'Maliyet modu', concreteMix.priceMode, 'Beton hacmi', n(quantities?.concreteVolume, 3), 'm³', '', '', ''], 14, C.subtotalBg);
  addHeader(wsMix, ['Malzeme', 'Kategori', 'Girilen değer', 'Girilen birim', 'kg/m³', '% grup', 'Proje kg', 'Proje ton', 'Birim fiyat', 'Fiyat birimi', 'EF kg CO₂e/kg', 'CO₂e / m³', 'Kaynak', 'Kaynak URL'], 14);
  mixMetrics.materials.filter((item) => item.enabled).forEach((item, index) => {
    const amount = item.canonicalKgPerM3;
    const projectKg = amount == null || quantities?.concreteVolume == null ? null : amount * quantities.concreteVolume;
    const price = item.price ?? concreteMix.prices?.[item.id] ?? getDefaultMaterialPrice(item.id);
    const engineEmission = emissionByMaterial.get(item.id);
    const factor = engineEmission?.factorKgCo2ePerKg == null
      ? null
      : engineEmission.factorKgCo2ePerKg;
    const emissionPerM3 = engineEmission?.emissionKgCo2eM3 ?? null;
    addData(wsMix, [
      item.name,
      item.category,
      item.rawValue == null ? '—' : String(item.rawValue),
      item.rawUnit ?? item.unit,
      n(amount, 3),
      n(item.percentage, 2),
      n(projectKg, 2),
      n(projectKg == null ? null : projectKg / 1000, 3),
      n(price?.value, 3),
      price?.unit ?? '',
      n(factor, 6),
      n(emissionPerM3, 3),
      item.source ?? '',
      item.sourceUrl ?? '',
    ], 14, index % 2 === 0 ? C.zebraLight : C.zebradark);
  });
  addEmptyRow(wsMix);
  addSection(wsMix, 'REÇETE ÖZETİ', 4);
  addHeader(wsMix, ['Metrik', 'Değer', 'Birim', 'Not'], 4);
  [
    ['Toplam bağlayıcı', n(mixMetrics.totalBinderKgM3, 3), 'kg/m³', 'Tüm aktif bağlayıcılar'],
    ['Toplam agrega', n(mixMetrics.totalAggregateKgM3, 3), 'kg/m³', 'Doğal ince/iri + geri dönüştürülmüş ince/iri'],
    ['Toplam doğal agrega', n(mixMetrics.totalNaturalAggregateKgM3, 3), 'kg/m³', ''],
    ['Toplam geri dönüştürülmüş agrega', n(mixMetrics.totalRecycledAggregateKgM3, 3), 'kg/m³', 'Geri dönüştürülmüş ince + iri agrega'],
    ['Toplam SCM/mineral katkı', n(mixMetrics.totalScmKgM3, 3), 'kg/m³', 'Bağlayıcı içindeki mineral ikameler'],
    ['Toplam taze karışım', n(mixMetrics.totalFreshMassKgM3, 3), 'kg/m³', 'Eksik miktar varsa hesaplanamaz'],
    ['Su/bağlayıcı', n(mixMetrics.waterBinderRatio, 5), '—', concreteMix.materialSystem === 'geopolymer' ? 'Geopolimerde tek başına performans göstergesi değildir' : 'waterKgM3 / totalBinderKgM3'],
    ['RCA toplam agrega payı', n(mixMetrics.totalRecycledAggregatePercent, 3), '%', 'RCA / toplam agrega'],
    ['RCA ince ikame', n(mixMetrics.recycledFineReplacementPercent, 3), '%', 'RCA ince / (doğal ince + RCA ince)'],
    ['RCA iri ikame', n(mixMetrics.recycledCoarseReplacementPercent, 3), '%', 'RCA iri / (doğal iri + RCA iri)'],
    ['Hedef hava', n(concreteMix.targetAirContentPercent, 3), '%', 'Hedef; ölçülmüş hava değildir'],
  ].forEach((row, index) => addData(wsMix, row, 4, index % 2 === 0 ? C.zebraLight : C.zebradark));
  addEmptyRow(wsMix);
  addSection(wsMix, 'DENEYSEL / LİTERATÜR DAYANIMLARI', 5);
  addHeader(wsMix, ['Değer', 'Yaş', 'Birim', 'Çalışma', 'Kaynak URL'], 5);
  concreteMix.compressiveStrengthMeasurements.forEach((measurement, index) => addData(wsMix, [
    n(measurement.valueMpa, 3),
    measurement.ageDays == null ? 'Belirtilmemiş' : `${measurement.ageDays} gün`,
    'MPa',
    measurement.source ?? concreteMix.literature?.studyName ?? '',
    measurement.sourceUrl ?? concreteMix.literature?.sourceUrl ?? '',
  ], 5, index % 2 === 0 ? C.zebraLight : C.zebradark));
  const mixWarnings = [...new Set([...mixMetrics.warnings, ...(concreteMix.literature?.warnings ?? [])])];
  if (mixWarnings.length > 0) {
    addEmptyRow(wsMix);
    addSection(wsMix, 'VERİ KALİTESİ / UYARILAR', 2);
    mixWarnings.forEach((warning) => addData(wsMix, ['Uyarı', warning], 2, C.warnBg));
  }

  // ── 3C. KARBON–DAYANIM KARAR DESTEĞİ ───────────────────────
  const wsOpt = wb.addWorksheet('Karbon-Dayanım', { properties: { tabColor: { argb: 'FF84CC16' } } });
  setColWidths(wsOpt, [34, 22, 18, 22, 18, 52]);
  addTitle(wsOpt, 'Karbon–Dayanım Karar Desteği', 6);
  addData(wsOpt, [
    'Aktif reçete', concreteMix.name,
    'Referans', activeReference.referenceDefinition.name,
    'Durum', activeReference.status,
  ], 6, C.subtotalBg);
  addEmptyRow(wsOpt);
  addSection(wsOpt, 'AKTİF REÇETE / REFERANS KARŞILAŞTIRMASI', 6);
  addHeader(wsOpt, ['Metrik', 'Referans', 'Aktif reçete', 'Fark / kazanç', 'Birim', 'Yorum'], 6);
  [
    [
      'Beton reçetesi üretim CO₂e',
      n(activeReference.referenceCarbon.kgCo2eM3, 3),
      n(activeReference.activeCarbon.kgCo2eM3, 3),
      n(activeReference.carbonSavingKgM3, 3),
      'kg CO₂e/m³',
      activeReference.referenceCarbon.dataComplete && activeReference.activeCarbon.dataComplete
        ? 'Pozitif fark, referansa göre önlenen reçete üretim emisyonudur.'
        : 'Eksik emisyon faktörü nedeniyle kesin sonuç üretilemez.',
    ],
    [
      'Beton maliyeti',
      n(activeReferenceCostPerM3, 2),
      n(activeConcreteCostPerM3, 2),
      n(activeConcreteCostPerM3 == null || activeReferenceCostPerM3 == null ? null : activeConcreteCostPerM3 - activeReferenceCostPerM3, 2),
      '₺/m³',
      `Değişim: ${changePct(activeConcreteCostPerM3, activeReferenceCostPerM3)}; aktif fiyat/reçete modeli kullanıldı.`,
    ],
    [
      'Maliyet değişimi',
      '—',
      '—',
      changePct(activeConcreteCostPerM3, activeReferenceCostPerM3),
      '%',
      'Negatif değer referansa göre maliyet azalmasıdır.',
    ],
    [
      'Proje karbon kazancı',
      '—',
      '—',
      n(activeReference.projectCarbonSavingKg, 2),
      'kg CO₂e',
      'Reçete kazancı × proje beton hacmi; donatı, şantiye ve lojistik ayrıca hesaplanır.',
    ],
    [
      'Çimento azalımı',
      n(activeReference.referenceMetrics.binderPercentages.cement, 2),
      n(activeReference.activeMetrics.binderPercentages.cement, 2),
      n(activeReference.cementReductionKgM3, 3),
      'kg/m³',
      'Referans ve aktif reçetedeki gerçek çimento miktarlarının farkı.',
    ],
    [
      'SCM / mineral katkı artışı',
      n(activeReference.referenceMetrics.totalScmKgM3, 3),
      n(activeReference.activeMetrics.totalScmKgM3, 3),
      n(activeReference.scmIncreaseKgM3, 3),
      'kg/m³',
      'Uçucu kül, GGBFS, silis dumanı ve metakaolin toplamı.',
    ],
    [
      'Ölçülmüş basınç dayanımı',
      n(activeReference.referenceDefinition.measuredStrengthMpa, 2),
      activeReference.exactDatasetMatch ? n(activeReference.measuredStrengthMpa, 2) : 'Tahmin edilmedi',
      activeReference.exactDatasetMatch ? n(activeReference.measuredStrengthDeltaMpa, 2) : '—',
      'MPa',
      activeReference.exactDatasetMatch
        ? 'Her iki değer de veri setinde ölçülmüştür; referans deney yaşı: ' + (activeReference.referenceDefinition.measuredStrengthAgeDays == null ? 'belirtilmedi' : String(activeReference.referenceDefinition.measuredStrengthAgeDays) + ' gün') + '; aktif deney yaşı: ' + (activeReference.matchedActiveDefinition?.measuredStrengthAgeDays == null ? 'belirtilmedi' : String(activeReference.matchedActiveDefinition.measuredStrengthAgeDays) + ' gün') + '.'
        : 'Aktif reçete değiştirildiği için ölçülmüş MPa aktarılmadı; laboratuvar doğrulaması gerekir.',
    ],
  ].forEach((row, index) => addData(wsOpt, row, 6, index % 2 === 0 ? C.zebraLight : C.zebradark));

  addEmptyRow(wsOpt);
  addSection(wsOpt, 'VERİ SETİNDEN ÖNERİLEN KARŞILAŞTIRMA', 6);
  addData(wsOpt, [
    'Senaryo', optimization.scenario.title,
    'Referans → aday', `${optimization.referenceDefinition.name} → ${optimization.candidateDefinition.name}`,
    'Kanıt durumu', optimization.status,
  ], 6, C.subtotalBg);
  addHeader(wsOpt, ['Metrik', 'Referans', 'Aday', 'Fark / kazanç', 'Birim', 'Veri niteliği'], 6);
  [
    ['Beton reçetesi üretim CO₂e', n(optimization.referenceCarbon.kgCo2eM3, 3), n(optimization.candidateCarbon.kgCo2eM3, 3), n(optimization.carbonSavingKgM3, 3), 'kg CO₂e/m³', 'Aktif emisyon faktörleriyle hesaplanan reçete sonucu'],
    ['Karbon azaltımı', '—', '—', n(optimization.carbonSavingPercent, 2), '%', 'Referans reçeteye göre'],
    ['Beton maliyeti', n(optimizationReferenceCostPerM3, 2), n(optimizationCandidateCostPerM3, 2), n(optimizationCandidateCostPerM3 == null || optimizationReferenceCostPerM3 == null ? null : optimizationCandidateCostPerM3 - optimizationReferenceCostPerM3, 2), '₺/m³', `Değişim: ${changePct(optimizationCandidateCostPerM3, optimizationReferenceCostPerM3)}`],
    ['Maliyet değişimi', '—', '—', changePct(optimizationCandidateCostPerM3, optimizationReferenceCostPerM3), '%', 'Negatif değer referansa göre maliyet azalmasıdır.'],
    ['Çimento azalımı', '', '', n(optimization.cementReductionKgM3, 3), 'kg/m³', 'Gerçek reçete miktarları'],
    ['SCM artışı', n(optimization.referenceMetrics.totalScmKgM3, 3), n(optimization.candidateMetrics.totalScmKgM3, 3), n(optimization.scmIncreaseKgM3, 3), 'kg/m³', 'Mineral katkı toplamı'],
    ['Ölçülmüş basınç dayanımı', n(optimization.referenceDefinition.measuredStrengthMpa, 2), n(optimization.candidateDefinition.measuredStrengthMpa, 2), n(optimization.measuredStrengthDeltaMpa, 2), 'MPa', TEKNOFEST_DATASET_LABEL + '; referans deney yaşı: ' + (optimization.referenceDefinition.measuredStrengthAgeDays == null ? 'belirtilmedi' : String(optimization.referenceDefinition.measuredStrengthAgeDays) + ' gün') + '; aday deney yaşı: ' + (optimization.candidateDefinition.measuredStrengthAgeDays == null ? 'belirtilmedi' : String(optimization.candidateDefinition.measuredStrengthAgeDays) + ' gün')],
  ].forEach((row, index) => addData(wsOpt, row, 6, index % 2 === 0 ? C.zebraLight : C.zebradark));

  addEmptyRow(wsOpt);
  addSection(wsOpt, 'FORMÜLLER VE SINIRLAR', 2);
  [
    ['CO₂e/m³', 'Σ(malzeme kg/m³ × emisyon faktörü kg CO₂e/kg)'],
    ['Proje karbon kazancı', 'Reçete karbon farkı kg CO₂e/m³ × proje beton hacmi m³'],
    ['Dayanım', 'Yazılım reçeteden MPa tahmini yapmaz; yalnızca veri setindeki birebir reçetelerin ölçülmüş değerini gösterir.'],
    ['Yapısal sınıf', 'Ölçülmüş literatür/veri seti MPa değerinden otomatik beton sınıfı türetilmez.'],
    ['Deney yaşı', concreteMix.compressiveStrengthMeasurements.some((measurement) => measurement.ageDays == null)
      ? 'Kaynağında yaş olmayan ölçümlerde 28 gün varsayılmamıştır.'
      : 'Aktif reçetedeki ölçüm yaşları yukarıdaki tabloda gösterilmiştir; 28 gün yalnızca kaynakta doğrulanmışsa kullanılır.'],
    ['Kapsam', 'Reçete üretim karbonu; donatı, şantiye/makine ve lojistik emisyonlarından ayrı tutulur.'],
  ].forEach((row, index) => addData(wsOpt, row, 2, index % 2 === 0 ? C.zebraLight : C.zebradark));

  // ── 3D. SIFIR ATIK ANALİZİ ───────────────────────────────────
  const wsZeroWaste = wb.addWorksheet('Sıfır Atık Analizi', { properties: { tabColor: { argb: 'FF64748B' } } });
  setColWidths(wsZeroWaste, [34, 22, 22, 22, 46, 22]);
  addTitle(wsZeroWaste, 'Sıfır Atık Analizi', 6);
  addSection(wsZeroWaste, 'PROJE', 6);
  addHeader(wsZeroWaste, ['Kalem', 'Değer', 'Birim', 'Not', '', ''], 6);
  [
    ['Duvar uzunluğu', n(zeroWaste.wallLengthM, 2), 'm', 'Aktif geometri L', '', ''],
    ['Beton hacmi', n(zeroWaste.concreteVolumeM3, 3), 'm³', 'Aktif metraj sonucu', '', ''],
    ['Beton sınıfı', scenario.input.concreteClass, '', 'Aktif tasarım hedefi', '', ''],
    ['Aktif reçete', zeroWaste.activeMixName, '', '', '', ''],
    ['Referans reçete', zeroWaste.referenceMixName ?? 'Seçilmedi', '', zeroWaste.referenceAvailable ? 'Karşılaştırma aktif' : 'Karşılaştırma yapılamaz', '', ''],
  ].forEach((row, index) => addData(wsZeroWaste, row, 6, index % 2 === 0 ? C.zebraLight : C.zebradark));

  addEmptyRow(wsZeroWaste);
  addSection(wsZeroWaste, 'DÖNGÜSELLİK / ALTERNATİF MALZEME VE DOĞAL KAYNAK KULLANIMI', 6);
  addHeader(wsZeroWaste, ['Gösterge', 'Referans', 'Aktif', 'Kazanç', 'Birim / kapsam', ''], 6);
  const circularAlternativeGain = zeroWaste.reference.circularAlternativeMaterialProjectTon == null
    || zeroWaste.active.circularAlternativeMaterialProjectTon == null
    ? null
    : zeroWaste.active.circularAlternativeMaterialProjectTon - zeroWaste.reference.circularAlternativeMaterialProjectTon;
  [
    ['Döngüsel / alternatif malzeme', n(zeroWaste.reference.circularAlternativeMaterialProjectTon, 2), n(zeroWaste.active.circularAlternativeMaterialProjectTon, 2), n(circularAlternativeGain, 2), 'ton proje toplamı', 'Endüstriyel yan ürün + geri dönüştürülmüş atık + ikincil malzeme + alternatif mineral; aktif − referans'],
    ['Geri kazanılmış malzeme (dar alt küme)', n(zeroWaste.reference.recoveredMaterialProjectTon, 2), n(zeroWaste.active.recoveredMaterialProjectTon, 2), n(zeroWaste.savings.recoveredMaterialTon, 2), 'ton proje toplamı', 'Alternatif mineral ayrı tutulur; metakaolin bu satırda atık diye sayılmaz.'],
    ['Çimento', n(zeroWaste.reference.cementProjectTon, 2), n(zeroWaste.active.cementProjectTon, 2), n(zeroWaste.savings.cementTon, 2), 'ton proje toplamı', 'Referans − aktif'],
    ['Doğal agrega', n(zeroWaste.reference.naturalAggregateProjectTon, 2), n(zeroWaste.active.naturalAggregateProjectTon, 2), n(zeroWaste.savings.naturalAggregateTon, 2), 'ton proje toplamı', 'Referans − aktif'],
  ].forEach((row, index) => addData(wsZeroWaste, row, 6, index % 2 === 0 ? C.zebraLight : C.zebradark));

  addEmptyRow(wsZeroWaste);
  addSection(wsZeroWaste, 'KARBON', 6);
  addHeader(wsZeroWaste, ['Gösterge', 'Referans', 'Aktif', 'Azaltım / fark', 'Birim', 'Kapsam'], 6);
  [
    ['Birim emisyon', n(zeroWaste.reference.recipeCarbonKgM3, 3), n(zeroWaste.active.recipeCarbonKgM3, 3), zeroWaste.savings.carbonPercent == null ? '—' : `${n(zeroWaste.savings.carbonPercent, 1)}%`, 'kg CO₂e/m³', 'Beton reçetesi malzeme üretimi'],
    [zeroWasteProjectTotalLabel, n(zeroWaste.reference.recipeCarbonProjectTon, 2), n(zeroWaste.active.recipeCarbonProjectTon, 2), n(zeroWaste.savings.carbonTon, 2), 'ton CO₂e', 'Donatı, şantiye ve lojistik hariç'],
  ].forEach((row, index) => addData(wsZeroWaste, row, 6, index % 2 === 0 ? C.zebraLight : C.zebradark));

  addEmptyRow(wsZeroWaste);
  addSection(wsZeroWaste, 'DAYANIM', 6);
  addHeader(wsZeroWaste, ['Gösterge', 'Referans', 'Aktif', 'Birim', 'Durum', 'Not'], 6);
  [
    ['Deneysel basınç dayanımı', n(zeroWaste.strength.referenceMpa, 2), n(zeroWaste.strength.activeMpa, 2), 'MPa', zeroWaste.strength.status === 'preserved' ? 'Dayanım korunuyor' : zeroWaste.strength.status === 'loss' ? 'Dayanım kaybı var' : 'Deneysel doğrulama eksik', `Hedef ${zeroWaste.strength.targetConcreteClass} · alt sınır ${n(zeroWaste.strength.targetStrengthMpa, 2)} MPa`],
    ['Deney yaşı', zeroWaste.strength.referenceAgeDays == null ? 'Belirtilmemiş' : `${zeroWaste.strength.referenceAgeDays} gün`, zeroWaste.strength.activeAgeDays == null ? 'Belirtilmemiş' : `${zeroWaste.strength.activeAgeDays} gün`, 'gün', '', '28 gün otomatik varsayılmadı'],
  ].forEach((row, index) => addData(wsZeroWaste, row, 6, index % 2 === 0 ? C.zebraLight : C.zebradark));

  addEmptyRow(wsZeroWaste);
  addSection(wsZeroWaste, 'DÖNGÜSEL / ALTERNATİF MALZEME KIRILIMI', 6);
  addHeader(wsZeroWaste, ['Malzeme', 'Kategori', 'Döngüsellik kökeni', 'kg/m³', 'Proje toplam ton', 'Not'], 6);
  const circularAlternativeBreakdown = zeroWaste.activeMaterialImpacts.filter((item) => (
    ['industrial_byproduct', 'recycled_waste', 'secondary_material', 'alternative_mineral'].includes(item.circularityOrigin)
    && (item.recipeAmountKgM3 ?? 0) > 0
  ));
  circularAlternativeBreakdown.forEach((item, index) => addData(wsZeroWaste, [
    item.name,
    item.category,
    circularityOriginLabel(item.circularityOrigin),
    n(item.recipeAmountKgM3, 1),
    n(item.projectAmountTon, 2),
    item.circularityOrigin === 'recycled_waste' ? 'Geri dönüştürülmüş atık' : 'Geri dönüştürülmüş atık olarak etiketlenmez',
  ], 6, index % 2 === 0 ? C.zebraLight : C.zebradark));
  if (circularAlternativeBreakdown.length === 0) addData(wsZeroWaste, ['Pozitif miktarlı döngüsel / alternatif malzeme yok', '', '', '', '', ''], 6, C.zebradark);

  if (zeroWaste.warnings.length > 0) {
    addEmptyRow(wsZeroWaste);
    addSection(wsZeroWaste, 'VERİ KALİTESİ / UYARILAR', 6);
    zeroWaste.warnings.forEach((warning) => addData(wsZeroWaste, ['Uyarı', warning, '', '', '', ''], 6, C.warnBg));
  }

  // ── 4. MALİYET ────────────────────────────────────────────────
  const wsCost = wb.addWorksheet('Maliyet', { properties: { tabColor: { argb: 'FFEC4899' } } });
  setColWidths(wsCost, [32, 20, 14, 18, 20, 18, 14, 28, 34]);
  addTitle(wsCost, 'Maliyet Analizi', 3);
  addHeader(wsCost, ['Kalem', 'Tutar (₺)', 'Pay (%)'], 3);
  const sub = cost?.subtotal;
  const costItems: [string, string, string][] = [
    ['Beton', n(cost?.concreteCost, 0), pct(cost?.concreteCost, sub)],
    ['Donatı (malzeme)', n(cost?.rebarCost, 0), pct(cost?.rebarCost, sub)],
    ['Kazı', n(cost?.excavationCost, 0), pct(cost?.excavationCost, sub)],
    ['Geri Dolgu', n(cost?.backfillCost, 0), pct(cost?.backfillCost, sub)],
    ['Kalıp', n(cost?.formworkCost, 0), pct(cost?.formworkCost, sub)],
    ['Donatı İşçiliği', n(cost?.rebarLaborCost, 0), pct(cost?.rebarLaborCost, sub)],
    ['Nakliye', n(cost?.transportCost, 0), pct(cost?.transportCost, sub)],
    ['Yakıt', n(cost?.fuelCost, 0), pct(cost?.fuelCost, sub)],
  ];
  costItems.forEach((r, i) => addData(wsCost, r, 3, i % 2 === 0 ? C.zebraLight : C.zebradark));
  addEmptyRow(wsCost);
  addData(wsCost, ['Ara Toplam', n(cost?.subtotal, 0), '100%'], 3, C.subtotalBg);
  addData(wsCost, ['Genel Gider & Kâr', n(cost?.overhead, 0), logistics.overheadPercent != null ? logistics.overheadPercent.toFixed(1) + '%' : '—'], 3, C.zebraLight);
  addData(wsCost, ['KDV', n(cost?.vat, 0), logistics.vatPercent != null ? logistics.vatPercent.toFixed(1) + '%' : '—'], 3, C.zebradark);
  addEmptyRow(wsCost);
  addData(wsCost, ['TOPLAM (KDV dahil)', n(cost?.totalCost, 0), ''], 3, undefined, true);
  addEmptyRow(wsCost);
  addData(wsCost, ['Birim Maliyet (m³)', n(cost?.unitCostPerM3, 0), '₺/m³'], 3, C.zebraLight);
  addData(wsCost, ['Birim Maliyet (m-duvar)', n(cost?.unitCostPerMeterWall, 0), '₺/m'], 3, C.zebradark);
  if (cost?.recipeMaterialCosts.length) {
    addEmptyRow(wsCost);
    addSection(wsCost, `REÇETE BAZLI BETON MALZEME MALİYETLERİ (${cost.concreteCostMode})`, 9);
    addHeader(wsCost, ['Malzeme', 'Miktar', 'Birim', 'Maliyet / m³', 'Proje maliyeti', 'Fiyat', 'Para birimi', 'Fiyat kaynağı / tarih', 'Kaynak URL'], 9);
    cost.recipeMaterialCosts.forEach((item, index) => addData(wsCost, [
      item.name,
      n(item.amountKgM3, 3),
      'kg/m³',
      n(item.costPerM3, 2),
      n(item.projectCost, 2),
      item.price == null ? '—' : `${item.price} ${item.priceUnit ?? ''}`.trim(),
      item.priceCurrency ?? '',
      [item.source, item.priceDate, item.priceRegion, item.priceYear, item.priceNotes].filter((value) => value != null && value !== '').join(' · '),
      item.sourceUrl ?? '',
    ], 9, index % 2 === 0 ? C.zebraLight : C.zebradark));
  }

  // ── 5. EMİSYON ────────────────────────────────────────────────
  const wsEm = wb.addWorksheet('Emisyon', { properties: { tabColor: { argb: 'FF10B981' } } });
  setColWidths(wsEm, [32, 24, 14]);
  addTitle(wsEm, 'Karbon Emisyon Analizi', 3);
  addHeader(wsEm, ['Kaynak', 'Emisyon (kg CO₂e)', 'Pay (%)'], 3);
  const gt = emissions?.grandTotal;
  const emItems: [string, string, string][] = [
    ['Beton reçetesi üretimi (donatı hariç)', n(report.carbon.recipeProductionProjectKgCo2e, 2), pct(report.carbon.recipeProductionProjectKgCo2e, gt)],
    ['Donatı', n(report.carbon.reinforcementProjectKgCo2e, 2), pct(report.carbon.reinforcementProjectKgCo2e, gt)],
    ['Şantiye iş makineleri (mikser/pompa hariç)', n(report.carbon.siteMachineryProjectKgCo2e, 2), pct(report.carbon.siteMachineryProjectKgCo2e, gt)],
    ['Beton lojistiği (mikser + pompa; makine toplamının alt kümesi)', n(report.carbon.concreteLogisticsProjectKgCo2e, 2), pct(report.carbon.concreteLogisticsProjectKgCo2e, gt)],
  ];
  emItems.forEach((r, i) => addData(wsEm, r, 3, i % 2 === 0 ? C.zebraLight : C.zebradark));
  addEmptyRow(wsEm);
  addData(wsEm, ['TOPLAM', n(gt, 2), '100%'], 3, undefined, true);
  addEmptyRow(wsEm);
  addSection(wsEm, 'Yoğunluk Metrikleri', 3);
  addData(wsEm, ['Aktif reçete üretim CO₂e / m³ beton (donatı hariç)', n(report.carbon.recipeProductionKgCo2ePerM3, 2), 'kg CO₂e/m³'], 3, C.zebraLight);
  addData(wsEm, ['Toplam proje CO₂e / m³ beton', n(report.carbon.grandTotalPerConcreteM3, 2), 'kg CO₂e/m³'], 3, C.zebradark);
  addData(wsEm, ['Toplam proje CO₂e / m-duvar', n(report.carbon.grandTotalPerWallMeter, 2), 'kg CO₂e/m'], 3, C.zebraLight);
  addData(wsEm, ['CO₂e / ₺ maliyet', cost?.totalCost && gt ? n(gt / cost.totalCost, 5) : '—', 'kg/₺'], 3, C.zebraLight);
  addEmptyRow(wsEm);
  addSection(wsEm, 'AKTİF BETON REÇETESİ EMİSYON DETAYI', 7);
  addHeader(wsEm, ['Malzeme', 'Miktar kg/m³', 'Faktör kg CO₂e/kg', 'CO₂e/m³', 'Proje kg CO₂e', 'Kaynak', 'Kaynak URL'], 7);
  (emissions?.materials.byMaterial ?? []).filter((item) => item.id !== 'reinforcement_steel').forEach((item, index) => addData(wsEm, [
    item.name,
    n(item.amountKgM3, 3),
    n(item.factorKgCo2ePerKg, 6),
    n(item.emissionKgCo2eM3, 3),
    n(item.emissionKgCo2eProject, 3),
    [item.source, item.factorRegion, item.factorYear].filter((value) => value != null && value !== '').join(' · '),
    item.sourceUrl ?? '',
  ], 7, index % 2 === 0 ? C.zebraLight : C.zebradark));
  const recipeKnownSubtotal = (emissions?.materials.byMaterial ?? [])
    .filter((item) => item.id !== 'reinforcement_steel')
    .reduce((sum, item) => sum + (item.emissionKgCo2eProject ?? 0), 0);
  addData(wsEm, ['Beton reçetesi bilinen alt toplamı', '', '', '', n(recipeKnownSubtotal, 3), '', ''], 7, C.subtotalBg);
  if (emissions?.warnings.length) emissions.warnings.forEach((warning) => addData(wsEm, ['Uyarı', warning, '', '', '', '', ''], 7, C.warnBg));

  // ── 6. MAKİNE EMİSYON DETAYI ─────────────────────────────────
  const wsMach = wb.addWorksheet('Makine Emisyon', { properties: { tabColor: { argb: 'FF6366F1' } } });
  setColWidths(wsMach, [30, 22, 16, 22, 18]);
  addTitle(wsMach, 'İş Makinesi Emisyon Detayı', 5);
  addHeader(wsMach, ['Makine', 'Çalışma Süresi (sa)', 'Yakıt (L)', 'Emisyon (kg CO₂e)', 'Maliyet (₺)'], 5);
  const mach = emissions?.machinery;
  const machines = mach
    ? [mach.excavator, mach.dumperTruck, mach.rebarTruck, mach.concreteMixer, mach.concretePump, mach.compactor]
    : [];
  machines.forEach((m, i) => {
    addData(wsMach, [m.machineName, n(m.workingTime, 2), n(m.fuelConsumption, 2), n(m.emission, 2), n(m.cost, 0)], 5, i % 2 === 0 ? C.zebraLight : C.zebradark);
  });
  addEmptyRow(wsMach);
  addData(wsMach, [
    'TOPLAM',
    n(machines.reduce((a, m) => a + (m.workingTime ?? 0), 0), 2),
    n(mach?.totalFuel, 2),
    n(mach?.totalEmission, 2),
    n(mach?.totalCost, 0),
  ], 5, undefined, true);

  return wb;
}

export async function exportScenarioToExcel(scenario: Scenario): Promise<void> {
  const wb = await buildScenarioWorkbook(scenario);
  const safeName = scenario.name.replace(/[\/\\?*:|"<>]/g, '_');
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}_analiz_${Date.now()}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
