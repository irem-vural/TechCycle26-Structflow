import type { RawMaterialInput, StrengthValues, SustainableConcreteMix } from './types';
import { EMPTY_STRENGTH_VALUES } from './defaults';

export interface SustainableConcreteImportIssue {
  severity: 'error' | 'warning';
  row?: number;
  field?: string;
  message: string;
}

export interface SustainableConcreteImportResult {
  mixes: SustainableConcreteMix[];
  referenceStrengths: StrengthValues;
  issues: SustainableConcreteImportIssue[];
  headers: string[];
  duplicateRows?: number[];
}

type Field =
  | 'mixNo'
  | 'name'
  | 'materialSystem'
  | 'cementKgM3'
  | 'flyAshKgM3'
  | 'ggbfsKgM3'
  | 'silicaFumeKgM3'
  | 'metakaolinKgM3'
  | 'naturalFineAggregateKgM3'
  | 'naturalCoarseAggregateKgM3'
  | 'recycledAggregateUnspecifiedKgM3'
  | 'recycledFineAggregateKgM3'
  | 'recycledCoarseAggregateKgM3'
  | 'lightweightAggregateKgM3'
  | 'heavyweightAggregateKgM3'
  | 'naturalAggregateKgM3'
  | 'recycledAggregateKgM3'
  | 'waterKgM3'
  | 'sodiumHydroxideKgM3'
  | 'sodiumSilicateKgM3'
  | 'alkaliActivatorKgM3'
  | 'superplasticizerKgM3'
  | 'airEntrainingKgM3'
  | 'acceleratorRetarderKgM3'
  | 'fiberKgM3'
  | 'airTargetContentPercent'
  | 'genericStrengthMpa'
  | 'strength7DaysMpa'
  | 'strength28DaysMpa'
  | 'strength56DaysMpa'
  | 'strength90DaysMpa'
  | 'study'
  | 'sourceUrl'
  | 'sourceLine'
  | 'referenceStrength7DaysMpa'
  | 'referenceStrength28DaysMpa'
  | 'referenceStrength56DaysMpa'
  | 'referenceStrength90DaysMpa';

