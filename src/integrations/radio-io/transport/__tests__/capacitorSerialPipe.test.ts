import type {
  DataEvent,
  ErrorEvent,
  SerialDeviceInfo,
  SerialParameters,
  SetLineOptions,
  StartReadingOptions,
  WriteOptions,
} from '@leeskies/capacitor-usb-serial';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RadioClosedError, RadioProtocolError, RadioTimeoutError } from '../../kit/errors.ts';
import {
  base64ToUint8Array,
  CAPACITOR_DRAIN_MARGIN_MS,
  CAPACITOR_MAX_FRAME_BYTES,
  CAPACITOR_WRITE_BUFFER_SIZE,
  openCapacitorSerialPipe,
  requestCapacitorSerialPipe,
  requestCapacitorSerialPort,
  uint8ArrayToBase64,
  type UsbSerialPluginLike,
} from '../capacitorSerialPipe.ts';

const CH340: SerialDeviceInfo = {
  deviceId: 'dev_1_ab12',
  vendorId: 0x1a86,
  productId: 0x7523,
  deviceName: '/dev/bus/usb/001/002',
  serialNumber: null,
  driverType: 'Ch34xSerialDriver',
  portCount: 1,
  hasPermission: true,
};

const FTDI: SerialDeviceInfo = {
  deviceId: 'dev_2_cd34',
  vendorId: 0x0403,
  productId: 0x6001,
  deviceName: '/dev/bus/usb/001/003',
  serialNumber: null,
  driverType: 'FtdiSerialDriver',
  portCount: 1,
  hasPermission: true,
};

/**
 * A fake of the plugin, typed from the plugin's own definitions (`UsbSerialPluginLike` is a `Pick` of them), so a
 * drift in the plugin's API fails `tsc` here. Every call is logged in order.
 */
