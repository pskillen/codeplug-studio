/**
 * Test-only stand-in for the Android USB-serial plugin, in front of a scripted radio that answers synchronously (the
 * Mini's `FakeMiniRadio`, a `FakeD890Radio` session): each `write` hands the bytes to the radio and delivers whatever
 * it queued as `data` events, as the plugin's read stream does. It records what the pipe asked of the port (the
 * device opened, `setParameters`, DTR and RTS) and every frame written, so a test can check the line settings and
 * that no forbidden frame reached the port.
 */
import type { DataEvent, SerialDeviceInfo } from '@leeskies/capacitor-usb-serial';

import {
  base64ToUint8Array,
  uint8ArrayToBase64,
  type UsbSerialPluginLike,
} from '@integrations/radio-io/transport/capacitorSerialPipe.ts';
import type { BytePipe } from '@integrations/radio-io/types.ts';

/** A CH340 programming cable (the UV-5R Mini's). */
export const FAKE_CH340_DEVICE: SerialDeviceInfo = {
  deviceId: 'dev_ch340',
  vendorId: 0x1a86,
  productId: 0x7523,
  deviceName: '/dev/bus/usb/001/002',
  serialNumber: null,
  driverType: 'Ch34xSerialDriver',
  portCount: 1,
  hasPermission: true,
};

/** An ST CDC device (the AT-D890UV's own USB port). */
export const FAKE_ST_CDC_DEVICE: SerialDeviceInfo = {
  deviceId: 'dev_st_cdc',
  vendorId: 0x0483,
  productId: 0x5740,
  deviceName: '/dev/bus/usb/001/003',
  serialNumber: null,
  driverType: 'CdcAcmSerialDriver',
  portCount: 1,
  hasPermission: true,
};

export interface FakeUsbSerialRecord {
  opened: string[];
  parameters: { baudRate: number; dataBits?: number; stopBits?: number; parity?: string }[];
  dtr: boolean[];
  rts: boolean[];
  /** Every frame the plugin was asked to write, in order. */
  writes: Uint8Array[];
  closed: number;
}

export interface FakeUsbSerialPlugin extends UsbSerialPluginLike {
  readonly record: FakeUsbSerialRecord;
  /** Replace the radio behind the port (the next `open` uses it). */
  setRadio(radio: BytePipe): void;
}

/** Take every byte the scripted radio has queued (its `readExact` throws once it has fewer than asked). */
async function drain(radio: BytePipe): Promise<Uint8Array> {
  const out: number[] = [];
  for (;;) {
    try {
      out.push(...(await radio.readExact(1, 0)));
    } catch {
      return Uint8Array.from(out);
    }
  }
}

export function createFakeUsbSerialPlugin(input: {
  devices: SerialDeviceInfo[];
  radio: BytePipe;
}): FakeUsbSerialPlugin {
  const listeners: Array<(event: DataEvent) => void> = [];
  const record: FakeUsbSerialRecord = {
    opened: [],
    parameters: [],
    dtr: [],
    rts: [],
    writes: [],
    closed: 0,
  };
  let radio = input.radio;
  let portId: string | null = null;
  let n = 0;

  const addListener = (eventName: string, listener: (event: never) => void) => {
    const list = eventName === 'data' ? (listeners as Array<(event: never) => void>) : [];
    list.push(listener);
    return Promise.resolve({
      remove: async () => {
        const idx = list.indexOf(listener);
        if (idx >= 0) list.splice(idx, 1);
      },
    });
  };

  return {
    record,
    setRadio: (next) => {
      radio = next;
    },
    listDevices: async () => ({ devices: input.devices }),
    hasPermission: async () => ({ granted: true }),
    requestPermission: async () => ({ granted: true }),
    open: async ({ deviceId }) => {
      if (!input.devices.some((d) => d.deviceId === deviceId)) throw new Error('NO_DEVICE');
      if (portId) throw new Error('INVALID_STATE');
      record.opened.push(deviceId);
      portId = `port-${++n}`;
      return { portId };
    },
    setParameters: async (p) => {
      record.parameters.push({ ...p });
    },
    setDTR: async ({ value }) => {
      record.dtr.push(value);
    },
    setRTS: async ({ value }) => {
      record.rts.push(value);
    },
    addListener: addListener as UsbSerialPluginLike['addListener'],
    startReading: async () => undefined,
    stopReading: async () => undefined,
    write: async ({ portId: id, data }) => {
      if (id !== portId) throw new Error('PORT_NOT_OPEN');
      const bytes = base64ToUint8Array(data);
      record.writes.push(bytes);
      await radio.write(bytes);
      const reply = await drain(radio);
      if (reply.length > 0) {
        const event = { portId: id, data: uint8ArrayToBase64(reply) };
        for (const l of [...listeners]) l(event);
      }
      return { bytesWritten: bytes.length };
    },
    close: async () => {
      record.closed += 1;
      portId = null;
    },
  };
}
