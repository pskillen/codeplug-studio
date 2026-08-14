/// <reference lib="webworker" />
import { traceRayFan } from '@core/domain/hfPropagation/rayTrace.ts';
import type { RayTraceWorkerRequest, RayTraceWorkerResponse } from './protocol.ts';

self.onmessage = (event: MessageEvent<RayTraceWorkerRequest>) => {
  const { requestId, payload } = event.data;
  try {
    const rays = traceRayFan(payload);
    const response: RayTraceWorkerResponse = { type: 'result', requestId, rays };
    self.postMessage(response);
  } catch (err) {
    const response: RayTraceWorkerResponse = {
      type: 'error',
      requestId,
      message: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(response);
  }
};
