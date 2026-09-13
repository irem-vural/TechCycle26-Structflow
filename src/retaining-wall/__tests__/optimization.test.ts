import { describe, expect, it } from 'vitest';
import { calculateMixMetrics, createDefaultConcreteMix, evaluateMixBalance, normalizeConcreteMix } from '../material-selection/mixModel';
import {
  createCatalogConcreteMix,
  evaluateActiveAgainstReference,
  evaluateOptimizationScenario,
  evaluateSelectedConcreteAgainstCandidate,
  findExactOptimizationCatalogMatch,
  OPTIMIZATION_SCENARIOS,
} from '../material-selection/optimization';

describe('karbon-dayanım optimizasyon karar desteği', () => {
  const template = createDefaultConcreteMix();

  it.each([
    ['ggbfs-strength-carbon', 11.9, 341.7049, 230.1464, 'recommended'],
    ['metakaolin-strength-carbon', 7.5, 436.1682, 323.1356, 'recommended'],
    ['silica-fume-strength-carbon', 9.3, 446.7205, 391.7595, 'recommended'],
    ['hybrid-scm-strength-carbon', 8, 413.9878, 345.1258, 'recommended'],
    ['rca-circularity-tradeoff', -3.98, 369.89278, 358.56298, 'tradeoff'],
  ] as const)('%s senaryosunda reçete CO₂ hesabını gerçek dozaj ve faktörlerle yapar', (id, strengthDelta, referenceCarbon, candidateCarbon, status) => {
    const result = evaluateOptimizationScenario(id, template, 20);
    expect(result.referenceCarbon.kgCo2eM3).toBeCloseTo(referenceCarbon, 6);
    expect(result.candidateCarbon.kgCo2eM3).toBeCloseTo(candidateCarbon, 6);
    expect(result.carbonSavingKgM3).toBeCloseTo(referenceCarbon - candidateCarbon, 6);
    expect(result.projectCarbonSavingKg).toBeCloseTo((referenceCarbon - candidateCarbon) * 20, 6);
    expect(result.measuredStrengthDeltaMpa).toBeCloseTo(strengthDelta, 6);
    expect(result.status).toBe(status);
  });

  it('önerilen reçeteyi aktif karışıma taşırken yapısal sınıfı ve faktörleri korur', () => {
    const scenario = OPTIMIZATION_SCENARIOS[0];
    const withOverrides = {
      ...template,
      targetConcreteClass: 'C35' as const,
      emissionFactors: {
        cement: { value: 0.75, unit: 'kgCO₂e/kg' as const, source: 'project EPD' },
      },
    };
    const applied = createCatalogConcreteMix(scenario.candidateMixId, {
      ...withOverrides,
      referenceMixId: scenario.referenceMixId,
    });
    expect(applied.targetConcreteClass).toBe('C35');
    expect(applied.emissionFactors?.cement?.value).toBe(0.75);
    expect(applied.referenceMixId).toBe(scenario.referenceMixId);
    expect(applied.compressiveStrengthMeasurements).toEqual([
      expect.objectContaining({ ageDays: 28, valueMpa: 58.8, sourceRow: 111 }),
    ]);
    expect(calculateMixMetrics(applied, 20).warnings).not.toContain('Deney yaşı belirtilmemiş; ölçüm 28 gün varsayılmadı.');
    expect(findExactOptimizationCatalogMatch(applied)?.id).toBe(scenario.candidateMixId);
  });

  it('tüm katkı senaryolarında seçili C30 yapısal hedefini değiştirmez', () => {
    for (const scenario of OPTIMIZATION_SCENARIOS) {
      const applied = createCatalogConcreteMix(scenario.candidateMixId, {
        ...template,
        targetConcreteClass: 'C30',
        referenceMixId: scenario.referenceMixId,
      });

      expect(applied.targetConcreteClass).toBe('C30');
      expect(applied.name).toContain('C30 hedef');
    }
  });

  it('karşılaştırma referansı olarak güncel seçili beton reçetesini kullanır', () => {
    const selected = createDefaultConcreteMix('C30');
    const result = evaluateSelectedConcreteAgainstCandidate(selected, 'ggbfs-strength-carbon', 20);

    expect(result.referenceMix.name).toBe(selected.name);
    expect(result.referenceCementKgM3).toBeCloseTo(selected.materials.find((item) => item.id === 'cement')?.canonicalKgPerM3 ?? 0, 6);
    expect(result.referenceDefinition).toBeNull();
    expect(result.candidateDefinition.id).toBe('dataset-c50-ggbfs-row-111');
    expect(result.candidateCementKgM3).toBeCloseTo(200, 6);
    expect(result.measuredStrengthDeltaMpa).toBeNull();
    expect(result.status).toBe('unverified');
  });

  it('standart sınıf profillerinde makul ön dozaj dengesini korur', () => {
    for (const concreteClass of ['C20', 'C25', 'C30', 'C35', 'C40', 'C45', 'C50'] as const) {
      const balance = evaluateMixBalance(calculateMixMetrics(createDefaultConcreteMix(concreteClass)));

      expect(balance.status).toBe('balanced');
      expect(balance.totalMassKgM3).toBeGreaterThanOrEqual(2150);
      expect(balance.totalMassKgM3).toBeLessThanOrEqual(2550);
      expect(balance.waterBinderRatio).toBeGreaterThanOrEqual(0.30);
      expect(balance.waterBinderRatio).toBeLessThanOrEqual(0.70);
      expect(balance.fineAggregateSharePercent).toBeGreaterThanOrEqual(30);
      expect(balance.fineAggregateSharePercent).toBeLessThanOrEqual(60);
    }

    const outlier = normalizeConcreteMix({
      ...template,
      materials: template.materials.map((item) => item.id === 'water'
        ? { ...item, value: 800, rawValue: 800, canonicalKgPerM3: 800 }
        : item),
    });
    expect(evaluateMixBalance(calculateMixMetrics(outlier)).status).toBe('review');
  });

  it('reçete değiştirildiğinde yeni dayanım tahmini üretmez', () => {
    const scenario = OPTIMIZATION_SCENARIOS[1];
    const applied = createCatalogConcreteMix(scenario.candidateMixId, {
      ...template,
      referenceMixId: scenario.referenceMixId,
    });
    const edited = normalizeConcreteMix({
      ...applied,
      materials: applied.materials.map((item) => item.id === 'cement'
        ? { ...item, value: 319, rawValue: 319, canonicalKgPerM3: 319 }
        : item),
      compressiveStrengthMeasurements: [],
    }, { projectConcreteVolumeM3: 20 });
    const result = evaluateActiveAgainstReference(edited, scenario, 20);
    expect(result.exactDatasetMatch).toBe(false);
    expect(result.measuredStrengthMpa).toBeNull();
    expect(result.measuredStrengthDeltaMpa).toBeNull();
    expect(result.status).toBe('unverified');
  });

  it('toplam kg girdisini proje hacmine göre karşılaştırır', () => {
    const scenario = OPTIMIZATION_SCENARIOS[2];
    const active = createCatalogConcreteMix(scenario.candidateMixId, {
      ...template,
      referenceMixId: scenario.referenceMixId,
    });
    const volume = 20;
    const totalKgInput = normalizeConcreteMix({
      ...active,
      materials: active.materials.map((item) => ({
        ...item,
        value: (item.canonicalKgPerM3 ?? 0) * volume,
        rawValue: (item.canonicalKgPerM3 ?? 0) * volume,
        unit: 'kg' as const,
        rawUnit: 'kg',
        canonicalKgPerM3: item.canonicalKgPerM3,
      })),
    }, { projectConcreteVolumeM3: volume });
    const result = evaluateActiveAgainstReference(totalKgInput, scenario, volume);
    expect(result.exactDatasetMatch).toBe(true);
    expect(result.carbonSavingKgM3).toBeCloseTo(54.961, 6);
    expect(result.measuredStrengthMpa).toBe(87.6);
  });
});
