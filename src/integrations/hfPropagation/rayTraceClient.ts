import type { RayPathResult, RayTraceParams } from '@core/domain/hfPropagation/types.ts';
import type { RayTraceWorkerRequest, RayTraceWorkerResponse } from './protocol.ts';

interface PendingRequest {
  resolve: (rays: RayPathResult[]) => void;
  reject: (error: Error) => void;
}

/**
 * Owns the ray-trace Web Worker and correlates request/response pairs by id so
 * concurrent calls don't cross-resolve. Lazily creates the worker on first use;
 * call `terminate()` when the visualiser unmounts.
 */
export class RayTraceClient {
  private worker: Worker | null = null;
  private nextRequestId = 1;
  private readonly pending = new Map<number, PendingRequest>();

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;

    const worker = new Worker(new URL('./rayTraceWorker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (event: MessageEvent<RayTraceWorkerResponse>) => {
      const response = event.data;
      const pending = this.pending.get(response.requestId);
      if (!pending) return;
      this.pending.delete(response.requestId);
      if (response.type === 'result') {
        pending.resolve(response.rays);
      } else {
        pending.reject(new Error(response.message));
      }
    };
    worker.onerror = (event: ErrorEvent) => {
      for (const [id, pending] of this.pending) {
        pending.reject(new Error(event.message || 'Ray-trace worker error'));
        this.pending.delete(id);
      }
    };
    this.worker = worker;
    return worker;
  }

  requestRayTrace(params: RayTraceParams): Promise<RayPathResult[]> {
    const worker = this.ensureWorker();
    const requestId = this.nextRequestId++;
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      const request: RayTraceWorkerRequest = {
        type: 'compute',
        requestId,
        payload: params,
      };
      worker.postMessage(request);
    });
  }

  /** Release the worker thread. Safe to call even if never started. */
  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
    this.pending.clear();
  }
}

/** Shared client instance for the app — one worker for the whole visualiser. */
export const rayTraceClient = new RayTraceClient();
