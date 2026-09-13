import type {
  CalculationStep,
  EarthPressureResult,
  RetainingWallInput,
  SafetyStatus,
  StabilityResult,
} from '../types';
import type { GeometryMetrics } from './geometry';
import { PROJECT_CONCRETE_UNIT_WEIGHT_KN_M3 } from './constants';

const DEG = Math.PI / 180;
const EPS = 1e-12;

/** Project acceptance limits used by every retaining-wall stability output. */
export const STABILITY_REQUIRED_FS = {
  sliding: 1.25,
  overturning: 1.5,
  bearingCapacity: 3.0,
} as const;

export function getSafetyStatus(fs: number, limit: number): SafetyStatus {
  return fs >= limit ? 'safe' : 'unsafe';
}

/**
 * Terzaghi general-shear Nγ table. These tabulated values intentionally keep
 * the project-approved φ=34° benchmark Nγ=38.04; they are not replaced by a
 * Vesic, Meyerhof or Hansen Nγ expression. Non-integer φ is linearly
 * interpolated between adjacent table rows.
 */
const TERZAGHI_N_GAMMA: readonly number[] = [
  0.00, 0.01, 0.04, 0.06, 0.10, 0.14, 0.20, 0.27, 0.35, 0.44,
  0.56, 0.69, 0.85, 1.04, 1.26, 1.52, 1.82, 2.18, 2.59, 3.07,
  3.64, 4.31, 5.09, 6.00, 7.08, 8.34, 9.84, 11.60, 13.70, 16.18,
  19.13, 22.65, 26.87, 31.94, 38.04, 45.41, 54.36, 65.27, 78.61, 95.03,
  115.31, 140.51, 171.99, 211.56, 261.60, 325.34, 407.11, 512.84, 650.67, 831.99,
  1072.80,
] as const;

/** Pure Terzaghi general-shear bearing-capacity factors. */
export function getBearingCapacityFactors(phiDeg: number): { Nc: number; Nq: number; Ngamma: number } {
  if (!Number.isFinite(phiDeg) || phiDeg < 0 || phiDeg > 50) {
    throw new RangeError('Terzaghi taşıma gücü için φ 0°–50° aralığında olmalıdır.');
  }
  const phi = phiDeg * DEG;
  let Nq = 1;
  let Nc = 5.7;
  if (phiDeg > EPS) {
    const a = Math.exp((3 * Math.PI / 4 - phi / 2) * Math.tan(phi));
    Nq = a * a / (2 * Math.cos(Math.PI / 4 + phi / 2) ** 2);
    Nc = (Nq - 1) / Math.tan(phi);
  }

  const lower = Math.floor(phiDeg);
  const upper = Math.ceil(phiDeg);
  const lowValue = TERZAGHI_N_GAMMA[lower];
  const highValue = TERZAGHI_N_GAMMA[upper];
  const fraction = phiDeg - lower;
  const Ngamma = lower === upper ? lowValue : lowValue + (highValue - lowValue) * fraction;
  return { Nc, Nq, Ngamma };
}

export interface StabilityInput {
  input: RetainingWallInput;
  geoMetrics: GeometryMetrics;
  earthPressures: EarthPressureResult;
  gammaConcrete?: number;
}

interface BaseReaction {
  qMax: number;
  qMin: number;
  qToe: number;
  qHeel: number;
  compressionStartX: number;
  compressionEndX: number;
}

function baseReaction(sumV: number, width: number, signedE: number): BaseReaction {
  const absE = Math.abs(signedE);
  if (absE >= width / 2 - EPS) {
    return {
      qMax: Number.POSITIVE_INFINITY,
      qMin: 0,
      qToe: signedE >= 0 ? Number.POSITIVE_INFINITY : 0,
      qHeel: signedE < 0 ? Number.POSITIVE_INFINITY : 0,
      compressionStartX: signedE >= 0 ? 0 : width,
      compressionEndX: signedE >= 0 ? 0 : width,
    };
  }

  if (absE <= width / 6 + EPS) {
    const average = sumV / width;
    const qToe = average * (1 + 6 * signedE / width);
    const qHeel = average * (1 - 6 * signedE / width);
    return {
      qMax: Math.max(qToe, qHeel),
      qMin: Math.min(qToe, qHeel),
      qToe,
      qHeel,
      compressionStartX: 0,
      compressionEndX: width,
    };
  }

  // Soil takes compression only. The triangular contact resultant is located
  // one third of its contact length from the high-pressure edge.
  const resultantX = width / 2 - signedE;
  if (signedE > 0) {
    const contactLength = 3 * resultantX;
    const qToe = 2 * sumV / contactLength;
    return {
      qMax: qToe,
      qMin: 0,
      qToe,
      qHeel: 0,
      compressionStartX: 0,
      compressionEndX: contactLength,
    };
  }
  const contactLength = 3 * (width - resultantX);
  const qHeel = 2 * sumV / contactLength;
  return {
    qMax: qHeel,
    qMin: 0,
    qToe: 0,
    qHeel,
    compressionStartX: width - contactLength,
    compressionEndX: width,
  };
}

