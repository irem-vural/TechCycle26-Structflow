import {
  ACI318_25_STANDARD,
  getBasicTensionDevelopmentLengthMm,
  getConcreteShearDesignStrengthKn,
  getDesignFlexuralCapacityKnM,
  getMinimumFlexuralSteelArea,
  getRebarArea,
  getRequiredFlexuralSteelArea,
  getShrinkageTemperatureSteelArea,
  getTensionControlledSteelArea,
  STANDARD_REBAR_DIAMETERS,
  type Aci318MaterialProperties,
} from '@/core/standards/aci318-25';
import type {
  EarthPressureResult,
  InternalStabilityResult,
  ReinforcementAssignment,
  ReinforcementSettings,
  RetainingWallInput,
  SectionDesign,
  StabilityResult,
} from '../types';
import type { GeometryMetrics } from './geometry';
import { PROJECT_CONCRETE_UNIT_WEIGHT_KN_M3 } from './constants';
import { getSafetyStatus } from './stability';

// RC demands are solved on a 1.00 m design strip perpendicular to the drawing
// plane (along the wall length). Project totals are obtained later by scaling
// the resulting kg/m strip mass by the physical wall length L exactly once.
const DESIGN_STRIP_WIDTH_M = 1;
const MM_PER_M = DESIGN_STRIP_WIDTH_M * 1000;
const DEFAULT_COVER_MM = 70;
const DEFAULT_DIAMETER_MM = 16;
const DEFAULT_SPACING_MM = 200;
const DEFAULT_MIN_SPACING_MM = 100;
const DEFAULT_MAX_SPACING_MM = 300;
const MIN_CUSTOM_RATIO_KG_M3 = 40;
const MAX_CUSTOM_RATIO_KG_M3 = 180;
const STEEL_DENSITY_KG_M3 = 7850;

