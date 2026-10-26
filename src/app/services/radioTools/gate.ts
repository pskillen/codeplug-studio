/**
 * Per-tool prod gate for Radio tools. Separate from the codeplug Write gate and, like the firmware flasher's,
 * with no Capacitor exemption: Web Serial is not available in the native app yet, so the area is hidden there.
 */
import { isCapacitorSerialSupported } from '@integrations/radio-io';

import { isProdBuildEnv } from '../radioWriteEnvGate.ts';
import { RADIO_TOOLS, type RadioToolDescriptor } from './registry.ts';

export type RadioToolGate = 'hidden' | 'allowed';

/** Pure. 'hidden' only on the prod build while the tool's `prodDisabled` is set. */
export function resolveRadioToolGate(
  tool: Pick<RadioToolDescriptor, 'prodDisabled'>,
  buildEnv: string = __BUILD_ENV__,
): RadioToolGate {
  return isProdBuildEnv(buildEnv) && tool.prodDisabled ? 'hidden' : 'allowed';
}

/** Tools for this radio target that this deploy and platform may offer. */
export function listOfferedRadioTools(
  radioTargetId: string | undefined,
  buildEnv: string = __BUILD_ENV__,
): readonly RadioToolDescriptor[] {
  if (!radioTargetId || isCapacitorSerialSupported()) return [];
  return RADIO_TOOLS.filter(
    (t) => t.radios.includes(radioTargetId) && resolveRadioToolGate(t, buildEnv) === 'allowed',
  );
}
