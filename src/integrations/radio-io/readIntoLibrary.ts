import type { ReadChannelInput } from '@core/services/radioRead/types.ts';
import type { RadioReadZone } from '@core/services/radioRead/upsertReadZones.ts';
import type { ProgressFn, RadioSession } from './types.ts';

/** What one radio read hands the library pipeline. */
export interface RadioLibraryRead {
  modelLabel: string;
  profileId: string;
  firmwareLabel: string;
  /** Occupied slots in slot order. */
  channels: ReadChannelInput[];
  zones: RadioReadZone[];
  droppedFields: readonly string[];
  notes: readonly string[];
}

export interface RadioReadIntoLibraryHooks {
  read(
    session: RadioSession,
    opts: { onProgress?: ProgressFn; signal?: AbortSignal },
  ): Promise<RadioLibraryRead>;
}
