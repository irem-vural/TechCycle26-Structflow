import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { calculateCost, calculateRecipeMaterialCostPerM3 } from '../engine/cost';
import { calculateMaterialsEmissions } from '../engine/emissions/materials';
import { runEngine } from '../engine';
import { approvedRebarPriceTlPerTon, getApprovedEmissionBenchmark, getApprovedPriceBenchmark } from '../coefficients/materialData';
import { getMaterialEmissionCoefficient } from '../coefficients/defaults';
import { getDefaultMaterialPrice } from '../material-selection/defaultPrices';
import { ALL_MATERIAL_DEFINITIONS } from '../material-selection/materialCatalog';
import { applyConcreteClassProfile, autoFixConcreteMixIssue, calculateMixMetrics, createDefaultConcreteMix, makeCustomConcreteMix, normalizeConcreteMix, validateConcreteMix } from '../material-selection/mixModel';
import { evaluateOptimizationScenario } from '../material-selection/optimization';
import {
  getStructFlowReferenceConcreteProfile,
  STRUCTFLOW_REFERENCE_PROFILE_NOTE,
  STRUCTFLOW_REFERENCE_PROFILE_SOURCE,
} from '../material-selection/referenceConcreteProfiles';
import { normalizeMaterialQuantity } from '../material-selection/units';
import type { ConcreteMixDesign, EmissionFactor, MaterialInput } from '../material-selection/types';
import { sustainableMixToConcreteMix } from '../sustainable-concrete/adapter';
import { parseImportedNumber, parseSustainableConcreteCsv, parseSustainableConcreteXlsx } from '../sustainable-concrete/importers';
import type { LogisticsInput, QuantityResult } from '../types';
import { DEFAULT_LOGISTICS, DEFAULT_WALL_INPUT } from '../store/useRetainingWallStore';

function mixWith(values: Record<string, number>, overrides: Partial<ConcreteMixDesign> = {}): ConcreteMixDesign {
  const base = createDefaultConcreteMix();
  const materials: MaterialInput[] = base.materials.map((item) => {
    const value = values[item.id] ?? 0;
    return {
      ...item,
      value,
      enabled: value > 0,
      basis: 'amount',
      unit: 'kg/m³',
      rawValue: value,
      rawUnit: 'kg/m³',
      canonicalKgPerM3: value,
    };
  });
  return { ...base, ...overrides, materials };
}

function quantities(concreteVolume = 20): QuantityResult {
  return {
    concreteVolume,
    reinforcementWeight: 0,
    formworkArea: 0,
    excavationVolume: 0,
    backfillVolume: 0,
    concreteVolumePerMeter: concreteVolume / 10,
    reinforcementWeightPerMeter: 0,
    formworkAreaPerMeter: 0,
    excavationVolumePerMeter: 0,
    backfillVolumePerMeter: 0,
    wallLength: 10,
  };
}

function logistics(): LogisticsInput {
  return {
    distancePlant: 0,
    distanceDump: 0,
    distanceRebar: 0,
    distanceFormwork: 0,
    distanceCrushedStone: 0,
    dieselPrice: 0,
    dailyWorkHours: 0,
    concretePrice: 2500,
    rebarPrice: 0,
    excavationUnitCost: 0,
    backfillUnitCost: 0,
    formworkUnitCost: 0,
    rebarLaborUnitCost: 0,
    transportRatePerTonKm: 0,
    overheadPercent: 0,
    vatPercent: 0,
  };
}

function factor(value: number): EmissionFactor {
  return { value, unit: 'kgCO₂e/kg', source: 'unit test' };
}

describe('varsayılan malzeme fiyatları', () => {
  it('katalogdaki her yerleşik malzeme için sıfıra düşmeyen maliyet referansı sağlar', () => {
    for (const material of ALL_MATERIAL_DEFINITIONS) {
      const price = getDefaultMaterialPrice(material.id);
      expect(price, material.id).not.toBeNull();
      expect(price?.value, material.id).not.toBeNull();
      if (['fly_ash', 'slag', 'silica_fume', 'metakaolin', 'recycled_aggregate_unspecified', 'recycled_fine_aggregate', 'recycled_coarse_aggregate'].includes(material.id)) expect(price?.value, material.id).toBe(0);
      else expect(price?.value ?? 0, material.id).toBeGreaterThan(0);
    }
  });

  it('onaylı Excel fiyat ve emisyon benchmarklarını tek merkezden tam değerleriyle sağlar', () => {
    const approved = {
      cement: [3.3119, 0.8],
      fly_ash: [0, 0.01],
      slag: [0, 0.09],
      silica_fume: [0, 0.025],
      metakaolin: [0, 0.33],
      natural_coarse_aggregate: [0.62, 0.04],
      natural_fine_aggregate: [0.72, 0.004],
      recycled_coarse_aggregate: [0, 0.008],
      water: [0.0648, 0.0003],
      superplasticizer: [42.00, 1.88],
      reinforcement_steel: [30.76, 0.7],
      sodium_hydroxide: [73.4, 1.915],
    } as const;
    Object.entries(approved).forEach(([id, [expectedPrice, expectedEf]]) => {
      expect(getApprovedPriceBenchmark(id)?.value, `${id} fiyat`).toBe(expectedPrice);
      expect(getApprovedPriceBenchmark(id)?.unit, `${id} fiyat birimi`).toBe('TL/kg');
      expect(getApprovedPriceBenchmark(id)?.notes, `${id} KDV notu`).toContain('KDV hariç');
      expect(getApprovedEmissionBenchmark(id)?.value, `${id} EF`).toBe(expectedEf);
    });
    expect(getApprovedEmissionBenchmark('recycled_coarse_aggregate')?.uncertaintyRange).toMatchObject({ min: 0.004, max: 0.012 });
    expect(approvedRebarPriceTlPerTon()).toBe(30760);
    expect(getApprovedPriceBenchmark('reinforcement_steel')?.date).toBe('2026-09-11');
    expect(getApprovedPriceBenchmark('silica_fume')).toMatchObject({
      value: 0,
      source: 'Proje maliyet kabulü · 2026-09-13',
    });
  });

  it('hava sürükleyici katkı için kaynaklı emisyon faktörünü ve varsayılan maliyeti sağlar', () => {
    expect(getMaterialEmissionCoefficient('air_entraining')).toMatchObject({
      key: 'EF_air_entraining',
      value: 0.4393,
      year: 2021,
      reliability: 'high',
    });
    expect(getMaterialEmissionCoefficient('air_entraining')?.source).toContain('EFCA / IBU');
    expect(getDefaultMaterialPrice('air_entraining')?.value).toBe(54.2);
  });

  it('kullanıcı tanımlı malzemeleri kategori fallback fiyatıyla hesaplanabilir tutar', () => {
    expect(getDefaultMaterialPrice('custom_aggregate')?.value).toBeGreaterThan(0);
    expect(getDefaultMaterialPrice('lightweight_aggregate')?.value).toBeGreaterThan(0);
    expect(getDefaultMaterialPrice('heavyweight_aggregate')?.value).toBeGreaterThan(0);
    expect(getDefaultMaterialPrice('binder-custom-1')?.value).toBeGreaterThan(0);
    expect(getDefaultMaterialPrice('aggregate-custom-1')?.value).toBeGreaterThan(0);
    expect(getDefaultMaterialPrice('admixture-custom-1')?.value).toBeGreaterThan(0);
    expect(getDefaultMaterialPrice('fiber-custom-1')?.value).toBeGreaterThan(0);
    expect(getDefaultMaterialPrice('activator-custom-1')?.value).toBeGreaterThan(0);
  });
});

