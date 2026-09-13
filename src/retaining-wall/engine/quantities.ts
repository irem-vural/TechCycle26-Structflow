import { GeometryMetrics } from './geometry';
import { QuantityResult, InternalStabilityResult, ReinforcementSettings } from '../types';

/**
 * İç stabilite hesabı kullanılamadığında gösterilen geçici uygulama miktarıdır.
 * Bu değer nihai yapısal talep olarak sunulmaz; sonuçlarda veri uyarısı üretilir.
 */
export const REBAR_RATIO_LIMITS = { min: 40, max: 180 } as const;

function preliminaryAutomaticRatio(wallHeight: number): number {
  return Math.min(90, Math.max(60, 55 + wallHeight * 2.5));
}

/**
 * Geometri metriklerinden ve iç stabilite sonuçlarından yararlanarak
 * metraj özetini oluşturur. Hem TOPLAM hem 1 metre şerit değerleri döner.
 * İç stabiliteden gelen kg/m, kesit çizim düzlemine dik 1.00 m duvar şerididir;
 * proje toplamı yalnız burada ve yalnız bir kez L ile çarpılır.
 */
export function calculateQuantities(
  geoMetrics: GeometryMetrics,
  internalStability?: InternalStabilityResult,
  reinforcement?: ReinforcementSettings,
  wallHeight = 6,
): QuantityResult {
  let appliedRebarKgPerMeter = 0;
  let requiredRebarKgPerMeter = 0;

  if (internalStability) {
    const parts = [internalStability.stem, internalStability.toe, internalStability.heel];
    // Structural results already include each member's actual bar run length
    // and both primary + secondary reinforcement directions. Falling back to
    // zero here is deliberate: area alone is not a physically valid mass.
    appliedRebarKgPerMeter = parts.reduce((sum, part) => sum + (part.appliedRebarKgPerMeter ?? 0), 0);
    requiredRebarKgPerMeter = parts.reduce((sum, part) => sum + (part.requiredRebarKgPerMeter ?? 0), 0);
  }

  // İç stabilite yoksa tipik uygulama miktarı üzerinden kaba tahmin
  const reinforcementMode: QuantityResult['reinforcementMode'] = internalStability
    ? reinforcement?.mode === 'custom' ? 'custom' : 'structural'
    : reinforcement?.mode ?? 'automatic';
  let requestedRatio: number | null = reinforcement?.mode === 'custom'
    ? Number.isFinite(reinforcement.customRatioKgM3)
      ? Math.min(REBAR_RATIO_LIMITS.max, Math.max(REBAR_RATIO_LIMITS.min, reinforcement.customRatioKgM3))
      : REBAR_RATIO_LIMITS.min
    : null;
  const reinforcementWarnings: string[] = [];
  let appliedRatio = preliminaryAutomaticRatio(wallHeight);

  if (appliedRebarKgPerMeter === 0) {
    if (reinforcement?.mode === 'custom') {
      requestedRatio = Number.isFinite(reinforcement.customRatioKgM3) ? reinforcement.customRatioKgM3 : appliedRatio;
      appliedRatio = Math.min(REBAR_RATIO_LIMITS.max, Math.max(REBAR_RATIO_LIMITS.min, requestedRatio));
      if (appliedRatio !== requestedRatio) {
      reinforcementWarnings.push(`İstenen ${requestedRatio} kg/m³ uygulama hedefi ${REBAR_RATIO_LIMITS.min}–${REBAR_RATIO_LIMITS.max} kg/m³ aralığına getirildi.`);
      }
      reinforcementWarnings.push('Yapısal talep bulunamadığı için uygulanan donatı miktarı ön metraj olarak gösteriliyor; çap, aralık, ankraj ve kesit yeterliliği statik proje ile doğrulanmalıdır.');
    } else {
      reinforcementWarnings.push('Donatı miktarı iç stabilite hesabı bulunmadığı için duvar yüksekliğine bağlı otomatik ön metraj ile hesaplandı.');
    }
    const kgPerM = geoMetrics.concreteVolumePerMeter * appliedRatio;
    appliedRebarKgPerMeter = kgPerM;
    requiredRebarKgPerMeter = kgPerM;
  } else if (geoMetrics.concreteVolumePerMeter > 0) {
    appliedRatio = appliedRebarKgPerMeter / geoMetrics.concreteVolumePerMeter;
    if (requestedRatio != null && Math.abs(appliedRatio - requestedRatio) > 0.5) {
      reinforcementWarnings.push(`İstenen ${requestedRatio.toFixed(0)} kg/m³ uygulama hedefi ACI CODE-318-25 ön kesit talebiyle kontrol edildi; uygulanan ön metraj ${appliedRatio.toFixed(1)} kg/m³ oldu.`);
    }
    reinforcementWarnings.push('Yapısal donatı metrajı ana ve dağıtma donatısının gerçek eleman boylarıyla hesaplanır; bindirme, kanca, ankraj uzatması ve fire dahil değildir.');
    reinforcementWarnings.push('Donatı hesabı kesit çizim düzlemine dik 1,00 m duvar şeridi için yapılır; proje toplamı kg/m × toplam duvar uzunluğu L olarak yalnız bir kez ölçeklenir.');
  }

  const wallLength = geoMetrics.wallLength;
  const reinforcementWeightPerMeter = appliedRebarKgPerMeter / 1000;
  // The internal RC solver already returns one-metre-strip mass. Do not apply L
  // anywhere upstream; this is the single project-length scaling boundary.
  const reinforcementWeightKg = appliedRebarKgPerMeter * wallLength;
  const reinforcementRequiredKg = requiredRebarKgPerMeter * wallLength;

  return {
    // TOPLAM değerler
    concreteVolume: geoMetrics.totalConcreteVolume,
    reinforcementWeight: reinforcementWeightPerMeter * wallLength,
    reinforcementWeightKg,
    reinforcementRequiredKg,
    formworkArea: geoMetrics.totalFormworkArea,
    excavationVolume: geoMetrics.totalExcavationVolume,
    backfillVolume: geoMetrics.totalBackfillVolume,

    // 1 METRE şerit değerleri
    concreteVolumePerMeter: geoMetrics.concreteVolumePerMeter,
    reinforcementWeightPerMeter,
    reinforcementWeightKgPerMeter: appliedRebarKgPerMeter,
    reinforcementRequiredKgPerMeter: requiredRebarKgPerMeter,
    formworkAreaPerMeter: geoMetrics.formworkAreaPerMeter,
    excavationVolumePerMeter: geoMetrics.excavationVolumePerMeter,
    backfillVolumePerMeter: geoMetrics.backfillVolumePerMeter,

    wallLength,
    reinforcementRatioKgM3: appliedRatio,
    reinforcementMode,
    reinforcementRequestedRatioKgM3: requestedRatio,
    reinforcementWarnings,
  };
}
