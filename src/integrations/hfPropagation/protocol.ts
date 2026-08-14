import type { RayPathResult, RayTraceParams } from '@core/domain/hfPropagation/types.ts';

export interface RayTraceWorkerRequest {
  type: 'compute';
  requestId: number;
  payload: RayTraceParams;
}

export type RayTraceWorkerResponse =
  | { type: 'result'; requestId: number; rays: RayPathResult[] }
  | { type: 'error'; requestId: number; message: string };
