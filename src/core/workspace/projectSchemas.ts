import { z } from 'zod';
import { CURRENT_SCHEMA_VERSION, type ProjectPayload } from './projectTypes';
import { ProjectDecodeError } from './projectDecodeError';

const finiteNumber = z.number().finite();

const geometrySchema = z.object({
  H: finiteNumber,
  x1: finiteNumber,
  x2: finiteNumber,
  x3: finiteNumber,
  x4: finiteNumber,
  x5: finiteNumber,
  x6: finiteNumber,
  // Legacy shear-key fields are accepted on import only; current WallGeometry no longer uses them.
  x7: finiteNumber.optional(),
  x8: finiteNumber.optional(),
  Df: finiteNumber,
  L: finiteNumber,
}).passthrough();

const soilSchema = z.object({
  gamma: finiteNumber,
  phi: finiteNumber,
  c: finiteNumber,
  beta: finiteNumber,
  type: z.enum(['granular', 'clayey', 'silty', 'rockfill', 'custom']).optional(),
}).passthrough();

const rcDesignSchema = z.object({
  fcMpa: finiteNumber,
  fyMpa: finiteNumber,
  shrinkageTemperatureRatio: finiteNumber,
}).passthrough();

const wallInputSchema = z.object({
  geometry: geometrySchema,
  backfillSoil: soilSchema,
  foundationSoil: soilSchema,
  concreteClass: z.enum(['C20', 'C25', 'C30', 'C35', 'C40', 'C45', 'C50']),
  rebarClass: z.enum(['B420C', 'B500C']),
  reinforcement: z.object({
    mode: z.enum(['automatic', 'custom']),
    customRatioKgM3: finiteNumber,
    coverMm: finiteNumber.optional(),
  }).passthrough().optional(),
  rcDesign: rcDesignSchema.optional(),
  surchargeLoad: finiteNumber,
  earthPressureTheory: z.enum(['rankine', 'coulomb']),
  bearingCapacityMethod: z.enum(['terzaghi', 'hansen']),
  wallFrictionAngle: finiteNumber,
}).passthrough();

const logisticsSchema = z.object({
  distancePlant: finiteNumber,
  distanceDump: finiteNumber,
  distanceRebar: finiteNumber,
  distanceFormwork: finiteNumber,
  distanceCrushedStone: finiteNumber,
  dieselPrice: finiteNumber,
  dailyWorkHours: finiteNumber,
  concretePrice: finiteNumber,
  concretePricesByClass: z.record(z.string(), finiteNumber).optional(),
  rebarPrice: finiteNumber,
  excavationUnitCost: finiteNumber,
  backfillUnitCost: finiteNumber,
  formworkUnitCost: finiteNumber,
  rebarLaborUnitCost: finiteNumber,
  transportRatePerTonKm: finiteNumber,
  overheadPercent: finiteNumber,
  vatPercent: finiteNumber,
}).passthrough();

const concreteMixSchema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2)]),
  targetConcreteClass: z.enum(['C20', 'C25', 'C30', 'C35', 'C40', 'C45', 'C50']),
}).passthrough();

const sustainableConcreteDataSchema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2)]),
}).passthrough();

const retainingWallDataSchema = z.object({
  wallInput: wallInputSchema,
  logistics: logisticsSchema,
  customCoefficients: z.record(z.string(), finiteNumber),
  concreteMix: concreteMixSchema.optional(),
  sustainableConcrete: sustainableConcreteDataSchema.optional(),
}).passthrough();

function envelopeSchema(version: 2 | 3) {
  return z.object({
    schemaVersion: z.literal(version),
    projectType: z.literal('retaining-wall'),
    name: z.string().optional(),
    updatedAt: z.string().optional(),
    data: retainingWallDataSchema,
  }).passthrough();
}

const v2ProjectSchema = envelopeSchema(2);
const v3ProjectSchema = envelopeSchema(3);
const v1RetainingWallSchema = z.object({
  schemaVersion: z.literal(1).optional(),
  name: z.string().optional(),
  updatedAt: z.string().optional(),
  wallInput: wallInputSchema,
  logistics: logisticsSchema,
  customCoefficients: z.record(z.string(), finiteNumber).optional(),
  concreteMix: concreteMixSchema.optional(),
}).passthrough();