function createFakePlugin(devices: SerialDeviceInfo[] = [CH340]) {
  const calls: string[] = [];
  const dataListeners: Array<(event: DataEvent) => void> = [];
  const errorListeners: Array<(event: ErrorEvent) => void> = [];
  let nextPort = 0;

  function addListener(
    eventName: 'data' | 'error' | 'attached' | 'detached',
    listener: (event: never) => void,
  ) {
    calls.push(`addListener:${eventName}`);
    const list: Array<(event: never) => void> =
      eventName === 'data'
        ? (dataListeners as Array<(event: never) => void>)
        : eventName === 'error'
          ? (errorListeners as Array<(event: never) => void>)
          : [];
    list.push(listener);
    return Promise.resolve({
      remove: async () => {
        const idx = list.indexOf(listener);
        if (idx >= 0) list.splice(idx, 1);
      },
    });
  }

  const plugin = {
    listDevices: vi.fn(async () => {
      calls.push('listDevices');
      return { devices };
    }),
    hasPermission: vi.fn(async ({ deviceId }: { deviceId: string }) => {
      calls.push(`hasPermission:${deviceId}`);
      return { granted: true };
    }),
    requestPermission: vi.fn(async ({ deviceId }: { deviceId: string }) => {
      calls.push(`requestPermission:${deviceId}`);
      return { granted: true };
    }),
    open: vi.fn(async ({ deviceId }: { deviceId: string; portNum?: number }) => {
      calls.push(`open:${deviceId}`);
      nextPort += 1;
      return { portId: `port-${nextPort}` };
    }),
    setParameters: vi.fn(async (p: SerialParameters) => {
      calls.push(`setParameters:${p.baudRate}`);
    }),
    setDTR: vi.fn(async (o: SetLineOptions) => {
      calls.push(`setDTR:${o.value}`);
    }),
    setRTS: vi.fn(async (o: SetLineOptions) => {
      calls.push(`setRTS:${o.value}`);
    }),
    addListener: addListener as UsbSerialPluginLike['addListener'],
    startReading: vi.fn(async (o: StartReadingOptions) => {
      calls.push(`startReading:${o.writeBufferSize}`);
    }),
    stopReading: vi.fn(async () => {
      calls.push('stopReading');
    }),
    write: vi.fn(async (o: WriteOptions) => {
      calls.push(`write:${base64ToUint8Array(o.data).length}`);
      return { bytesWritten: base64ToUint8Array(o.data).length };
    }),
    close: vi.fn(async () => {
      calls.push('close');
    }),
  } satisfies UsbSerialPluginLike;

  return {
    plugin,
    calls,
    emitData(portId: string, bytes: Uint8Array) {
      for (const l of [...dataListeners]) l({ portId, data: uint8ArrayToBase64(bytes) });
    },
    emitError(portId: string, message: string) {
      for (const l of [...errorListeners]) l({ portId, message });
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
});

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
    const { plugin } = createFakePlugin();
    const device = await requestCapacitorSerialPort({ plugin });
    expect(device.deviceId).toBe(CH340.deviceId);
    expect(plugin.hasPermission).toHaveBeenCalledWith({ deviceId: CH340.deviceId });
  });

  it('requests permission if not granted and succeeds', async () => {
    const { plugin } = createFakePlugin();
    plugin.hasPermission.mockResolvedValueOnce({ granted: false });
    const device = await requestCapacitorSerialPort({ plugin });
    expect(device.deviceId).toBe(CH340.deviceId);
    expect(plugin.requestPermission).toHaveBeenCalledWith({ deviceId: CH340.deviceId });
  });

  it('throws RadioClosedError when user denies permission', async () => {
    const { plugin } = createFakePlugin();
    plugin.hasPermission.mockResolvedValueOnce({ granted: false });
    plugin.requestPermission.mockResolvedValueOnce({ granted: false });
    await expect(requestCapacitorSerialPort({ plugin })).rejects.toThrow(RadioClosedError);
  });

  it('throws RadioClosedError when no USB devices are connected', async () => {
    const { plugin } = createFakePlugin([]);
    await expect(requestCapacitorSerialPort({ plugin })).rejects.toThrow(RadioClosedError);
  });

  it('without filters takes the first device, as codeplug Read/Write always has', async () => {
    const { plugin } = createFakePlugin([FTDI, CH340]);
    const device = await requestCapacitorSerialPort({ plugin });
    expect(device.deviceId).toBe(FTDI.deviceId);
  });

  it('with filters picks the one matching device, wherever it is listed', async () => {
    const { plugin } = createFakePlugin([FTDI, CH340]);
    const device = await requestCapacitorSerialPort({
      plugin,
      usbFilters: [{ usbVendorId: 0x1a86, usbProductId: 0x7523 }],
    });
    expect(device.deviceId).toBe(CH340.deviceId);
    expect(plugin.hasPermission).toHaveBeenCalledWith({ deviceId: CH340.deviceId });
  });

  it('with filters refuses when nothing matches, and never falls back to the first device', async () => {
    const { plugin } = createFakePlugin([FTDI]);
    await expect(
      requestCapacitorSerialPort({
        plugin,
        usbFilters: [{ usbVendorId: 0x1a86, usbProductId: 0x7523 }],
      }),
    ).rejects.toThrow(/No matching programming cable/);
    expect(plugin.hasPermission).not.toHaveBeenCalled();
  });

  it('with filters refuses when more than one device matches', async () => {
    const second = { ...CH340, deviceId: 'dev_3_ef56' };
    const { plugin } = createFakePlugin([CH340, second]);
    await expect(
      requestCapacitorSerialPort({ plugin, usbFilters: [{ usbVendorId: 0x1a86 }] }),
    ).rejects.toThrow(/More than one programming cable/);
    expect(plugin.hasPermission).not.toHaveBeenCalled();
  });

  it('with an empty filter list still needs exactly one device', async () => {
    const { plugin } = createFakePlugin([FTDI, CH340]);
    await expect(requestCapacitorSerialPort({ plugin, usbFilters: [] })).rejects.toThrow(
      /More than one/,
    );
    const one = createFakePlugin([FTDI]);
    const device = await requestCapacitorSerialPort({ plugin: one.plugin, usbFilters: [] });
    expect(device.deviceId).toBe(FTDI.deviceId);
  });
});

