import type { EarthPressureResult, EarthPressureTheory, SoilParameters } from '../types';

const EPS = 1e-12;
const toRad = (deg: number) => (deg * Math.PI) / 180;

function requireFinite(name: string, value: number): number {
  if (!Number.isFinite(value)) throw new RangeError(`${name} sonlu bir sayı olmalıdır.`);
  return value;
}

function requireNonNegative(name: string, value: number): number {
  requireFinite(name, value);
  if (value < 0) throw new RangeError(`${name} negatif olamaz.`);
  return value;
}

function validateSoilForCoulomb(soil: SoilParameters, label: string, requireCohesionless: boolean): void {
  requireFinite(`${label} γ`, soil.gamma);
  requireFinite(`${label} φ`, soil.phi);
  requireFinite(`${label} β`, soil.beta);
  requireFinite(`${label} c`, soil.c);
  if (soil.gamma <= 0) throw new RangeError(`${label} birim hacim ağırlığı pozitif olmalıdır.`);
  if (soil.phi < 0 || soil.phi >= 90) throw new RangeError(`${label} φ açısı 0° ≤ φ < 90° aralığında olmalıdır.`);
  if (Math.abs(soil.beta) >= 90) throw new RangeError(`${label} β açısı -90° ile 90° arasında olmalıdır.`);
  if (soil.c < 0) throw new RangeError(`${label} kohezyonu negatif olamaz.`);
  if (soil.beta > soil.phi + EPS) {
    throw new RangeError(`${label} şev açısı β, Coulomb aktif durumunda φ açısını aşamaz.`);
  }
  if (requireCohesionless && Math.abs(soil.c) > EPS) {
    throw new RangeError('Bu Coulomb aktif basınç modeli kohezyonsuz dolgu (c = 0) içindir; c > 0 sessizce yok sayılmaz.');
  }
}

function validateCoulombAngles(
  phiDeg: number,
  deltaDeg: number,
  betaDeg: number,
  epsilonDeg: number,
): void {
  [phiDeg, deltaDeg, betaDeg, epsilonDeg].forEach((value, index) => {
    requireFinite(['φ', 'δ', 'β', 'ε'][index], value);
  });
  if (phiDeg < 0 || phiDeg >= 90) throw new RangeError('φ açısı 0° ≤ φ < 90° aralığında olmalıdır.');
  if (deltaDeg < 0 || deltaDeg > phiDeg + EPS) throw new RangeError('Coulomb için 0° ≤ δ ≤ φ olmalıdır.');
  if (betaDeg > phiDeg + EPS) throw new RangeError('Coulomb için β ≤ φ olmalıdır.');
  if (epsilonDeg <= 0 || epsilonDeg >= 180) throw new RangeError('Duvar arka yüz açısı ε, 0° ile 180° arasında olmalıdır.');
}

/**
 * Coulomb aktif toprak basıncı katsayısı.
 * ε duvar arka yüzünün yatayla açısıdır; düşey arka yüz için ε = 90°.
 */
export function calculateKaCoulomb(
  phiDeg: number,
  deltaDeg: number,
  betaDeg: number,
  epsilonDeg = 90,
): number {
  validateCoulombAngles(phiDeg, deltaDeg, betaDeg, epsilonDeg);
  const phi = toRad(phiDeg);
  const delta = toRad(deltaDeg);
  const beta = toRad(betaDeg);
  const epsilon = toRad(epsilonDeg);

  const sqrtNum = Math.sin(phi + delta) * Math.sin(phi - beta);
  const sqrtDen = Math.sin(epsilon - delta) * Math.sin(epsilon + beta);
  if (sqrtDen <= EPS || sqrtNum < -EPS) {
    throw new RangeError('Coulomb aktif katsayısı için açı kombinasyonu fiziksel olarak geçersizdir.');
  }
  const radical = sqrtNum / sqrtDen;
  if (radical < -EPS || !Number.isFinite(radical)) {
    throw new RangeError('Coulomb aktif katsayısının karekök terimi geçersizdir.');
  }

  const denominator = Math.sin(epsilon) ** 2
    * Math.sin(epsilon - delta)
    * (1 + Math.sqrt(Math.max(0, radical))) ** 2;
  if (Math.abs(denominator) <= EPS) throw new RangeError('Coulomb aktif katsayısında payda sıfıra yaklaşıyor.');
  const Ka = Math.sin(epsilon + phi) ** 2 / denominator;
  if (!Number.isFinite(Ka) || Ka <= 0) throw new RangeError('Coulomb aktif katsayısı pozitif ve sonlu olmalıdır.');
  return Ka;
}

/**
 * Coulomb pasif katsayısı. Motor, pasif dirençte δp = 0 ve βp = 0 kullanır;
 * böylece temel önü zemin için duvar sürtünmesinden ilave direnç üretilmez.
 */