describe('StructFlow beton sınıfı başlangıç profilleri', () => {
  const amount = (mix: ConcreteMixDesign, id: string) => mix.materials.find((item) => item.id === id)?.canonicalKgPerM3;

  it('profilleri yazılım başlangıç verisi olarak açıkça etiketler; standart reçetesi iddiası taşımaz', () => {
    const profile = getStructFlowReferenceConcreteProfile('C30');
    const mix = createDefaultConcreteMix('C30');

    expect(STRUCTFLOW_REFERENCE_PROFILE_SOURCE).toBe('StructFlow reference/starter data');
    expect(STRUCTFLOW_REFERENCE_PROFILE_NOTE).toContain('standardın zorunlu beton reçetesi değildir');
    expect(profile.characteristicCylinderStrengthMpa).toBe(30);
    expect(profile.starterRecipe).toEqual({ cementKgM3: 350, waterKgM3: 175, coarseAggregateKgM3: 1050, fineAggregateKgM3: 800 });
    expect(mix.name).toBe('StructFlow C30 başlangıç reçetesi');
    expect(mix.notes).toBe(STRUCTFLOW_REFERENCE_PROFILE_NOTE);
  });

  it('her sınıf için başlangıç dozaj profillerini aktif malzeme içeriğine yansıtır', () => {
    const classes = ['C20', 'C25', 'C30', 'C35', 'C40', 'C45', 'C50'] as const;
    const cementAmounts = classes.map((concreteClass) => amount(createDefaultConcreteMix(concreteClass), 'cement'));

    expect(new Set(cementAmounts).size).toBe(classes.length);
    expect(amount(createDefaultConcreteMix('C20'), 'cement')).toBe(260);
    expect(amount(createDefaultConcreteMix('C20'), 'water')).toBe(175);
    expect(amount(createDefaultConcreteMix('C35'), 'cement')).toBe(380);
    expect(amount(createDefaultConcreteMix('C50'), 'cement')).toBe(450);
    expect(amount(createDefaultConcreteMix('C50'), 'water')).toBe(155);
  });

  it('sınıf değişiminde reçeteyi güncellerken fiyatları ve özel satırları korur', () => {
    const customMaterial: MaterialInput = {
      id: 'binder-custom-test',
      name: 'Test bağlayıcısı',
      category: 'binder',
      enabled: true,
      value: 20,
      unit: 'kg/m³',
      basis: 'amount',
      rawValue: 20,
      rawUnit: 'kg/m³',
      canonicalKgPerM3: 20,
    };
    const source = createDefaultConcreteMix();
    const next = applyConcreteClassProfile({
      ...source,
      materials: [...source.materials, customMaterial],
      prices: { cement: { value: 4, unit: 'TL/kg', currency: 'TRY' } },
      compressiveStrengthMeasurements: [{ ageDays: 28, valueMpa: 30 }],
    }, 'C35');

    expect(next.targetConcreteClass).toBe('C35');
    expect(amount(next, 'cement')).toBe(380);
    expect(amount(next, 'natural_fine_aggregate')).toBe(780);
    expect(next.materials.some((item) => item.id === customMaterial.id)).toBe(true);
    expect(next.prices?.cement?.value).toBe(4);
    expect(next.compressiveStrengthVerification).toBe('unverified');
  });

  it('active design class takes precedence over stale recipe metadata', () => {
    const scenario = runEngine({
      wallInput: { ...DEFAULT_WALL_INPUT, concreteClass: 'C40' },
      logistics: DEFAULT_LOGISTICS,
      customCoefficients: new Map(),
      concreteMix: createDefaultConcreteMix('C30'),
      scenarioName: 'Class synchronization test',
    });

    expect(scenario.concreteMix.targetConcreteClass).toBe('C40');
    expect(scenario.cost?.recipeCostPerM3).toBe(DEFAULT_LOGISTICS.concretePricesByClass?.C40);
  });

  it('elle eklenen sıfır dozajlı malzeme reçeteyi custom yapar ancak dayanım uyarısını tetiklemez', () => {
    const source = createDefaultConcreteMix('C30');
    const withMeasurement = {
      ...source,
      compressiveStrengthMeasurements: [{ ageDays: 28, valueMpa: 37 }],
      compressiveStrengthVerification: 'verified' as const,
    };
    const next = normalizeConcreteMix({
      ...withMeasurement,
      materials: [...withMeasurement.materials, {
        id: 'binder-custom-zero',
        name: 'Kullanıcı bağlayıcısı',
        category: 'binder' as const,
        enabled: true,
        value: 0,
        unit: 'kg/m³' as const,
        basis: 'amount' as const,
        rawValue: 0,
        rawUnit: 'kg/m³',
        canonicalKgPerM3: 0,
        percentage: null,
      }],
    });

    const custom = makeCustomConcreteMix(withMeasurement, next);
    expect(custom.recipeMode).toBe('custom');
    expect(custom.priceMode).toBe('readyMix');
    expect(custom.compressiveStrengthMeasurements).toEqual([]);
    expect(custom.compressiveStrengthVerification).toBe('verified');
    const warnings = calculateMixMetrics(custom).warnings;
    expect(warnings).not.toContain('Dayanım bilgisi eksik; aktif reçete için deney sonucu girilmedi.');
    expect(warnings).not.toContain('Reçete değişti; kayıtlı dayanım ölçümleri yeni bileşimi doğrulamıyor.');
  });

  it('elle değiştirilen gerçek dozajı custom reçete hesabına geçirir ve doğrulanmış dayanımı geçersiz kılar', () => {
    const source = {
      ...createDefaultConcreteMix('C30'),
      id: 'custom-lab-source',
      recipeMode: 'custom' as const,
      compressiveStrengthMeasurements: [{ ageDays: 28, valueMpa: 37 }],
      compressiveStrengthVerification: 'verified' as const,
    };
    const next = normalizeConcreteMix({
      ...source,
      materials: source.materials.map((item) => item.id === 'cement'
        ? { ...item, value: 360, rawValue: 360, canonicalKgPerM3: 360 }
        : item),
    });

    const custom = makeCustomConcreteMix(source, next);
    expect(custom.recipeMode).toBe('custom');
    expect(custom.priceMode).toBe('readyMix');
    expect(custom.compressiveStrengthVerification).toBe('unverified');
    expect(calculateMixMetrics(custom).materials.find((item) => item.id === 'cement')?.canonicalKgPerM3).toBe(360);
  });

  it('kaynağı olmayan manuel dayanım ölçümünü otomatik doğrulanmış saymaz', () => {
    const unsourced = normalizeConcreteMix({
      ...createDefaultConcreteMix('C30'),
      compressiveStrengthMeasurements: [{ ageDays: 28, valueMpa: 37 }],
      compressiveStrengthVerification: undefined,
    });
    const sourced = normalizeConcreteMix({
      ...createDefaultConcreteMix('C30'),
      compressiveStrengthMeasurements: [{ ageDays: 28, valueMpa: 37, source: 'Laboratuvar deney föyü' }],
      compressiveStrengthVerification: undefined,
    });

    expect(unsourced.compressiveStrengthVerification).toBe('unverified');
    expect(sourced.compressiveStrengthVerification).toBe('verified');
  });

  it('varsayılan reçetede dozaj girildiği anda custom hesap kullanır ve veri uyarısı göstermez', () => {
    const source = {
      ...createDefaultConcreteMix('C30'),
      // Eski/yanlış hydrate edilmiş bir ölçüm gelse bile varsayılan reçeteden
      // manuel custom reçeteye geçerken taşınmamalı.
      compressiveStrengthMeasurements: [{ ageDays: 28, valueMpa: 37 }],
      compressiveStrengthVerification: 'verified' as const,
    };
    const next = normalizeConcreteMix({
      ...source,
      materials: source.materials.map((item) => item.id === 'cement'
        ? { ...item, value: 360, rawValue: 360, canonicalKgPerM3: 360 }
        : item),
    });

    const custom = makeCustomConcreteMix(source, next);
    const metrics = calculateMixMetrics(custom);
    const cost = calculateCost({
      quantities: quantities(1),
      emissions: { machinery: { totalCost: 0 } } as never,
      logistics: logistics(),
      concreteMix: custom,
    });

    expect(custom.recipeMode).toBe('custom');
    expect(custom.priceMode).toBe('readyMix');
    expect(custom.compressiveStrengthMeasurements).toEqual([]);
    expect(metrics.materials.find((item) => item.id === 'cement')?.canonicalKgPerM3).toBe(360);
    expect(cost.concreteCostMode).toBe('readyMix');
    expect(cost.recipeCostPerM3).not.toBeNull();
    expect(metrics.warnings).not.toContain('Dayanım bilgisi eksik; aktif reçete için deney sonucu girilmedi.');
    expect(metrics.warnings).not.toContain('Reçete değişti; kayıtlı dayanım ölçümleri yeni bileşimi doğrulamıyor.');
  });

  it('genel RCA dozajını tek bir iri RCA satırına taşır ve tekrar normalizasyonda kaybetmez', () => {
    const source = createDefaultConcreteMix('C30');
    const withLegacyRca = {
      ...source,
      materials: source.materials.map((item) => item.id === 'recycled_aggregate_unspecified'
        ? {
          ...item,
          enabled: true,
          value: 354,
          rawValue: 354,
          unit: 'kg/m³' as const,
          rawUnit: 'kg/m³',
          basis: 'amount' as const,
          canonicalKgPerM3: 354,
        }
        : item),
    };

    const normalized = normalizeConcreteMix(withLegacyRca);
    const normalizedAgain = normalizeConcreteMix(normalized);
    const coarseRows = normalizedAgain.materials.filter((item) => item.id === 'recycled_coarse_aggregate');
    const legacyRows = normalizedAgain.materials.filter((item) => item.id === 'recycled_aggregate_unspecified');

    expect(coarseRows).toHaveLength(1);
    expect(coarseRows[0]?.enabled).toBe(true);
    expect(coarseRows[0]?.canonicalKgPerM3).toBe(354);
    expect(legacyRows).toHaveLength(1);
    expect(legacyRows[0]?.canonicalKgPerM3).toBe(0);
  });
});

