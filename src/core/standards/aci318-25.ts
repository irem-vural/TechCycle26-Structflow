// ============================================================
// ACI CODE-318-25 — preliminary reinforced-concrete helpers
// ============================================================
//
// This module intentionally contains no clause-number claims. It supports a
// transparent preliminary member check only; final design still requires the
// governing ACI CODE-318-25 load combinations, detailing, durability and
// project-specific requirements to be checked by the engineer of record.

export const ACI318_25_STANDARD = 'ACI CODE-318-25' as const;

export interface Aci318MaterialProperties {
  /** Specified concrete compressive strength f'c (MPa). */
  fcMpa: number;
  /** Reinforcement yield strength fy (MPa). */
  fyMpa: number;
  /** Reinforcement elastic modulus Es (MPa). */
  esMpa?: number;
  /** Lightweight-concrete modifier; use 1.0 for normalweight concrete. */
  lambda?: number;
  /** Project-approved shrinkage/temperature gross-area ratio. */
  shrinkageTemperatureRatio?: number;
}

export const ACI318_25_PRELIMINARY_DEFAULTS = {
  esMpa: 200_000,
  lambda: 1,
  flexurePhi: 0.90,
  shearPhi: 0.75,
  shrinkageTemperatureRatio: 0.002,
} as const;

export const STANDARD_REBAR_DIAMETERS = [8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32] as const;

