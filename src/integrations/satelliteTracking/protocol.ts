import type {
  ObserverLocation,
  PassPredictionWindow,
  PassResult,
} from '@core/domain/satelliteTracking/types.ts';

export interface PassPredictionRequestPayload {
  tleLine1: string;
  tleLine2: string;
  observer: ObserverLocation;
  window: PassPredictionWindow;
}

export interface PassPredictionWorkerRequest {
  type: 'compute';
  requestId: number;
  payload: PassPredictionRequestPayload;
}

export type PassPredictionWorkerResponse =
  | { type: 'result'; requestId: number; passes: PassResult[] }
  | { type: 'error'; requestId: number; message: string };