const DATASET_HEADERS = [
  'Karışım No', 'Çimento', 'Uçucu Kül', 'Yüksek Fırın Cürufu (GGBFS)', 'Silis Dumanı', 'Metakaolin (kg)',
  'İnce Agrega (Doğal Kum)', 'İri Agrega (Kırma Taş)', 'Geri Dönüştürülmüş Agrega (RCA)', 'Hafif Agrega',
  'Ağır Agrega', 'Su', 'Süperakışkanlaştırıcı/Su Azaltıcı', 'Hava Sürükleyici Katkı',
  'Priz Hızlandırıcı/Geciktirici', 'Fiber (Çelik/PP/Cam)', 'Hava (Hedef İçerik)', 'Basınç dayanımı (MPa)',
  'Literatür çalışma', 'Link',
];

function csvRow(values: Record<number, string>): string {
  const row = Array.from({ length: DATASET_HEADERS.length }, () => '');
  Object.entries(values).forEach(([index, value]) => { row[Number(index)] = value; });
  return row.join(';');
}

function acceptanceCsv(): string {
  const rows = Array.from({ length: 89 }, () => '');
  rows[0] = DATASET_HEADERS.join(';');
  rows[1] = csvRow({ 0: 'E0', 3: '400 kg', 6: '1111.07', 7: '507.02', 11: '172', 17: '62.50 MPa', 18: 'Çalışma E0', 19: 'https://example.test/e0' });
  rows[3] = csvRow({ 0: 'E50', 2: '200', 3: '200', 6: '1111.07', 7: '507.02', 11: '172', 17: '45.78', 18: 'Çalışma E50', 19: 'https://example.test/e50' });
  rows[6] = csvRow({ 0: 'karışım1', 1: '488', 6: '866', 7: '897', 11: '170', 12: '3.39 kg', 17: '76.9', 18: 'Çalışma 1', 19: 'https://example.test/1' });
  rows[8] = csvRow({ 0: 'karışım3', 1: '406', 5: '77,4', 6: '862', 7: '891', 11: '169', 12: '3.36', 17: '81.2', 18: 'Çalışma 3', 19: 'https://example.test/3' });
  rows[12] = csvRow({ 0: 'Kontrol', 1: '500', 6: '967', 7: '694', 11: '175', 12: '8', 17: '78.3', 18: 'Çalışma kontrol', 19: 'https://example.test/control' });
  rows[15] = csvRow({ 0: '%15 SD', 1: '425', 4: '75', 6: '948', 7: '681', 11: '175', 12: '10', 17: '87.6', 18: 'Çalışma SD', 19: 'https://example.test/sd' });
  rows[87] = csvRow({ 0: 'NAC', 1: '400', 6: '660.22', 7: '1180', 11: '173', 17: '39.57', 18: 'Çalışma RAC', 19: 'https://example.test/rac' });
  rows[88] = csvRow({ 0: 'RAC', 1: '400', 6: '660.22', 7: '826', 8: '354', 11: '167', 17: '35.59', 18: 'Çalışma RAC', 19: 'https://example.test/rac' });
  return rows.join('\n');
}