const HEADER_ALIASES: Record<Field, string[]> = {
  mixNo: ['karisimno', 'karisimno', 'mixno', 'mixnumber', 'no'],
  name: ['karisim', 'karisimadi', 'mix', 'mixname', 'design', 'ad', 'karisimadi/no'],
  materialSystem: ['malzemesistemi', 'sistem', 'system', 'concretesystem'],
  cementKgM3: ['cimento', 'cement', 'cementkgm3', 'cementkg', 'cimento kg', 'portlandcement'],
  flyAshKgM3: ['ucucukul', 'flyash', 'fly ash', 'flyashkgm3', 'flyashkg', 'ucucukulkgm3'],
  ggbfsKgM3: ['ggbfs', 'ggbfskgm3', 'ggbfskg', 'slag', 'slagkgm3', 'cüruf', 'curuf', 'yuksekfirincurufu', 'yuksekfirincurufuggbfs', 'blastfurnaceslag'],
  silicaFumeKgM3: ['silisdumani', 'silica fume', 'silicafume', 'silicafumekg', 'silisdumanikgm3'],
  metakaolinKgM3: ['metakaolin', 'metakaolinkg', 'metakaolinkgm3'],
  naturalFineAggregateKgM3: ['inceagregadogalkum', 'inceagregadogalkumkg', 'inceagregadogalkumkgm3', 'dogalinceagrega', 'naturalfineaggregate', 'naturalfineaggregatekgm3'],
  naturalCoarseAggregateKgM3: ['iriagregakirmatas', 'iriagregakirmataskg', 'iriagregakirmataskgm3', 'dogaliriagrega', 'naturalcoarseaggregate', 'naturalcoarseaggregatekgm3'],
  recycledAggregateUnspecifiedKgM3: ['geridönüştürülmüşagregarca', 'geridonusturulmusagregarca', 'geridonutulmusagregarca', 'recycledaggregaterca', 'rca', 'gda', 'recycledaggregateunspecified'],
  recycledFineAggregateKgM3: ['geridonuturulmusinceagrega', 'geridonusumluinceagrega', 'recycledfineaggregate', 'recycledfineaggregatekgm3'],
  recycledCoarseAggregateKgM3: ['geridonuturulmusiriagrega', 'geridonusumluiriagrega', 'recycledcoarseaggregate', 'recycledcoarseaggregatekgm3'],
  lightweightAggregateKgM3: ['hafifagrega', 'lightweightaggregate', 'lightweightaggregatekgm3'],
  heavyweightAggregateKgM3: ['agiragrega', 'heavyweightaggregate', 'heavyweightaggregatekgm3'],
  naturalAggregateKgM3: ['dogalagrega', 'naturalaggregate', 'natural aggregate', 'naturalaggregatekgm3', 'dogalagregakgm3', 'na'],
  recycledAggregateKgM3: ['geridönüştürülmüşagrega', 'geridonusturulmusagrega', 'geridonutulmusagrega', 'recycledaggregate', 'recycled aggregate', 'recycledaggregatekgm3', 'geridonusturulmusagregakgm3'],
  waterKgM3: ['su', 'water', 'waterkgm3', 'waterkg', 'sukgm3'],
  sodiumHydroxideKgM3: ['naoh', 'sodiumhydroxide', 'sodiumhydroxidekgm3', 'sodyumhidroksit'],
  sodiumSilicateKgM3: ['na2sio3', 'sodiumsilicate', 'sodiumsilicatekgm3', 'sodyumsilikat'],
  alkaliActivatorKgM3: ['alkaliactivator', 'alkaliactivatorsolution', 'alkaliactivatorkgm3', 'alkaliactivatorsolutionkgm3'],
  superplasticizerKgM3: ['superakiskanlastirici/suazaltici', 'superakiskanlastiricisuazaltici', 'superplasticizer', 'waterreducingadmixture', 'superplasticizerkgm3'],
  airEntrainingKgM3: ['havasurukleyicikatki', 'airentraining', 'airentrainingadmixture'],
  acceleratorRetarderKgM3: ['prizhizlandiricigeciktirici', 'prizhizlandiricigeciktirici', 'acceleratorretarder', 'accelerator', 'retarder'],
  fiberKgM3: ['fiber/celikppcam', 'fibercelikppcam', 'fiber', 'fiberkgm3'],
  airTargetContentPercent: ['havaatargeticerik', 'havaatargeticerigi', 'havahedeficerik', 'havahedeficerigi', 'hava', 'airtargetcontent', 'aircontent'],
  genericStrengthMpa: ['basincdayanimi', 'basincdayanimimpa', 'compressivestrength', 'compressivestrengthmpa', 'fc', 'fcm'],
  strength7DaysMpa: ['7gun', '7gün', '7day', '7days', '7gunmpa', 'strength7', 'strength7days', '7gunlukbasincdayanimi', 'fc7', 'fc7mpa'],
  strength28DaysMpa: ['28gun', '28gün', '28day', '28days', '28gunmpa', 'strength28', 'strength28days', '28gunlukbasincdayanimi', 'fc28', 'fc28mpa'],
  strength56DaysMpa: ['56gun', '56gün', '56day', '56days', '56gunmpa', 'strength56', 'strength56days', '56gunlukbasincdayanimi', 'fc56', 'fc56mpa'],
  strength90DaysMpa: ['90gun', '90gün', '90day', '90days', '90gunmpa', 'strength90', 'strength90days', '90gunlukbasincdayanimi', 'fc90', 'fc90mpa'],
  study: ['literaturcalisma', 'literatur', 'calisma', 'study', 'reference', 'source'],
  sourceUrl: ['link', 'url', 'kaynakurl', 'sourceurl', 'kaynak'],
  sourceLine: ['kaynaksatiri', 'sourceline', 'line'],
  referenceStrength7DaysMpa: ['referans7', 'referans7gun', 'referans7gunmpa', 'reference7', 'ref7', 'reference7days', 'ref7mpa'],
  referenceStrength28DaysMpa: ['referans28', 'referans28gun', 'referans28gunmpa', 'reference28', 'ref28', 'reference28days', 'ref28mpa'],
  referenceStrength56DaysMpa: ['referans56', 'referans56gun', 'referans56gunmpa', 'reference56', 'ref56', 'reference56days', 'ref56mpa'],
  referenceStrength90DaysMpa: ['referans90', 'referans90gun', 'referans90gunmpa', 'reference90', 'ref90', 'reference90days', 'ref90mpa'],
};

