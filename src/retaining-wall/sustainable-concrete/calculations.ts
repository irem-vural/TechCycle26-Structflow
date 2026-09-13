import type {
  ConcreteMixComponents,
  EmissionFactors,
  MaterialKey,
  ReferenceMixComposition,
  StrengthAge,
  StrengthValues,
  SustainableConcreteFilters,
  SustainableConcreteMix,
  SustainableConcreteSortKey,
} from './types';

const BINDER_KEYS: MaterialKey[] = ['cement', 'flyAsh', 'ggbfs', 'silicaFume', 'metakaolin'];
const RECOVERED_MINERAL_KEYS: MaterialKey[] = ['flyAsh', 'ggbfs', 'silicaFume'];
const ALTERNATIVE_MINERAL_KEYS: MaterialKey[] = ['metakaolin'];
const AGGREGATE_KEYS: MaterialKey[] = ['naturalAggregate', 'recycledAggregate'];

export interface WasteCalculation {
  mineralWasteKgM3: number | null;
  mineralWastePercentOfBinder: number | null;
  alternativeMineralKgM3: number | null;
  alternativeMineralPercentOfBinder: number | null;
  recycledAggregateWasteKgM3: number | null;
  recycledAggregatePercentOfAggregate: number | null;
  totalWasteKgM3: number | null;
  circularAlternativeKgM3: number | null;
  totalDrySolidsKgM3: number | null;
  wasteUseRatePercent: number | null;
  circularAlternativeRatePercent: number | null;
  referenceTotalWasteKgM3: number | null;
  differenceVsReferenceKgM3: number | null;
  differenceVsReferencePercent: number | null;
}

export interface CarbonCalculation {
  totalKgCo2eM3: number | null;
  knownSubtotalKgCo2eM3: number;
  emissionsByMaterial: Record<MaterialKey, number | null>;
  missingFactors: MaterialKey[];
  missingAmounts: MaterialKey[];
  referenceTotalKgCo2eM3: number | null;
  reductionPercent: number | null;
}

export interface StrengthComparison {
  mixMpa: number | null;
  referenceMpa: number | null;
  differenceMpa: number | null;
  differencePercent: number | null;
}

export interface SustainableConcreteMixResult {
  mix: SustainableConcreteMix;
  totalBinderKgM3: number | null;
  referenceMode: 'none' | 'selected' | 'theoretical';
  referenceMix: ReferenceMixComposition;
  waste: WasteCalculation;
  carbon: CarbonCalculation;
  strengths: Record<StrengthAge, StrengthComparison>;
  warnings: string[];
}

export interface SustainableConcreteReferenceOptions {
  referenceMode?: 'none' | 'selected' | 'theoretical';
  referenceMix?: SustainableConcreteMix | null;
}

type ComponentField = Exclude<keyof ConcreteMixComponents, 'waterKgM3'>;

const FIELD_BY_MATERIAL: Record<MaterialKey, ComponentField> = {
  cement: 'cementKgM3',
  flyAsh: 'flyAshKgM3',
  ggbfs: 'ggbfsKgM3',
  silicaFume: 'silicaFumeKgM3',
  metakaolin: 'metakaolinKgM3',
  naturalAggregate: 'naturalAggregateKgM3',
  recycledAggregate: 'recycledAggregateKgM3',
};

const STRENGTH_FIELD_BY_AGE: Record<StrengthAge, keyof StrengthValues> = {
  7: 'strength7DaysMpa',
  28: 'strength28DaysMpa',
  56: 'strength56DaysMpa',
  90: 'strength90DaysMpa',
};

const nullableSum = (values: Array<number | null>): number | null => {
  if (values.some((value) => value == null || !Number.isFinite(value))) return null;
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
};

const nullableAdd = (left: number | null, right: number | null): number | null =>
  left == null || right == null ? null : left + right;

const percent = (value: number | null, denominator: number | null): number | null =>
  value == null || denominator == null || denominator <= 0 ? null : (value / denominator) * 100;

