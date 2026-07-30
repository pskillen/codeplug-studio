/**
 * Capacitor USB-Serial BytePipe — OTG port request/open, buffered readExact/write/close.
 * No radio handshake or memory layout (architecture §1 / #615).
 *
 * Uses @leeskies/capacitor-usb-serial on Capacitor native Android shells.
 */

import { UsbSerial } from '@leeskies/capacitor-usb-serial';
import type { BytePipe } from '../types.ts';
import { RadioClosedError, RadioTimeoutError } from '../kit/errors.ts';

export interface UsbDeviceLike {
  deviceId: number;
  vendorId?: number;
  productId?: number;
  deviceName?: string;
  manufacturerName?: string;
  productName?: string;
  portCount?: number;
}

export interface PluginListenerHandleLike {
  remove: () => Promise<void>;
}

export interface UsbSerialPluginLike {
  listDevices(): Promise<{ devices: UsbDeviceLike[] }>;
  hasPermission(options: { deviceId: number }): Promise<{ granted: boolean }>;
  requestPermission(options: { deviceId: number }): Promise<{ granted: boolean }>;
  open(options: {
    deviceId: number;
    portIndex?: number;
    baudRate: number;
    dataBits?: number;
    stopBits?: number;
    parity?: string;
  }): Promise<{ portId: string }>;
  addListener(
    eventName: 'data',
    listenerFunc: (data: { portId: string; data: string }) => void,
  ): Promise<PluginListenerHandleLike>;
  addListener(
    eventName: 'error',
    listenerFunc: (error: { portId: string; error: string; code?: string }) => void,
  ): Promise<PluginListenerHandleLike>;
  startReading(options: { portId: string }): Promise<void>;
  stopReading(options: { portId: string }): Promise<void>;
  write(options: { portId: string; data: string }): Promise<void>;
  close(options: { portId: string }): Promise<void>;
}

export interface CapacitorSerialPipeOptions {
  baudRate: number;
  deviceId?: number;
  portIndex?: number;
  /** Custom plugin implementation for unit testing or dependency injection. */
  plugin?: UsbSerialPluginLike;
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export class CapacitorSerialBytePipe implements BytePipe {
  readonly baudRate: number;
  private portId: string | null = null;
  private plugin: UsbSerialPluginLike;
  private dataListenerHandle: PluginListenerHandleLike | null = null;
  private errorListenerHandle: PluginListenerHandleLike | null = null;
  private buf = new Uint8Array(0);
  private closed = false;
  private eof = false;
  private waiters: Array<() => void> = [];

  constructor(baudRate: number, plugin?: UsbSerialPluginLike) {
    this.baudRate = baudRate;
    this.plugin = plugin ?? (UsbSerial as unknown as UsbSerialPluginLike);
  }

  async attachPort(portId: string): Promise<void> {
    this.portId = portId;
    this.buf = new Uint8Array(0);
    this.closed = false;
    this.eof = false;

    this.dataListenerHandle = await this.plugin.addListener('data', (event) => {
      if (event.portId === this.portId && event.data) {
        const chunk = base64ToUint8Array(event.data);
        if (chunk.length > 0) {
          const next = new Uint8Array(this.buf.length + chunk.length);
          next.set(this.buf);
          next.set(chunk, this.buf.length);
          this.buf = next;
          this.notifyWaiters();
        }
      }
    });

    this.errorListenerHandle = await this.plugin.addListener('error', (event) => {
      if (event.portId === this.portId) {
        this.eof = true;
        this.notifyWaiters();
      }
    });

    await this.plugin.startReading({ portId: this.portId });
  }

  async write(data: Uint8Array): Promise<void> {
    if (!this.portId || this.closed) {
      throw new RadioClosedError('Not connected.');
    }
    const base64Data = uint8ArrayToBase64(data);
    await this.plugin.write({ portId: this.portId, data: base64Data });
  }

  async readExact(n: number, timeoutMs: number): Promise<Uint8Array> {
    if ((!this.portId && !this.eof) || this.closed) {
      throw new RadioClosedError('Not connected.');
    }
    if (n < 0) {
      throw new RangeError(`readExact length must be >= 0, got ${n}`);
    }
    if (n === 0) {
      return new Uint8Array(0);
    }

    const deadline = Date.now() + timeoutMs;
    while (this.buf.length < n) {
      if (this.eof || this.closed) {
        throw new RadioClosedError('Serial port closed unexpectedly.');
      }
      if (Date.now() > deadline) {
        throw new RadioTimeoutError(`Timeout: needed ${n} bytes, have ${this.buf.length}.`);
      }
      const remaining = Math.max(1, deadline - Date.now());
      await this.waitForBufferGrowth(this.buf.length, remaining);
    }

    const result = this.buf.slice(0, n);
    this.buf = this.buf.length > n ? this.buf.slice(n) : new Uint8Array(0);
    return result;
  }

  async flush(): Promise<void> {
    this.buf = new Uint8Array(0);
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.notifyWaiters();

    if (this.portId) {
      const pid = this.portId;
      this.portId = null;

      try {
        await this.plugin.stopReading({ portId: pid });
      } catch {
        /* ignore */
      }

      if (this.dataListenerHandle) {
        try {
          await this.dataListenerHandle.remove();
        } catch {
          /* ignore */
        }
        this.dataListenerHandle = null;
      }

      if (this.errorListenerHandle) {
        try {
          await this.errorListenerHandle.remove();
        } catch {
          /* ignore */
        }
        this.errorListenerHandle = null;
      }

      try {
        await this.plugin.close({ portId: pid });
      } catch {
        /* ignore */
      }
    }

    this.buf = new Uint8Array(0);
  }

  private waitForBufferGrowth(priorLength: number, timeoutMs: number): Promise<void> {
    if (this.buf.length > priorLength || this.eof || this.closed) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.indexOf(onNotify);
        if (idx >= 0) {
          this.waiters.splice(idx, 1);
        }
        resolve();
      }, timeoutMs);
      const onNotify = (): void => {
        clearTimeout(timer);
        const idx = this.waiters.indexOf(onNotify);
        if (idx >= 0) {
          this.waiters.splice(idx, 1);
        }
        resolve();
      };
      this.waiters.push(onNotify);
      if (this.buf.length > priorLength || this.eof || this.closed) {
        onNotify();
      }
    });
  }

  private notifyWaiters(): void {
    const pending = this.waiters.splice(0, this.waiters.length);
    for (const w of pending) {
      w();
    }
  }
}

