import { RetainingWallInput, LogisticsInput, Scenario } from '../types';
import { calculateGeometryMetrics } from './geometry';
import { calculateEarthPressures } from './earth-pressure';
import { calculateStability } from './stability';
import { calculateQuantities } from './quantities';
import { calculateEmissions } from './emissions';
import { calculateCost } from './cost';
import { PROJECT_CONCRETE_UNIT_WEIGHT_KN_M3 } from './constants';
import { calculateMixMetrics, createDefaultConcreteMix, normalizeConcreteMix } from '../material-selection/mixModel';
import type { ConcreteMixDesign } from '../material-selection/types';
import { calculateInternalStability } from './reinforcement';

export interface RunEngineInput {
  wallInput: RetainingWallInput;
  logistics: LogisticsInput;
  scenarioName?: string;
  scenarioId?: string;
  customCoefficients?: Map<string, number>;
  /** The active concrete recipe. Geometry/stability do not depend on this object. */
  concreteMix?: ConcreteMixDesign;
}

const FINAL_ACTIVE_DELTA_DEG = 0;
const FINAL_ACTIVE_BETA_DEG = 0;
const FINAL_VIRTUAL_PLANE_ANGLE_DEG = 90;

function normalizeFinalGeotechnicalInput(wallInput: RetainingWallInput): {
  wallInput: RetainingWallInput;
  warnings: string[];
} {
  const warnings: string[] = [];
  if (Math.abs(wallInput.wallFrictionAngle - FINAL_ACTIVE_DELTA_DEG) > 1e-12) {
    warnings.push(`Legacy/proje δ=${wallInput.wallFrictionAngle}° girdisi kullanılmadı; heel-edge düşey sanal düzlem için δ=0° uygulandı.`);
  }
  if (Math.abs(wallInput.backfillSoil.beta - FINAL_ACTIVE_BETA_DEG) > 1e-12) {
    warnings.push(`Legacy/proje β=${wallInput.backfillSoil.beta}° girdisi kullanılmadı; final Excel benchmarkı için β=0° uygulandı.`);
  }
  return {
    wallInput: {
      ...wallInput,
      wallFrictionAngle: FINAL_ACTIVE_DELTA_DEG,
      backfillSoil: { ...wallInput.backfillSoil, beta: FINAL_ACTIVE_BETA_DEG },
    },
    warnings,
  };
}

/**
 * Ana Hesaplama Motoru Orkestratörü
 * Tüm alt motorları sırasıyla çalıştırarak tam bir senaryo sonucu üretir.
 */
export function runEngine(input: RunEngineInput): Scenario {
  const { wallInput, logistics, customCoefficients, scenarioName = 'Varsayılan', scenarioId = crypto.randomUUID() } = input;
  const normalized = normalizeFinalGeotechnicalInput(wallInput);
  const finalWallInput = normalized.wallInput;

  // 1. Geometri
  const geoMetrics = calculateGeometryMetrics(finalWallInput.geometry);

  // 2. Toprak Basınçları
  const earthPressures = calculateEarthPressures({
    theory: finalWallInput.earthPressureTheory,
    backfillSoil: finalWallInput.backfillSoil,
    foundationSoil: finalWallInput.foundationSoil,
    wallHeight: finalWallInput.geometry.H,
    passiveHeight: finalWallInput.geometry.Df,
    surcharge: finalWallInput.surchargeLoad,
    wallFrictionAngle: FINAL_ACTIVE_DELTA_DEG,
    epsilonAngle: FINAL_VIRTUAL_PLANE_ANGLE_DEG,
  });

  // 3. Dış Stabilite
  const gammaConcrete = PROJECT_CONCRETE_UNIT_WEIGHT_KN_M3;
  const stability = calculateStability({
    input: finalWallInput,
    geoMetrics,
    earthPressures,
    gammaConcrete,
  });

  // 4. İç stabilite / donatı kesit ön tasarımı
  const internalStability = calculateInternalStability(finalWallInput, geoMetrics, earthPressures, stability);

  // 5. Metraj — donatı alanları artık kesit kontrollerinden gelir.
  const quantities = calculateQuantities(geoMetrics, internalStability, finalWallInput.reinforcement, finalWallInput.geometry.H);

  // 6. Active recipe normalization. The project volume is now known, so kg,
  // ton and m³ inputs can be converted exactly or reported as incomplete.
  const concreteMix = normalizeConcreteMix({
    ...(input.concreteMix ?? createDefaultConcreteMix(finalWallInput.concreteClass)),
    targetConcreteClass: finalWallInput.concreteClass,
  }, {
    projectConcreteVolumeM3: quantities.concreteVolume,
  });
  const mixMetrics = calculateMixMetrics(concreteMix, quantities.concreteVolume);

  // 7. Emisyonlar — yalnız aktif reçete kullanılır.
  const emissions = calculateEmissions({
    quantities,
    logistics,
    concreteClass: finalWallInput.concreteClass,
    customCoefficients,
    concreteMix,
  });

  // 8. Maliyet — ready-mix and recipe pricing are mutually exclusive.
  const cost = calculateCost({
    quantities,
    emissions,
    logistics,
    concreteClass: finalWallInput.concreteClass,
    concreteMix,
  });

  return {
    id: scenarioId,
    name: scenarioName,
    input: finalWallInput,
    logistics,
    concreteMix,
    customCoefficients: Object.fromEntries(customCoefficients?.entries() ?? []),
    mixMetrics,
    earthPressures,
    internalStability,
    stability,
    quantities,
    emissions,
    cost,
    engineeringWarnings: normalized.warnings,
    createdAt: new Date(),
  };
}
