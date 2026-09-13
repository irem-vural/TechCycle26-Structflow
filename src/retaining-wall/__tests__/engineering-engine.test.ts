import { describe, expect, it } from 'vitest';
import {
  ACI318_25_STANDARD,
  getConcreteShearDesignStrengthKn,
  getMinimumFlexuralSteelArea,
  getShrinkageTemperatureSteelArea,
} from '@/core/standards/aci318-25';
import { PROJECT_CONCRETE_UNIT_WEIGHT_KN_M3 } from '../engine/constants';
import { calculateEarthPressures, calculateKaCoulomb } from '../engine/earth-pressure';
import { calculateGeometryMetrics } from '../engine/geometry';
import { runEngine } from '../engine';
import { calculateQuantities } from '../engine/quantities';
import { calculateInternalStability } from '../engine/reinforcement';
import { calculateStability, getBearingCapacityFactors, getSafetyStatus } from '../engine/stability';
import { DEFAULT_LOGISTICS, DEFAULT_WALL_INPUT, useRetainingWallStore } from '../store/useRetainingWallStore';
import type { RetainingWallInput, WallGeometry } from '../types';

const geometry: WallGeometry = {
  H: 6,
  x1: 4,
  x2: 1,
  x3: 0.5,
  x4: 0.3,
  x5: 0.6,
  x6: 2.5,
  Df: 0.75,
  L: 10,
};

function benchmarkInput(overrides: Partial<RetainingWallInput> = {}): RetainingWallInput {
  return {
    ...DEFAULT_WALL_INPUT,
    geometry,
    backfillSoil: { type: 'granular', gamma: 17.5, phi: 30, c: 0, beta: 0 },
    foundationSoil: { type: 'custom', gamma: 18.5, phi: 34, c: 0, beta: 0 },
    surchargeLoad: 30,
    earthPressureTheory: 'coulomb',
    bearingCapacityMethod: 'terzaghi',
    wallFrictionAngle: 0,
    rcDesign: { fcMpa: 21, fyMpa: 400, shrinkageTemperatureRatio: 0.002 },
    reinforcement: {
      mode: 'automatic',
      customRatioKgM3: 70,
      coverMm: 70,
      preferredDiameterMm: 16,
      preferredSpacingMm: 200,
      minSpacingMm: 100,
      maxSpacingMm: 300,
    },
    ...overrides,
  };
}

function benchmarkEarth(input = benchmarkInput()) {
  return calculateEarthPressures({
    theory: input.earthPressureTheory,
    backfillSoil: input.backfillSoil,
    foundationSoil: input.foundationSoil,
    wallHeight: input.geometry.H,
    passiveHeight: input.geometry.Df,
    surcharge: input.surchargeLoad,
    wallFrictionAngle: input.wallFrictionAngle,
  });
}