export function amountForMaterial(
  source: Pick<ConcreteMixComponents, ComponentField>,
  material: MaterialKey,
): number | null {
  return source[FIELD_BY_MATERIAL[material]] ?? null;
}

export function strengthAtAge(source: StrengthValues, age: StrengthAge): number | null {
  return source[STRENGTH_FIELD_BY_AGE[age]] ?? null;
}

function measuredStrengthAtAge(source: SustainableConcreteMix, age: StrengthAge): number | null {
  const direct = strengthAtAge(source, age);
  if (direct != null) return direct;
  return source.compressiveStrengthMeasurements?.find((measurement) => measurement.ageDays === age)?.valueMpa ?? null;
}

export function totalBinderKgM3(mix: ConcreteMixComponents): number | null {
  return nullableSum(BINDER_KEYS.map((key) => amountForMaterial(mix, key)));
}

export function totalAggregateKgM3(mix: ConcreteMixComponents): number | null {
  return nullableSum(AGGREGATE_KEYS.map((key) => amountForMaterial(mix, key)));
}

export function createReferenceMix(mix: SustainableConcreteMix): ReferenceMixComposition {
  const totalBinder = totalBinderKgM3(mix);
  const naturalAggregate = amountForMaterial(mix, 'naturalAggregate');
  const recycledAggregate = amountForMaterial(mix, 'recycledAggregate');
  return {
    name: `Referans · ${mix.name}`,
    cementKgM3: totalBinder,
    flyAshKgM3: totalBinder == null ? null : 0,
    ggbfsKgM3: totalBinder == null ? null : 0,
    silicaFumeKgM3: totalBinder == null ? null : 0,
    metakaolinKgM3: totalBinder == null ? null : 0,
    naturalAggregateKgM3: nullableAdd(naturalAggregate, recycledAggregate),
    recycledAggregateKgM3: 0,
    waterKgM3: mix.waterKgM3,
  };
}

function calculateCarbon(
  components: ConcreteMixComponents,
  factors: EmissionFactors,
): Omit<CarbonCalculation, 'referenceTotalKgCo2eM3' | 'reductionPercent'> {
  const emissionsByMaterial = {} as Record<MaterialKey, number | null>;
  const missingFactors: MaterialKey[] = [];
  const missingAmounts: MaterialKey[] = [];

  const values = Object.keys(FIELD_BY_MATERIAL) as MaterialKey[];
  for (const material of values) {
    const amount = amountForMaterial(components, material);
    const factor = factors[material];
    if (amount == null) {
      missingAmounts.push(material);
      emissionsByMaterial[material] = null;
    } else if (amount > 0 && factor == null) {
      missingFactors.push(material);
      emissionsByMaterial[material] = null;
    } else {
      emissionsByMaterial[material] = amount * (factor ?? 0);
    }
  }

  const knownSubtotalKgCo2eM3 = values.reduce(
    (sum, material) => sum + (emissionsByMaterial[material] ?? 0),
    0,
  );
  const totalKgCo2eM3 = missingFactors.length > 0 || missingAmounts.length > 0
    ? null
    : knownSubtotalKgCo2eM3;

  return {
    totalKgCo2eM3,
    knownSubtotalKgCo2eM3,
    emissionsByMaterial,
    missingFactors,
    missingAmounts,
  };
}

