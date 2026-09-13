import {
  DEFAULT_WALL_INPUT,
  DEFAULT_LOGISTICS,
  useRetainingWallStore,
} from './store/useRetainingWallStore';
import type { RetainingWallState } from './store/useRetainingWallStore';
import { createDefaultConcreteMix } from './material-selection/mixModel';
import { createDefaultSustainableConcreteData } from './sustainable-concrete/defaults';

export { default as RetainingWallInputPanel } from './components/EngineeringInputPanel';
export { default as RetainingWallCanvasPanel } from './components/CanvasPanel';
export { default as RetainingWallResultsPanel } from './components/EngineeringResultsPanel';
export { default as RetainingWallWorkspace } from './components/RetainingWallWorkspace';
export { useRetainingWallStore, DEFAULT_WALL_INPUT, DEFAULT_LOGISTICS };
export type { RetainingWallState };
export { exportConcreteMixJson, toVrConcreteMixPayload } from './material-selection/mixModel';
export type { ConcreteMixDesign, VrConcreteMixPayload } from './material-selection/types';
export { calculateZeroWasteImpact } from './material-selection/zeroWasteImpact';
export type { ZeroWasteImpactResult } from './material-selection/zeroWasteImpact';
export * from './sustainable-concrete';

export function createDefaultRetainingWallData() {
  return {
    wallInput: JSON.parse(JSON.stringify(DEFAULT_WALL_INPUT)),
    logistics: JSON.parse(JSON.stringify(DEFAULT_LOGISTICS)),
    customCoefficients: {} as Record<string, number>,
    concreteMix: createDefaultConcreteMix(DEFAULT_WALL_INPUT.concreteClass),
    sustainableConcrete: createDefaultSustainableConcreteData(),
  };
}
