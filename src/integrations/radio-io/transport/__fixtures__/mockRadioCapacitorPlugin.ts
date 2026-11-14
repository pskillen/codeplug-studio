/**
 * Test-only stand-in for the Android USB-serial plugin, backed by any radio mock that implements `BytePipe` (the
 * DM-32UV, RT95 and AT-D890UV bootloader mocks), so an updater runs end to end through the real `CapacitorSerialBytePipe`
 * offline. Modelled on the UV-5R Mini's emulator-bridge plugin; this one needs no emulator.
 *
 * - `listDevices` lists one cable (`device`, a CH340 by default); permission is granted.
 * - `open` takes no rate; `setParameters` records the rate (the mocks run at one rate, so nothing else changes).
 * - `write` hands the bytes to the mock and resolves once accepted. The mock's reply is then pulled from it (its
 *   pending bytes, read one at a time until it has none) and delivered as `data` events of at most `chunkBytes`,
 *   in write order, each after `eventDelayMs` (0: on the next microtask, after `write` has resolved).
 * - `cutAfterWrites: n`: the cable is pulled after the n-th write. That write's reply is never delivered, an `error`
 *   event fires (as the plugin does on a lost device) and every later call is refused.
 * - `setDTR` / `setRTS` are recorded.
 */
import type { DataEvent, ErrorEvent, SerialDeviceInfo } from '@leeskies/capacitor-usb-serial';

import type { BytePipe } from '../../types.ts';
import {
  base64ToUint8Array,
  uint8ArrayToBase64,
  type UsbSerialPluginLike,
} from '../capacitorSerialPipe.ts';

/** A CH340 programming cable as the plugin lists it. */
export const MOCK_CH340_DEVICE: SerialDeviceInfo = {
  deviceId: 'dev_mock_ch340',
  vendorId: 0x1a86,
  productId: 0x7523,
  deviceName: '/dev/bus/usb/001/003',
  serialNumber: null,
  driverType: 'Ch34xSerialDriver',
  portCount: 1,
  hasPermission: true,
};

/** A Prolific PL2303GC cable as the plugin lists it. */
export const MOCK_PL2303GC_DEVICE: SerialDeviceInfo = {
  deviceId: 'dev_mock_pl2303gc',
  vendorId: 0x067b,
  productId: 0x23a3,
  deviceName: '/dev/bus/usb/001/004',
  serialNumber: null,
  driverType: 'ProlificSerialDriver',
  portCount: 1,
  hasPermission: true,
};

/** The AT-D890UV itself (ST's CDC/ACM virtual COM port) as the plugin lists it. */
export const MOCK_ST_CDC_DEVICE: SerialDeviceInfo = {
  deviceId: 'dev_mock_st_cdc',
  vendorId: 0x0483,
  productId: 0x5740,
  deviceName: '/dev/bus/usb/001/005',
  serialNumber: null,
  driverType: 'CdcAcmSerialDriver',
  portCount: 1,
  hasPermission: true,
};

const PORT_ID = 'mock-port-0';

export interface MockRadioCapacitorPluginOptions {
  /** The cable listed. Default {@link MOCK_CH340_DEVICE}. */
  readonly device?: SerialDeviceInfo;
  /** Delay before each `data` event, in ms. Default 0. */
  readonly eventDelayMs?: number;
  /** Largest `data` event, in bytes. Default 64 (a full-speed USB packet). */
  readonly chunkBytes?: number;
  /** Pull the cable after this many writes. */
  readonly cutAfterWrites?: number;
}

/** What the fake plugin saw, for assertions. */
export interface MockRadioCapacitorPluginRecord {
  readonly baudRates: number[];
  readonly signals: Array<{ line: 'dtr' | 'rts'; value: boolean }>;
  /** Writes handed to the mock (none after a cut). */
  writes: number;
  /** `data` events delivered. */
  events: number;
  cut: boolean;
  closed: boolean;
}

