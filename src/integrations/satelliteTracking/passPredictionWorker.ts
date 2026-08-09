/// <reference lib="webworker" />
import { computePassesForSatellite } from '@core/domain/satelliteTracking/passPrediction.ts';
import type { PassPredictionWorkerRequest, PassPredictionWorkerResponse } from './protocol.ts';

self.onmessage = (event: MessageEvent<PassPredictionWorkerRequest>) => {
  const { requestId, payload } = event.data;
  try {
    const passes = computePassesForSatellite(
      payload.tleLine1,
      payload.tleLine2,
      payload.observer,
      payload.window,
    );
    const response: PassPredictionWorkerResponse = { type: 'result', requestId, passes };
    self.postMessage(response);
  } catch (err) {
    const response: PassPredictionWorkerResponse = {
      type: 'error',
      requestId,
      message: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(response);
  }
};