const KNOWN_MATERIAL_HEADER = /(cement|cimento|çimento|uçucu|ucucu|fly|ggbfs|slag|cüruf|curuf|silica|silis|metakaolin|agrega|aggregate|kirmatas|kum|su|water|fiber|haval|air|katki|admixture)/i;

function normalizeHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/³/g, '3')
    .replace(/²/g, '2')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function createHeaderMap(headers: string[]): Map<Field, number> {
  const map = new Map<Field, number>();
  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    (Object.keys(HEADER_ALIASES) as Field[]).some((field) => {
      if (map.has(field)) return false;
      if (HEADER_ALIASES[field].some((alias) => normalizeHeader(alias) === normalized)) {
        map.set(field, index);
        return true;
      }
      return false;
    });
  });
  return map;
}

function cellValue(row: string[], index: number | undefined): string {
  return index == null ? '' : String(row[index] ?? '').trim();
}

/** Reads kg, kg/m³, MPa and % suffixes without assuming a single spelling. */
export function parseImportedNumber(value: string): number | null {
  let normalized = value.replace(/\u00A0/g, ' ').trim();
  if (!normalized) return null;
  normalized = normalized.replace(/\(\s*(kg|kg\/m3|kg\/m³|mpa|%|ton|t|m3|m³|l)\s*\)/gi, '');
  normalized = normalized.replace(/(kg\/m3|kg\/m³|kg|mpa|%|ton|t|m3|m³|l)\s*$/gi, '');
  normalized = normalized.replace(/\s+/g, '');
  if (!normalized) return null;
  const comma = normalized.lastIndexOf(',');
  const dot = normalized.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) {
    normalized = comma > dot ? normalized.replace(/\./g, '').replace(',', '.') : normalized.replace(/,/g, '');
  } else if (comma >= 0) {
    normalized = normalized.replace(',', '.');
  }
  const result = Number(normalized);
  return Number.isFinite(result) ? result : null;
}

function readNumber(row: string[], map: Map<Field, number>, field: Field, issues: SustainableConcreteImportIssue[], rowNumber: number): number | null {
  const raw = cellValue(row, map.get(field));
  if (!raw) return null;
  const parsed = parseImportedNumber(raw);
  if (parsed == null) {
    issues.push({ severity: 'error', row: rowNumber, field, message: `“${raw}” sayısal bir değer olarak okunamadı.` });
    return null;
  }
  if (parsed < 0) {
    issues.push({ severity: 'error', row: rowNumber, field, message: 'Negatif miktar veya dayanım kabul edilmedi.' });
    return null;
  }
  return parsed;
}

function readBoundedEngineeringNumber(
  row: string[],
  map: Map<Field, number>,
  field: Field,
  issues: SustainableConcreteImportIssue[],
  rowNumber: number,
  max: number,
  label: string,
): number | null {
  const parsed = readNumber(row, map, field, issues, rowNumber);
  if (parsed == null || parsed <= max) return parsed;
  const raw = cellValue(row, map.get(field));
  const looksLikeExcelSerial = parsed >= 20_000 && parsed <= 80_000;
  issues.push({
    severity: 'warning',
    row: rowNumber,
    field,
    message: looksLikeExcelSerial
      ? `${label} “${raw}” Excel tarih/seri numarasına benziyor; aktif hesaba aktarılmadı. Ham değer kaynak kaydında korundu.`
      : `${label} “${raw}” beklenen mühendislik aralığının dışında; aktif hesaba aktarılmadı. Ham değer kaynak kaydında korundu.`,
  });
  return null;
}

function rawUnit(value: string): string | null {
  const match = value.match(/(?:\(|\s)(kg\/m³|kg\/m3|kg|ton|t|m³|m3|l|mpa|%)\s*\)?$/i);
  return match?.[1] ?? null;
}

