/**
 * Test-only stand-in for the Android USB-serial plugin over the emulator bridge (`bridgeSerialPort.ts`), so the
 * Capacitor pipe can run the Mini's whole update against the emulated radio. It keeps the plugin's shapes and the
 * behaviour the pipe relies on:
 *
 * - `open` takes no rate: the port comes up at the CH340 driver's default, 9600.
 * - `setParameters` changes the rate on the open port (the bridge's `setBaud`): no close, and the read stream keeps
 *   running, so nothing is lost but what was on the wire at the switch.
 * - `startReading` starts a stream that delivers `data` events (base64); `write` resolves once the bytes are accepted.
 * - `setDTR` / `setRTS` are recorded as the bridge's `setSignals` calls.
 *
 * `setParametersDelayMs` adds a delay to every rate change, to show the loader's window holds a slow phone.
 */
import type { DataEvent, ErrorEvent, SerialDeviceInfo } from '@leeskies/capacitor-usb-serial';

import {
  base64ToUint8Array,
  uint8ArrayToBase64,
  type UsbSerialPluginLike,
} from '../../../../transport/capacitorSerialPipe.ts';
import type { BridgeSerialPort } from './bridgeSerialPort.ts';

/** The CH340 programming cable as the plugin lists it. */
export const BRIDGE_CH340_DEVICE: SerialDeviceInfo = {
  deviceId: 'dev_bridge_ch340',
  vendorId: 0x1a86,
  productId: 0x7523,
  deviceName: '/dev/bus/usb/001/002',
  serialNumber: null,
  driverType: 'Ch34xSerialDriver',
  portCount: 1,
  hasPermission: true,
};

/** The CH340 driver's rate after `open`, before any `setParameters`. */
const DRIVER_DEFAULT_BAUD = 9600;
const PORT_ID = 'bridge-port-0';

export function createBridgeCapacitorPlugin(
  bridge: BridgeSerialPort,
  options?: { setParametersDelayMs?: number },
): UsbSerialPluginLike {
  const dataListeners: Array<(event: DataEvent) => void> = [];
  const errorListeners: Array<(event: ErrorEvent) => void> = [];
  let open = false;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  let pump: Promise<void> | null = null;

  const requirePort = (portId: string) => {
    if (!open || portId !== PORT_ID) throw new Error('PORT_NOT_OPEN');
  };

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

  async function stopStream() {
    const r = reader;
    reader = null;
    try {
      await r?.cancel();
    } catch {
      /* ignore */
    }
    try {
      r?.releaseLock();
    } catch {
      /* ignore */
    }
    await pump?.catch(() => undefined);
    pump = null;
  }

  return {
    listDevices: async () => ({ devices: [BRIDGE_CH340_DEVICE] }),
    hasPermission: async () => ({ granted: true }),
    requestPermission: async () => ({ granted: true }),
    open: async ({ deviceId }) => {
      if (deviceId !== BRIDGE_CH340_DEVICE.deviceId) throw new Error('NO_DEVICE');
      if (open) throw new Error('INVALID_STATE');
      await bridge.port.open({ baudRate: DRIVER_DEFAULT_BAUD });
      open = true;
      return { portId: PORT_ID };
    },
    setParameters: async ({ portId, baudRate }) => {
      requirePort(portId);
      if (options?.setParametersDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, options.setParametersDelayMs));
      }
      await bridge.setBaud(baudRate);
    },
    setDTR: async ({ portId, value }) => {
      requirePort(portId);
      await bridge.port.setSignals?.({ dataTerminalReady: value });
    },
    setRTS: async ({ portId, value }) => {
      requirePort(portId);
      await bridge.port.setSignals?.({ requestToSend: value });
    },
    addListener: addListener as UsbSerialPluginLike['addListener'],
    startReading: async ({ portId }) => {
      requirePort(portId);
      const readable = bridge.port.readable;
      const writable = bridge.port.writable;
      if (!readable || !writable) throw new Error('IO_ERROR');
      const r = readable.getReader();
      reader = r;
      writer = writable.getWriter();
      pump = (async () => {
        try {
          for (;;) {
            const { value, done } = await r.read();
            if (done || reader !== r) return;
            if (value?.length) {
              const event = { portId: PORT_ID, data: uint8ArrayToBase64(value) };
              for (const l of [...dataListeners]) l(event);
            }
          }
        } catch (err) {
          if (reader !== r) return;
          const event = { portId: PORT_ID, message: String(err) };
          for (const l of [...errorListeners]) l(event);
        }
      })();
    },
    stopReading: async ({ portId }) => {
      requirePort(portId);
      await stopStream();
    },
    write: async ({ portId, data }) => {
      requirePort(portId);
      if (!writer) throw new Error('INVALID_STATE');
      const bytes = base64ToUint8Array(data);
      await writer.write(bytes);
      return { bytesWritten: bytes.length };
    },
    close: async ({ portId }) => {
      requirePort(portId);
      await stopStream();
      try {
        await writer?.close();
      } catch {
        /* ignore */
      }
      try {
        writer?.releaseLock();
      } catch {
        /* ignore */
      }
      writer = null;
      open = false;
      await bridge.port.close();
    },
  };
}