describe('kanonik malzeme birimleri ve reçete metrikleri', () => {
  it('kg/m³, toplam kg, ton ve m³ girdilerini normalize eder', () => {
    expect(normalizeMaterialQuantity({ value: 400, unit: 'kg/m³', basis: 'amount' }).canonicalKgPerM3).toBe(400);
    expect(normalizeMaterialQuantity({ value: 8000, unit: 'kg', basis: 'amount' }, { projectConcreteVolumeM3: 20 }).canonicalKgPerM3).toBe(400);
    expect(normalizeMaterialQuantity({ value: 8, unit: 'ton', basis: 'amount' }, { projectConcreteVolumeM3: 20 }).canonicalKgPerM3).toBe(400);
    expect(normalizeMaterialQuantity({ value: 1, unit: 'm³', basis: 'amount', densityKgM3: 2400 }, { projectConcreteVolumeM3: 20 }).canonicalKgPerM3).toBe(120);
    expect(normalizeMaterialQuantity({ value: 1, unit: 'm³', basis: 'amount' }, { projectConcreteVolumeM3: 20 }).canonicalKgPerM3).toBeNull();
  });

  it('bağlayıcı/agrega yüzdelerini, w/b oranını ve taze kütleyi hesaplar', () => {
    const mix = mixWith({ cement: 200, fly_ash: 100, slag: 100, natural_fine_aggregate: 500, natural_coarse_aggregate: 500, water: 200 });
    const metrics = calculateMixMetrics(mix, 1);
    expect(metrics.totalBinderKgM3).toBe(400);
    expect(metrics.binderPercentages.cement).toBe(50);
    expect(metrics.binderPercentages.fly_ash).toBe(25);
    expect(metrics.aggregatePercentages.natural_fine_aggregate).toBe(50);
    expect(metrics.waterBinderRatio).toBe(0.5);
    expect(metrics.totalFreshMassKgM3).toBe(1600);
  });

  it('eyleme dönük reçete uyarıları güvenli kullanıcı tetiklemeli düzeltmeler üretir', () => {
    const ratioMix = mixWith({ cement: 400, natural_fine_aggregate: 500, natural_coarse_aggregate: 500, water: 400 });
    const ratioIssue = validateConcreteMix(ratioMix, 1).find((item) => item.code === 'water_binder_ratio_review');
    expect(ratioIssue).toMatchObject({ target: 'water', materialId: 'water', autoFix: 'clamp_water_binder' });
    const fixedRatio = autoFixConcreteMixIssue(ratioMix, ratioIssue!, 1);
    expect(calculateMixMetrics(fixedRatio, 1).waterBinderRatio).toBe(0.7);
    expect(fixedRatio.recipeMode).toBe('custom');

    const invalidAir = { ...createDefaultConcreteMix('C30'), targetAirContentPercent: 46116 };
    const airIssue = validateConcreteMix(invalidAir, 1).find((item) => item.code === 'air_target_invalid');
    expect(airIssue).toMatchObject({ target: 'air_target', autoFix: 'clear_air_target' });
    expect(autoFixConcreteMixIssue(invalidAir, airIssue!, 1).targetAirContentPercent).toBeNull();

    const invalidStrength = {
      ...createDefaultConcreteMix('C30'),
      compressiveStrengthMeasurements: [{ ageDays: 28, valueMpa: 46173, source: 'Kaynak kayıt' }],
    };
    const strengthIssue = validateConcreteMix(invalidStrength, 1).find((item) => item.code === 'strength_outlier');
    expect(strengthIssue).toMatchObject({ target: 'strength', measurementIndex: 0, autoFix: 'remove_strength_outlier' });
    expect(autoFixConcreteMixIssue(invalidStrength, strengthIssue!, 1).compressiveStrengthMeasurements).toEqual([]);
  });

  it('reçete maliyetini hesaplar ve fiyat eksikliğini sıfırla gizlemez', () => {
    const mix = mixWith(
      { cement: 400, natural_fine_aggregate: 500, natural_coarse_aggregate: 500, water: 200 },
      {
        priceMode: 'recipe',
        prices: {
          cement: { value: 2, unit: 'TL/kg', currency: 'TRY' },
          natural_fine_aggregate: { value: 0.5, unit: 'TL/kg', currency: 'TRY' },
          natural_coarse_aggregate: { value: 0.5, unit: 'TL/kg', currency: 'TRY' },
          water: { value: 0.01, unit: 'TL/kg', currency: 'TRY' },
        },
      },
    );
    const result = calculateCost({ quantities: quantities(), emissions: { machinery: { totalCost: 0 } } as never, logistics: logistics(), concreteMix: mix });
    expect(result.recipeCostPerM3).toBe(1302);
    expect(result.concreteCost).toBe(26040);
    const missingPrices = {
      ...mix.prices,
      natural_coarse_aggregate: { value: null, unit: 'TL/kg' as const, currency: 'TRY' },
    };
    const missing = calculateCost({ quantities: quantities(), emissions: { machinery: { totalCost: 0 } } as never, logistics: logistics(), concreteMix: { ...mix, prices: missingPrices } });
    expect(missing.recipeCostPerM3).toBeNull();
    expect(missing.missingPrices).toContain('natural_coarse_aggregate');
  });

  it('çözümlenemeyen etkin malzeme miktarını reçete maliyetinde eksik veri sayar; açık 0 miktarı geçerli sıfırdır', () => {
    const base = mixWith({ cement: 100 }, { priceMode: 'recipe', prices: {} });
    const unresolvedMaterial: MaterialInput = {
      id: 'binder-custom-unresolved-cost',
      name: 'Yoğunluğu eksik özel bağlayıcı',
      category: 'binder',
      enabled: true,
      value: 1,
      unit: 'm³',
      basis: 'amount',
      rawValue: 1,
      rawUnit: 'm³',
      canonicalKgPerM3: null,
      densityKgM3: null,
      price: { value: 1, unit: 'TL/kg', currency: 'TRY', source: 'unit test' },
    };
    const unresolved = normalizeConcreteMix({
      ...base,
      materials: [...base.materials, unresolvedMaterial],
    }, { projectConcreteVolumeM3: 1 });

    expect(calculateRecipeMaterialCostPerM3(unresolved, 1)).toBeNull();
    const unresolvedCost = calculateCost({
      quantities: quantities(1),
      emissions: { machinery: { totalCost: 0 } } as never,
      logistics: logistics(),
      concreteMix: unresolved,
    });
    expect(unresolvedCost.recipeCostPerM3).toBe(2500);
    expect(unresolvedCost.concreteCost).toBe(2500);
    expect(unresolvedCost.dataComplete).toBe(true);
    expect(unresolvedCost.missingAmounts).not.toContain(unresolvedMaterial.id);
    expect(unresolvedCost.missingPrices).not.toContain(unresolvedMaterial.id);
    expect(unresolvedCost.recipeMaterialCosts).toEqual([]);
    expect(unresolvedCost.warnings.some((warning) => warning.includes('Malzeme miktarı çözümlenemedi'))).toBe(false);

    const explicitZero = normalizeConcreteMix({
      ...base,
      materials: [...base.materials, { ...unresolvedMaterial, id: 'binder-custom-zero-cost', value: 0, rawValue: 0 }],
    }, { projectConcreteVolumeM3: 1 });
    expect(calculateRecipeMaterialCostPerM3(explicitZero, 1)).not.toBeNull();
    const zeroCost = calculateCost({
      quantities: quantities(1),
      emissions: { machinery: { totalCost: 0 } } as never,
      logistics: logistics(),
      concreteMix: explicitZero,
    });
    expect(zeroCost.dataComplete).toBe(true);
    expect(zeroCost.missingAmounts).not.toContain('binder-custom-zero-cost');
  });

  it('onaylı TL/kg fiyatını doğru kullanır ve KDVyi yalnız proje toplamında uygular', () => {
    const mix = mixWith({ cement: 100 }, { priceMode: 'recipe', prices: {} });
    const result = calculateCost({
      quantities: quantities(1),
      emissions: { machinery: { totalCost: 0 } } as never,
      logistics: { ...logistics(), vatPercent: 20 },
      concreteMix: mix,
    });
    expect(result.recipeCostPerM3).toBeCloseTo(331.19, 8);
    expect(result.subtotal).toBeCloseTo(331.19, 8);
    expect(result.vat).toBeCloseTo(66.238, 8);
    expect(result.totalCost).toBeCloseTo(397.428, 8);
  });

  it('aktif reçete emisyonunu proje hacmiyle ölçekler ve eksik faktörü bildirir', () => {
    const mix = mixWith({ cement: 400, natural_fine_aggregate: 500, natural_coarse_aggregate: 500, water: 200 }, {
      emissionFactors: {
        cement: factor(0.8),
        natural_fine_aggregate: factor(0.1),
        natural_coarse_aggregate: factor(0.05),
        water: factor(0.0003),
      },
    });
    const result = calculateMaterialsEmissions({ quantities: quantities(), concreteClass: 'C30', concreteMix: mix });
    expect(result.totalEmission).toBeCloseTo((400 * 0.8 + 500 * 0.1 + 500 * 0.05 + 200 * 0.0003) * 20, 8);
    expect(result.byMaterial.find((item) => item.id === 'cement')?.projectAmountKg).toBe(8000);
    const incompleteFactors = { ...(mix.emissionFactors ?? {}) };
    delete incompleteFactors.water;
    const incomplete = calculateMaterialsEmissions({ quantities: quantities(), concreteClass: 'C30', concreteMix: { ...mix, emissionFactors: incompleteFactors } });
    expect(incomplete.totalEmission).toBeNull();
    expect(incomplete.missingFactors).toContain('water');
  });

  it('çözümlenemeyen etkin malzeme miktarını emisyon hesabında eksik sayar; açık 0 miktarı geçerli sıfırdır', () => {
    const base = mixWith({ cement: 100 });
    const unresolvedMaterial: MaterialInput = {
      id: 'binder-custom-unresolved-emission',
      name: 'Yoğunluğu eksik emisyon bağlayıcısı',
      category: 'binder',
      enabled: true,
      value: 1,
      unit: 'm³',
      basis: 'amount',
      rawValue: 1,
      rawUnit: 'm³',
      canonicalKgPerM3: null,
      densityKgM3: null,
      emissionFactor: factor(0.5),
    };
    const unresolved = normalizeConcreteMix({
      ...base,
      materials: [...base.materials, unresolvedMaterial],
    }, { projectConcreteVolumeM3: 1 });
    const result = calculateMaterialsEmissions({ quantities: quantities(1), concreteClass: 'C30', concreteMix: unresolved });
    expect(result.dataComplete).toBe(false);
    expect(result.totalEmission).toBeNull();
    expect(result.missingAmounts).toContain(unresolvedMaterial.id);
    expect(result.missingFactors).not.toContain(unresolvedMaterial.id);
    expect(result.byMaterial.find((item) => item.id === unresolvedMaterial.id)).toMatchObject({
      amountKgM3: null,
      projectAmountKg: null,
      factorKgCo2ePerKg: 0.5,
      emissionKgCo2eM3: null,
      emissionKgCo2eProject: null,
    });

    const explicitZero = normalizeConcreteMix({
      ...base,
      materials: [...base.materials, { ...unresolvedMaterial, id: 'binder-custom-zero-emission', value: 0, rawValue: 0 }],
    }, { projectConcreteVolumeM3: 1 });
    const zeroResult = calculateMaterialsEmissions({ quantities: quantities(1), concreteClass: 'C30', concreteMix: explicitZero });
    expect(zeroResult.dataComplete).toBe(true);
    expect(zeroResult.missingAmounts).not.toContain('binder-custom-zero-emission');
  });

  it('açıkça girilmiş gerçek 0 emisyon faktörünü eksik veri saymadan korur', () => {
    const mix = mixWith({ cement: 100 }, { emissionFactors: { cement: factor(0) } });
    const result = calculateMaterialsEmissions({ quantities: quantities(1), concreteClass: 'C30', concreteMix: mix });
    expect(result.dataComplete).toBe(true);
    expect(result.totalEmission).toBe(0);
    expect(result.byMaterial.find((item) => item.id === 'cement')).toMatchObject({
      factorKgCo2ePerKg: 0,
      emissionKgCo2eM3: 0,
    });
  });

  it('donatı tonajını kg bazlı onaylı çelik faktörüyle hesaplar ve kaynak metadata sını taşır', () => {
    const q = { ...quantities(1), reinforcementWeight: 1 };
    const result = calculateMaterialsEmissions({ quantities: q, concreteClass: 'C30', concreteMix: mixWith({}) });
    expect(result.byMaterial.find((item) => item.id === 'reinforcement_steel')).toMatchObject({
      projectAmountKg: 1000,
      factorKgCo2ePerKg: 0.7,
      emissionKgCo2eProject: 700,
      source: 'worldsteel / Climatiq',
    });
  });
});

