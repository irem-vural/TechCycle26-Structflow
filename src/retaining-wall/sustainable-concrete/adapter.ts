import type { ConcreteMixDesign, EmissionFactor, MaterialInput } from '../material-selection/types';
import { getApprovedEmissionFactor } from '../coefficients/materialData';
import { getMaterialEmissionCoefficient } from '../coefficients/defaults';
import type { ConcreteClass } from '../types';
import type { EmissionFactors, RawMaterialInput, SustainableConcreteMix } from './types';

type SustainableEmissionMetadata = NonNullable<EmissionFactors['metadata']>[keyof NonNullable<EmissionFactors['metadata']>];

function amount(id: string, name: string, category: MaterialInput['category'], value: number | null, rawInput?: RawMaterialInput, enabled = (value ?? 0) > 0): MaterialInput {
  return {
    id,
    name,
    category,
    enabled,
    value,
    unit: 'kg/m³',
    basis: 'amount',
    rawValue: rawInput?.rawValue ?? value,
    rawUnit: rawInput?.rawUnit ?? 'kg/m³',
    canonicalKgPerM3: value,
    percentage: null,
  };
}

function factor(
  value: number | null | undefined,
  key: string,
  metadata?: SustainableEmissionMetadata,
): EmissionFactor | undefined {
  if (value != null && Number.isFinite(value)) {
    return {
      value,
      unit: 'kgCO₂e/kg',
      source: metadata?.source ?? `Sürdürülebilir beton emisyon faktörü: ${key}`,
      sourceUrl: metadata?.sourceUrl ?? null,
      region: metadata?.region ?? null,
      year: metadata?.year ?? null,
      notes: metadata?.notes ?? null,
    };
  }
  const approved = getApprovedEmissionFactor(key);
  if (approved) return approved;
  const coefficient = getMaterialEmissionCoefficient(key);
  if (!coefficient) return undefined;
  return {
    value: coefficient.value,
    unit: 'kgCO₂e/kg',
    source: coefficient.source,
    sourceUrl: coefficient.sourceUrl ?? null,
    region: coefficient.region ?? null,
    year: coefficient.year ?? null,
    notes: coefficient.notes ?? null,
  };
}