function invalid(path: string, message: string, cause?: unknown): never {
  throw new ProjectDecodeError('INVALID_PROJECT', { path, message, cause });
}

function parse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const path = issue?.path.map(String).join('.') ?? '';
  return invalid(path, path ? `Proje verisi geçersiz (${path}).` : 'Proje verisi geçersiz.', result.error);
}

function normalizedName(name: string | undefined): string {
  return name?.trim() || 'İstinat Duvarı Projesi';
}

function normalizedUpdatedAt(updatedAt: string | undefined): string {
  return updatedAt?.trim() || new Date().toISOString();
}

const DEFAULT_RC_DESIGN = {
  fcMpa: 21,
  fyMpa: 400,
  shrinkageTemperatureRatio: 0.002,
} as const;

type ParsedWallInput = z.infer<typeof wallInputSchema>;

function normalizeWallInput(wallInput: ParsedWallInput): ProjectPayload['data']['wallInput'] {
  const geometry = { ...wallInput.geometry };
  delete geometry.x7;
  delete geometry.x8;
  const reinforcement = wallInput.reinforcement === undefined
    ? undefined
    : {
        ...wallInput.reinforcement,
        coverMm: wallInput.reinforcement.coverMm ?? 70,
      };

  return {
    ...wallInput,
    geometry,
    backfillSoil: { ...wallInput.backfillSoil, beta: 0 },
    foundationSoil: { ...wallInput.foundationSoil, beta: 0 },
    earthPressureTheory: 'coulomb',
    bearingCapacityMethod: 'terzaghi',
    wallFrictionAngle: 0,
    rcDesign: wallInput.rcDesign ?? { ...DEFAULT_RC_DESIGN },
    ...(reinforcement === undefined ? {} : { reinforcement }),
  } as ProjectPayload['data']['wallInput'];
}

export function parseAndMigrateProject(raw: unknown): ProjectPayload {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    invalid('', 'Tanınmayan proje dosyası biçimi.');
  }

  const envelope = raw as Record<string, unknown>;
  const version = envelope.schemaVersion;
  if (typeof version === 'number' && version > CURRENT_SCHEMA_VERSION) {
    throw new ProjectDecodeError('UNSUPPORTED_VERSION', {
      path: 'schemaVersion',
      message: `Bu proje dosyası daha yeni bir StructFlow şeması kullanıyor (v${version}).`,
    });
  }

  if (envelope.projectType !== undefined && envelope.projectType !== 'retaining-wall') {
    invalid('projectType', 'Bu sürüm yalnızca istinat duvarı proje dosyalarını destekler.');
  }

  if (version === 3) {
    const parsed = parse(v3ProjectSchema, raw);
    return {
      ...parsed,
      name: normalizedName(parsed.name),
      updatedAt: normalizedUpdatedAt(parsed.updatedAt),
      data: {
        ...parsed.data,
        wallInput: normalizeWallInput(parsed.data.wallInput),
      },
    } as ProjectPayload;
  }

  if (version === 2) {
    const parsed = parse(v2ProjectSchema, raw);
    return {
      ...parsed,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      name: normalizedName(parsed.name),
      updatedAt: normalizedUpdatedAt(parsed.updatedAt),
      data: {
        ...parsed.data,
        wallInput: normalizeWallInput(parsed.data.wallInput),
      },
    } as ProjectPayload;
  }

  if (
    version === 1
    || (version === undefined && Object.hasOwn(envelope, 'wallInput') && Object.hasOwn(envelope, 'logistics'))
  ) {
    const parsed = parse(v1RetainingWallSchema, raw);
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      projectType: 'retaining-wall',
      name: normalizedName(parsed.name),
      updatedAt: normalizedUpdatedAt(parsed.updatedAt),
      data: {
        wallInput: normalizeWallInput(parsed.wallInput),
        logistics: parsed.logistics,
        customCoefficients: parsed.customCoefficients ?? {},
        concreteMix: parsed.concreteMix,
      },
    } as ProjectPayload;
  }

  invalid('schemaVersion', 'Tanınmayan proje dosyası biçimi.');
}