export function calculateMixResult(
  mix: SustainableConcreteMix,
  factors: EmissionFactors,
  referenceStrengths: StrengthValues,
  options: SustainableConcreteReferenceOptions = {},
): SustainableConcreteMixResult {
  const totalBinder = totalBinderKgM3(mix);
  const totalAggregate = totalAggregateKgM3(mix);
  const mineralWasteKgM3 = nullableSum(RECOVERED_MINERAL_KEYS.map((key) => amountForMaterial(mix, key)));
  const alternativeMineralKgM3 = nullableSum(ALTERNATIVE_MINERAL_KEYS.map((key) => amountForMaterial(mix, key)));
  const recycledAggregateWasteKgM3 = amountForMaterial(mix, 'recycledAggregate');
  const totalWasteKgM3 = nullableAdd(mineralWasteKgM3, recycledAggregateWasteKgM3);
  const circularAlternativeKgM3 = nullableAdd(totalWasteKgM3, alternativeMineralKgM3);
  const totalDrySolidsKgM3 = nullableAdd(totalBinder, totalAggregate);
  const currentCarbon = calculateCarbon(mix, factors);
  const referenceMode = options.referenceMode ?? 'none';
  const referenceMix: ReferenceMixComposition = referenceMode === 'theoretical'
    ? createReferenceMix(mix)
    : options.referenceMix
      ? { ...options.referenceMix, name: `Seçili referans · ${options.referenceMix.name}` }
      : {
        name: 'Referans seçilmedi',
        cementKgM3: null,
        flyAshKgM3: null,
        ggbfsKgM3: null,
        silicaFumeKgM3: null,
        metakaolinKgM3: null,
        naturalAggregateKgM3: null,
        recycledAggregateKgM3: null,
        waterKgM3: null,
      };
  const referenceCarbon = calculateCarbon(referenceMix, factors);
  const wasteUseRatePercent = percent(totalWasteKgM3, totalDrySolidsKgM3);
  const circularAlternativeRatePercent = percent(circularAlternativeKgM3, totalDrySolidsKgM3);
  const referenceMineralWasteKgM3 = nullableSum(RECOVERED_MINERAL_KEYS.map((key) => amountForMaterial(referenceMix, key)));
  const referenceRecycledAggregateWasteKgM3 = amountForMaterial(referenceMix, 'recycledAggregate');
  const referenceWaste = referenceMode === 'none' ? null : nullableAdd(referenceMineralWasteKgM3, referenceRecycledAggregateWasteKgM3);
  const referenceDrySolidsKgM3 = nullableAdd(totalBinderKgM3(referenceMix), totalAggregateKgM3(referenceMix));
  const referenceWasteUseRatePercent = percent(referenceWaste, referenceDrySolidsKgM3);
  const differenceVsReferenceKgM3 = totalWasteKgM3 == null || referenceWaste == null ? null : totalWasteKgM3 - referenceWaste;
  const differenceVsReferencePercent = wasteUseRatePercent == null || referenceWasteUseRatePercent == null ? null : wasteUseRatePercent - referenceWasteUseRatePercent;
  const warnings: string[] = [];

  const requiredInputs: Array<[keyof ConcreteMixComponents, string]> = [
    ['cementKgM3', 'Çimento'],
    ['flyAshKgM3', 'Uçucu kül'],
    ['ggbfsKgM3', 'GGBFS'],
    ['silicaFumeKgM3', 'Silis dumanı'],
    ['metakaolinKgM3', 'Metakaolin'],
    ['naturalAggregateKgM3', 'Doğal agrega'],
    ['recycledAggregateKgM3', 'Geri dönüştürülmüş agrega'],
    ['waterKgM3', 'Su'],
  ];
  for (const [field, label] of requiredInputs) {
    const value = mix[field];
    if (value == null) warnings.push(`${label} verisi eksik.`);
    else if (value < 0) warnings.push(`${label} değeri negatif olamaz.`);
  }
  const hasMixStrength = ([7, 28, 56, 90] as const).some((age) => measuredStrengthAtAge(mix, age) != null)
    || (mix.compressiveStrengthMeasurements ?? []).some((measurement) => measurement.ageDays == null);
  if (!hasMixStrength) {
    warnings.push('Basınç dayanımı verisi bulunmuyor.');
  }
  if (currentCarbon.missingFactors.length > 0) {
    warnings.push('Karbon ayak izi için emisyon faktörü eksik.');
  }
  if (referenceMode === 'none') {
    warnings.push('Referans karışımı seçilmedi; karşılaştırma farkları hesaplanmadı.');
  } else if (referenceMode === 'theoretical') {
    warnings.push('Karşılaştırma açıkça teorik referansla yapılıyor; bu bir literatür karışımı değildir.');
  }
  const hasReferenceStrength = referenceMode === 'selected' && options.referenceMix
    ? ([7, 28, 56, 90] as const).some((age) => measuredStrengthAtAge(options.referenceMix as SustainableConcreteMix, age) != null)
    : Object.values(referenceStrengths).some((value) => value != null);
  if (!hasReferenceStrength) {
    warnings.push('Referans karışımın ölçülmüş dayanımı girilmedi; dayanım farkı hesaplanamaz.');
  }

  const strengths = {} as Record<StrengthAge, StrengthComparison>;
  for (const age of [7, 28, 56, 90] as const) {
    const mixMpa = measuredStrengthAtAge(mix, age);
    const referenceMpa = referenceMode === 'none'
      ? null
      : referenceMode === 'selected' && options.referenceMix
        ? measuredStrengthAtAge(options.referenceMix, age)
        : strengthAtAge(referenceStrengths, age);
    const differenceMpa = mixMpa == null || referenceMpa == null ? null : mixMpa - referenceMpa;
    strengths[age] = {
      mixMpa,
      referenceMpa,
      differenceMpa,
      differencePercent: percent(differenceMpa, referenceMpa),
    };
  }

  const carbon: CarbonCalculation = {
    ...currentCarbon,
    referenceTotalKgCo2eM3: referenceCarbon.totalKgCo2eM3,
    reductionPercent:
      currentCarbon.totalKgCo2eM3 == null || referenceCarbon.totalKgCo2eM3 == null || referenceCarbon.totalKgCo2eM3 <= 0
        ? null
        : ((referenceCarbon.totalKgCo2eM3 - currentCarbon.totalKgCo2eM3) / referenceCarbon.totalKgCo2eM3) * 100,
  };

  return {
    mix,
    totalBinderKgM3: totalBinder,
    referenceMode,
    referenceMix,
    waste: {
      mineralWasteKgM3,
      mineralWastePercentOfBinder: percent(mineralWasteKgM3, totalBinder),
      alternativeMineralKgM3,
      alternativeMineralPercentOfBinder: percent(alternativeMineralKgM3, totalBinder),
      recycledAggregateWasteKgM3,
      recycledAggregatePercentOfAggregate: percent(recycledAggregateWasteKgM3, totalAggregate),
      totalWasteKgM3,
      circularAlternativeKgM3,
      totalDrySolidsKgM3,
      wasteUseRatePercent,
      circularAlternativeRatePercent,
      referenceTotalWasteKgM3: referenceWaste,
      differenceVsReferenceKgM3,
      differenceVsReferencePercent,
    },
    carbon,
    strengths,
    warnings,
  };
}