describe('openCapacitorSerialPipe', () => {
  it('sets the requested rate (8N1) before it starts reading, then raises DTR/RTS by default', async () => {
    const { plugin, calls } = createFakePlugin();
    const pipe = await openCapacitorSerialPipe(CH340, 115200, { plugin });
    expect(pipe.baudRate).toBe(115200);
    expect(plugin.open).toHaveBeenCalledWith({ deviceId: CH340.deviceId, portNum: 0 });
    expect(plugin.setParameters).toHaveBeenCalledWith({
      portId: 'port-1',
      baudRate: 115200,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
    });
    expect(calls).toEqual([
      `open:${CH340.deviceId}`,
      'setParameters:115200',
      'setDTR:true',
      'setRTS:true',
      'addListener:data',
      'addListener:error',
      `startReading:${CAPACITOR_WRITE_BUFFER_SIZE}`,
    ]);
    await pipe.close();
  });

  it('drives DTR and RTS low with raiseDtrRts: false', async () => {
    const { plugin } = createFakePlugin();
    const pipe = await openCapacitorSerialPipe(CH340, 9600, { plugin, raiseDtrRts: false });
    expect(plugin.setDTR).toHaveBeenCalledWith({ portId: 'port-1', value: false });
    expect(plugin.setRTS).toHaveBeenCalledWith({ portId: 'port-1', value: false });
    expect(plugin.setDTR).not.toHaveBeenCalledWith(expect.objectContaining({ value: true }));
    expect(plugin.setRTS).not.toHaveBeenCalledWith(expect.objectContaining({ value: true }));
    await pipe.close();
  });

  it('surfaces a failed setParameters as RadioClosedError and closes the port without reading', async () => {
    const { plugin } = createFakePlugin();
    plugin.setParameters.mockRejectedValueOnce(new Error('IO_ERROR'));
    await expect(openCapacitorSerialPipe(CH340, 38400, { plugin })).rejects.toThrow(
      /could not be set to 38400 baud: IO_ERROR/,
    );
    expect(plugin.close).toHaveBeenCalledWith({ portId: 'port-1' });
    expect(plugin.startReading).not.toHaveBeenCalled();
  });
});

