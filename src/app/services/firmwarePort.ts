/**
 * The flasher's transport seam: one grant and one open per firmware link, over Web Serial in a browser or the
 * Capacitor USB-serial plugin in the Android app. No protocol knowledge; the link (`FirmwareLinkSpec`) says the rate,
 * the cable's USB filters and the DTR/RTS choice.
 *
 * - Web Serial: a fresh picker narrowed to the link's filters.
 * - Capacitor: exactly one attached device matching the link's filters, never the first device by default.
 */
import {
  isCapacitorSerialSupported,
  openCapacitorSerialPipe,
  openWebSerialPipe,
  RadioUnsupportedError,
  requestCapacitorSerialPort,
  requestWebSerialPort,
  type BytePipe,
  type FirmwareLinkSpec,
  type SerialPortLike,
  type UsbDeviceLike,
} from '@integrations/radio-io';

/** A device granted through the Capacitor plugin (Android app). Opened per link; nothing to close until then. */
export interface CapacitorFirmwarePort {
  readonly transport: 'capacitor';
  readonly device: UsbDeviceLike;
}

/** A granted firmware port: a Web Serial port, or a device on the Android app. */
export type FirmwarePort = SerialPortLike | CapacitorFirmwarePort;

export function isCapacitorFirmwarePort(port: FirmwarePort): port is CapacitorFirmwarePort {
  return 'transport' in port && port.transport === 'capacitor';
}

/** Grant the port for `link`: Web Serial's picker, or on the Android app the one matching device. */
export async function grantFirmwareLinkPort(link: FirmwareLinkSpec): Promise<FirmwarePort> {
  if (isCapacitorSerialSupported()) {
    const device = await requestCapacitorSerialPort({ usbFilters: link.usbFilters });
    return { transport: 'capacitor', device };
  }
  return requestWebSerialPort(true, link.usbFilters);
}

/** Open a granted port at `baudRate` with the link's DTR/RTS choice. */
export function openFirmwareLinkPipe(
  port: FirmwarePort,
  baudRate: number,
  link: FirmwareLinkSpec,
): Promise<BytePipe> {
  if (isCapacitorFirmwarePort(port)) {
    return openCapacitorSerialPipe(port.device, baudRate, { raiseDtrRts: link.raiseDtrRts });
  }
  return openWebSerialPipe(port, baudRate, { raiseDtrRts: link.raiseDtrRts });
}

/** Release a granted port that was never opened as a pipe. A Capacitor device holds nothing until it is opened. */
export async function closeUnopenedFirmwarePort(port: FirmwarePort): Promise<void> {
  if (isCapacitorFirmwarePort(port)) return;
  await port.close();
}

/** The refusal for a step the Android app does not offer. */
export function notOnAndroidMessage(step: string): string {
  return `${step} is not available in the Android app. Use Studio in a desktop browser for this step.`;
}

/** Throw before any port is requested when this step has no Android path. */
export function refuseOnCapacitor(step: string): void {
  if (isCapacitorSerialSupported()) throw new RadioUnsupportedError(notOnAndroidMessage(step));
}

/** Throw when a Web-Serial-only step is handed a Capacitor port; otherwise return the Web Serial port. */
export function requireWebSerialPort(port: FirmwarePort, step: string): SerialPortLike {
  if (isCapacitorFirmwarePort(port)) throw new RadioUnsupportedError(notOnAndroidMessage(step));
  return port;
}
