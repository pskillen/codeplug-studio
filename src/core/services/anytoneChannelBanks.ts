import type { Channel } from '@core/models/library.ts';
import {
  classifyAnytoneExportChannelBank as classifyFromFormat,
  type AnytoneExportChannelBank,
} from '@core/import-export/formats/anytone/receiveOnlyBanks.ts';

export type { AnytoneExportChannelBank };

/** Anytone CPS export bank for a library channel (DMR/main, AM air, FM broadcast). */
export function classifyAnytoneExportChannelBank(channel: Channel): AnytoneExportChannelBank {
  return classifyFromFormat(channel);
}