export function calculateKpCoulomb(
  phiDeg: number,
  deltaDeg = 0,
  betaDeg = 0,
  epsilonDeg = 90,
): number {
  validateCoulombAngles(phiDeg, deltaDeg, betaDeg, epsilonDeg);
  const phi = toRad(phiDeg);
  const delta = toRad(deltaDeg);
  const beta = toRad(betaDeg);
  const epsilon = toRad(epsilonDeg);

  const sqrtNum = Math.sin(phi + delta) * Math.sin(phi + beta);
  const sqrtDen = Math.sin(epsilon + delta) * Math.sin(epsilon + beta);
  if (sqrtDen <= EPS || sqrtNum < -EPS) {
    throw new RangeError('Coulomb pasif katsayısı için açı kombinasyonu fiziksel olarak geçersizdir.');
  }
  const radical = sqrtNum / sqrtDen;
  if (radical < -EPS || !Number.isFinite(radical)) {
    throw new RangeError('Coulomb pasif katsayısının karekök terimi geçersizdir.');
  }
  const root = Math.sqrt(Math.max(0, radical));
  const denominator = Math.sin(epsilon) ** 2
    * Math.sin(epsilon + delta)
    * (1 - root) ** 2;
  if (Math.abs(denominator) <= EPS) throw new RangeError('Coulomb pasif katsayısında payda sıfıra yaklaşıyor.');
  const Kp = Math.sin(epsilon - phi) ** 2 / denominator;
  if (!Number.isFinite(Kp) || Kp <= 0) throw new RangeError('Coulomb pasif katsayısı pozitif ve sonlu olmalıdır.');
  return Kp;
}

export interface EarthPressureInput {
  /** Legacy payloads may contain a method; anything except Coulomb is rejected. */
  theory?: EarthPressureTheory;
  backfillSoil: SoilParameters;
  foundationSoil: SoilParameters;
  /** H: base-slab TOP to wall top (m). */
  wallHeight: number;
  /** Soil height available for passive resistance in front of the footing (m). */
  passiveHeight: number;
  surcharge: number;
  wallFrictionAngle: number;
  epsilonAngle?: number;
}

/** Coulomb-only active/passive lateral pressure result for a 1 m wall strip. */
export function calculateEarthPressures(input: EarthPressureInput): EarthPressureResult {
  if (input.theory !== undefined && input.theory !== 'coulomb') {
    throw new RangeError('Yanal toprak basıncı için yalnız Coulomb modeli desteklenir.');
  }
  const H = requireNonNegative('H', input.wallHeight);
  const hp = requireNonNegative('Pasif zemin yüksekliği', input.passiveHeight);
  const q = requireNonNegative('Sürşarj q', input.surcharge);
  if (H <= 0) throw new RangeError('H pozitif olmalıdır.');
  validateSoilForCoulomb(input.backfillSoil, 'Dolgu zemini', true);
  validateSoilForCoulomb({ ...input.foundationSoil, beta: 0 }, 'Temel zemini', false);

  const epsilon = input.epsilonAngle ?? 90;
  const delta = requireNonNegative('Duvar-zemin sürtünme açısı δ', input.wallFrictionAngle);
  const Ka = calculateKaCoulomb(input.backfillSoil.phi, delta, input.backfillSoil.beta, epsilon);
  const Kp = calculateKpCoulomb(input.foundationSoil.phi, 0, 0, 90);

  const PaSoil = 0.5 * Ka * input.backfillSoil.gamma * H ** 2;
  const PaSurcharge = Ka * q * H;
  const Pa = PaSoil + PaSurcharge;
  const Pp = 0.5 * Kp * input.foundationSoil.gamma * hp ** 2;

  const forceAngle = toRad(90 - epsilon + delta);
  const cos = Math.cos(forceAngle);
  const sin = Math.sin(forceAngle);
  const PaSoil_h = PaSoil * cos;
  const PaSoil_v = PaSoil * sin;
  const PaSurcharge_h = PaSurcharge * cos;
  const PaSurcharge_v = PaSurcharge * sin;

  return {
    theory: 'coulomb',
    activeConvention: Math.abs(delta) <= EPS
      && Math.abs(input.backfillSoil.beta) <= EPS
      && Math.abs(epsilon - 90) <= EPS
      ? 'heel-edge-vertical-virtual-plane'
      : undefined,
    wallFrictionAngle: delta,
    backfillSlopeAngle: input.backfillSoil.beta,
    virtualPlaneAngle: epsilon,
    Ka,
    Kp,
    PaSoil,
    PaSurcharge,
    Pa,
    Pp,
    PaSoil_h,
    PaSoil_v,
    PaSurcharge_h,
    PaSurcharge_v,
    Pa_h: PaSoil_h + PaSurcharge_h,
    Pa_v: PaSoil_v + PaSurcharge_v,
    soilLeverArm: H / 3,
    surchargeLeverArm: H / 2,
    passiveHeight: hp,
  };
}