describe('engineering engine — approved benchmark semantics', () => {
  it('keeps H as free stem height rather than subtracting base thickness', () => {
    const result = calculateGeometryMetrics(geometry);
    expect(result.stemHeight).toBe(6);
    expect(result.heelWidth).toBe(2.5);
    // Base 2.4 + stem rectangle 1.8 + stem taper triangle 0.6 m².
    expect(result.totalCrossSectionArea).toBeCloseTo(4.8, 10);
  });

  it('stores the user-approved geotechnical/RC benchmark defaults', () => {
    expect(DEFAULT_WALL_INPUT.geometry.x1).toBe(4.0);
    expect(DEFAULT_WALL_INPUT.geometry.x6).toBe(2.5);
    expect(DEFAULT_WALL_INPUT.surchargeLoad).toBe(30);
    expect(DEFAULT_WALL_INPUT.backfillSoil.gamma).toBe(17.5);
    expect(DEFAULT_WALL_INPUT.foundationSoil.gamma).toBe(18.5);
    expect(DEFAULT_WALL_INPUT.foundationSoil.phi).toBe(34);
    expect(DEFAULT_WALL_INPUT.foundationSoil.c).toBe(0);
    expect(DEFAULT_WALL_INPUT.geometry.Df).toBe(0.75);
    expect(DEFAULT_WALL_INPUT.reinforcement?.coverMm).toBe(70);
    expect(DEFAULT_WALL_INPUT.rcDesign).toEqual({
      fcMpa: 21,
      fyMpa: 400,
      shrinkageTemperatureRatio: 0.002,
    });
    expect(PROJECT_CONCRETE_UNIT_WEIGHT_KN_M3).toBe(23.5);
    expect(useRetainingWallStore.getState().logistics.rebarPrice).toBe(30_760);
  });

  it('accepts a safety check as soon as the required FS is reached', () => {
    expect(getSafetyStatus(1.25, 1.25)).toBe('safe');
    expect(getSafetyStatus(1.26, 1.25)).toBe('safe');
    expect(getSafetyStatus(1.2499, 1.25)).toBe('unsafe');
  });

  it('matches the approved φ=34° pure-Terzaghi bearing-factor row', () => {
    const factors = getBearingCapacityFactors(34);
    expect(factors.Nc).toBeCloseTo(52.64, 2);
    expect(factors.Nq).toBeCloseTo(36.50, 2);
    expect(factors.Ngamma).toBeCloseTo(38.04, 8);
  });

  it('interpolates only the Terzaghi Nγ table between integer rows', () => {
    const factors = getBearingCapacityFactors(34.5);
    expect(factors.Ngamma).toBeCloseTo((38.04 + 45.41) / 2, 10);
    expect(() => getBearingCapacityFactors(51)).toThrow(/Terzaghi/);
  });
});

describe('engineering engine — Coulomb-only lateral pressure', () => {
  it('separates triangular soil and uniform surcharge resultants and lever arms', () => {
    const earth = benchmarkEarth();
    expect(calculateKaCoulomb(30, 0, 0)).toBeCloseTo(1 / 3, 10);
    expect(earth.Ka).toBeCloseTo(1 / 3, 10);
    expect(earth.PaSoil).toBeCloseTo(105, 10);
    expect(earth.PaSurcharge).toBeCloseTo(60, 10);
    expect(earth.Pa).toBeCloseTo(165, 10);
    expect(earth.Pa_h).toBeCloseTo(165, 10);
    expect(earth.Pa_v).toBeCloseTo(0, 10);
    expect(earth.soilLeverArm).toBe(2);
    expect(earth.surchargeLeverArm).toBe(3);
    expect(earth.passiveHeight).toBeCloseTo(0.75, 10);
  });

  it('uses foundation soil and full front-soil depth Df for passive resistance', () => {
    const earth = benchmarkEarth();
    const kpExpected = (1 + Math.sin(34 * Math.PI / 180)) / (1 - Math.sin(34 * Math.PI / 180));
    expect(earth.Kp).toBeCloseTo(kpExpected, 10);
    expect(earth.Pp).toBeCloseTo(0.5 * kpExpected * 18.5 * 0.75 ** 2, 10);
  });

  it('rejects physically invalid Coulomb inputs instead of clamping radicals', () => {
    expect(() => calculateKaCoulomb(30, 31, 0)).toThrow(/δ/);
    expect(() => calculateKaCoulomb(30, 0, 31)).toThrow(/β/);
    expect(() => benchmarkEarth(benchmarkInput({
      backfillSoil: { gamma: 17.5, phi: 30, c: 5, beta: 0 },
    }))).toThrow(/c = 0/);
  });

  it('normalizes final engine scenarios to the heel-edge vertical plane with δ=0 and β=0', () => {
    expect(DEFAULT_WALL_INPUT.wallFrictionAngle).toBe(0);
    const scenario = runEngine({
      wallInput: benchmarkInput({
        wallFrictionAngle: 20,
        backfillSoil: { type: 'granular', gamma: 17.5, phi: 30, c: 0, beta: 8 },
      }),
      logistics: DEFAULT_LOGISTICS,
      scenarioId: 'delta-zero-regression',
    });

    expect(scenario.input.wallFrictionAngle).toBe(0);
    expect(scenario.input.backfillSoil.beta).toBe(0);
    expect(scenario.earthPressures?.activeConvention).toBe('heel-edge-vertical-virtual-plane');
    expect(scenario.earthPressures?.wallFrictionAngle).toBe(0);
    expect(scenario.earthPressures?.backfillSlopeAngle).toBe(0);
    expect(scenario.earthPressures?.virtualPlaneAngle).toBe(90);
    expect(scenario.earthPressures?.Ka).toBeCloseTo(calculateKaCoulomb(30, 0, 0), 12);
    expect(scenario.earthPressures?.Pa_v).toBeCloseTo(0, 12);
    expect(scenario.engineeringWarnings?.some((warning) => warning.includes('δ=20°'))).toBe(true);
    expect(scenario.engineeringWarnings?.some((warning) => warning.includes('β=8°'))).toBe(true);
  });

  it('does not emit engineering warnings for an already-valid default δ=0/β=0 scenario', () => {
    const scenario = runEngine({
      wallInput: benchmarkInput(),
      logistics: DEFAULT_LOGISTICS,
      scenarioId: 'default-geotech-no-warning',
    });

    expect(scenario.input.wallFrictionAngle).toBe(0);
    expect(scenario.input.backfillSoil.beta).toBe(0);
    expect(scenario.engineeringWarnings).toEqual([]);
  });
});