describe('CSV/Excel literatür veri seti parserı', () => {
  it('birim son eklerini ve decimal comma/point değerlerini okur', () => {
    expect(parseImportedNumber('488')).toBe(488);
    expect(parseImportedNumber('488 kg')).toBe(488);
    expect(parseImportedNumber('488(kg)')).toBe(488);
    expect(parseImportedNumber('1111.07(kg)')).toBe(1111.07);
    expect(parseImportedNumber('32,0 MPa')).toBe(32);
    expect(parseImportedNumber('0%')).toBe(0);
    expect(parseImportedNumber('')).toBeNull();
  });

  it('satır 2, 4, 7, 9, 13, 16, 88 ve 89 kayıtlarını kaynak satırıyla korur', () => {
    const imported = parseSustainableConcreteCsv(acceptanceCsv(), 'acceptance.csv');
    const byNo = (mixNo: string) => imported.mixes.find((mix) => mix.mixNo === mixNo);
    const e0 = byNo('E0');
    const e50 = byNo('E50');
    const mix1 = byNo('karışım1');
    const mix3 = byNo('karışım3');
    const control = byNo('Kontrol');
    const sd = byNo('%15 SD');
    const nac = byNo('NAC');
    const rac = byNo('RAC');
    expect(e0?.sourceRow).toBe(2);
    expect(e0?.ggbfsKgM3).toBe(400);
    expect(e0?.compressiveStrengthMeasurements?.[0]).toMatchObject({ ageDays: null, valueMpa: 62.5, sourceRow: 2 });
    expect(e50?.sourceRow).toBe(4);
    expect(e50?.flyAshKgM3).toBe(200);
    expect(e50?.ggbfsKgM3).toBe(200);
    expect(mix1?.sourceRow).toBe(7);
    expect(mix1?.cementKgM3).toBe(488);
    expect(mix1?.superplasticizerKgM3).toBe(3.39);
    expect(mix1?.rawInputs?.superplasticizerKgM3).toEqual({ rawValue: '3.39 kg', rawUnit: 'kg' });
    expect(mix3?.sourceRow).toBe(9);
    expect(mix3?.metakaolinKgM3).toBe(77.4);
    expect(control?.sourceRow).toBe(13);
    expect(control?.cementKgM3).toBe(500);
    expect(sd?.sourceRow).toBe(16);
    expect(sd?.silicaFumeKgM3).toBe(75);
    expect(nac?.sourceRow).toBe(88);
    expect(rac?.sourceRow).toBe(89);
    expect(rac?.recycledAggregateUnspecifiedKgM3).toBe(354);
    expect(rac?.recycledCoarseAggregateKgM3).toBeNull();
    expect(rac?.compressiveStrengthMeasurements?.[0].ageDays).toBeNull();
    expect(imported.issues.some((issue) => issue.row === 2 && issue.message.includes('aktivatör'))).toBe(true);
    expect(imported.issues.some((issue) => issue.row === 4 && issue.message.includes('aktivatör'))).toBe(true);
  });

  it('kaynaklı varsayılan profil ile sekiz kabul satırının CO₂ durumunu doğru üretir', () => {
    const imported = parseSustainableConcreteCsv(acceptanceCsv(), 'acceptance.csv');
    const byNo = (mixNo: string) => imported.mixes.find((mix) => mix.mixNo === mixNo);
    const evaluate = (mixNo: string) => {
      const source = byNo(mixNo);
      expect(source).toBeDefined();
      return calculateMaterialsEmissions({
        quantities: quantities(1),
        concreteClass: 'C30',
        concreteMix: sustainableMixToConcreteMix(source as NonNullable<typeof source>, undefined, 'C30'),
      });
    };

    const e0 = evaluate('E0');
    const e50 = evaluate('E50');
    expect(e0.dataComplete).toBe(false);
    expect(e0.missingAmounts).toContain('alkali_activator');
    expect(e0.knownSubtotal).toBeCloseTo(60.77668, 6);
    expect(e50.dataComplete).toBe(false);
    expect(e50.missingAmounts).toContain('alkali_activator');
    expect(e50.knownSubtotal).toBeCloseTo(44.77668, 6);

    const expectedComplete: Record<string, number> = {
      'karışım1': 436.1682,
      'karışım3': 395.7975,
      Kontrol: 446.7205,
      '%15 SD': 391.7595,
      NAC: 369.89278,
      RAC: 358.56298,
    };
    Object.entries(expectedComplete).forEach(([mixNo, expectedKgCo2eM3]) => {
      const result = evaluate(mixNo);
      expect(result.dataComplete, mixNo).toBe(true);
      expect(result.missingFactors, mixNo).toEqual([]);
      expect(result.totalEmission, mixNo).toBeCloseTo(expectedKgCo2eM3, 6);
      expect(result.byMaterial.filter((item) => (item.amountKgM3 ?? 0) > 0).every((item) => item.factorKgCo2ePerKg != null && item.source)).toBe(true);
    });
  });

  it('RCA toplam payını ve doğal iri agrega karşılaştırmalı ikame oranını ayırır', () => {
    const imported = parseSustainableConcreteCsv(acceptanceCsv(), 'acceptance.csv');
    const rac = imported.mixes.find((mix) => mix.mixNo === 'RAC');
    expect(rac).toBeDefined();
    const active = sustainableMixToConcreteMix(rac as NonNullable<typeof rac>, undefined, 'C40');
    expect(active.targetConcreteClass).toBe('C40');
    const metrics = calculateMixMetrics(active, 1);
    expect(metrics.totalAggregateKgM3).toBeCloseTo(1840.22, 8);
    expect(metrics.totalRecycledAggregateKgM3).toBe(354);
    expect(metrics.totalRecycledAggregatePercent).toBeCloseTo(354 / 1840.22 * 100, 2);
    expect(metrics.recycledCoarseReplacementPercent).toBeCloseTo(30, 8);
    expect(metrics.recycledFineReplacementPercent).toBeNull();
    expect(metrics.waterBinderRatio).toBeCloseTo(0.4175, 8);
    expect(metrics.totalFreshMassKgM3).toBeCloseTo(2407.22, 8);
  });

  it('tamamen aynı satırı duplicate olarak bildirir', () => {
    const row = csvRow({ 0: 'D', 1: '400', 6: '800', 7: '900', 11: '170', 17: '40' });
    const imported = parseSustainableConcreteCsv(`${DATASET_HEADERS.join(';')}\n${row}\n${row}`, 'duplicate.csv');
    expect(imported.duplicateRows).toEqual([3]);
    expect(imported.issues.some((issue) => issue.row === 3 && issue.message.includes('duplicate'))).toBe(true);
  });

  it('yaş sütununu ölçüm yaşına taşır ve adapter ölçümü çoğaltmaz', () => {
    const headers = ['Karışım No', 'Çimento', 'Su', '28 gün', 'Literatür çalışma'];
    const imported = parseSustainableConcreteCsv(`${headers.join(';')}\nAge-28;400;170;45.2;Çalışma`, 'age.csv');
    const source = imported.mixes[0];
    expect(source?.compressiveStrengthMeasurements).toEqual([
      expect.objectContaining({ ageDays: 28, valueMpa: 45.2, sourceRow: 2 }),
    ]);
    const active = sustainableMixToConcreteMix(source as NonNullable<typeof source>, undefined, 'C40');
    expect(active.targetConcreteClass).toBe('C40');
    expect(active.compressiveStrengthMeasurements).toHaveLength(1);
    expect(active.compressiveStrengthMeasurements[0]?.ageDays).toBe(28);
  });

  it('hava sürükleyici dozajını kaynaklı faktörle eksiksiz CO₂ hesabına dahil eder', () => {
    const row = csvRow({
      0: 'AIR-1', 1: '400', 6: '800', 7: '900', 11: '180', 13: '0.2', 16: '5.5', 17: '40',
      18: 'Hava katkısı çalışması', 19: 'https://example.test/air',
    });
    const imported = parseSustainableConcreteCsv(`${DATASET_HEADERS.join(';')}\n${row}`, 'air.csv');
    const source = imported.mixes[0];
    expect(source).toMatchObject({ airEntrainingKgM3: 0.2, airTargetContentPercent: 5.5 });
    const active = sustainableMixToConcreteMix(source, undefined, 'C30');
    expect(active.targetAirContentPercent).toBe(5.5);
    expect(active.emissionFactors?.air_entraining).toMatchObject({ value: 0.4393, year: 2021 });
    const result = calculateMaterialsEmissions({ quantities: quantities(1), concreteClass: 'C30', concreteMix: active });
    expect(result.dataComplete).toBe(true);
    expect(result.missingFactors).not.toContain('air_entraining');
    expect(result.byMaterial.find((item) => item.id === 'air_entraining')).toMatchObject({
      amountKgM3: 0.2,
      factorKgCo2ePerKg: 0.4393,
    });
    expect(result.byMaterial.find((item) => item.id === 'air_entraining')?.emissionKgCo2eM3).toBeCloseTo(0.08786, 8);
  });

  it('Excel tarih seri numarasına benzeyen hava hedefi ve dayanımı aktif girdiden karantinaya alır', () => {
    const row = csvRow({
      0: 'SERIAL-1', 1: '400', 6: '800', 7: '900', 11: '180', 16: '46116', 17: '46173',
      18: 'Bozuk hücre biçimi', 19: 'https://example.test/serial',
    });
    const imported = parseSustainableConcreteCsv(`${DATASET_HEADERS.join(';')}\n${row}`, 'serial.csv');
    const source = imported.mixes[0];
    expect(source.airTargetContentPercent).toBeNull();
    expect(source.compressiveStrengthMeasurements ?? []).toHaveLength(0);
    expect(source.rawValues?.['Hava (Hedef İçerik)']).toBe('46116');
    expect(source.rawValues?.['Basınç dayanımı (MPa)']).toBe('46173');
    expect(imported.issues.filter((issue) => issue.row === 2 && issue.message.includes('Excel tarih/seri numarasına benziyor'))).toHaveLength(2);
  });

  it('namespace-prefiksli geçerli OOXML dosyasını ExcelJS başarısız olsa da fallback ile okur', async () => {
    const workbookXml = '<?xml version="1.0" encoding="utf-8"?><x:workbook xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:sheets><x:sheet name="Sayfa1" sheetId="1" r:id="R1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" /></x:sheets></x:workbook>';
    const relsXml = '<?xml version="1.0" encoding="utf-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="/xl/worksheets/sheet1.xml" Id="R1" /><Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="/xl/sharedStrings.xml" Id="R2" /></Relationships>';
    const sharedStringsXml = '<?xml version="1.0" encoding="utf-8"?><x:sst xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:si><x:t>Karışım No</x:t></x:si><x:si><x:t>Çimento</x:t></x:si><x:si><x:t>Su</x:t></x:si><x:si><x:t>Basınç dayanımı (MPa)</x:t></x:si><x:si><x:t>Test-1</x:t></x:si></x:sst>';
    const sheetXml = '<?xml version="1.0" encoding="utf-8"?><x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:sheetData><x:row r="1"><x:c r="A1" t="s"><x:v>0</x:v></x:c><x:c r="B1" t="s"><x:v>1</x:v></x:c><x:c r="C1" t="s"><x:v>2</x:v></x:c><x:c r="D1" t="s"><x:v>3</x:v></x:c></x:row><x:row r="2"><x:c r="A2" t="s"><x:v>4</x:v></x:c><x:c r="B2"><x:v>400</x:v></x:c><x:c r="C2"><x:v>180</x:v></x:c><x:c r="D2"><x:v>42.5</x:v></x:c></x:row></x:sheetData></x:worksheet>';
    const zip = zipSync({
      'xl/workbook.xml': strToU8(workbookXml),
      'xl/_rels/workbook.xml.rels': strToU8(relsXml),
      'xl/sharedStrings.xml': strToU8(sharedStringsXml),
      'xl/worksheets/sheet1.xml': strToU8(sheetXml),
    });
    const arrayBuffer = zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer;
    const imported = await parseSustainableConcreteXlsx(arrayBuffer, 'prefixed.xlsx');
    expect(imported.mixes).toHaveLength(1);
    expect(imported.mixes[0]).toMatchObject({ mixNo: 'Test-1', cementKgM3: 400, waterKgM3: 180 });
    expect(imported.mixes[0]?.compressiveStrengthMeasurements?.[0]).toMatchObject({ valueMpa: 42.5, sourceRow: 2 });
  });
});

