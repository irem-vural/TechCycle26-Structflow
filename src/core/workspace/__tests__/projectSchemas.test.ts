import { describe, expect, it } from 'vitest';
import { parseAndMigrateProject } from '../projectSchemas';

const logistics = {
  distancePlant: 11,
  distanceDump: 12,
  distanceRebar: 13,
  distanceFormwork: 14,
  distanceCrushedStone: 15,
  dieselPrice: 44,
  dailyWorkHours: 8,
  concretePrice: 2500,
  rebarPrice: 30000,
  excavationUnitCost: 100,
  backfillUnitCost: 110,
  formworkUnitCost: 120,
  rebarLaborUnitCost: 130,
  transportRatePerTonKm: 140,
  overheadPercent: 10,
  vatPercent: 20,
};

function legacyWallInput() {
  return {
    geometry: {
      H: 6,
      x1: 4,
      x2: 1,
      x3: 0.5,
      x4: 0.3,
      x5: 0.6,
      x6: 2.5,
      x7: 0.4,
      x8: 0.25,
      Df: 0.75,
      L: 18,
      preservedGeometryValue: 123,
    },
    backfillSoil: { gamma: 17.5, phi: 30, c: 0, beta: 7 },
    foundationSoil: { gamma: 18.5, phi: 34, c: 0, beta: 5 },
    concreteClass: 'C25',
    rebarClass: 'B420C',
    reinforcement: {
      mode: 'custom',
      customRatioKgM3: 88,
      preferredDiameterMm: 20,
    },
    surchargeLoad: 17,
    earthPressureTheory: 'rankine',
    bearingCapacityMethod: 'hansen',
    wallFrictionAngle: 12,
    preservedWallValue: 'keep-me',
  };
}

function legacyPayload(version: 1 | 2 | 3) {
  const common = {
    name: `Legacy v${version}`,
    updatedAt: '2025-01-02T03:04:05.000Z',
  };

  if (version === 1) {
    return {
      ...common,
      schemaVersion: 1,
      wallInput: legacyWallInput(),
      logistics,
      customCoefficients: { EF_steel: 1.23 },
    };
  }

  return {
    ...common,
    schemaVersion: version,
    projectType: 'retaining-wall',
    data: {
      wallInput: legacyWallInput(),
      logistics,
      customCoefficients: { EF_steel: 1.23 },
    },
  };
}

describe('project payload migration', () => {
  it.each([1, 2, 3] as const)(
    'accepts legacy v%s wall fields and normalizes only retired runtime settings',
    (version) => {
      const migrated = parseAndMigrateProject(legacyPayload(version));
      const wallInput = migrated.data.wallInput;

      expect(migrated.schemaVersion).toBe(3);
      expect(migrated.name).toBe(`Legacy v${version}`);
      expect(migrated.updatedAt).toBe('2025-01-02T03:04:05.000Z');
      expect(migrated.data.customCoefficients).toEqual({ EF_steel: 1.23 });

      expect(wallInput.earthPressureTheory).toBe('coulomb');
      expect(wallInput.bearingCapacityMethod).toBe('terzaghi');
      expect(wallInput.wallFrictionAngle).toBe(0);
      expect(wallInput.backfillSoil.beta).toBe(0);
      expect(wallInput.foundationSoil.beta).toBe(0);
      expect(wallInput.rcDesign).toEqual({
        fcMpa: 21,
        fyMpa: 400,
        shrinkageTemperatureRatio: 0.002,
      });
      expect(wallInput.reinforcement).toMatchObject({
        mode: 'custom',
        customRatioKgM3: 88,
        coverMm: 70,
        preferredDiameterMm: 20,
      });

      expect(wallInput.geometry).not.toHaveProperty('x7');
      expect(wallInput.geometry).not.toHaveProperty('x8');
      expect(wallInput.geometry).toMatchObject({
        H: 6,
        x1: 4,
        x6: 2.5,
        Df: 0.75,
        L: 18,
        preservedGeometryValue: 123,
      });
      expect(wallInput.surchargeLoad).toBe(17);
      expect(wallInput).toHaveProperty('preservedWallValue', 'keep-me');
    },
  );

  it('preserves explicit current RC design and cover values', () => {
    const legacy = legacyPayload(3);
    if (!('data' in legacy)) throw new Error('Expected v3 envelope fixture.');
    const raw = {
      ...legacy,
      data: {
        ...legacy.data,
        wallInput: {
          ...legacy.data.wallInput,
          earthPressureTheory: 'coulomb',
          bearingCapacityMethod: 'terzaghi',
          rcDesign: {
            fcMpa: 32,
            fyMpa: 500,
            shrinkageTemperatureRatio: 0.0018,
          },
          reinforcement: {
            ...legacy.data.wallInput.reinforcement,
            coverMm: 55,
          },
        },
      },
    };

    const wallInput = parseAndMigrateProject(raw).data.wallInput;

    expect(wallInput.rcDesign).toEqual({
      fcMpa: 32,
      fyMpa: 500,
      shrinkageTemperatureRatio: 0.0018,
    });
    expect(wallInput.reinforcement?.coverMm).toBe(55);
  });
});
