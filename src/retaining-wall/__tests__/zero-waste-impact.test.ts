import { describe, expect, it } from 'vitest';
import { runEngine } from '../engine';
import { createCatalogConcreteMix, OPTIMIZATION_SCENARIOS } from '../material-selection/optimization';
import { createDefaultConcreteMix, makeCustomConcreteMix, normalizeConcreteMix } from '../material-selection/mixModel';
import { calculateZeroWasteImpact } from '../material-selection/zeroWasteImpact';
import { DEFAULT_LOGISTICS, DEFAULT_WALL_INPUT } from '../store/useRetainingWallStore';

function scenarioWithMix(mix: ReturnType<typeof createDefaultConcreteMix>) {
  return runEngine({
    wallInput: DEFAULT_WALL_INPUT,
    logistics: DEFAULT_LOGISTICS,
    customCoefficients: new Map(),
    concreteMix: mix,
  });
}

describe('Sıfır Atık etki hesaplaması', () => {
  it('aktif ve referans reçeteyi gerçek proje hacmine ölçekler', () => {
    const optimizationScenario = OPTIMIZATION_SCENARIOS[0];
    const template = createDefaultConcreteMix('C30');
    const activeMix = createCatalogConcreteMix(optimizationScenario.candidateMixId, {
      ...template,
      referenceMixId: optimizationScenario.referenceMixId,
    });
    const impact = calculateZeroWasteImpact(scenarioWithMix(activeMix));

    expect(impact.referenceAvailable).toBe(true);
    expect(impact.reference.recoveredMaterialKgM3).toBe(0);
    expect(impact.active.recoveredMaterialKgM3).toBe(200);
    expect(impact.savings.recoveredMaterialTon).toBeCloseTo(200 * (impact.concreteVolumeM3 ?? 0) / 1000, 8);
    expect(impact.savings.cementTon).toBeGreaterThan(0);
    expect(impact.recoveredBreakdown).toEqual([
      expect.objectContaining({ id: 'slag', circularityOrigin: 'industrial_byproduct', kgM3: 200 }),
    ]);
    expect(impact.strength.status).toBe('preserved');
  });

  it('referans seçilmeden karşılaştırmalı sonuç üretmez ama aktif sonucu korur', () => {
    const impact = calculateZeroWasteImpact(scenarioWithMix(createDefaultConcreteMix('C30')));

    expect(impact.referenceAvailable).toBe(false);
    expect(impact.reference.cementKgM3).toBeNull();
    expect(impact.active.cementKgM3).toBe(350);
    expect(impact.savings.cementTon).toBeNull();
    expect(impact.warnings).toContain('Aktif reçete hesaplandı; karşılaştırmalı Sıfır Atık kazancı için referans reçete seçilmedi.');
  });

  it('custom reçeteyi Sıfır Atık hesabında aktif reçete olarak korur', () => {
    const base = createDefaultConcreteMix('C30');
    const custom = normalizeConcreteMix({
      ...base,
      id: 'custom-test',
      name: 'Özel beton reçetesi',
      recipeMode: 'custom',
      priceMode: 'recipe',
      materials: base.materials.map((item) => item.id === 'fly_ash'
        ? { ...item, enabled: true, value: 80, rawValue: 80, canonicalKgPerM3: 80 }
        : item),
    });
    const impact = calculateZeroWasteImpact(scenarioWithMix(custom));

    expect(impact.activeRecipeMode).toBe('custom');
    expect(impact.activeMixName).toBe('Özel beton reçetesi');
    expect(impact.active.recoveredMaterialKgM3).toBe(80);
    expect(impact.referenceAvailable).toBe(false);
  });

  it('alternatif daha fazla çimento kullandığında bunu negatif kazanç olarak verir', () => {
    const optimizationScenario = OPTIMIZATION_SCENARIOS[0];
    const base = createDefaultConcreteMix('C30');
    const activeMix = normalizeConcreteMix({
      ...base,
      referenceMixId: optimizationScenario.referenceMixId,
      materials: base.materials.map((item) => item.id === 'cement'
        ? { ...item, enabled: true, value: 500, rawValue: 500, canonicalKgPerM3: 500 }
        : item),
      compressiveStrengthMeasurements: [{ ageDays: 28, valueMpa: 50 }],
      compressiveStrengthVerification: 'verified',
    });
    const impact = calculateZeroWasteImpact(scenarioWithMix(activeMix));

    expect(impact.savings.cementTon).toBeLessThan(0);
    expect(impact.savings.carbonPercent).toBeLessThan(0);
  });

  it('metakaolini otomatik olarak geri kazanılmış atık saymaz', () => {
    const base = createDefaultConcreteMix('C30');
    const activeMix = normalizeConcreteMix({
      ...base,
      materials: base.materials.map((item) => item.id === 'metakaolin'
        ? { ...item, enabled: true, value: 80, rawValue: 80, canonicalKgPerM3: 80 }
        : item),
    });
    const impact = calculateZeroWasteImpact(scenarioWithMix(activeMix));

    expect(impact.recoveredBreakdown).toHaveLength(0);
    expect(impact.active.recoveredMaterialKgM3).toBe(0);
    expect(impact.active.circularAlternativeMaterialKgM3).toBe(80);
  });

  it('suyu virgin olarak sınıflandırır ve bilinmeyen kaynak uyarısı üretmez', () => {
    const impact = calculateZeroWasteImpact(scenarioWithMix(createDefaultConcreteMix('C30')));

    expect(impact.warnings.some((warning) => warning.includes('Su'))).toBe(false);
  });

  it('custom reçetedeki uçucu külü onaylı gerçek faktörüyle hesaba dahil eder ve görünür kılar', () => {
    const base = createDefaultConcreteMix('C30');
    const edited = normalizeConcreteMix({
      ...base,
      materials: base.materials.map((item) => item.id === 'fly_ash'
        ? { ...item, enabled: true, value: 80, rawValue: 80, canonicalKgPerM3: 80 }
        : item),
    });
    const custom = makeCustomConcreteMix(base, edited);
    const impact = calculateZeroWasteImpact(scenarioWithMix(custom));
    const flyAsh = impact.activeMaterialImpacts.find((item) => item.id === 'fly_ash');

    expect(impact.activeRecipeMode).toBe('custom');
    expect(flyAsh).toMatchObject({
      recipeAmountKgM3: 80,
      factorKgCo2ePerKg: 0.01,
      emissionKgCo2eM3: 0.8,
    });
    expect(impact.active.recipeCarbonKgM3).not.toBeNull();
    expect(impact.warnings.some((warning) => warning.includes('0 kgCO₂e/kg'))).toBe(false);
  });

  it('stale default recipeMode taşıyan custom kimliğini normalize eder', () => {
    const base = createDefaultConcreteMix('C30');
    const repaired = normalizeConcreteMix({ ...base, id: 'custom-legacy-test', recipeMode: 'default' });
    expect(repaired.recipeMode).toBe('custom');
  });
});