/** Adapter used by “Bu karışımı aktif tasarımda kullan”. */
export function sustainableMixToConcreteMix(
  source: SustainableConcreteMix,
  factors: EmissionFactors | undefined,
  targetConcreteClass: ConcreteClass,
): ConcreteMixDesign {
  const naturalFine = source.naturalFineAggregateKgM3 ?? null;
  const naturalCoarse = source.naturalCoarseAggregateKgM3 ?? null;
  const recycledFine = source.recycledFineAggregateKgM3 ?? null;
  // This thesis uses coarse RCA. Legacy/general RCA columns are migrated to the
  // coarse field only when an explicit coarse value is not present.
  const recycledCoarse = source.recycledCoarseAggregateKgM3
    ?? source.recycledAggregateUnspecifiedKgM3
    ?? source.recycledAggregateKgM3
    ?? null;
  const recycledCoarseRaw = source.rawInputs?.recycledCoarseAggregateKgM3
    ?? source.rawInputs?.recycledAggregateUnspecifiedKgM3
    ?? source.rawInputs?.recycledAggregateKgM3;
  const materials: MaterialInput[] = [
    amount('cement', 'Portland çimentosu', 'binder', source.cementKgM3, source.rawInputs?.cementKgM3),
    amount('fly_ash', 'Uçucu kül', 'binder', source.flyAshKgM3, source.rawInputs?.flyAshKgM3),
    amount('slag', 'Yüksek fırın cürufu (GGBFS)', 'binder', source.ggbfsKgM3, source.rawInputs?.ggbfsKgM3),
    amount('silica_fume', 'Silis dumanı', 'binder', source.silicaFumeKgM3, source.rawInputs?.silicaFumeKgM3),
    amount('metakaolin', 'Metakaolin', 'binder', source.metakaolinKgM3, source.rawInputs?.metakaolinKgM3),
    amount('natural_fine_aggregate', 'Doğal ince agrega', 'aggregate', naturalFine ?? source.naturalAggregateKgM3, source.rawInputs?.naturalFineAggregateKgM3),
    amount('natural_coarse_aggregate', 'Doğal iri agrega', 'aggregate', naturalCoarse, source.rawInputs?.naturalCoarseAggregateKgM3),
    amount('recycled_fine_aggregate', 'Geri dönüştürülmüş ince agrega', 'aggregate', recycledFine, source.rawInputs?.recycledFineAggregateKgM3),
    amount('recycled_coarse_aggregate', 'Geri dönüştürülmüş iri agrega', 'aggregate', recycledCoarse, recycledCoarseRaw),
    amount('water', 'Su', 'water', source.waterKgM3, source.rawInputs?.waterKgM3),
    amount('superplasticizer', 'Süperakışkanlaştırıcı / su azaltıcı', 'admixture', source.superplasticizerKgM3 ?? null, source.rawInputs?.superplasticizerKgM3),
    amount('air_entraining', 'Hava sürükleyici katkı', 'admixture', source.airEntrainingKgM3 ?? null, source.rawInputs?.airEntrainingKgM3),
    amount('accelerator', 'Priz hızlandırıcı / geciktirici', 'admixture', source.acceleratorRetarderKgM3 ?? null, source.rawInputs?.acceleratorRetarderKgM3),
    amount('other_fiber', 'Fiber', 'fiber', source.fiberKgM3 ?? null, source.rawInputs?.fiberKgM3),
    amount('sodium_hydroxide', 'Sodyum hidroksit (NaOH)', 'activator', source.sodiumHydroxideKgM3 ?? null, source.rawInputs?.sodiumHydroxideKgM3),
    amount('sodium_silicate', 'Sodyum silikat (Na₂SiO₃)', 'activator', source.sodiumSilicateKgM3 ?? null, source.rawInputs?.sodiumSilicateKgM3),
    amount('alkali_activator', 'Alkali aktivatör çözeltisi', 'activator', source.alkaliActivatorKgM3 ?? null, source.rawInputs?.alkaliActivatorKgM3),
  ];
  const measurements = source.compressiveStrengthMeasurements?.length
    ? [...source.compressiveStrengthMeasurements]
    : ([
      [7, source.strength7DaysMpa],
      [28, source.strength28DaysMpa],
      [56, source.strength56DaysMpa],
      [90, source.strength90DaysMpa],
    ] as Array<[number, number | null]>).filter(([, value]) => value != null).map(([ageDays, value]) => ({ ageDays, valueMpa: value as number, source: source.literatureStudy ?? source.source, sourceUrl: source.sourceUrl, sourceRow: source.sourceRow }));
  const emissionFactors: Record<string, EmissionFactor> = {};
  const factorMap: Record<string, { value: number | null | undefined; metadataKey?: keyof NonNullable<EmissionFactors['metadata']> }> = {
    cement: { value: factors?.cement, metadataKey: 'cement' },
    fly_ash: { value: factors?.flyAsh, metadataKey: 'flyAsh' },
    slag: { value: factors?.ggbfs, metadataKey: 'ggbfs' },
    silica_fume: { value: factors?.silicaFume, metadataKey: 'silicaFume' },
    metakaolin: { value: factors?.metakaolin, metadataKey: 'metakaolin' },
    natural_fine_aggregate: { value: factors?.naturalAggregate, metadataKey: 'naturalAggregate' },
    natural_coarse_aggregate: { value: factors?.naturalAggregate, metadataKey: 'naturalAggregate' },
    recycled_fine_aggregate: { value: factors?.recycledAggregate, metadataKey: 'recycledAggregate' },
    recycled_coarse_aggregate: { value: factors?.recycledAggregate, metadataKey: 'recycledAggregate' },
    water: { value: undefined },
    superplasticizer: { value: undefined },
    air_entraining: { value: undefined },
    sodium_hydroxide: { value: undefined },
  };
  Object.entries(factorMap).forEach(([key, configured]) => {
    const metadata = configured.metadataKey ? factors?.metadata?.[configured.metadataKey] : undefined;
    const entry = factor(configured.value, key, metadata);
    if (entry) emissionFactors[key] = entry;
  });
  return {
    schemaVersion: 2,
    id: source.id,
    name: source.name,
    materialSystem: source.materialSystem ?? 'concrete',
    targetConcreteClass,
    targetSlumpClass: 'S3',
    targetStrength7DaysMpa: null,
    targetStrength28DaysMpa: null,
    targetLongTermAgeDays: 56,
    targetLongTermStrengthMpa: null,
    targetAirContentPercent: source.airTargetContentPercent ?? null,
    materials,
    aggregates: [],
    binders: [],
    water: { amountKgM3: source.waterKgM3 ?? 0, waterBinderRatio: 0, ratioMode: 'automatic' },
    superplasticizer: { enabled: (source.superplasticizerKgM3 ?? 0) > 0, amountKgM3: source.superplasticizerKgM3 ?? 0 },
    admixtures: [],
    compressiveStrengthMeasurements: measurements,
    literature: {
      studyName: source.literatureStudy ?? source.source ?? null,
      sourceUrl: source.sourceUrl ?? null,
      sourceRow: source.sourceRow ?? null,
      sourceLine: source.sourceLine ?? null,
      notes: source.materialSystem === 'geopolymer' ? 'Aktivatör kolonları veri setinde bulunmuyorsa karbon/maliyet hesabı eksiktir.' : null,
    },
    emissionFactors,
    prices: {},
    priceMode: 'recipe',
    readyMixPrice: null,
  };
}
