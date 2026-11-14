/**
 * Capacitor USB-Serial BytePipe — OTG port request/open, buffered readExact/write/reopen/close.
 * No radio handshake or memory layout (architecture §1 / #615).
 *
 * Uses @leeskies/capacitor-usb-serial on Capacitor native Android shells.
 *
 * Line rate: the plugin's `open` takes no rate (the port comes up at the driver's default; a CH340 runs 9600), so
 * `openCapacitorSerialPipe` calls `setParameters` with the requested rate, 8 data bits, 1 stop bit and no parity
 * before it starts reading. A failed `setParameters` closes the port and throws `RadioClosedError`.
 *
 * DTR/RTS: set right after the rate, high by default (every codeplug caller, as on Web Serial), low with
 * `raiseDtrRts: false` (a cable may wire them to PTT). Best effort, as on Web Serial. The pipe remembers the choice and
 * sets it again after every `reopen`.
 *
 * Writes: the plugin's `write` resolves when its stream has queued the bytes, not when they have left the adapter, and
 * its calls run on a thread pool, so two un-awaited calls can reach the port out of order. The pipe chains every
 * write and `reopen` (one queue), counts `txBytesWritten` cumulatively, and keeps its own time-based account of when
 * the line will be idle (bytes x 10 / rate). The stream's write buffer is opened at
 * {@link CAPACITOR_WRITE_BUFFER_SIZE}; one frame may be at most {@link CAPACITOR_MAX_FRAME_BYTES}, and a write waits
 * until the estimated backlog plus the frame fits in that, so the buffer does not overflow.
 *
 * `reopen(baudRate)`: no close and open. Chained after pending writes, it waits for the backlog to leave the adapter
 * plus {@link CAPACITOR_DRAIN_MARGIN_MS}, discards what was read so far, calls `setParameters` on the open port (the
 * read stream keeps running) and sets DTR/RTS again. Bytes read before the call are never delivered after it.
 * `txBytesWritten` stays cumulative. A failed `setParameters` leaves the pipe unusable; call `close()`.
 */

import {
  UsbSerial,
  type SerialDeviceInfo,
  type UsbSerialPlugin,
} from '@leeskies/capacitor-usb-serial';
import type { BytePipe } from '../types.ts';
import { RadioClosedError, RadioProtocolError, RadioTimeoutError } from '../kit/errors.ts';

/** A device as the plugin lists it. `deviceId` is an opaque string, valid for one attachment. */
export type UsbDeviceLike = SerialDeviceInfo;

/**
 * The part of the plugin the pipe uses, typed from the plugin's own definitions so a drift fails `tsc`.
 */
export type UsbSerialPluginLike = Pick<
  UsbSerialPlugin,
  | 'listDevices'
  | 'hasPermission'
  | 'requestPermission'
  | 'open'
  | 'setParameters'
  | 'setDTR'
  | 'setRTS'
  | 'addListener'
  | 'startReading'
  | 'stopReading'
  | 'write'
  | 'close'
>;

/** Handle returned by the plugin's `addListener`. */
export type PluginListenerHandleLike = Awaited<ReturnType<UsbSerialPluginLike['addListener']>>;

/** USB vendor / product filter, the same shape as Web Serial's (`usbVendorId`, `usbProductId`). */
export interface CapacitorUsbFilter {
  readonly usbVendorId?: number;
  readonly usbProductId?: number;
}

/**
 * Write buffer asked of the plugin's read/write stream (`startReading({ writeBufferSize })`). The plugin's default
 * is 4096 bytes and a write that does not fit is rejected, so the pipe raises it and keeps its own backlog below
 * {@link CAPACITOR_MAX_FRAME_BYTES}.
 */
export const CAPACITOR_WRITE_BUFFER_SIZE = 16_384;

/**
 * Largest single write, and the most the pipe lets queue in the stream by its own estimate: half the buffer, so an
 * estimate that runs behind the real line still leaves room.
 */
export const CAPACITOR_MAX_FRAME_BYTES = CAPACITOR_WRITE_BUFFER_SIZE / 2;

