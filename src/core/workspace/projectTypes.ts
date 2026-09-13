import type { LogisticsInput, RetainingWallInput } from '@/retaining-wall/types';
import type { ConcreteMixDesign } from '@/retaining-wall/material-selection/types';
import type { SustainableConcreteData } from '@/retaining-wall/sustainable-concrete/types';

/** StructFlow now has a single project/workspace type. */
export type ProjectType = 'retaining-wall';

export const CURRENT_SCHEMA_VERSION = 3 as const;
export const SFL_EXTENSION = 'sfl';
export const SFL_MIME = 'application/x-sfl';

/** @deprecated Use SFL_EXTENSION. */
export const SFLOW_EXTENSION = SFL_EXTENSION;
/** @deprecated Use SFL_MIME. */
export const SFLOW_MIME = SFL_MIME;

export interface SflowMetadata {
  version: 3;
  units: 'm';
  appVersion: string;
  createdAt: string;
  updatedAt: string;
}

export interface RetainingWallProjectData {
  wallInput: RetainingWallInput;
  logistics: LogisticsInput;
  customCoefficients: Record<string, number>;
  concreteMix?: ConcreteMixDesign;
  sustainableConcrete?: SustainableConcreteData;
}

export interface ProjectPayload {
  schemaVersion: 2 | 3;
  projectType: 'retaining-wall';
  name: string;
  updatedAt: string;
  data: RetainingWallProjectData;
}

export type RetainingWallProjectPayload = ProjectPayload;

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  'retaining-wall': 'İstinat Duvarı',
};

export function isRetainingWallPayload(payload: ProjectPayload): payload is RetainingWallProjectPayload {
  return payload.projectType === 'retaining-wall';
}
