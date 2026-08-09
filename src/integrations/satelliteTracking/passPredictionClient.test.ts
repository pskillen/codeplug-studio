import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PassPredictionClient } from './passPredictionClient.ts';
import type { PassPredictionWorkerRequest, PassPredictionWorkerResponse } from './protocol.ts';

class MockWorker {
  onmessage: ((event: MessageEvent<PassPredictionWorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  posted: PassPredictionWorkerRequest[] = [];
  terminated = false;

  postMessage(data: PassPredictionWorkerRequest): void {
    this.posted.push(data);
  }

  terminate(): void {
    this.terminated = true;
  }

  respond(response: PassPredictionWorkerResponse): void {
    this.onmessage?.({ data: response } as MessageEvent<PassPredictionWorkerResponse>);
  }

  fail(message: string): void {
    this.onerror?.({ message } as ErrorEvent);
  }
}

const OBSERVER = { latDeg: 0, lonDeg: 0 };
const WINDOW = { fromAt: '2024-01-01T00:00:00.000Z', toAt: '2024-01-01T01:00:00.000Z' };

describe('PassPredictionClient', () => {
  let mockWorker: MockWorker;

  beforeEach(() => {
    mockWorker = new MockWorker();
    vi.stubGlobal(
      'Worker',
      vi.fn(function MockWorkerConstructor() {
        return mockWorker;
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves with passes when the worker responds with a matching requestId', async () => {
    const client = new PassPredictionClient();
    const promise = client.requestPasses('L1', 'L2', OBSERVER, WINDOW);

    expect(mockWorker.posted).toHaveLength(1);
    mockWorker.respond({ type: 'result', requestId: mockWorker.posted[0]!.requestId, passes: [] });

    await expect(promise).resolves.toEqual([]);
  });

  it('rejects when the worker responds with an error', async () => {
    const client = new PassPredictionClient();
    const promise = client.requestPasses('L1', 'L2', OBSERVER, WINDOW);

    mockWorker.respond({
      type: 'error',
      requestId: mockWorker.posted[0]!.requestId,
      message: 'boom',
    });

    await expect(promise).rejects.toThrow('boom');
  });

  it('correlates concurrent requests by id independently', async () => {
    const client = new PassPredictionClient();
    const p1 = client.requestPasses('L1', 'L2', OBSERVER, WINDOW);
    const p2 = client.requestPasses('L1', 'L2', OBSERVER, WINDOW);
    expect(mockWorker.posted).toHaveLength(2);

    const onePass = [
      { aosAt: 'a', losAt: 'b', maxElevationAt: 'c', maxElevationDeg: 45, durationSec: 300 },
    ];
    mockWorker.respond({
      type: 'result',
      requestId: mockWorker.posted[1]!.requestId,
      passes: onePass,
    });
    mockWorker.respond({ type: 'result', requestId: mockWorker.posted[0]!.requestId, passes: [] });

    await expect(p2).resolves.toEqual(onePass);
    await expect(p1).resolves.toEqual([]);
  });

  it('reuses one worker instance across multiple requests', () => {
    const client = new PassPredictionClient();
    void client.requestPasses('L1', 'L2', OBSERVER, WINDOW);
    void client.requestPasses('L1', 'L2', OBSERVER, WINDOW);
    expect(vi.mocked(Worker)).toHaveBeenCalledTimes(1);
  });

  it('rejects all pending requests when the worker errors', async () => {
    const client = new PassPredictionClient();
    const p1 = client.requestPasses('L1', 'L2', OBSERVER, WINDOW);
    const p2 = client.requestPasses('L1', 'L2', OBSERVER, WINDOW);

    mockWorker.fail('worker crashed');

    await expect(p1).rejects.toThrow('worker crashed');
    await expect(p2).rejects.toThrow('worker crashed');
  });

  it('terminate() releases the worker so the next request creates a new one', () => {
    const client = new PassPredictionClient();
    void client.requestPasses('L1', 'L2', OBSERVER, WINDOW);
    client.terminate();
    expect(mockWorker.terminated).toBe(true);

    void client.requestPasses('L1', 'L2', OBSERVER, WINDOW);
    expect(vi.mocked(Worker)).toHaveBeenCalledTimes(2);
  });
});
