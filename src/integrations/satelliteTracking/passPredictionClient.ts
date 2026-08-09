import type {
  ObserverLocation,
  PassPredictionWindow,
  PassResult,
} from '@core/domain/satelliteTracking/types.ts';
import type { PassPredictionWorkerRequest, PassPredictionWorkerResponse } from './protocol.ts';

interface PendingRequest {
  resolve: (passes: PassResult[]) => void;
  reject: (error: Error) => void;
}

/**
 * Owns the SGP4 pass-prediction Web Worker and correlates request/response
 * pairs by id so concurrent calls don't cross-resolve. Lazily creates the
 * worker on first use; call `terminate()` when the tracking dashboard unmounts.
 */
export class PassPredictionClient {
  private worker: Worker | null = null;
  private nextRequestId = 1;
  private readonly pending = new Map<number, PendingRequest>();

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;

    const worker = new Worker(new URL('./passPredictionWorker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (event: MessageEvent<PassPredictionWorkerResponse>) => {
      const response = event.data;
      const pending = this.pending.get(response.requestId);
      if (!pending) return;
      this.pending.delete(response.requestId);
      if (response.type === 'result') {
        pending.resolve(response.passes);
      } else {
        pending.reject(new Error(response.message));
      }
    };
    worker.onerror = (event: ErrorEvent) => {
      for (const [id, pending] of this.pending) {
        pending.reject(new Error(event.message || 'Pass prediction worker error'));
        this.pending.delete(id);
      }
    };
    this.worker = worker;
    return worker;
  }

  requestPasses(
    tleLine1: string,
    tleLine2: string,
    observer: ObserverLocation,
    window: PassPredictionWindow,
  ): Promise<PassResult[]> {
    const worker = this.ensureWorker();
    const requestId = this.nextRequestId++;
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      const request: PassPredictionWorkerRequest = {
        type: 'compute',
        requestId,
        payload: { tleLine1, tleLine2, observer, window },
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

/** Shared client instance for the app — one worker for the whole tracking dashboard. */
export const passPredictionClient = new PassPredictionClient();