const DEFAULT_RC_MATERIALS: Aci318MaterialProperties = {
  fcMpa: 21,
  fyMpa: 400,
  shrinkageTemperatureRatio: 0.002,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundDown(value: number, step: number): number {
  return Math.floor(value / step) * step;
}

function chooseAssignment(requiredAs: number, settings: ReinforcementSettings): ReinforcementAssignment & { warnings: string[] } {
  const warnings: string[] = [];
  const preferredDiameter = STANDARD_REBAR_DIAMETERS.includes(settings.preferredDiameterMm as typeof STANDARD_REBAR_DIAMETERS[number])
    ? settings.preferredDiameterMm as typeof STANDARD_REBAR_DIAMETERS[number]
    : DEFAULT_DIAMETER_MM;
  const minSpacing = clamp(settings.minSpacingMm ?? DEFAULT_MIN_SPACING_MM, 75, 300);
  const maxSpacing = clamp(settings.maxSpacingMm ?? DEFAULT_MAX_SPACING_MM, minSpacing, 300);
  const preferredSpacing = clamp(settings.preferredSpacingMm ?? DEFAULT_SPACING_MM, minSpacing, maxSpacing);
  const candidateDiameters = STANDARD_REBAR_DIAMETERS.filter((diameter) => diameter >= preferredDiameter);

  for (const diameter of candidateDiameters) {
    const areaBar = getRebarArea(diameter);
    const theoreticalSpacing = requiredAs > 0 ? MM_PER_M * areaBar / requiredAs : maxSpacing;
    const rounded = roundDown(Math.min(preferredSpacing, theoreticalSpacing), 10);
    const spacing = clamp(rounded > 0 ? rounded : minSpacing, minSpacing, maxSpacing);
    const area = MM_PER_M / spacing * areaBar;
    // This is a bar density for the 1.00 m design strip, not a literal finite
    // bar count. Keeping it continuous makes it exactly consistent with As/m.
    const count = MM_PER_M / spacing;
    if (area + 1e-9 >= requiredAs) return { count, diameter, spacing, area, warnings };
  }

  const diameter = STANDARD_REBAR_DIAMETERS[STANDARD_REBAR_DIAMETERS.length - 1];
  const spacing = minSpacing;
  const area = MM_PER_M / spacing * getRebarArea(diameter);
  warnings.push('Kritik kesitte gerekli donatı alanı mevcut çap/aralık sınırlarıyla karşılanamadı; donatı adedi artırılmalı (aralık azaltılmalı), çap büyütülmeli, ek katman düşünülmeli veya kesit yeniden tasarlanmalıdır.');
  return { count: MM_PER_M / spacing, diameter, spacing, area, warnings };
}

function designSection(
  name: string,
  momentDemand: number,
  shearDemand: number,
  thicknessMm: number,
  memberLengthM: number,
  input: RetainingWallInput,
): SectionDesign {
  const settings = input.reinforcement ?? { mode: 'automatic' as const, customRatioKgM3: 70 };
  const materials: Aci318MaterialProperties = input.rcDesign ?? DEFAULT_RC_MATERIALS;
  const coverMm = clamp(settings.coverMm ?? DEFAULT_COVER_MM, 35, Math.max(35, thicknessMm - 50));
  const preferredDiameter = settings.preferredDiameterMm ?? DEFAULT_DIAMETER_MM;
  const preliminaryD = Math.max(50, thicknessMm - coverMm - preferredDiameter / 2);
  const sectionInput = (effectiveDepthMm: number) => ({
    widthMm: MM_PER_M,
    thicknessMm,
    effectiveDepthMm,
    materials,
  });

  const requestedRatioKgM3 = clamp(settings.customRatioKgM3 ?? 70, MIN_CUSTOM_RATIO_KG_M3, MAX_CUSTOM_RATIO_KG_M3);
  const requestedAs = settings.mode === 'custom'
    ? requestedRatioKgM3 * (thicknessMm / MM_PER_M) * 1e6 / STEEL_DENSITY_KG_M3
    : 0;

  const requiredForDepth = (effectiveDepthMm: number) => {
    const section = sectionInput(effectiveDepthMm);
    const flexuralAs = getRequiredFlexuralSteelArea(Math.max(0, momentDemand), section);
    const flexuralMinAs = getMinimumFlexuralSteelArea(section);
    const temperatureAs = getShrinkageTemperatureSteelArea(MM_PER_M, thicknessMm, materials);
    const minAs = Math.max(flexuralMinAs, temperatureAs);
    return { flexuralAs, temperatureAs, minAs, requiredAs: Math.max(flexuralAs, minAs) };
  };

  let demand = requiredForDepth(preliminaryD);
  let assignment = chooseAssignment(Math.max(demand.requiredAs, requestedAs), settings);
  let effectiveDepthMm = Math.max(50, thicknessMm - coverMm - assignment.diameter / 2);
  // One correction pass accounts for a selected bar diameter different from
  // the preferred diameter used for the first depth estimate.
  demand = requiredForDepth(effectiveDepthMm);
  assignment = chooseAssignment(Math.max(demand.requiredAs, requestedAs), settings);
  effectiveDepthMm = Math.max(50, thicknessMm - coverMm - assignment.diameter / 2);
  demand = requiredForDepth(effectiveDepthMm);

  const secondary = chooseAssignment(demand.temperatureAs, settings);
  const section = sectionInput(effectiveDepthMm);
  const tensionControlledAs = getTensionControlledSteelArea(section);
  const isTensionControlled = assignment.area <= tensionControlledAs + 1e-9;
  const momentCapacity = isTensionControlled ? getDesignFlexuralCapacityKnM(assignment.area, section) : 0;
  // ACI 318-25 no-minimum-shear-reinforcement screening depends on the
  // actually selected longitudinal tension steel, so evaluate it only after
  // the assignment is known.
  const shearCapacity = getConcreteShearDesignStrengthKn(section, assignment.area);
  // requiredAs/assignment.area are mm² per 1.00 m wall strip. Multiplying by
  // the member run (H, toe or heel length) gives kg for that one-metre strip;
  // L is intentionally NOT used in this section-level calculation.
  const requiredMass = (demand.requiredAs + demand.temperatureAs) * 1e-6 * memberLengthM * STEEL_DENSITY_KG_M3;
  const appliedMass = (assignment.area + secondary.area) * 1e-6 * memberLengthM * STEEL_DENSITY_KG_M3;
  const developmentLength = getBasicTensionDevelopmentLengthMm({
    diameterMm: assignment.diameter,
    coverMm,
    spacingMm: assignment.spacing,
    materials,
  });

  const warnings = [...assignment.warnings, ...secondary.warnings];
  if (thicknessMm < 150) warnings.push(`${name}: kesit kalınlığı 150 mm'nin altında; donatı yerleşimi ve dayanıklılık ayrıca kontrol edilmelidir.`);
  if (!Number.isFinite(demand.flexuralAs)) warnings.push(`${name}: seçilen kesit, verilen ön moment talebi için tek donatılı dikdörtgen kesit çözüm aralığının dışındadır.`);
  if (!isTensionControlled) warnings.push(`${name}: seçilen çekme donatısı φ=0.90 gerilme-kontrollü ön-kontrol sınırını aşıyor; bu ön hesap moment kapasitesi kabul etmez. Kesit büyütülmeli veya tam şekil değiştirme uyumluluğu ile yeniden tasarlanmalıdır.`);
  if (settings.mode === 'custom' && requestedAs > 0 && requestedAs < demand.requiredAs) {
    warnings.push(`${name}: ${requestedRatioKgM3.toFixed(0)} kg/m³ uygulama hedefi ön yapısal talebi karşılamadığı için ana donatı artırıldı.`);
  }
  if (shearDemand > shearCapacity) warnings.push(`${name}: kesme talebi betonun ön-kontrol kesme dayanımını aşıyor; tam ACI CODE-318-25 kesme tasarımı gerekir.`);
  warnings.push(`${name}: ${ACI318_25_STANDARD} kapsamında ön boyutlandırmadır; yük katsayıları/kombinasyonları, dayanıklılık, çatlak kontrolü ve tüm detaylandırma hükümleri nihai statik projede ayrıca uygulanmalıdır.`);
  warnings.push(`${name}: donatı kütlesi ana + dağıtma donatısının düz eleman boylarıyla hesaplanır; bindirme, kanca, ankraj uzatması ve fire dahil değildir.`);

  return {
    designBasis: 'preliminary',
    designStandard: ACI318_25_STANDARD,
    momentDemand,
    momentCapacity,
    shearDemand,
    shearCapacity,
    requiredAs: demand.requiredAs,
    flexuralRequiredAs: demand.flexuralAs,
    requestedAs,
    minAs: demand.minAs,
    maxAs: tensionControlledAs,
    reinforcement: assignment,
    secondaryRequiredAs: demand.temperatureAs,
    secondaryReinforcement: secondary,
    developmentLength,
    memberLengthM,
    effectiveDepthMm,
    sectionThicknessMm: thicknessMm,
    reinforcementRatio: assignment.area / (MM_PER_M * thicknessMm),
    requiredRebarKgPerMeter: requiredMass,
    appliedRebarKgPerMeter: appliedMass,
    shearStatus: getSafetyStatus(shearCapacity / Math.max(shearDemand, 0.001), 1),
    flexuralStatus: getSafetyStatus(momentCapacity / Math.max(momentDemand, 0.001), 1),
    warnings,
  };
}

interface IntegratedLoad {
  force: number;
  firstMoment: number;
}

function integrateLinear(startX: number, endX: number, startValue: number, endValue: number): IntegratedLoad {
  if (endX <= startX) return { force: 0, firstMoment: 0 };
  const length = endX - startX;
  const slope = (endValue - startValue) / length;
  const intercept = startValue - slope * startX;
  const force = intercept * (endX - startX) + slope * (endX ** 2 - startX ** 2) / 2;
  const firstMoment = intercept * (endX ** 2 - startX ** 2) / 2 + slope * (endX ** 3 - startX ** 3) / 3;
  return { force, firstMoment };
}

function integrateBaseReaction(stability: StabilityResult, width: number, fromX: number, toX: number): IntegratedLoad {
  const start = Math.max(fromX, stability.compressionStartX ?? 0);
  const end = Math.min(toX, stability.compressionEndX ?? width);
  if (end <= start) return { force: 0, firstMoment: 0 };
  const compressionStart = stability.compressionStartX ?? 0;
  const compressionEnd = stability.compressionEndX ?? width;
  const qToe = stability.qToe ?? stability.qMax;
  const qHeel = stability.qHeel ?? stability.qMin;
  if (compressionEnd - compressionStart <= 1e-12) return { force: 0, firstMoment: 0 };
  const qAt = (x: number) => {
    const fraction = (x - compressionStart) / (compressionEnd - compressionStart);
    return qToe + (qHeel - qToe) * fraction;
  };
  return integrateLinear(start, end, qAt(start), qAt(end));
}

function integrateDownwardHeelLoad(input: RetainingWallInput, rootX: number, endX: number): IntegratedLoad {
  const length = endX - rootX;
  if (length <= 0) return { force: 0, firstMoment: 0 };
  const hRoot = input.geometry.H;
  const hEnd = hRoot;
  const uniform = PROJECT_CONCRETE_UNIT_WEIGHT_KN_M3 * input.geometry.x5 + input.surchargeLoad;
  const startValue = uniform + input.backfillSoil.gamma * hRoot;
  const endValue = uniform + input.backfillSoil.gamma * hEnd;
  return integrateLinear(rootX, endX, startValue, endValue);
}

/**
 * Preliminary 1.00 m wall-strip RC design. The strip extends perpendicular to
 * the section drawing plane, i.e. along the wall-length direction. Stem demand uses the separate triangular
 * soil and rectangular surcharge distributions. Toe and heel demands integrate
 * the actual stability contact-pressure distribution against their downward
 * dead/soil/surcharge distributions.
 */
export function calculateInternalStability(
  input: RetainingWallInput,
  geo: GeometryMetrics,
  earth: EarthPressureResult,
  stability: StabilityResult,
): InternalStabilityResult {
  if (Math.abs(input.backfillSoil.beta) > 1e-12) {
    throw new RangeError('Final iç stabilite modeli yalnız yatay dolgu β=0° için tanımlıdır.');
  }
  if (Math.abs(earth.Pa_v) > 1e-12) {
    throw new RangeError('Final iç stabilite modeli düşey sanal düzlemde δ=0° ve Pa_v=0 için tanımlıdır.');
  }
  const g = input.geometry;
  const stemMoment = Math.max(0,
    earth.PaSoil_h * earth.soilLeverArm
    + earth.PaSurcharge_h * earth.surchargeLeverArm,
  );
  const stemShear = Math.max(0, earth.PaSoil_h + earth.PaSurcharge_h);

  const toeReaction = integrateBaseReaction(stability, g.x1, 0, g.x2);
  const passiveHeight = Math.max(0, g.Df - g.x5);
  const toeDownward = integrateLinear(
    0,
    g.x2,
    PROJECT_CONCRETE_UNIT_WEIGHT_KN_M3 * g.x5 + input.foundationSoil.gamma * passiveHeight,
    PROJECT_CONCRETE_UNIT_WEIGHT_KN_M3 * g.x5 + input.foundationSoil.gamma * passiveHeight,
  );
  const toeRoot = g.x2;
  const toeMoment = Math.abs(
    (toeReaction.firstMoment - toeRoot * toeReaction.force)
    - (toeDownward.firstMoment - toeRoot * toeDownward.force),
  );
  const toeShear = Math.abs(toeReaction.force - toeDownward.force);

  const heelRoot = g.x2 + g.x3;
  const heelReaction = integrateBaseReaction(stability, g.x1, heelRoot, g.x1);
  const heelDownward = integrateDownwardHeelLoad(input, heelRoot, g.x1);
  const heelMoment = Math.abs(
    (heelReaction.firstMoment - heelRoot * heelReaction.force)
    - (heelDownward.firstMoment - heelRoot * heelDownward.force),
  );
  const heelShear = Math.abs(heelReaction.force - heelDownward.force);

  return {
    stem: designSection('Gövde', stemMoment, stemShear, g.x3 * MM_PER_M, g.H, input),
    toe: designSection('Burun', toeMoment, toeShear, g.x5 * MM_PER_M, g.x2, input),
    heel: designSection('Topuk', heelMoment, heelShear, g.x5 * MM_PER_M, geo.heelWidth, input),
  };
}