describe('eski reçete migration', () => {
  it('legacy binders/aggregates/water alanlarını canonical materials modeline taşır', () => {
    const legacy = {
      ...createDefaultConcreteMix(),
      schemaVersion: 1 as const,
      materials: [],
      binders: [{ type: 'cement' as const, enabled: true, percentage: 100, amountKgM3: 400, description: '' }],
      aggregates: [{ type: 'natural_fine_aggregate' as const, enabled: true, percentage: 45, amountKgM3: 800, waterAbsorption: 0, specificGravity: 2.6, grading: '' }, { type: 'natural_coarse_aggregate' as const, enabled: true, percentage: 55, amountKgM3: 1000, waterAbsorption: 0, specificGravity: 2.6, grading: '' }],
      water: { amountKgM3: 180, waterBinderRatio: 0.45, ratioMode: 'automatic' as const },
    };
    const migrated = normalizeConcreteMix(legacy, { projectConcreteVolumeM3: 1 });
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.materials.find((item) => item.id === 'cement')?.canonicalKgPerM3).toBe(400);
    expect(migrated.materials.find((item) => item.id === 'water')?.canonicalKgPerM3).toBe(180);
  });
});

describe('ana istinat motoru reçete bağlantısı', () => {
  it('GGBFS optimizasyonunda aktif reçete emisyonunu dozaj × onaylı EF toplamı ile hesaplar', () => {
    const comparison = evaluateOptimizationScenario('ggbfs-strength-carbon', createDefaultConcreteMix(), 20, new Map());
    expect(comparison.referenceCarbon.kgCo2eM3).toBeCloseTo(341.7049, 6);
    expect(comparison.candidateCarbon.kgCo2eM3).toBeCloseTo(230.1464, 6);
    expect(comparison.carbonSavingKgM3).toBeCloseTo(111.5585, 6);
    expect(comparison.carbonSavingPercent).toBeGreaterThan(0);

    const reference = runEngine({
      wallInput: DEFAULT_WALL_INPUT,
      logistics: DEFAULT_LOGISTICS,
      customCoefficients: new Map(),
      concreteMix: comparison.referenceMix,
      scenarioName: 'Referans CO₂ testi',
    });
    const candidate = runEngine({
      wallInput: DEFAULT_WALL_INPUT,
      logistics: DEFAULT_LOGISTICS,
      customCoefficients: new Map(),
      concreteMix: comparison.candidateMix,
      scenarioName: 'Katkılı CO₂ testi',
    });
    const recipeProjectEmission = (scenario: typeof reference) => scenario.emissions?.materials.byMaterial
      .filter((item) => item.id !== 'reinforcement_steel')
      .reduce((sum, item) => sum + (item.emissionKgCo2eProject ?? 0), 0) ?? null;
    expect(recipeProjectEmission(candidate)).toBeLessThan(recipeProjectEmission(reference) as number);
  });

  it('seçili materials[] reçetesini runEngine ve sağ panel senaryosuna taşır', () => {
    const activeMix = mixWith({ cement: 400, natural_fine_aggregate: 660.22, natural_coarse_aggregate: 826, recycled_aggregate_unspecified: 354, water: 167 });
    const scenario = runEngine({
      wallInput: DEFAULT_WALL_INPUT,
      logistics: DEFAULT_LOGISTICS,
      customCoefficients: new Map(),
      concreteMix: activeMix,
      scenarioName: 'Aktif reçete test senaryosu',
    });
    expect(scenario.concreteMix.materials.find((item) => item.id === 'cement')?.canonicalKgPerM3).toBe(400);
    expect(scenario.mixMetrics.totalRecycledAggregateKgM3).toBe(354);
    expect(scenario.quantities?.concreteVolume).toBeGreaterThan(0);
    expect(scenario.emissions?.materials.byMaterial.some((item) => ['recycled_aggregate_unspecified', 'recycled_coarse_aggregate'].includes(item.id))).toBe(true);
  });
});
