import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RayTraceClient } from './rayTraceClient.ts';
import type { RayTraceWorkerRequest, RayTraceWorkerResponse } from './protocol.ts';
import type { RayPathResult, RayTraceParams } from '@core/domain/hfPropagation/types.ts';

class MockWorker {
  onmessage: ((event: MessageEvent<RayTraceWorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  posted: RayTraceWorkerRequest[] = [];
  terminated = false;

  postMessage(data: RayTraceWorkerRequest): void {
    this.posted.push(data);
  }

  terminate(): void {
    this.terminated = true;
  }

  respond(response: RayTraceWorkerResponse): void {
    this.onmessage?.({ data: response } as MessageEvent<RayTraceWorkerResponse>);
  }

  fail(message: string): void {
    this.onerror?.({ message } as ErrorEvent);
  }
}

const PARAMS: RayTraceParams = {
  frequencyMhz: 14,
  antenna: { family: 'omnidirectional-vertical', heightM: 8 },
  layers: [],
  azimuthDeg: 0,
  txLat: 51.5,
  txLon: -0.13,
  atMs: 0,
};

const RAY: RayPathResult = {
  mode: 'skywave',
  points: [{ lat: 51.5, lon: -0.13, altitudeKm: 0 }],
  takeoffAngleDeg: 15,
  relativeSignalStrength: 1,
};

describe('RayTraceClient', () => {
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

  it('resolves with rays when the worker responds with a matching requestId', async () => {
    const client = new RayTraceClient();
    const promise = client.requestRayTrace(PARAMS);

    expect(mockWorker.posted).toHaveLength(1);
    expect(mockWorker.posted[0]!.payload).toEqual(PARAMS);
    mockWorker.respond({ type: 'result', requestId: mockWorker.posted[0]!.requestId, rays: [RAY] });

    await expect(promise).resolves.toEqual([RAY]);
  });

  it('rejects when the worker responds with an error', async () => {
    const client = new RayTraceClient();
    const promise = client.requestRayTrace(PARAMS);

    mockWorker.respond({
      type: 'error',
      requestId: mockWorker.posted[0]!.requestId,
      message: 'traceRayFan failed',
    });

    await expect(promise).rejects.toThrow('traceRayFan failed');
  });

  it('correlates concurrent requests by id independently', async () => {
    const client = new RayTraceClient();
    const p1 = client.requestRayTrace(PARAMS);
    const p2 = client.requestRayTrace({ ...PARAMS, azimuthDeg: 90 });
    expect(mockWorker.posted).toHaveLength(2);
    expect(mockWorker.posted[0]!.requestId).not.toBe(mockWorker.posted[1]!.requestId);

    const otherRay: RayPathResult = { ...RAY, takeoffAngleDeg: 45 };
    mockWorker.respond({
      type: 'result',
      requestId: mockWorker.posted[1]!.requestId,
      rays: [otherRay],
    });
    mockWorker.respond({ type: 'result', requestId: mockWorker.posted[0]!.requestId, rays: [] });

    await expect(p2).resolves.toEqual([otherRay]);
    await expect(p1).resolves.toEqual([]);
  });

  it('reuses one worker instance across multiple requests', () => {
    const client = new RayTraceClient();
    void client.requestRayTrace(PARAMS);
    void client.requestRayTrace(PARAMS);
    expect(vi.mocked(Worker)).toHaveBeenCalledTimes(1);
  });

  it('rejects all pending requests when the worker errors', async () => {
    const client = new RayTraceClient();
    const p1 = client.requestRayTrace(PARAMS);
    const p2 = client.requestRayTrace(PARAMS);

    mockWorker.fail('worker crashed');

    await expect(p1).rejects.toThrow('worker crashed');
    await expect(p2).rejects.toThrow('worker crashed');
  });

  it('terminate() releases the worker so the next request creates a new one', () => {
    const client = new RayTraceClient();
    void client.requestRayTrace(PARAMS);
    client.terminate();
    expect(mockWorker.terminated).toBe(true);

    void client.requestRayTrace(PARAMS);
    expect(vi.mocked(Worker)).toHaveBeenCalledTimes(2);
  });
});