function requirePositive(name: string, value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} pozitif ve sonlu olmalıdır.`);
  }
  return value;
}

export function normalizeAciMaterials(materials: Aci318MaterialProperties): Required<Aci318MaterialProperties> {
  const fcMpa = requirePositive("f'c", materials.fcMpa);
  const fyMpa = requirePositive('fy', materials.fyMpa);
  const esMpa = requirePositive('Es', materials.esMpa ?? ACI318_25_PRELIMINARY_DEFAULTS.esMpa);
  const lambda = requirePositive('λ', materials.lambda ?? ACI318_25_PRELIMINARY_DEFAULTS.lambda);
  const shrinkageTemperatureRatio = materials.shrinkageTemperatureRatio
    ?? ACI318_25_PRELIMINARY_DEFAULTS.shrinkageTemperatureRatio;
  if (!Number.isFinite(shrinkageTemperatureRatio) || shrinkageTemperatureRatio <= 0 || shrinkageTemperatureRatio >= 0.02) {
    throw new RangeError('Büzülme/sıcaklık donatı oranı 0 ile 0.02 arasında olmalıdır.');
  }
  return { fcMpa, fyMpa, esMpa, lambda, shrinkageTemperatureRatio };
}

/** ACI rectangular stress-block β1 expression for normal-strength concrete. */
export function getBeta1(fcMpa: number): number {
  requirePositive("f'c", fcMpa);
  if (fcMpa <= 28) return 0.85;
  return Math.max(0.65, 0.85 - 0.05 * ((fcMpa - 28) / 7));
}

export function getRebarArea(diameterMm: number): number {
  requirePositive('Donatı çapı', diameterMm);
  return (Math.PI / 4) * diameterMm * diameterMm;
}

export interface RectangularSectionInput {
  widthMm: number;
  thicknessMm: number;
  effectiveDepthMm: number;
  materials: Aci318MaterialProperties;
}

/**
 * Minimum flexural steel screening expression for a nonprestressed rectangular
 * strip. Units are MPa and mm. This is used together with the project-approved
 * shrinkage/temperature ratio; the larger requirement governs.
 */
export function getMinimumFlexuralSteelArea(input: RectangularSectionInput): number {
  const { widthMm: b, effectiveDepthMm: d } = input;
  requirePositive('Kesit genişliği', b);
  requirePositive('Etkili derinlik', d);
  const { fcMpa: fc, fyMpa: fy } = normalizeAciMaterials(input.materials);
  const termMetric = 0.25 * Math.sqrt(fc) / fy * b * d;
  const termFloor = 1.4 / fy * b * d;
  return Math.max(termMetric, termFloor);
}

export function getShrinkageTemperatureSteelArea(
  widthMm: number,
  thicknessMm: number,
  materials: Aci318MaterialProperties,
): number {
  requirePositive('Kesit genişliği', widthMm);
  requirePositive('Kesit kalınlığı', thicknessMm);
  const { shrinkageTemperatureRatio } = normalizeAciMaterials(materials);
  return shrinkageTemperatureRatio * widthMm * thicknessMm;
}

/**
 * Solves φMn = Mu for a singly-reinforced rectangular 1-way section using the
 * ACI rectangular compression block. Mu is kN·m and steel area is mm².
 */
export function getRequiredFlexuralSteelArea(
  momentDemandKnM: number,
  input: RectangularSectionInput,
  phi = ACI318_25_PRELIMINARY_DEFAULTS.flexurePhi,
): number {
  if (!Number.isFinite(momentDemandKnM) || momentDemandKnM < 0) {
    throw new RangeError('Moment talebi negatif olmayan sonlu bir sayı olmalıdır.');
  }
  requirePositive('φ', phi);
  const { widthMm: b, effectiveDepthMm: d } = input;
  requirePositive('Kesit genişliği', b);
  requirePositive('Etkili derinlik', d);
  const { fcMpa: fc, fyMpa: fy, esMpa: es } = normalizeAciMaterials(input.materials);
  if (momentDemandKnM === 0) return 0;

  const requiredNominalNmm = momentDemandKnM * 1e6 / phi;
  const quadraticA = fy * fy / (2 * 0.85 * fc * b);
  const quadraticB = fy * d;
  const discriminant = quadraticB * quadraticB - 4 * quadraticA * requiredNominalNmm;
  if (discriminant <= 0) return Number.POSITIVE_INFINITY;
  const steelArea = (quadraticB - Math.sqrt(discriminant)) / (2 * quadraticA);
  // A fixed φ=0.90 is used only in the tension-controlled screening domain.
  // If the solved steel area leaves that domain, this simplified preliminary
  // solver intentionally refuses to claim a valid design.
  const a = steelArea * fy / (0.85 * fc * b);
  const c = a / getBeta1(fc);
  const tensionStrain = c > 0 ? 0.003 * (d - c) / c : Number.POSITIVE_INFINITY;
  const yieldStrain = fy / es;
  if (tensionStrain < yieldStrain + 0.003) return Number.POSITIVE_INFINITY;
  return steelArea;
}

export function getDesignFlexuralCapacityKnM(
  steelAreaMm2: number,
  input: RectangularSectionInput,
  phi = ACI318_25_PRELIMINARY_DEFAULTS.flexurePhi,
): number {
  if (!Number.isFinite(steelAreaMm2) || steelAreaMm2 < 0) return 0;
  const { widthMm: b, effectiveDepthMm: d } = input;
  const { fcMpa: fc, fyMpa: fy } = normalizeAciMaterials(input.materials);
  const a = steelAreaMm2 * fy / (0.85 * fc * b);
  const leverArm = d - a / 2;
  if (leverArm <= 0) return 0;
  return phi * steelAreaMm2 * fy * leverArm / 1e6;
}

/** Balanced-strain steel area used only as a preliminary over-reinforcement warning. */
export function getBalancedSteelArea(input: RectangularSectionInput): number {
  const { widthMm: b, effectiveDepthMm: d } = input;
  const { fcMpa: fc, fyMpa: fy, esMpa: es } = normalizeAciMaterials(input.materials);
  const beta1 = getBeta1(fc);
  const epsCu = 0.003;
  const epsY = fy / es;
  const c = d * epsCu / (epsCu + epsY);
  const a = beta1 * c;
  return 0.85 * fc * b * a / fy;
}

/** Steel area at the lower edge of the tension-controlled φ=0.90 domain. */
export function getTensionControlledSteelArea(input: RectangularSectionInput): number {
  const { widthMm: b, effectiveDepthMm: d } = input;
  const { fcMpa: fc, fyMpa: fy, esMpa: es } = normalizeAciMaterials(input.materials);
  const beta1 = getBeta1(fc);
  const epsCu = 0.003;
  const epsTLimit = fy / es + 0.003;
  const c = d * epsCu / (epsCu + epsTLimit);
  const a = beta1 * c;
  return 0.85 * fc * b * a / fy;
}

/**
 * Preliminary one-way concrete shear screening strength for a nonprestressed
 * member without minimum shear reinforcement. Longitudinal tension steel and
 * effective-depth size effect are explicit inputs. Net axial tension is not
 * modeled here, so the non-axial-tension lower bound is used.
 *
 * This remains a screening value only; it is not a substitute for the complete
 * ACI CODE-318-25 shear-design and detailing workflow.
 */
export function getConcreteShearDesignStrengthKn(
  input: RectangularSectionInput,
  longitudinalTensionAsMm2: number,
): number {
  const { widthMm: b, effectiveDepthMm: d } = input;
  requirePositive('Kesit genişliği', b);
  requirePositive('Etkili derinlik', d);
  if (!Number.isFinite(longitudinalTensionAsMm2) || longitudinalTensionAsMm2 < 0) {
    throw new RangeError('Boyuna çekme donatısı alanı negatif olmayan sonlu bir sayı olmalıdır.');
  }

  const { fcMpa: fc, lambda } = normalizeAciMaterials(input.materials);
  const rhoW = longitudinalTensionAsMm2 / (b * d);
  const lambdaS = Math.min(1, Math.sqrt(2 / (1 + 0.004 * d)));
  const sqrtFc = Math.sqrt(fc);
  const baseVcMpa = 0.66 * lambdaS * lambda * Math.cbrt(rhoW) * sqrtFc;
  const lowerBoundMpa = 0.083 * lambda * sqrtFc;
  const upperCapMpa = 0.42 * lambda * sqrtFc;
  const vcMpa = Math.min(upperCapMpa, Math.max(lowerBoundMpa, baseVcMpa));
  const nominalN = vcMpa * b * d;
  return ACI318_25_PRELIMINARY_DEFAULTS.shearPhi * nominalN / 1000;
}

/**
 * Straight deformed-bar tension development screening length in mm using the
 * ACI-style SI expression with unity coating/top-bar/size modifiers and Ktr=0.
 * Cover/spacing controls the confinement denominator, capped at 2.5.
 */
export function getBasicTensionDevelopmentLengthMm(args: {
  diameterMm: number;
  coverMm: number;
  spacingMm: number;
  materials: Aci318MaterialProperties;
}): number {
  const db = requirePositive('Donatı çapı', args.diameterMm);
  const cover = requirePositive('Beton örtüsü', args.coverMm);
  const spacing = requirePositive('Donatı aralığı', args.spacingMm);
  const { fcMpa: fc, fyMpa: fy, lambda } = normalizeAciMaterials(args.materials);
  const cb = Math.min(cover + db / 2, spacing / 2);
  const confinementRatio = Math.min(2.5, cb / db);
  const ld = 0.9 * fy / (lambda * Math.sqrt(fc)) * db / confinementRatio;
  return Math.max(300, ld);
}