describe('CapacitorSerialBytePipe operation', () => {
  it('connects, writes, reads exact bytes, and closes cleanly', async () => {
    const { plugin, emitData } = createFakePlugin();
    const pipe = await requestCapacitorSerialPipe({ baudRate: 9600, plugin });

    const testBytes = new Uint8Array([0x01, 0x02, 0x03]);
    await pipe.write(testBytes);
    expect(plugin.write).toHaveBeenCalledWith({
      portId: 'port-1',
      data: uint8ArrayToBase64(testBytes),
    });

    const readPromise = pipe.readExact(4, 1000);
    emitData('port-1', new Uint8Array([0x10, 0x20]));
    emitData('port-1', new Uint8Array([0x30, 0x40]));
    expect(await readPromise).toEqual(new Uint8Array([0x10, 0x20, 0x30, 0x40]));

    await pipe.close();
    expect(plugin.stopReading).toHaveBeenCalledWith({ portId: 'port-1' });
    expect(plugin.close).toHaveBeenCalledWith({ portId: 'port-1' });
  });

  it('throws RadioTimeoutError when readExact times out', async () => {
    const { plugin } = createFakePlugin();
    const pipe = await requestCapacitorSerialPipe({ baudRate: 9600, plugin });
    await expect(pipe.readExact(5, 50)).rejects.toThrow(RadioTimeoutError);
    await pipe.close();
  });

  it('throws RadioClosedError when serial error or disconnect happens', async () => {
    const { plugin, emitError } = createFakePlugin();
    const pipe = await requestCapacitorSerialPipe({ baudRate: 9600, plugin });
    const readPromise = pipe.readExact(5, 1000);
    emitError('port-1', 'USB cable disconnected');
    await expect(readPromise).rejects.toThrow(RadioClosedError);
    await pipe.close();
  });

  it('keeps concurrent writes in call order: each reaches the plugin only after the one before resolved', async () => {
    const { plugin } = createFakePlugin();
    const pipe = await requestCapacitorSerialPipe({ baudRate: 115200, plugin });
    const order: number[] = [];
    let releaseFirst!: () => void;
    plugin.write
      .mockImplementationOnce(async (o) => {
        order.push(base64ToUint8Array(o.data)[0]!);
        await new Promise<void>((r) => (releaseFirst = r));
        return { bytesWritten: 1 };
      })
      .mockImplementation(async (o) => {
        order.push(base64ToUint8Array(o.data)[0]!);
        return { bytesWritten: 1 };
      });

    const a = pipe.write(Uint8Array.of(1));
    const b = pipe.write(Uint8Array.of(2));
    const c = pipe.write(Uint8Array.of(3));
    await vi.waitFor(() => expect(order).toEqual([1]));
    await new Promise((r) => setTimeout(r, 5));
    expect(order).toEqual([1]);
    releaseFirst();
    await Promise.all([a, b, c]);
    expect(order).toEqual([1, 2, 3]);
    await pipe.close();
  });

  it('counts txBytesWritten cumulatively, across a reopen', async () => {
    const { plugin } = createFakePlugin();
    const pipe = await requestCapacitorSerialPipe({ baudRate: 115200, plugin });
    expect(pipe.txBytesWritten).toBe(0);
    await pipe.write(new Uint8Array(10));
    await pipe.write(new Uint8Array(5));
    expect(pipe.txBytesWritten).toBe(15);
    await pipe.reopen(38400);
    await pipe.write(new Uint8Array(7));
    expect(pipe.txBytesWritten).toBe(22);
    await pipe.close();
  });

  it('refuses a frame over the write limit before sending anything', async () => {
    const { plugin } = createFakePlugin();
    const pipe = await requestCapacitorSerialPipe({ baudRate: 115200, plugin });
    await expect(pipe.write(new Uint8Array(CAPACITOR_MAX_FRAME_BYTES + 1))).rejects.toThrow(
      RadioProtocolError,
    );
    expect(plugin.write).not.toHaveBeenCalled();
    expect(pipe.txBytesWritten).toBe(0);
    // The largest frame Studio's outgoing guard allows (a 0x1000 slice plus 15 bytes of framing) fits.
    await pipe.write(new Uint8Array(0x1000 + 15));
    expect(plugin.write).toHaveBeenCalledTimes(1);
    await pipe.close();
  });

  it('holds a write back until the estimated backlog leaves room in the write buffer', async () => {
    vi.useFakeTimers();
    const { plugin } = createFakePlugin();
    const pipe = await requestCapacitorSerialPipe({ baudRate: 9600, plugin });
    await pipe.write(new Uint8Array(CAPACITOR_MAX_FRAME_BYTES)); // ~8.5 s of wire at 9600
    const second = pipe.write(new Uint8Array(1000));
    await vi.advanceTimersByTimeAsync(500);
    expect(plugin.write).toHaveBeenCalledTimes(1);
    // 1000 bytes must leave first: about 1.04 s at 9600.
    await vi.advanceTimersByTimeAsync(600);
    await second;
    expect(plugin.write).toHaveBeenCalledTimes(2);
    await pipe.close();
  });
});