function addReferenceValue(target: StrengthValues, value: number | null, field: Field): void {
  if (value == null) return;
  const age = field.match(/(7|28|56|90)/)?.[1];
  if (age) target[`strength${age}DaysMpa` as keyof StrengthValues] = value;
}

function isGeopolymer(name: string, system: string): boolean {
  return /geopolymer|geopolimer|\be0\b|\be50\b|naoh|na2sio3|alkali/i.test(`${name} ${system}`);
}

function parseMatrix(rows: string[][], sourceLabel: string): SustainableConcreteImportResult {
  const issues: SustainableConcreteImportIssue[] = [];
  const firstRow = rows.findIndex((row) => row.some((cell) => String(cell).trim().length > 0));
  if (firstRow < 0) return { mixes: [], referenceStrengths: { ...EMPTY_STRENGTH_VALUES }, issues: [{ severity: 'error', message: 'Dosya boş.' }], headers: [] };
  const headers = rows[firstRow].map((header) => String(header ?? '').trim());
  const map = createHeaderMap(headers);
  if (!map.has('name') && !map.has('mixNo')) issues.push({ severity: 'warning', row: firstRow + 1, message: 'Karışım adı/no kolonu bulunamadı; satır numarasıyla adlandırılacak.' });
  const componentFields: Field[] = ['cementKgM3', 'flyAshKgM3', 'ggbfsKgM3', 'silicaFumeKgM3', 'metakaolinKgM3', 'naturalFineAggregateKgM3', 'naturalCoarseAggregateKgM3', 'recycledAggregateUnspecifiedKgM3', 'naturalAggregateKgM3', 'recycledAggregateKgM3', 'waterKgM3'];
  if (!componentFields.some((field) => map.has(field))) issues.push({ severity: 'error', row: firstRow + 1, message: 'Tanımlı bir bağlayıcı, agrega veya su kolonu bulunamadı.' });
  headers.forEach((header) => {
    if (KNOWN_MATERIAL_HEADER.test(header) && ![...map.keys()].some((field) => HEADER_ALIASES[field].some((alias) => normalizeHeader(alias) === normalizeHeader(header)))) {
      issues.push({ severity: 'warning', row: firstRow + 1, field: header, message: 'Malzeme kolonu tanınmadı; değer ham satırda korundu ve aktif hesapta kullanılmadı.' });
    }
  });

  const referenceStrengths: StrengthValues = { ...EMPTY_STRENGTH_VALUES };
  const mixes: SustainableConcreteMix[] = [];
  const duplicateRows: number[] = [];
  const seenRows = new Map<string, number>();
  const sourceUrlByName = new Map<string, string>();

  rows.slice(firstRow + 1).forEach((row, index) => {
    const rowNumber = firstRow + index + 2;
    if (!row.some((cell) => String(cell ?? '').trim().length > 0)) return;
    const duplicateKey = row.map((cell) => String(cell ?? '').trim()).join('\u241F');
    const previous = seenRows.get(duplicateKey);
    if (previous != null) {
      duplicateRows.push(rowNumber);
      issues.push({ severity: 'warning', row: rowNumber, message: `Bu satır ${previous}. satırla tamamen aynı; duplicate kayıt.` });
    } else {
      seenRows.set(duplicateKey, rowNumber);
    }

    const mixNo = cellValue(row, map.get('mixNo')) || null;
    const rawName = cellValue(row, map.get('name'));
    const name = rawName || mixNo || `Karışım ${rowNumber}`;
    const systemRaw = cellValue(row, map.get('materialSystem'));
    const study = cellValue(row, map.get('study')) || null;
    const sourceUrl = cellValue(row, map.get('sourceUrl')) || null;
    const hasActivatorHeader = ['sodiumHydroxideKgM3', 'sodiumSilicateKgM3', 'alkaliActivatorKgM3'].some((field) => map.has(field as Field));
    const materialSystem = isGeopolymer(name, systemRaw) || hasActivatorHeader ? 'geopolymer' : /harc|mortar/i.test(systemRaw) ? 'mortar' : 'concrete';
    const numericFields: Field[] = [
      'cementKgM3', 'flyAshKgM3', 'ggbfsKgM3', 'silicaFumeKgM3', 'metakaolinKgM3',
      'naturalFineAggregateKgM3', 'naturalCoarseAggregateKgM3', 'recycledAggregateUnspecifiedKgM3',
      'recycledFineAggregateKgM3', 'recycledCoarseAggregateKgM3', 'lightweightAggregateKgM3',
      'heavyweightAggregateKgM3', 'naturalAggregateKgM3', 'recycledAggregateKgM3', 'waterKgM3',
      'sodiumHydroxideKgM3', 'sodiumSilicateKgM3', 'alkaliActivatorKgM3',
      'superplasticizerKgM3', 'airEntrainingKgM3', 'acceleratorRetarderKgM3', 'fiberKgM3', 'airTargetContentPercent',
    ];
    const values: Record<string, number | null> = {};
    numericFields.forEach((field) => {
      values[field] = field === 'airTargetContentPercent'
        ? readBoundedEngineeringNumber(row, map, field, issues, rowNumber, 100, 'Hava hedefi')
        : readNumber(row, map, field, issues, rowNumber);
    });
    const naturalFine = values.naturalFineAggregateKgM3 ?? null;
    const naturalCoarse = values.naturalCoarseAggregateKgM3 ?? null;
    const genericNatural = values.naturalAggregateKgM3 ?? null;
    const recycledUnspecified = values.recycledAggregateUnspecifiedKgM3 ?? values.recycledAggregateKgM3 ?? null;
    const recycledFine = values.recycledFineAggregateKgM3 ?? null;
    const recycledCoarse = values.recycledCoarseAggregateKgM3 ?? null;
    const naturalTotal = naturalFine != null || naturalCoarse != null ? (naturalFine ?? 0) + (naturalCoarse ?? 0) : genericNatural;
    const recycledTotal = recycledUnspecified != null || recycledFine != null || recycledCoarse != null
      ? (recycledUnspecified ?? 0) + (recycledFine ?? 0) + (recycledCoarse ?? 0)
      : null;
    const strengthValues: StrengthValues = {
      strength7DaysMpa: readBoundedEngineeringNumber(row, map, 'strength7DaysMpa', issues, rowNumber, 300, '7 günlük basınç dayanımı'),
      strength28DaysMpa: readBoundedEngineeringNumber(row, map, 'strength28DaysMpa', issues, rowNumber, 300, '28 günlük basınç dayanımı'),
      strength56DaysMpa: readBoundedEngineeringNumber(row, map, 'strength56DaysMpa', issues, rowNumber, 300, '56 günlük basınç dayanımı'),
      strength90DaysMpa: readBoundedEngineeringNumber(row, map, 'strength90DaysMpa', issues, rowNumber, 300, '90 günlük basınç dayanımı'),
    };
    const genericStrength = readBoundedEngineeringNumber(row, map, 'genericStrengthMpa', issues, rowNumber, 300, 'Basınç dayanımı');
    const compressiveStrengthMeasurements = [
      ...(genericStrength == null ? [] : [{ ageDays: null, valueMpa: genericStrength, source: study ?? sourceLabel, sourceUrl, sourceRow: rowNumber }]),
      ...([7, 28, 56, 90] as const).flatMap((ageDays) => {
        const value = strengthValues[`strength${ageDays}DaysMpa` as keyof StrengthValues];
        return value == null ? [] : [{ ageDays, valueMpa: value, source: study ?? sourceLabel, sourceUrl, sourceRow: rowNumber }];
      }),
    ];
    if (genericStrength != null) issues.push({ severity: 'warning', row: rowNumber, field: 'genericStrengthMpa', message: 'Deney yaşı belirtilmemiş; MPa değeri 28 gün kabul edilmedi.' });
    const hasActivatorData = ['sodiumHydroxideKgM3', 'sodiumSilicateKgM3', 'alkaliActivatorKgM3']
      .some((field) => map.has(field as Field) && values[field] != null);
    if (materialSystem === 'geopolymer' && !hasActivatorData) {
      issues.push({ severity: 'warning', row: rowNumber, message: 'Geopolimer reçetede alkali aktivatör verisi bulunmuyor; karbon ve maliyet hesabı eksik.' });
    }
    const binders = [values.cementKgM3, values.flyAshKgM3, values.ggbfsKgM3, values.silicaFumeKgM3, values.metakaolinKgM3].filter((value): value is number => value != null);
    if (binders.length === 0 || binders.reduce((sum, value) => sum + value, 0) <= 0) issues.push({ severity: 'error', row: rowNumber, message: `${name} için bağlayıcı yok.` });
    const water = values.waterKgM3;
    const binderTotal = binders.reduce((sum, value) => sum + value, 0);
    if (water != null && binderTotal > 0 && water / binderTotal > 1) issues.push({ severity: 'warning', row: rowNumber, message: `Su/bağlayıcı oranı olağandışı yüksek (${(water / binderTotal).toFixed(3)}).` });
    const knownMass = numericFields
      .filter((field) => field !== 'airTargetContentPercent')
      .map((field) => values[field])
      .filter((value): value is number => value != null)
      .reduce((sum, value) => sum + value, 0);
    if (knownMass > 0 && (knownMass < 1000 || knownMass > 3000)) issues.push({ severity: 'warning', row: rowNumber, message: `Toplam bilinen karışım kütlesi olağandışı (${knownMass.toFixed(2)} kg/m³).` });
    if (compressiveStrengthMeasurements.length === 0) issues.push({ severity: 'warning', row: rowNumber, message: 'Basınç dayanımı verisi bulunmuyor.' });
    if (study && sourceUrl) {
      const previousUrl = sourceUrlByName.get(study);
      if (previousUrl && previousUrl !== sourceUrl) issues.push({ severity: 'warning', row: rowNumber, message: `Aynı kaynak adı farklı URL ile geldi: ${study}.` });
      sourceUrlByName.set(study, sourceUrl);
    }
    const referenceFields: Array<[Field, keyof StrengthValues]> = [
      ['referenceStrength7DaysMpa', 'strength7DaysMpa'],
      ['referenceStrength28DaysMpa', 'strength28DaysMpa'],
      ['referenceStrength56DaysMpa', 'strength56DaysMpa'],
      ['referenceStrength90DaysMpa', 'strength90DaysMpa'],
    ];
    referenceFields.forEach(([field]) => addReferenceValue(referenceStrengths, readNumber(row, map, field, issues, rowNumber), field));
    const rawValues: Record<string, string | number | null> = {};
    headers.forEach((header, headerIndex) => { rawValues[header] = cellValue(row, headerIndex) || null; });
    const rawInputs: Record<string, RawMaterialInput> = {};
    numericFields.forEach((field) => {
      const raw = cellValue(row, map.get(field));
      rawInputs[field] = { rawValue: raw || null, rawUnit: raw ? rawUnit(raw) : null };
    });
    mixes.push({
      id: `imported-${rowNumber}-${normalizeHeader(name).slice(0, 30) || 'mix'}`,
      name,
      mixNo,
      materialSystem,
      source: sourceLabel,
      sourceUrl,
      literatureStudy: study,
      sourceLine: cellValue(row, map.get('sourceLine')) || null,
      sourceRow: rowNumber,
      rawValues,
      rawInputs,
      cementKgM3: values.cementKgM3,
      flyAshKgM3: values.flyAshKgM3,
      ggbfsKgM3: values.ggbfsKgM3,
      silicaFumeKgM3: values.silicaFumeKgM3,
      metakaolinKgM3: values.metakaolinKgM3,
      naturalAggregateKgM3: naturalTotal,
      recycledAggregateKgM3: recycledTotal,
      waterKgM3: values.waterKgM3,
      naturalFineAggregateKgM3: naturalFine,
      naturalCoarseAggregateKgM3: naturalCoarse,
      recycledAggregateUnspecifiedKgM3: values.recycledAggregateUnspecifiedKgM3 != null || (map.has('recycledAggregateKgM3') && recycledFine == null && recycledCoarse == null) ? recycledUnspecified : null,
      recycledFineAggregateKgM3: recycledFine,
      recycledCoarseAggregateKgM3: recycledCoarse,
      lightweightAggregateKgM3: values.lightweightAggregateKgM3,
      heavyweightAggregateKgM3: values.heavyweightAggregateKgM3,
      sodiumHydroxideKgM3: values.sodiumHydroxideKgM3,
      sodiumSilicateKgM3: values.sodiumSilicateKgM3,
      alkaliActivatorKgM3: values.alkaliActivatorKgM3,
      superplasticizerKgM3: values.superplasticizerKgM3,
      airEntrainingKgM3: values.airEntrainingKgM3,
      acceleratorRetarderKgM3: values.acceleratorRetarderKgM3,
      fiberKgM3: values.fiberKgM3,
      airTargetContentPercent: values.airTargetContentPercent,
      ...strengthValues,
      compressiveStrengthMeasurements,
    });
  });
  return { mixes, referenceStrengths, issues, headers, duplicateRows };
}

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) { cells.push(cell); cell = ''; }
    else cell += char;
  }
  cells.push(cell);
  return cells;
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const tabCount = (firstLine.match(/\t/g) ?? []).length;
  const semicolonCount = (firstLine.match(/;/g) ?? []).length;
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  if (tabCount > semicolonCount && tabCount > commaCount) return '\t';
  return semicolonCount >= commaCount ? ';' : ',';
}

