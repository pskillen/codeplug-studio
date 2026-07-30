import { describe, expect, it, vi } from 'vitest';
import { RadioClosedError, RadioTimeoutError } from '../../kit/errors.ts';
import {
  base64ToUint8Array,
  requestCapacitorSerialPipe,
  requestCapacitorSerialPort,
  uint8ArrayToBase64,
  type UsbDeviceLike,
  type UsbSerialPluginLike,
} from '../capacitorSerialPipe.ts';

function createMockPlugin(): UsbSerialPluginLike & {
  emitData: (portId: string, base64: string) => void;
  emitError: (portId: string, errorMsg: string) => void;
  dataListeners: Array<(event: { portId: string; data: string }) => void>;
  errorListeners: Array<(event: { portId: string; error: string }) => void>;
} {
  const devices: UsbDeviceLike[] = [
    {
      deviceId: 101,
      vendorId: 0x1a86,
      productId: 0x7523,
      deviceName: 'CH340 Serial',
    },
  ];

  const hasPerm = true;
  const requestPermResult = true;

  const dataListeners: Array<(event: { portId: string; data: string }) => void> = [];
  const errorListeners: Array<(event: { portId: string; error: string }) => void> = [];

  return {
    dataListeners,
    errorListeners,
    listDevices: vi.fn(async () => ({ devices })),
    hasPermission: vi.fn(async () => ({ granted: hasPerm })),
    requestPermission: vi.fn(async () => ({ granted: requestPermResult })),
    open: vi.fn(async ({ deviceId }) => ({ portId: `port-${deviceId}` })),
    addListener: vi.fn(
      async (
        eventName: 'data' | 'error',
        listener:
          | ((data: { portId: string; data: string }) => void)
          | ((error: { portId: string; error: string }) => void),
      ) => {
        if (eventName === 'data') {
          dataListeners.push(listener as (data: { portId: string; data: string }) => void);
        } else if (eventName === 'error') {
          errorListeners.push(listener as (error: { portId: string; error: string }) => void);
        }
        return {
          remove: async () => {
            if (eventName === 'data') {
              const idx = dataListeners.indexOf(
                listener as (data: { portId: string; data: string }) => void,
              );
              if (idx >= 0) dataListeners.splice(idx, 1);
            } else if (eventName === 'error') {
              const idx = errorListeners.indexOf(
                listener as (error: { portId: string; error: string }) => void,
              );
              if (idx >= 0) errorListeners.splice(idx, 1);
            }
          },
        };
      },
    ),
    startReading: vi.fn(async () => {}),
    stopReading: vi.fn(async () => {}),
    write: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    emitData(portId: string, base64: string) {
      for (const listener of [...dataListeners]) {
        listener({ portId, data: base64 });
      }
    },
    emitError(portId: string, errorMsg: string) {
      for (const listener of [...errorListeners]) {
        listener({ portId, error: errorMsg });
      }
    },
  };
}

describe('CapacitorSerialBytePipe base64 helpers', () => {
  it('encodes and decodes binary data correctly', () => {
    const raw = new Uint8Array([0x00, 0x01, 0x55, 0xaa, 0xff, 0x0d, 0x0a]);
    const b64 = uint8ArrayToBase64(raw);
    const decoded = base64ToUint8Array(b64);
    expect(decoded).toEqual(raw);
  });

  it('handles empty arrays', () => {
    const empty = new Uint8Array(0);
    const b64 = uint8ArrayToBase64(empty);
    expect(b64).toBe('');
    expect(base64ToUint8Array(b64)).toEqual(empty);
  });
});

describe('requestCapacitorSerialPort', () => {
  it('returns device when permission is already granted', async () => {
    const plugin = createMockPlugin();
    const device = await requestCapacitorSerialPort({ plugin });
    expect(device.deviceId).toBe(101);
    expect(plugin.hasPermission).toHaveBeenCalledWith({ deviceId: 101 });
  });

  it('requests permission if not granted and succeeds', async () => {
    const plugin = createMockPlugin();
    plugin.hasPermission = vi.fn(async () => ({ granted: false }));
    plugin.requestPermission = vi.fn(async () => ({ granted: true }));

    const device = await requestCapacitorSerialPort({ plugin });
    expect(device.deviceId).toBe(101);
    expect(plugin.requestPermission).toHaveBeenCalledWith({ deviceId: 101 });
  });

  it('throws RadioClosedError when user denies permission', async () => {
    const plugin = createMockPlugin();
    plugin.hasPermission = vi.fn(async () => ({ granted: false }));
    plugin.requestPermission = vi.fn(async () => ({ granted: false }));

    await expect(requestCapacitorSerialPort({ plugin })).rejects.toThrow(RadioClosedError);
  });

  it('throws RadioClosedError when no USB devices are connected', async () => {
    const plugin = createMockPlugin();
    plugin.listDevices = vi.fn(async () => ({ devices: [] }));

    await expect(requestCapacitorSerialPort({ plugin })).rejects.toThrow(RadioClosedError);
  });
});

describe('CapacitorSerialBytePipe operation', () => {
  it('connects, writes, reads exact bytes, and closes cleanly', async () => {
    const plugin = createMockPlugin();
    const pipe = await requestCapacitorSerialPipe({ baudRate: 9600, plugin });

    expect(pipe.baudRate).toBe(9600);
    expect(plugin.open).toHaveBeenCalledWith({
      deviceId: 101,
      portIndex: 0,
      baudRate: 9600,
    });
    expect(plugin.startReading).toHaveBeenCalled();

    // Test write
    const testBytes = new Uint8Array([0x01, 0x02, 0x03]);
    await pipe.write(testBytes);
    expect(plugin.write).toHaveBeenCalledWith({
      portId: 'port-101',
      data: uint8ArrayToBase64(testBytes),
    });

    // Test readExact with async data arrival
    const readPromise = pipe.readExact(4, 1000);

    // Emit 2 bytes then 2 bytes
    plugin.emitData('port-101', uint8ArrayToBase64(new Uint8Array([0x10, 0x20])));
    plugin.emitData('port-101', uint8ArrayToBase64(new Uint8Array([0x30, 0x40])));

    const result = await readPromise;
    expect(result).toEqual(new Uint8Array([0x10, 0x20, 0x30, 0x40]));

    // Close pipe
    await pipe.close();
    expect(plugin.stopReading).toHaveBeenCalledWith({ portId: 'port-101' });
    expect(plugin.close).toHaveBeenCalledWith({ portId: 'port-101' });
  });

  it('throws RadioTimeoutError when readExact times out', async () => {
    const plugin = createMockPlugin();
    const pipe = await requestCapacitorSerialPipe({ baudRate: 9600, plugin });

    await expect(pipe.readExact(5, 50)).rejects.toThrow(RadioTimeoutError);
    await pipe.close();
  });

  it('throws RadioClosedError when serial error or disconnect happens', async () => {
    const plugin = createMockPlugin();
    const pipe = await requestCapacitorSerialPipe({ baudRate: 9600, plugin });

    const readPromise = pipe.readExact(5, 1000);
    plugin.emitError('port-101', 'USB cable disconnected');

    await expect(readPromise).rejects.toThrow(RadioClosedError);
    await pipe.close();
  });
});
