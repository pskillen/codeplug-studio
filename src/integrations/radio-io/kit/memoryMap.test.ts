import { describe, expect, it, vi } from 'vitest';
import { createMemoryMap, memoryMapFromBytes, memoryMapToBytes } from './memoryMap.ts';
import { RadioAbortedError } from './errors.ts';
import { assertNotAborted, reportProgress, throwIfAborted } from './progress.ts';
import { clearCachedImage, createRadioSession, setCachedImage } from './session.ts';
import type { BytePipe, CloneImageRadio, RadioDescriptor } from '../types.ts';

describe('MemoryMap', () => {
  it('creates a zero-filled buffer of the requested size', () => {
    const map = createMemoryMap(8);
    expect(map.size).toBe(8);
    expect([...map.bytes]).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('get/set/fill round-trip within bounds', () => {
    const map = createMemoryMap(16);
    map.set(2, new Uint8Array([0xaa, 0xbb, 0xcc]));
    expect(map.get(2, 3)).toEqual(new Uint8Array([0xaa, 0xbb, 0xcc]));
    map.fill(4, 2, 0xff);
    expect(map.get(2, 4)).toEqual(new Uint8Array([0xaa, 0xbb, 0xff, 0xff]));
  });

  it('fromBytes copies so later mutations stay isolated', () => {
    const src = new Uint8Array([1, 2, 3]);
    const map = memoryMapFromBytes(src);
    src[0] = 9;
    expect(map.get(0, 1)).toEqual(new Uint8Array([1]));
    map.set(1, new Uint8Array([7]));
    expect(memoryMapToBytes(map)).toEqual(new Uint8Array([1, 7, 3]));
  });

  it('rejects out-of-range access', () => {
    const map = createMemoryMap(4);
    expect(() => map.get(2, 3)).toThrow(RangeError);
    expect(() => map.set(3, new Uint8Array([1, 2]))).toThrow(RangeError);
    expect(() => map.fill(-1, 1, 0)).toThrow(RangeError);
    expect(() => createMemoryMap(-1)).toThrow(RangeError);
  });
});

describe('progress', () => {
  it('reportProgress invokes the callback', () => {
    const onProgress = vi.fn();
    reportProgress(onProgress, { cur: 1, max: 10, msg: 'reading' });
    expect(onProgress).toHaveBeenCalledWith({ cur: 1, max: 10, msg: 'reading' });
  });

  it('throws RadioAbortedError when signal is aborted', () => {
    const signal = AbortSignal.abort();
    expect(() => assertNotAborted(signal)).toThrow(RadioAbortedError);
    expect(() => throwIfAborted(signal)).toThrow(RadioAbortedError);
    expect(() => reportProgress(undefined, { cur: 0, max: 1, msg: 'x' }, signal)).toThrow(
      RadioAbortedError,
    );
  });
});

describe('session', () => {
  const pipe = {
    write: async () => {},
    readExact: async () => new Uint8Array(),
    close: async () => {},
  } satisfies BytePipe;

  const radio = {
    connect: async () => ({ raw: new Uint8Array() }),
    disconnect: async () => {},
    download: async () => createMemoryMap(0),
    upload: async () => {},
    decodeChannels: () => [],
    encodeChannels: (image) => image,
    readFirmware: () => undefined,
  } satisfies CloneImageRadio;

  const descriptor: RadioDescriptor = {
    modelIds: ['test'],
    label: 'Test',
    supportsBle: false,
    protocolFactory: () => radio,
    capabilities: {
      maxChannels: 1,
      supportsZones: false,
      supportsScanLists: false,
      analogOnly: true,
    },
    attributionIds: [],
    compatibleProfiles: [],
    writeStrategy: 'full-image',
    hydrationRequiredForWrite: true,
    baudRate: 9600,
  };

  it('createRadioSession stores inputs and supports image cache helpers', () => {
    const session = createRadioSession({ descriptor, pipe, radio });
    expect(session.cachedImage).toBeUndefined();
    const image = createMemoryMap(4);
    setCachedImage(session, image);
    expect(session.cachedImage).toBe(image);
    clearCachedImage(session);
    expect(session.cachedImage).toBeUndefined();
  });
});