function linearLoadCentroid(startValue: number, endValue: number, length: number): number {
  const denominator = startValue + endValue;
  if (Math.abs(denominator) <= EPS) return length / 2;
  return length * (startValue + 2 * endValue) / (3 * denominator);
}

export function calculateStability(data: StabilityInput): StabilityResult {
  const { input, geoMetrics, earthPressures, gammaConcrete = PROJECT_CONCRETE_UNIT_WEIGHT_KN_M3 } = data;
  const geo = input.geometry;
  const B = geo.x1;
  if (!Number.isFinite(B) || B <= 0) throw new RangeError('Taban genişliği x1 pozitif ve sonlu olmalıdır.');
  if (!Number.isFinite(gammaConcrete) || gammaConcrete <= 0) throw new RangeError('Beton birim hacim ağırlığı pozitif ve sonlu olmalıdır.');
  if (input.foundationSoil.c < 0) throw new RangeError('Temel zemini kohezyonu negatif olamaz.');
  if (Math.abs(input.backfillSoil.beta) > EPS) {
    throw new RangeError('Final stabilite modeli yalnız yatay dolgu β=0° için tanımlıdır; eğimli dolgu final benchmarkta desteklenmez.');
  }
  if (Math.abs(earthPressures.Pa_v) > 1e-8) {
    throw new RangeError('Final stabilite modeli aktif basınç için δ=0° kabul eder; faydalı Pa_v düşey bileşeni kullanılamaz.');
  }

  const stepsSliding: CalculationStep[] = [];
  const stepsOverturning: CalculationStep[] = [];
  const stepsBearing: CalculationStep[] = [];

  // Vertical loads and resisting moments about the toe at the base underside.
  const W_conc = geoMetrics.concreteVolumePerMeter * gammaConcrete;
  const x_conc = geoMetrics.centerOfGravity.x;
  const Mr_conc = W_conc * x_conc;

  const heel = geoMetrics.heelWidth;
  const heelRootX = geo.x2 + geo.x3;
  const heelSoilHeightAtRoot = geo.H;
  const heelSoilHeightAtEnd = geo.H;
  const soilLineAtRoot = input.backfillSoil.gamma * heelSoilHeightAtRoot;
  const soilLineAtEnd = input.backfillSoil.gamma * heelSoilHeightAtEnd;
  const W_heel_soil = 0.5 * (soilLineAtRoot + soilLineAtEnd) * heel;
  const x_heel_soil = heelRootX + linearLoadCentroid(soilLineAtRoot, soilLineAtEnd, heel);
  const Mr_heel_soil = W_heel_soil * x_heel_soil;

  // Df is the front-soil depth measured to the footing underside. Passive
  // pressure acts over Df; only Df-x5 is actual soil sitting on the toe slab.
  const passiveHeight = geo.Df;
  if (Math.abs(passiveHeight - earthPressures.passiveHeight) > 1e-8) {
    throw new RangeError('Pasif zemin yüksekliği, ön zemin derinliği Df ile tutarlı olmalıdır.');
  }
  const toeSoilHeight = Math.max(0, geo.Df - geo.x5);
  const W_toe_soil = geo.x2 * toeSoilHeight * input.foundationSoil.gamma;
  const x_toe_soil = geo.x2 / 2;
  const Mr_toe_soil = W_toe_soil * x_toe_soil;

  const W_surcharge = input.surchargeLoad * heel;
  const x_surcharge = heelRootX + heel / 2;
  const Mr_surcharge = W_surcharge * x_surcharge;

  const Pa_v = 0;
  const x_Pa_v = geo.x1;
  const Mr_Pa_v = Pa_v * x_Pa_v;
  const sumV = W_conc + W_heel_soil + W_toe_soil + W_surcharge + Pa_v;
  const sumMr = Mr_conc + Mr_heel_soil + Mr_toe_soil + Mr_surcharge + Mr_Pa_v;
  if (!Number.isFinite(sumV) || sumV <= EPS) throw new RangeError('Toplam düşey taban yükü pozitif olmalıdır.');

  // Horizontal active components have different pressure distributions and
  // therefore different lever arms. Pivot is the toe at slab underside.
  const ySoil = geo.x5 + earthPressures.soilLeverArm;
  const ySurcharge = geo.x5 + earthPressures.surchargeLeverArm;
  const MdSoil = earthPressures.PaSoil_h * ySoil;
  const MdSurcharge = earthPressures.PaSurcharge_h * ySurcharge;
  const sumH = earthPressures.Pa_h;
  const sumMd = MdSoil + MdSurcharge;

  const fsOverturning = sumMd > EPS ? sumMr / sumMd : Number.POSITIVE_INFINITY;
  stepsOverturning.push({
    description: 'Devirici ve direnç momentleri',
    formula: 'FS = ΣMr / (Pa,soil,h·(x5+H/3) + Pa,q,h·(x5+H/2))',
    variables: { sumMr, MdSoil, MdSurcharge, ySoil, ySurcharge, sumMd },
    result: fsOverturning,
    unit: '-',
    reference: 'Coulomb yük bileşenleri; statik denge',
  });

  // Sliding: base friction + conservative 2/3 cohesion adhesion + passive.
  const deltaBaseDeg = (2 / 3) * input.foundationSoil.phi;
  const deltaBaseRad = deltaBaseDeg * DEG;
  const baseFriction = sumV * Math.tan(deltaBaseRad);
  const baseAdhesion = (2 / 3) * input.foundationSoil.c * B;
  const forceResisting = baseFriction + baseAdhesion + earthPressures.Pp;
  const fsSliding = sumH > EPS ? forceResisting / sumH : Number.POSITIVE_INFINITY;
  stepsSliding.push({
    description: 'Kayma direnci ve itici kuvvetler',
    formula: 'FS = (ΣV·tan(2φf/3) + 2cfB/3 + Pp) / ΣH',
    variables: { sumV, sumH, deltaBaseDeg, baseFriction, baseAdhesion, Pp: earthPressures.Pp, passiveHeight, toeSoilHeight },
    result: fsSliding,
    unit: '-',
    reference: 'Tasarım varsayımı: taban arayüz sürtünme açısı δbase = 2φfoundation/3; statik denge ve Coulomb pasif direnç',
  });

  // Resultant, signed eccentricity and compression-only base reaction.
  const xBar = (sumMr - sumMd) / sumV;
  const signedE = B / 2 - xBar;
  const eccentricity = Math.abs(signedE);
  const reaction = baseReaction(sumV, B, signedE);
  const effectiveB = Math.max(0, B - 2 * eccentricity);

  // Terzaghi strip-footing gross ultimate bearing capacity. Eccentricity is
  // already represented by the actual contact qMax above, so capacity uses
  // the full physical footing width B and does not apply a second B' penalty.
  // No Hansen/Meyerhof shape, depth or inclination factors are mixed in.
  const { Nc, Nq, Ngamma } = getBearingCapacityFactors(input.foundationSoil.phi);
  const qDepth = input.foundationSoil.gamma * geo.Df;
  const qUlt = input.foundationSoil.c * Nc
    + qDepth * Nq
    + 0.5 * input.foundationSoil.gamma * B * Ngamma;
  const fsBearing = Number.isFinite(reaction.qMax) && reaction.qMax > EPS
    ? qUlt / reaction.qMax
    : reaction.qMax === 0 ? Number.POSITIVE_INFINITY : 0;

  stepsBearing.push({
    description: 'Nihai taşıma gücü — Terzaghi genel kayma, şerit temel',
    formula: 'qult = c·Nc + (γ·Df)·Nq + 0.5·γ·B·Nγ',
    variables: { Nc, Nq, Ngamma, q_depth: qDepth, B, effectiveB, eccentricity, qMax: reaction.qMax },
    result: qUlt,
    unit: 'kN/m²',
    reference: 'Terzaghi genel kayma taşıma gücü; Nγ tablosu enterpolasyonu',
  });
  stepsBearing.push({
    description: 'Taşıma gücü güvenliği',
    formula: 'FS = qult / qmax',
    variables: { q_ult: qUlt, qMax: reaction.qMax },
    result: fsBearing,
    unit: '-',
  });

  return {
    sliding: {
      factorOfSafety: fsSliding,
      requiredFS: STABILITY_REQUIRED_FS.sliding,
      status: getSafetyStatus(fsSliding, STABILITY_REQUIRED_FS.sliding),
      steps: stepsSliding,
    },
    overturning: {
      factorOfSafety: fsOverturning,
      requiredFS: STABILITY_REQUIRED_FS.overturning,
      status: getSafetyStatus(fsOverturning, STABILITY_REQUIRED_FS.overturning),
      steps: stepsOverturning,
    },
    bearingCapacity: {
      factorOfSafety: fsBearing,
      requiredFS: STABILITY_REQUIRED_FS.bearingCapacity,
      status: getSafetyStatus(fsBearing, STABILITY_REQUIRED_FS.bearingCapacity),
      steps: stepsBearing,
    },
    eccentricity,
    signedEccentricity: signedE,
    effectiveBearingWidth: effectiveB,
    qMax: reaction.qMax,
    qMin: reaction.qMin,
    qToe: reaction.qToe,
    qHeel: reaction.qHeel,
    compressionStartX: reaction.compressionStartX,
    compressionEndX: reaction.compressionEndX,
    warnings: [
      `Taban arayüzü sürtünme açısı tasarım varsayımı olarak δbase = 2/3·φfoundation = ${deltaBaseDeg.toFixed(2)}° alınmıştır.`,
    ],
  };
}