export function matchesSustainableConcreteFilters(
  result: SustainableConcreteMixResult,
  filters: SustainableConcreteFilters,
): boolean {
  const strength = result.strengths[filters.strengthAge].mixMpa;
  if (filters.minStrengthMpa != null && (strength == null || strength < filters.minStrengthMpa)) return false;
  if (filters.minWasteRatePercent != null && (result.waste.wasteUseRatePercent == null || result.waste.wasteUseRatePercent < filters.minWasteRatePercent)) return false;
  if (filters.maxCarbonKgCo2eM3 != null && (result.carbon.totalKgCo2eM3 == null || result.carbon.totalKgCo2eM3 > filters.maxCarbonKgCo2eM3)) return false;
  return true;
}

export function sortSustainableConcreteResults(
  results: SustainableConcreteMixResult[],
  sortBy: SustainableConcreteSortKey,
  strengthAge: StrengthAge,
): SustainableConcreteMixResult[] {
  const sorted = [...results];
  const valueFor = (result: SustainableConcreteMixResult): number | null => {
    if (sortBy === 'strength') return result.strengths[strengthAge].mixMpa;
    if (sortBy === 'waste') return result.waste.wasteUseRatePercent;
    return result.carbon.reductionPercent;
  };
  sorted.sort((left, right) => {
    const leftValue = valueFor(left);
    const rightValue = valueFor(right);
    if (leftValue == null && rightValue == null) return left.mix.name.localeCompare(right.mix.name, 'tr');
    if (leftValue == null) return 1;
    if (rightValue == null) return -1;
    return rightValue - leftValue;
  });
  return sorted;
}