describe('CapacitorSerialBytePipe.reopen', () => {
  it('waits for the written bytes to leave, then changes the rate on the open port (no close, no open)', async () => {
    vi.useFakeTimers();
    const { plugin, calls } = createFakePlugin();
    const pipe = await requestCapacitorSerialPipe({ baudRate: 9600, plugin, raiseDtrRts: false });
    await pipe.write(new Uint8Array(11)); // 11.46 ms of wire at 9600
    calls.length = 0;

    const done = pipe.reopen(38400);
    const drainMs = Math.ceil((11 * 10 * 1000) / 9600) + CAPACITOR_DRAIN_MARGIN_MS;
    await vi.advanceTimersByTimeAsync(drainMs - 2);
    expect(plugin.setParameters).toHaveBeenCalledTimes(1); // the open's only
    await vi.advanceTimersByTimeAsync(2);
    await done;

    expect(plugin.setParameters).toHaveBeenLastCalledWith({
      portId: 'port-1',
      baudRate: 38400,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
    });
    expect(calls).toEqual(['setParameters:38400', 'setDTR:false', 'setRTS:false']);
    expect(plugin.open).toHaveBeenCalledTimes(1);
    expect(plugin.close).not.toHaveBeenCalled();
    expect(plugin.stopReading).not.toHaveBeenCalled();
    expect(pipe.baudRate).toBe(38400);
    await pipe.close();
  });

  it('changes the rate at once when nothing was written', async () => {
    const { plugin } = createFakePlugin();
    const pipe = await requestCapacitorSerialPipe({ baudRate: 9600, plugin });
    await pipe.reopen(38400);
    expect(plugin.setParameters).toHaveBeenLastCalledWith(
      expect.objectContaining({ baudRate: 38400 }),
    );
    await pipe.close();
  });

  it('runs after a write still in flight, never before it', async () => {
    const { plugin, calls } = createFakePlugin();
    const pipe = await requestCapacitorSerialPipe({ baudRate: 115200, plugin });
    let release!: () => void;
    plugin.write.mockImplementationOnce(async () => {
      calls.push('write:pending');
      await new Promise<void>((r) => (release = r));
      calls.push('write:done');
      return { bytesWritten: 3 };
    });
    calls.length = 0;
    const w = pipe.write(Uint8Array.of(1, 2, 3));
    const r = pipe.reopen(38400);
    await vi.waitFor(() => expect(calls).toEqual(['write:pending']));
    await new Promise((res) => setTimeout(res, 5));
    expect(calls).toEqual(['write:pending']);
    release();
    await Promise.all([w, r]);
    expect(calls.indexOf('setParameters:38400')).toBeGreaterThan(calls.indexOf('write:done'));
    await pipe.close();
  });

  it('discards bytes read before the switch, and delivers bytes read after it', async () => {
    const { plugin, emitData } = createFakePlugin();
    const pipe = await requestCapacitorSerialPipe({ baudRate: 9600, plugin });
    emitData('port-1', Uint8Array.of(0xaa, 0x55));
    plugin.setParameters.mockImplementationOnce(async () => {
      // A byte caught mid-switch, delivered before setParameters resolves.
      emitData('port-1', Uint8Array.of(0xff));
    });
    await pipe.reopen(38400);
    emitData('port-1', Uint8Array.of(0x01, 0x02));
    expect(await pipe.readExact(2, 100)).toEqual(Uint8Array.of(0x01, 0x02));
    await pipe.close();
  });

  it('surfaces a failed setParameters as RadioClosedError and leaves the pipe unusable', async () => {
    const { plugin } = createFakePlugin();
    const pipe = await requestCapacitorSerialPipe({ baudRate: 9600, plugin });
    plugin.setParameters.mockRejectedValueOnce(new Error('IO_ERROR'));
    await expect(pipe.reopen(38400)).rejects.toThrow(/could not change to 38400 baud: IO_ERROR/);
    await expect(pipe.write(Uint8Array.of(1))).rejects.toThrow(RadioClosedError);
    await expect(pipe.readExact(1, 10)).rejects.toThrow(RadioClosedError);
    expect(pipe.baudRate).toBe(9600);
    await pipe.close();
    expect(plugin.close).toHaveBeenCalledTimes(1);
  });

  it('refuses on a closed pipe', async () => {
    const { plugin } = createFakePlugin();
    const pipe = await requestCapacitorSerialPipe({ baudRate: 9600, plugin });
    await pipe.close();
    await expect(pipe.reopen(38400)).rejects.toThrow(RadioClosedError);
  });

  it('keeps a port error that arrives during the drain: no rate change, and the pipe stays unusable', async () => {
    vi.useFakeTimers();
    const { plugin, emitError } = createFakePlugin();
    const pipe = await requestCapacitorSerialPipe({ baudRate: 9600, plugin });
    await pipe.write(new Uint8Array(11));

    const done = pipe.reopen(38400);
    const settled = expect(done).rejects.toThrow(/closed before it could change to 38400 baud/);
    emitError('port-1', 'USB cable disconnected');
    await vi.advanceTimersByTimeAsync(
      Math.ceil((11 * 10 * 1000) / 9600) + CAPACITOR_DRAIN_MARGIN_MS,
    );
    await settled;

    expect(plugin.setParameters).toHaveBeenCalledTimes(1); // the open's only
    expect(pipe.baudRate).toBe(9600);
    await expect(pipe.write(Uint8Array.of(1))).rejects.toThrow(RadioClosedError);
    await expect(pipe.readExact(1, 10)).rejects.toThrow(RadioClosedError);
    await pipe.close();
  });
});
