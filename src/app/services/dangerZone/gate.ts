/**
 * Which Danger zone tools this build's radio and platform may offer. There is no prod gate or feature flag
 * (owner decision, #1369): testing happens on pre-prod. The Capacitor app offers nothing until Web Serial
 * works there (as the firmware flasher does).
 */
import { isCapacitorSerialSupported } from '@integrations/radio-io';

import { DANGER_ZONE_TOOLS, type DangerZoneToolDescriptor } from './registry.ts';

export function listOfferedDangerZoneTools(
  radioTargetId: string | undefined,
): readonly DangerZoneToolDescriptor[] {
  if (!radioTargetId || isCapacitorSerialSupported()) return [];
  return DANGER_ZONE_TOOLS.filter((t) => t.radios.includes(radioTargetId));
}
