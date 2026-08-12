import type { DigitalIdDirectoryEntry } from '@core/models/digitalIdDirectory.ts';
import type {
  RadioDigitalContactDto,
  RadioRadioIdDto,
} from '@integrations/radio-io/radioWriteProjection.ts';

const DM32_RADIO_ID_NAME_MAX = 11;

function directoryDisplayName(entry: DigitalIdDirectoryEntry): string {
  return (entry.name?.trim() || entry.callsign?.trim() || `ID${entry.digitalId}`).slice(
    0,
    DM32_RADIO_ID_NAME_MAX,
  );
}

/** Map a directory row into DM-32 operator radio-ID bank DTO (metadata 0x67). */
export function mapDirectoryEntryToRadioRadioIdDto(
  entry: DigitalIdDirectoryEntry,
  index: number,
): RadioRadioIdDto {
  return {
    index,
    dmrId: entry.digitalId,
    name: directoryDisplayName(entry),
  };
}

/** Map a directory row into OpenGD77 private-contact projection fields. */
export function mapDirectoryEntryToRadioDigitalContactDto(
  entry: DigitalIdDirectoryEntry,
): RadioDigitalContactDto {
  const wireName = entry.name?.trim() || entry.callsign?.trim() || `ID${entry.digitalId}`;
  return {
    wireName,
    digitalId: entry.digitalId,
    callsign: entry.callsign ?? '',
    city: entry.city ?? '',
    province: entry.state ?? '',
    country: entry.country ?? '',
    remark: entry.remarks ?? '',
  };
}