describe('engineering engine — stability and preliminary ACI design', () => {
  it('uses separate active-pressure moments, |e|, and an explicit contact distribution', () => {
    const input = benchmarkInput();
    const geo = calculateGeometryMetrics(input.geometry);
    const earth = benchmarkEarth(input);
    const stability = calculateStability({
      input,
      geoMetrics: geo,
      earthPressures: earth,
      gammaConcrete: PROJECT_CONCRETE_UNIT_WEIGHT_KN_M3,
    });

    expect(stability.eccentricity).toBeCloseTo(Math.abs(stability.signedEccentricity ?? 0), 12);
    expect(stability.effectiveBearingWidth).toBeCloseTo(input.geometry.x1 - 2 * stability.eccentricity, 12);
    expect(stability.qMax).toBeGreaterThanOrEqual(stability.qMin);
    expect((stability.compressionEndX ?? 0) - (stability.compressionStartX ?? 0)).toBeGreaterThan(0);
    const momentStep = stability.overturning.steps[0];
    expect(momentStep.variables.ySoil).toBeCloseTo(0.6 + 6 / 3, 12);
    expect(momentStep.variables.ySurcharge).toBeCloseTo(0.6 + 6 / 2, 12);
    expect(stability.sliding.requiredFS).toBe(1.25);
    expect(stability.overturning.requiredFS).toBe(1.5);
    expect(stability.bearingCapacity.requiredFS).toBe(3);
    const bearingStep = stability.bearingCapacity.steps[0];
    const factors = getBearingCapacityFactors(34);
    const expectedQult = 18.5 * 0.75 * factors.Nq + 0.5 * 18.5 * 4 * factors.Ngamma;
    expect(bearingStep.result).toBeCloseTo(expectedQult, 10);
    expect(bearingStep.formula).toContain('·B·Nγ');
    const slidingStep = stability.sliding.steps[0];
    expect(slidingStep.variables.deltaBaseDeg).toBeCloseTo((2 / 3) * 34, 12);
    expect(slidingStep.reference).toContain('δbase = 2φfoundation/3');
    expect(stability.warnings?.some((warning) => warning.includes('Taban arayüzü sürtünme açısı'))).toBe(true);
  });

  it('fails closed if low-level stability is called with beta != 0', () => {
    const input = benchmarkInput({
      backfillSoil: { type: 'granular', gamma: 17.5, phi: 30, c: 0, beta: 5 },
    });
    const geo = calculateGeometryMetrics(input.geometry);
    const earth = calculateEarthPressures({
      theory: 'coulomb',
      backfillSoil: input.backfillSoil,
      foundationSoil: input.foundationSoil,
      wallHeight: input.geometry.H,
      passiveHeight: input.geometry.Df,
      surcharge: input.surchargeLoad,
      wallFrictionAngle: 0,
    });
    expect(() => calculateStability({ input, geoMetrics: geo, earthPressures: earth, gammaConcrete: 23.5 }))
      .toThrow(/β=0/);
  });

  it('fails closed if low-level RC demand is called with a beneficial active Pa_v', () => {
    const input = benchmarkInput();
    const geo = calculateGeometryMetrics(input.geometry);
    const earth = benchmarkEarth(input);
    const stability = calculateStability({ input, geoMetrics: geo, earthPressures: earth, gammaConcrete: 23.5 });
    const inconsistentEarth = {
      ...earth,
      PaSoil_v: 5,
      Pa_v: 5,
    };

    expect(() => calculateInternalStability(input, geo, inconsistentEarth, stability))
      .toThrow(/Pa_v=0/);
  });

  it('switches to compression-only triangular base reaction outside the middle third', () => {
    const input = benchmarkInput();
    const geo = calculateGeometryMetrics(input.geometry);
    const earth = benchmarkEarth(input);
    const amplified = {
      ...earth,
      PaSoil_h: earth.PaSoil_h * 2,
      PaSurcharge_h: earth.PaSurcharge_h * 2,
      Pa_h: earth.Pa_h * 2,
    };
    const stability = calculateStability({ input, geoMetrics: geo, earthPressures: amplified, gammaConcrete: 23.5 });

    expect(stability.eccentricity).toBeGreaterThan(input.geometry.x1 / 6);
    expect(stability.eccentricity).toBeLessThan(input.geometry.x1 / 2);
    expect(stability.qMin).toBe(0);
    expect(stability.qHeel).toBe(0);
    expect(stability.compressionStartX).toBe(0);
    expect(stability.compressionEndX).toBeLessThan(input.geometry.x1);
  });

  it('uses f\'c/fy and the approved 0.002 shrinkage-temperature ratio', () => {
    const section = {
      widthMm: 1000,
      thicknessMm: 500,
      effectiveDepthMm: 422,
      materials: { fcMpa: 21, fyMpa: 400, shrinkageTemperatureRatio: 0.002 },
    };
    expect(getShrinkageTemperatureSteelArea(1000, 500, section.materials)).toBe(1000);
    expect(getMinimumFlexuralSteelArea(section)).toBeGreaterThan(0);
  });

  it('ACI shear screening responds to longitudinal rho and effective-depth size effect', () => {
    const materials = { fcMpa: 28, fyMpa: 400, shrinkageTemperatureRatio: 0.002 };
    const shallow = {
      widthMm: 1000,
      thicknessMm: 500,
      effectiveDepthMm: 300,
      materials,
    };
    const deep = { ...shallow, thicknessMm: 1000, effectiveDepthMm: 800 };

    const shallowLowRho = getConcreteShearDesignStrengthKn(shallow, 1000);
    const shallowHighRho = getConcreteShearDesignStrengthKn(shallow, 3000);
    const deepSameRho = getConcreteShearDesignStrengthKn(deep, 800 / 300 * 1000);

    expect(shallowHighRho).toBeGreaterThan(shallowLowRho);
    // Compare normalized shear stress φVc/(bd): the deeper member must show
    // the λs size-effect reduction at the same longitudinal reinforcement ratio.
    const shallowStress = shallowLowRho * 1000 / (shallow.widthMm * shallow.effectiveDepthMm);
    const deepStress = deepSameRho * 1000 / (deep.widthMm * deep.effectiveDepthMm);
    expect(deepStress).toBeLessThan(shallowStress);
  });

  it('ACI shear screening enforces the 0.083λ√f\'c lower bound when rho is very small', () => {
    const section = {
      widthMm: 1000,
      thicknessMm: 700,
      effectiveDepthMm: 600,
      materials: { fcMpa: 21, fyMpa: 400, shrinkageTemperatureRatio: 0.002 },
    };
    const capacity = getConcreteShearDesignStrengthKn(section, 1);
    const expectedVcMpa = 0.083 * Math.sqrt(21);
    const expectedPhiVcKn = 0.75 * expectedVcMpa * section.widthMm * section.effectiveDepthMm / 1000;
    expect(capacity).toBeCloseTo(expectedPhiVcKn, 12);
  });

  it('derives stem/toe/heel demands from distributions and reports preliminary ACI design', () => {
    const input = benchmarkInput();
    const geo = calculateGeometryMetrics(input.geometry);
    const earth = benchmarkEarth(input);
    const stability = calculateStability({ input, geoMetrics: geo, earthPressures: earth, gammaConcrete: 23.5 });
    const internal = calculateInternalStability(input, geo, earth, stability);

    expect(internal.stem.momentDemand).toBeCloseTo(105 * 2 + 60 * 3, 10);
    for (const section of [internal.stem, internal.toe, internal.heel]) {
      expect(section.designStandard).toBe(ACI318_25_STANDARD);
      expect(section.designBasis).toBe('preliminary');
      expect(section.memberLengthM).toBeGreaterThan(0);
      expect(section.secondaryRequiredAs).toBeGreaterThan(0);
      expect(section.requiredRebarKgPerMeter).toBeGreaterThan(0);
      expect(section.appliedRebarKgPerMeter).toBeGreaterThanOrEqual(section.requiredRebarKgPerMeter ?? 0);
      expect(section.reinforcement.count).toBeCloseTo(1000 / section.reinforcement.spacing, 12);
      expect(section.reinforcement.area).toBeCloseTo(
        section.reinforcement.count * Math.PI * section.reinforcement.diameter ** 2 / 4,
        10,
      );
      expect(section.warnings?.some((warning) => warning.includes('ön boyutlandırma'))).toBe(true);
    }

    const quantities = calculateQuantities(geo, internal, input.reinforcement, input.geometry.H);
    const expectedApplied = internal.stem.appliedRebarKgPerMeter!
      + internal.toe.appliedRebarKgPerMeter!
      + internal.heel.appliedRebarKgPerMeter!;
    const expectedRequired = internal.stem.requiredRebarKgPerMeter!
      + internal.toe.requiredRebarKgPerMeter!
      + internal.heel.requiredRebarKgPerMeter!;
    expect(quantities.reinforcementWeightKgPerMeter).toBeCloseTo(expectedApplied, 10);
    expect(quantities.reinforcementRequiredKgPerMeter).toBeCloseTo(expectedRequired, 10);
    expect(quantities.reinforcementWeightKg).toBeCloseTo(expectedApplied * input.geometry.L, 10);
    expect(quantities.reinforcementRequiredKg).toBeCloseTo(expectedRequired * input.geometry.L, 10);
  });

  it('designs reinforcement on a 1 m wall strip and scales total steel by L exactly once', () => {
    const short = runEngine({
      wallInput: benchmarkInput({ geometry: { ...geometry, L: 10 } }),
      logistics: DEFAULT_LOGISTICS,
      scenarioId: 'rebar-strip-short',
    });
    const long = runEngine({
      wallInput: benchmarkInput({ geometry: { ...geometry, L: 25 } }),
      logistics: DEFAULT_LOGISTICS,
      scenarioId: 'rebar-strip-long',
    });

    expect(short.quantities?.reinforcementWeightKgPerMeter).toBeCloseTo(long.quantities?.reinforcementWeightKgPerMeter ?? 0, 10);
    expect(short.quantities?.reinforcementRequiredKgPerMeter).toBeCloseTo(long.quantities?.reinforcementRequiredKgPerMeter ?? 0, 10);
    expect(short.quantities?.reinforcementWeightKg).toBeCloseTo((short.quantities?.reinforcementWeightKgPerMeter ?? 0) * 10, 10);
    expect(long.quantities?.reinforcementWeightKg).toBeCloseTo((long.quantities?.reinforcementWeightKgPerMeter ?? 0) * 25, 10);
    expect(long.quantities?.reinforcementWeightKg).toBeCloseTo((short.quantities?.reinforcementWeightKg ?? 0) * 2.5, 10);
  });

  it('fails closed instead of leaving a stale scenario after blocking geometry', () => {
    const store = useRetainingWallStore.getState();
    const originalGeometry = { ...store.wallInput.geometry };
    store.calculate();
    expect(useRetainingWallStore.getState().activeScenario).not.toBeNull();

    useRetainingWallStore.getState().setGeometry({ x1: 1 });
    expect(useRetainingWallStore.getState().geometryErrors.some((error) => error.severity === 'error')).toBe(true);
    expect(useRetainingWallStore.getState().activeScenario).toBeNull();

    // Leave the singleton store in its original geometry for following suites.
    useRetainingWallStore.getState().setGeometry(originalGeometry);
  });
});
