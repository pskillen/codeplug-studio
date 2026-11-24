/**
 * Whether the backup on screen holds a Brandmeister AirSecurity seed.
 * Uses bytes the backup already has. Does not read a radio and does not return the bytes.
 */

import {
  AT_D890UV_MODEL_IDS,
  D890_MAP,
} from '@integrations/radio-io/radios/at-d890uv/constants.ts';
import {
  AIRSECURITY_SEED_ADDRESS,
  AIRSECURITY_SEED_RECORD_LENGTH,
  airSecuritySeedRecordIsSet,
} from '@integrations/radio-io/radios/at-d890uv/airSecuritySeed.ts';
import type { RadioBackupSession } from '../../services/radioBackupRead.ts';

function isAtD890Backup(modelId: string): boolean {
  return modelId === AT_D890UV_MODEL_IDS[0] || modelId === AT_D890UV_MODEL_IDS[1];
}

/** True when this AT-D890UV backup's settings-store record at `+0x20` is a seed. */
export function atD890BackupContainsAirSecuritySeed(backup: RadioBackupSession): boolean {
  if (!isAtD890Backup(backup.manifest.radioModelId)) return false;
  const region = backup.manifest.regions.find((item) => item.id === 'settings-store');
  if (!region || region.address !== D890_MAP.SettingsStore) return false;
  const end = AIRSECURITY_SEED_ADDRESS + AIRSECURITY_SEED_RECORD_LENGTH;
  if (backup.image.size < end) return false;
  const record = backup.image.get(AIRSECURITY_SEED_ADDRESS, AIRSECURITY_SEED_RECORD_LENGTH);
  try {
    return airSecuritySeedRecordIsSet(record);
  } finally {
    record.fill(0);
  }
}