/** Margin added to the wire time of the backlog before a `reopen` changes the rate. */
export const CAPACITOR_DRAIN_MARGIN_MS = 50;

export interface CapacitorSerialPipeOptions {
  baudRate: number;
  deviceId?: string;
  portNum?: number;
  /** Pick the one device matching these filters; see {@link requestCapacitorSerialPort}. */
  usbFilters?: readonly CapacitorUsbFilter[];
  /** DTR/RTS after open and every reopen: high by default, low with `false`. */
  raiseDtrRts?: boolean;
  /** Custom plugin implementation for unit testing or dependency injection. */
  plugin?: UsbSerialPluginLike;
}

function defaultPlugin(): UsbSerialPluginLike {
  return UsbSerial;
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
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

/** Wire time of `bytes` at `baudRate`, in ms (10 bits per byte). */
function wireMs(bytes: number, baudRate: number): number {
  return (bytes * 10 * 1000) / baudRate;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function applyCapacitorSignals(
  plugin: UsbSerialPluginLike,
  portId: string | null,
  raise: boolean,
): Promise<void> {
  if (!portId) return;
  try {
    await plugin.setDTR({ portId, value: raise });
    await plugin.setRTS({ portId, value: raise });
  } catch {
    // DTR/RTS unsupported by the driver: best effort, as on Web Serial. This swallows a failed *low* request too
    // (`raiseDtrRts: false`), so the lines are left as the driver opened them. That is safe on the adapters we know
    // (a CH340 opens with both low) and is the same as Web Serial; refusing here would block a driver that has no
    // modem-line control at all, where the lines cannot be raised either.
  }
}

export class CapacitorSerialBytePipe implements BytePipe {
  baudRate: number;
  /** Cumulative bytes handed to the plugin since the pipe opened (never reset by `reopen`). */
  txBytesWritten = 0;
  private portId: string | null = null;
  private readonly plugin: UsbSerialPluginLike;
  private readonly raiseDtrRts: boolean;
  private dataListenerHandle: PluginListenerHandleLike | null = null;
  private errorListenerHandle: PluginListenerHandleLike | null = null;
  private buf = new Uint8Array(0);
  private closed = false;
  private eof = false;
  /** Set when a `reopen` failed: the port's rate is unknown, so nothing more is sent or read. */
  private broken = false;
  private waiters: Array<() => void> = [];
  /** One queue for writes and `reopen`, so they reach the port in call order. */
  private writeChain: Promise<void> = Promise.resolve();
  /** Bytes written since the open or the last reopen. */
  private bytesSinceDrain = 0;
  /** When (`Date.now()` ms) the bytes handed over so far will have left the adapter, at the line rate. */
  private wireFreeAt = 0;

  constructor(baudRate: number, plugin?: UsbSerialPluginLike, options?: { raiseDtrRts?: boolean }) {
    this.baudRate = baudRate;
    this.plugin = plugin ?? defaultPlugin();
    this.raiseDtrRts = options?.raiseDtrRts ?? true;
  }

  /** Listen on an opened port and start its read/write stream. The rate must already be set. */
  async attachPort(portId: string): Promise<void> {
    this.portId = portId;
    this.buf = new Uint8Array(0);
    this.closed = false;
    this.eof = false;
    this.broken = false;
    this.txBytesWritten = 0;
    this.bytesSinceDrain = 0;
    this.wireFreeAt = 0;

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

    await this.plugin.startReading({
      portId: this.portId,
      writeBufferSize: CAPACITOR_WRITE_BUFFER_SIZE,
    });
  }

  write(data: Uint8Array): Promise<void> {
    const run = this.writeChain.then(() => this.writeNow(data));
    this.writeChain = run.catch(() => undefined);
    return run;
  }

  private async writeNow(data: Uint8Array): Promise<void> {
    if (!this.portId || this.closed || this.broken) {
      throw new RadioClosedError('Not connected.');
    }
    if (data.length > CAPACITOR_MAX_FRAME_BYTES) {
      throw new RadioProtocolError(
        `Serial frame of ${data.length} bytes exceeds the ${CAPACITOR_MAX_FRAME_BYTES}-byte write limit. Split it into smaller frames.`,
      );
    }
    // Keep the estimated backlog plus this frame inside the limit: wait for enough of the backlog to leave.
    const backlogMs = Math.max(0, this.wireFreeAt - Date.now());
    const backlogBytes = Math.ceil((backlogMs * this.baudRate) / 10_000);
    const excess = backlogBytes + data.length - CAPACITOR_MAX_FRAME_BYTES;
    if (excess > 0) {
      await delay(Math.ceil(wireMs(excess, this.baudRate)));
    }
    const portId = this.portId;
    if (!portId || this.closed) {
      throw new RadioClosedError('Not connected.');
    }
    await this.plugin.write({ portId, data: uint8ArrayToBase64(data) });
    this.txBytesWritten += data.length;
    this.bytesSinceDrain += data.length;
    this.wireFreeAt = Math.max(this.wireFreeAt, Date.now()) + wireMs(data.length, this.baudRate);
  }

  /**
   * Change the line rate on the open port; see {@link BytePipe.reopen}. Serialised with writes, so queued frames
   * leave first.
   */
  reopen(baudRate: number): Promise<void> {
    const run = this.writeChain.then(() => this.reopenNow(baudRate));
    this.writeChain = run.catch(() => undefined);
    return run;
  }

  private async reopenNow(baudRate: number): Promise<void> {
    if (!this.portId || this.closed || this.broken) {
      throw new RadioClosedError('Not connected.');
    }
    const drainMs =
      this.bytesSinceDrain > 0
        ? Math.ceil(Math.max(0, this.wireFreeAt - Date.now())) + CAPACITOR_DRAIN_MARGIN_MS
        : 0;
    if (drainMs > 0) {
      await delay(drainMs);
    }
    const portId = this.portId;
    if (!portId || this.closed) {
      throw new RadioClosedError('Not connected.');
    }
    if (this.eof) {
      // The plugin reported a port error (a pulled cable) before or during the drain. Keep it: never retune a dead
      // port, and leave the pipe unusable, as a failed rate change does.
      this.broken = true;
      this.notifyWaiters();
      throw new RadioClosedError(`Serial port closed before it could change to ${baudRate} baud.`);
    }

    this.buf = new Uint8Array(0);
    try {
      await this.plugin.setParameters({
        portId,
        baudRate,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
      });
    } catch (err) {
      this.broken = true;
      this.notifyWaiters();
      throw new RadioClosedError(
        `Serial port could not change to ${baudRate} baud: ${describeError(err)}`,
      );
    }
    // Bytes delivered while the rate changed were read at either rate: none reaches a reader.
    this.buf = new Uint8Array(0);
    this.baudRate = baudRate;
    this.bytesSinceDrain = 0;
    this.wireFreeAt = 0;
    await applyCapacitorSignals(this.plugin, portId, this.raiseDtrRts);
    if (this.closed) {
      throw new RadioClosedError('Not connected.');
    }
  }

  async readExact(n: number, timeoutMs: number): Promise<Uint8Array> {
    if ((!this.portId && !this.eof) || this.closed || this.broken) {
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
      if (this.eof || this.closed || this.broken) {
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

  async drain(): Promise<Uint8Array> {
    const pending = this.buf;
    this.buf = new Uint8Array(0);
    return pending;
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
    if (this.buf.length > priorLength || this.eof || this.closed || this.broken) {
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
      if (this.buf.length > priorLength || this.eof || this.closed || this.broken) {
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

function matchesFilter(device: UsbDeviceLike, filter: CapacitorUsbFilter): boolean {
  if (filter.usbVendorId !== undefined && device.vendorId !== filter.usbVendorId) return false;
  if (filter.usbProductId !== undefined && device.productId !== filter.usbProductId) return false;
  return true;
}

/**
 * Request (or select) a Capacitor USB serial device and ensure permissions are granted.
 *
 * - `deviceId`: that device.
 * - `usbFilters` (firmware links): exactly one attached device must match one of the filters (an empty list matches
 *   any device). None or more than one is refused; there is no fall-back to the first device.
 * - Neither (codeplug Read/Write): the first device listed.
 */
export async function requestCapacitorSerialPort(options?: {
  deviceId?: string;
  usbFilters?: readonly CapacitorUsbFilter[];
  plugin?: UsbSerialPluginLike;
}): Promise<UsbDeviceLike> {
  const plugin = options?.plugin ?? defaultPlugin();
  const { devices } = await plugin.listDevices();
  if (!devices || devices.length === 0) {
    throw new RadioClosedError(
      'No USB serial device connected. Connect your radio programming cable using a USB-OTG adapter.',
    );
  }

  let device: UsbDeviceLike | undefined;
  if (options?.deviceId !== undefined) {
    device = devices.find((d) => d.deviceId === options.deviceId);
    if (!device) {
      throw new RadioClosedError(`USB device with ID ${options.deviceId} not found.`);
    }
  } else if (options?.usbFilters !== undefined) {
    const filters = options.usbFilters;
    const matching = filters.length
      ? devices.filter((d) => filters.some((f) => matchesFilter(d, f)))
      : devices;
    if (matching.length === 0) {
      throw new RadioClosedError(
        "No matching programming cable found. Connect the radio's programming cable using a USB-OTG adapter.",
      );
    }
    if (matching.length > 1) {
      throw new RadioClosedError(
        'More than one programming cable is connected. Unplug the others and try again.',
      );
    }
    device = matching[0];
  } else {
    device = devices[0];
  }
  if (!device) {
    throw new RadioClosedError('No USB serial device connected.');
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

export interface OpenCapacitorSerialPipeOptions {
  plugin?: UsbSerialPluginLike;
  portNum?: number;
  /** DTR/RTS after open and every reopen: high by default (every codeplug caller), low with `false`. */
  raiseDtrRts?: boolean;
}

/**
 * Open an already-obtained Capacitor USB serial device at `baudRate` (8N1) and return a BytePipe.
 * Order: `open`, `setParameters`, DTR/RTS, listeners, `startReading`.
 */
export async function openCapacitorSerialPipe(
  device: UsbDeviceLike,
  baudRate: number,
  options?: OpenCapacitorSerialPipeOptions,
): Promise<CapacitorSerialBytePipe> {
  const plugin = options?.plugin ?? defaultPlugin();
  const raiseDtrRts = options?.raiseDtrRts ?? true;
  const { portId } = await plugin.open({
    deviceId: device.deviceId,
    portNum: options?.portNum ?? 0,
  });
  try {
    await plugin.setParameters({ portId, baudRate, dataBits: 8, stopBits: 1, parity: 'none' });
  } catch (err) {
    try {
      await plugin.close({ portId });
    } catch {
      /* ignore */
    }
    throw new RadioClosedError(
      `Serial port could not be set to ${baudRate} baud: ${describeError(err)}`,
    );
  }
  await applyCapacitorSignals(plugin, portId, raiseDtrRts);

  const pipe = new CapacitorSerialBytePipe(baudRate, plugin, { raiseDtrRts });
  try {
    await pipe.attachPort(portId);
  } catch (err) {
    await pipe.close();
    throw err;
  }
  return pipe;
}

/** Request a Capacitor USB serial device and open a BytePipe at baudRate. */
export async function requestCapacitorSerialPipe(
  options: CapacitorSerialPipeOptions,
): Promise<CapacitorSerialBytePipe> {
  const device = await requestCapacitorSerialPort({
    deviceId: options.deviceId,
    usbFilters: options.usbFilters,
    plugin: options.plugin,
  });
  return openCapacitorSerialPipe(device, options.baudRate, {
    plugin: options.plugin,
    portNum: options.portNum,
    raiseDtrRts: options.raiseDtrRts,
  });
}