export function parseSustainableConcreteCsv(text: string, sourceLabel = 'CSV içe aktarma'): SustainableConcreteImportResult {
  const delimiter = detectDelimiter(text);
  // Keep physical blank lines so sourceRow continues to match Excel/CSV row numbers.
  const rows = text.replace(/^\uFEFF/, '').split(/\r?\n/).map((line) => splitDelimitedLine(line, delimiter));
  return parseMatrix(rows, sourceLabel);
}

function cellToString(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'object' && value !== null) {
    const candidate = value as { text?: unknown; result?: unknown; richText?: Array<{ text?: string }> };
    if (typeof candidate.text === 'string') return candidate.text;
    if (typeof candidate.result === 'number' || typeof candidate.result === 'string') return String(candidate.result);
    if (Array.isArray(candidate.richText)) return candidate.richText.map((part) => part.text ?? '').join('');
  }
  return String(value);
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function xmlAttribute(tag: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return tag.match(new RegExp(`(?:^|\\s)${escaped}="([^"]*)"`))?.[1];
}

function columnIndexFromReference(reference: string): number {
  const letters = reference.match(/^[A-Za-z]+/)?.[0]?.toUpperCase() ?? '';
  let result = 0;
  for (const char of letters) result = result * 26 + (char.charCodeAt(0) - 64);
  return Math.max(0, result - 1);
}

