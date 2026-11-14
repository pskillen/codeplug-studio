/**
 * The port for the AT-D890UV erase-unit probe page. In a browser every pass opens a Web Serial port from a fresh
 * picker at 921600 with DTR and RTS raised, as the page always has. In the Android app only the read-only link-speed
 * pass runs: it goes through the flasher's seam with the D890's link (the radio's own ST CDC port, `0483:5740`, the
 * same ID in normal and update mode; 921600, which is nominal on USB CDC; DTR and RTS raised, as in the browser).
 * Every other pass is refused there before any port is requested, so nothing that writes can reach the app's USB port.
 */
import { AT_D890_CONNECTION } from '@integrations/radio-io/radios/at-d890uv/constants.ts';
import { AT_D890_FW_LINK } from '@integrations/radio-io/radios/at-d890uv/firmwareUpdate/constants.ts';
import {
  isCapacitorSerialSupported,
  openWebSerialPipe,
  requestWebSerialPort,
} from '@integrations/radio-io/transport/index.ts';
import type { BytePipe } from '@integrations/radio-io/types.ts';

import { grantFirmwareLinkPort, openFirmwareLinkPipe, refuseOnCapacitor } from './firmwarePort.ts';

/** The probe page's passes that run in the Android app: read-only, and only the link-speed profile. */
export const AT_D890_PROBE_NATIVE_PASSES = ['link'] as const;

export type AtD890ProbeNativePass = (typeof AT_D890_PROBE_NATIVE_PASSES)[number];

function runsOnNative(pass: string): pass is AtD890ProbeNativePass {
  return (AT_D890_PROBE_NATIVE_PASSES as readonly string[]).includes(pass);
}

/**
 * Open a pipe for one pass of the probe page (`stepLabel` names it in a refusal). Call from a user gesture. In the
 * Android app a pass other than the link-speed profile throws before any port is requested.
 */
export async function openAtD890ProbePipe(pass: string, stepLabel: string): Promise<BytePipe> {
  if (isCapacitorSerialSupported()) {
    if (!runsOnNative(pass)) refuseOnCapacitor(stepLabel);
    const port = await grantFirmwareLinkPort(AT_D890_FW_LINK);
    return openFirmwareLinkPipe(port, AT_D890_FW_LINK.baudRate, AT_D890_FW_LINK);
  }
  const port = await requestWebSerialPort(false);
  return openWebSerialPipe(port, AT_D890_CONNECTION.BAUD_RATE);
}
