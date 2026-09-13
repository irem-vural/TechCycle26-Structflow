import type { LogisticsInput, RetainingWallInput } from '@/retaining-wall/types';
import { CURRENT_SCHEMA_VERSION, type ProjectPayload } from './projectTypes';
import { parseAndMigrateProject } from './projectSchemas';

export { ProjectDecodeError, isProjectDecodeError } from './projectDecodeError';

export function normalizeProjectPayload(raw: unknown): ProjectPayload {
  return parseAndMigrateProject(raw);
}

/** Retaining-wall payloads are already safe for persistence. */
export function sanitizeProjectPayloadForWrite(payload: ProjectPayload): ProjectPayload {
  return payload;
}

export function createEmptyPayload(
  name: string,
  defaults: () => {
    wallInput: RetainingWallInput;
    logistics: LogisticsInput;
    customCoefficients: Record<string, number>;
  },
): ProjectPayload {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    projectType: 'retaining-wall',
    name,
    updatedAt: new Date().toISOString(),
    data: defaults(),
  };
}