function xmlTextNodes(xml: string): string {
  return [...xml.matchAll(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g)]
    .map((match) => decodeXmlText(match[1] ?? ''))
    .join('');
}

async function parsePrefixedOoxmlMatrix(buffer: ArrayBuffer): Promise<string[][]> {
  const { strFromU8, unzipSync } = await import('fflate');
  const entries = unzipSync(new Uint8Array(buffer));
  const readEntry = (path: string): string | undefined => entries[path] ? strFromU8(entries[path]) : undefined;

  const sharedStringsXml = readEntry('xl/sharedStrings.xml');
  const sharedStrings = sharedStringsXml
    ? [...sharedStringsXml.matchAll(/<(?:\w+:)?si\b[^>]*>([\s\S]*?)<\/(?:\w+:)?si>/g)].map((match) => xmlTextNodes(match[1] ?? ''))
    : [];

  let worksheetPath = 'xl/worksheets/sheet1.xml';
  const workbookXml = readEntry('xl/workbook.xml');
  const relationshipsXml = readEntry('xl/_rels/workbook.xml.rels');
  if (workbookXml && relationshipsXml) {
    const firstSheetTag = workbookXml.match(/<(?:\w+:)?sheet\b[^>]*\/>/)?.[0]
      ?? workbookXml.match(/<(?:\w+:)?sheet\b[^>]*>/)?.[0];
    const relationshipId = firstSheetTag ? xmlAttribute(firstSheetTag, 'r:id') : undefined;
    if (relationshipId) {
      const relationshipTags = relationshipsXml.match(/<Relationship\b[^>]*\/>/g) ?? [];
      const matchingRelationship = relationshipTags.find((tag) => xmlAttribute(tag, 'Id') === relationshipId);
      const target = matchingRelationship ? xmlAttribute(matchingRelationship, 'Target') : undefined;
      if (target) worksheetPath = target.replace(/^\//, '');
    }
  }

  const worksheetXml = readEntry(worksheetPath);
  if (!worksheetXml) throw new Error(`OOXML çalışma sayfası bulunamadı: ${worksheetPath}`);

  const rows: string[][] = [];
  for (const rowMatch of worksheetXml.matchAll(/<(?:\w+:)?row\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?row>/g)) {
    const rowAttributes = rowMatch[1] ?? '';
    const rowXml = rowMatch[2] ?? '';
    const rowNumber = Number.parseInt(xmlAttribute(`<row ${rowAttributes}>`, 'r') ?? String(rows.length + 1), 10);
    const row: string[] = [];

    for (const cellMatch of rowXml.matchAll(/<(?:\w+:)?c\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?c>/g)) {
      const attributes = cellMatch[1] ?? '';
      const cellXml = cellMatch[2] ?? '';
      const reference = xmlAttribute(`<c ${attributes}>`, 'r') ?? '';
      const type = xmlAttribute(`<c ${attributes}>`, 't');
      const columnIndex = columnIndexFromReference(reference);
      let value = '';

      if (type === 'inlineStr') {
        value = xmlTextNodes(cellXml);
      } else {
        const rawValue = cellXml.match(/<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/)?.[1] ?? '';
        if (type === 's') value = sharedStrings[Number.parseInt(rawValue, 10)] ?? '';
        else if (type === 'b') value = rawValue === '1' ? 'TRUE' : 'FALSE';
        else value = decodeXmlText(rawValue);
      }

      row[columnIndex] = value;
    }

    while (rows.length < rowNumber - 1) rows.push([]);
    rows[rowNumber - 1] = Array.from({ length: row.length }, (_, index) => row[index] ?? '');
  }

  return rows;
}

export async function parseSustainableConcreteXlsx(buffer: ArrayBuffer, sourceLabel = 'Excel içe aktarma'): Promise<SustainableConcreteImportResult> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) return { mixes: [], referenceStrengths: { ...EMPTY_STRENGTH_VALUES }, issues: [{ severity: 'error', message: 'Excel dosyasında çalışma sayfası bulunamadı.' }], headers: [] };
    const rows: string[][] = [];
    // Iterate by physical worksheet row number. `eachRow({ includeEmpty: false })`
    // compresses blank rows and would make sourceRow differ from Excel's row.
    for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      rows.push(values.map(cellToString));
    }
    return parseMatrix(rows, sourceLabel);
  } catch (excelJsError) {
    try {
      // Some valid OOXML producers emit namespace-prefixed workbook/worksheet nodes
      // (for example x:workbook/x:worksheet). ExcelJS 4.x rejects those files even
      // though Excel opens them normally, so fall back to reading the OOXML package.
      return parseMatrix(await parsePrefixedOoxmlMatrix(buffer), sourceLabel);
    } catch (fallbackError) {
      const excelJsMessage = excelJsError instanceof Error ? excelJsError.message : String(excelJsError);
      const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      throw new Error(`Excel dosyası okunamadı. ExcelJS: ${excelJsMessage}; OOXML fallback: ${fallbackMessage}`);
    }
  }
}

export async function parseSustainableConcreteFile(file: File): Promise<SustainableConcreteImportResult> {
  if (/\.csv$/i.test(file.name) || file.type.includes('csv')) return parseSustainableConcreteCsv(await file.text(), file.name);
  if (/\.xlsx$/i.test(file.name) || file.type.includes('spreadsheetml')) return parseSustainableConcreteXlsx(await file.arrayBuffer(), file.name);
  return { mixes: [], referenceStrengths: { ...EMPTY_STRENGTH_VALUES }, issues: [{ severity: 'error', message: 'Bu dosya türü desteklenmiyor. CSV veya XLSX seçin.' }], headers: [] };
}