/** Request (or select) a Capacitor USB serial device and ensure permissions are granted. */
export async function requestCapacitorSerialPort(options?: {
  deviceId?: number;
  plugin?: UsbSerialPluginLike;
}): Promise<UsbDeviceLike> {
  const plugin = options?.plugin ?? (UsbSerial as unknown as UsbSerialPluginLike);
  const { devices } = await plugin.listDevices();
  if (!devices || devices.length === 0) {
    throw new RadioClosedError(
      'No USB serial device connected. Connect your radio programming cable using a USB-OTG adapter.',
    );
  }

  const device =
    options?.deviceId !== undefined
      ? devices.find((d) => d.deviceId === options.deviceId)
      : devices[0];

  if (!device) {
    throw new RadioClosedError(`USB device with ID ${options?.deviceId} not found.`);
  }

  const perm = await plugin.hasPermission({ deviceId: device.deviceId });
  if (!perm.granted) {
    const requested = await plugin.requestPermission({ deviceId: device.deviceId });
    if (!requested.granted) {
      throw new RadioClosedError('USB permission denied by user.');
    }
  }

  return device;
}

/** Open an already-obtained Capacitor USB serial device at baudRate. */
export async function openCapacitorSerialPipe(
  device: UsbDeviceLike,
  baudRate: number,
  options?: { plugin?: UsbSerialPluginLike; portIndex?: number },
): Promise<BytePipe> {
  const plugin = options?.plugin ?? (UsbSerial as unknown as UsbSerialPluginLike);
  const { portId } = await plugin.open({
    deviceId: device.deviceId,
    portIndex: options?.portIndex ?? 0,
    baudRate,
  });

  const pipe = new CapacitorSerialBytePipe(baudRate, plugin);
  await pipe.attachPort(portId);
  return pipe;
}

/** Request a Capacitor USB serial device and open a BytePipe at baudRate. */
export async function requestCapacitorSerialPipe(
  options: CapacitorSerialPipeOptions,
): Promise<BytePipe> {
  const device = await requestCapacitorSerialPort({
    deviceId: options.deviceId,
    plugin: options.plugin,
  });
  return openCapacitorSerialPipe(device, options.baudRate, {
    plugin: options.plugin,
    portIndex: options.portIndex,
  });
}