/** Everything the mock has pending: `readExact(1)` until it has nothing (the mocks never wait). */
async function takePending(radio: BytePipe): Promise<number[]> {
  const out: number[] = [];
  for (;;) {
    try {
      out.push((await radio.readExact(1, 0))[0]!);
    } catch {
      return out;
    }
  }
}

export function createMockRadioCapacitorPlugin(
  radio: BytePipe,
  options: MockRadioCapacitorPluginOptions = {},
): { plugin: UsbSerialPluginLike; record: MockRadioCapacitorPluginRecord } {
  const device = options.device ?? MOCK_CH340_DEVICE;
  const eventDelayMs = options.eventDelayMs ?? 0;
  const chunkBytes = options.chunkBytes ?? 64;
  const dataListeners: Array<(event: DataEvent) => void> = [];
  const errorListeners: Array<(event: ErrorEvent) => void> = [];
  const record: MockRadioCapacitorPluginRecord = {
    baudRates: [],
    signals: [],
    writes: 0,
    events: 0,
    cut: false,
    closed: false,
  };
  let open = false;
  let reading = false;
  /** Deliveries run one after another, so events keep write order whatever the delay. */
  let deliveries: Promise<void> = Promise.resolve();

  const requirePort = (portId: string) => {
    if (record.cut) throw new Error('IO_ERROR');
    if (!open || portId !== PORT_ID) throw new Error('PORT_NOT_OPEN');
  };

  const later = (ms: number) =>
    ms > 0
      ? new Promise<void>((resolve) => setTimeout(resolve, ms))
      : new Promise<void>((resolve) => queueMicrotask(resolve));

  function deliver(bytes: number[]): void {
    for (let i = 0; i < bytes.length; i += chunkBytes) {
      const chunk = Uint8Array.from(bytes.slice(i, i + chunkBytes));
      deliveries = deliveries.then(async () => {
        await later(eventDelayMs);
        if (!reading || record.cut) return;
        record.events += 1;
        const event = { portId: PORT_ID, data: uint8ArrayToBase64(chunk) };
        for (const l of [...dataListeners]) l(event);
      });
    }
  }

  function addListener(
    eventName: 'data' | 'error' | 'attached' | 'detached',
    listener: (event: never) => void,
  ) {
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

  const plugin: UsbSerialPluginLike = {
    listDevices: async () => ({ devices: [device] }),
    hasPermission: async () => ({ granted: true }),
    requestPermission: async () => ({ granted: true }),
    open: async ({ deviceId }) => {
      if (deviceId !== device.deviceId) throw new Error('NO_DEVICE');
      if (open) throw new Error('INVALID_STATE');
      open = true;
      return { portId: PORT_ID };
    },
    setParameters: async ({ portId, baudRate }) => {
      requirePort(portId);
      record.baudRates.push(baudRate);
    },
    setDTR: async ({ portId, value }) => {
      requirePort(portId);
      record.signals.push({ line: 'dtr', value });
    },
    setRTS: async ({ portId, value }) => {
      requirePort(portId);
      record.signals.push({ line: 'rts', value });
    },
    addListener: addListener as UsbSerialPluginLike['addListener'],
    startReading: async ({ portId }) => {
      requirePort(portId);
      reading = true;
    },
    stopReading: async ({ portId }) => {
      requirePort(portId);
      reading = false;
    },
    write: async ({ portId, data }) => {
      requirePort(portId);
      const bytes = base64ToUint8Array(data);
      await radio.write(bytes);
      record.writes += 1;
      if (options.cutAfterWrites !== undefined && record.writes >= options.cutAfterWrites) {
        record.cut = true;
        queueMicrotask(() => {
          const event = { portId: PORT_ID, message: 'USB device detached' };
          for (const l of [...errorListeners]) l(event);
        });
        return { bytesWritten: bytes.length };
      }
      deliver(await takePending(radio));
      return { bytesWritten: bytes.length };
    },
    close: async ({ portId }) => {
      if (portId !== PORT_ID) throw new Error('PORT_NOT_OPEN');
      open = false;
      reading = false;
      record.closed = true;
      await radio.close();
    },
  };
  return { plugin, record };
}
