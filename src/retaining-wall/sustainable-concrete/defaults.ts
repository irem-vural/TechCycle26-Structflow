import type {
  EmissionFactors,
  StrengthValues,
  SustainableConcreteData,
  SustainableConcreteMix,
} from './types';
import { SUSTAINABLE_CONCRETE_SCHEMA_VERSION } from './types';
import { getApprovedEmissionBenchmark } from '../coefficients/materialData';

function approved(key: string) {
  const benchmark = getApprovedEmissionBenchmark(key);
  if (!benchmark) throw new Error(`Onaylı emisyon benchmarkı bulunamadı: ${key}`);
  return benchmark;
}

export const EMPTY_STRENGTH_VALUES: StrengthValues = {
  strength7DaysMpa: null,
  strength28DaysMpa: null,
  strength56DaysMpa: null,
  strength90DaysMpa: null,
};

export const EMPTY_EMISSION_FACTORS: EmissionFactors = {
  cement: approved('cement').value,
  flyAsh: approved('fly_ash').value,
  ggbfs: approved('slag').value,
  silicaFume: approved('silica_fume').value,
  metakaolin: approved('metakaolin').value,
  naturalAggregate: null,
  recycledAggregate: approved('recycled_coarse_aggregate').value,
  metadata: {
    cement: { unit: 'kgCO₂e/kg', source: approved('cement').source, region: approved('cement').region, year: approved('cement').year, notes: approved('cement').notes },
    flyAsh: { unit: 'kgCO₂e/kg', source: approved('fly_ash').source, region: approved('fly_ash').region, year: approved('fly_ash').year, notes: approved('fly_ash').notes },
    ggbfs: { unit: 'kgCO₂e/kg', source: approved('slag').source, region: approved('slag').region, year: approved('slag').year, notes: approved('slag').notes },
    silicaFume: { unit: 'kgCO₂e/kg', source: approved('silica_fume').source, region: approved('silica_fume').region, year: approved('silica_fume').year, notes: approved('silica_fume').notes },
    metakaolin: { unit: 'kgCO₂e/kg', source: approved('metakaolin').source, region: approved('metakaolin').region, year: approved('metakaolin').year, notes: approved('metakaolin').notes },
    recycledAggregate: {
      unit: 'kgCO₂e/kg',
      source: approved('recycled_coarse_aggregate').source,
      region: approved('recycled_coarse_aggregate').region,
      year: approved('recycled_coarse_aggregate').year,
      notes: approved('recycled_coarse_aggregate').notes,
      uncertaintyMin: approved('recycled_coarse_aggregate').uncertaintyRange?.min ?? null,
      uncertaintyMax: approved('recycled_coarse_aggregate').uncertaintyRange?.max ?? null,
    },
  },
};

export function createDemoSustainableConcreteMixes(): SustainableConcreteMix[] {
  return [
    {
      id: 'demo-low-carbon',
      name: 'Demo · Düşük karbon',
      source: 'StructFlow demo verisi — laboratuvar verisi değildir',
      cementKgM3: 260,
      flyAshKgM3: 70,
      ggbfsKgM3: 50,
      silicaFumeKgM3: 0,
      metakaolinKgM3: 0,
      naturalAggregateKgM3: 950,
      recycledAggregateKgM3: 250,
      waterKgM3: 165,
      strength7DaysMpa: 23,
      strength28DaysMpa: 37,
      strength56DaysMpa: 42,
      strength90DaysMpa: 45,
    },
    {
      id: 'demo-high-recycled',
      name: 'Demo · Yüksek geri dönüşüm',
      source: 'StructFlow demo verisi — laboratuvar verisi değildir',
      cementKgM3: 280,
      flyAshKgM3: 40,
      ggbfsKgM3: 30,
      silicaFumeKgM3: 0,
      metakaolinKgM3: 10,
      naturalAggregateKgM3: 780,
      recycledAggregateKgM3: 450,
      waterKgM3: 170,
      strength7DaysMpa: 25,
      strength28DaysMpa: 39,
      strength56DaysMpa: 44,
      strength90DaysMpa: 47,
    },
    {
      id: 'demo-mineral-balance',
      name: 'Demo · Mineral katkı dengeli',
      source: 'StructFlow demo verisi — laboratuvar verisi değildir',
      cementKgM3: 240,
      flyAshKgM3: 80,
      ggbfsKgM3: 80,
      silicaFumeKgM3: 8,
      metakaolinKgM3: 12,
      naturalAggregateKgM3: 1050,
      recycledAggregateKgM3: 150,
      waterKgM3: 160,
      strength7DaysMpa: 21,
      strength28DaysMpa: 36,
      strength56DaysMpa: 40,
      strength90DaysMpa: 44,
    },
  ];
}

export function createDefaultSustainableConcreteData(): SustainableConcreteData {
  const mixes = createDemoSustainableConcreteMixes();
  return {
    schemaVersion: SUSTAINABLE_CONCRETE_SCHEMA_VERSION,
    mixes,
    emissionFactors: { ...EMPTY_EMISSION_FACTORS },
    referenceStrengths: { ...EMPTY_STRENGTH_VALUES },
    filters: {
      minStrengthMpa: null,
      minWasteRatePercent: null,
      maxCarbonKgCo2eM3: null,
      strengthAge: 28,
    },
    sortBy: 'waste',
    selectedMixId: mixes[0]?.id ?? null,
    referenceMode: 'none',
    referenceMixId: null,
    importIssues: [],
  };
}
