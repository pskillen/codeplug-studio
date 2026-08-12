import { describe, expect, it } from 'vitest';
import type { DigitalIdDirectoryEntry } from '@core/models/digitalIdDirectory.ts';
import {
  mapDirectoryEntryToRadioDigitalContactDto,
  mapDirectoryEntryToRadioRadioIdDto,
} from './mapDirectoryEntryToRadioDto.ts';

const entry: DigitalIdDirectoryEntry = {
  projectId: 'p1',
  digitalId: 1234567,
  mode: 'dmr',
  name: 'Alice Example',
  callsign: 'AL1CE',
  city: 'Town',
  state: 'ST',
  country: 'US',
  remarks: 'note',
};

describe('mapDirectoryEntryToRadioDto', () => {
  it('maps directory entry to DM-32 radio ID DTO', () => {
    expect(mapDirectoryEntryToRadioRadioIdDto(entry, 3)).toEqual({
      index: 3,
      dmrId: 1234567,
      name: 'Alice Examp',
    });
  });

  it('maps directory entry to OpenGD77 digital contact DTO', () => {
    expect(mapDirectoryEntryToRadioDigitalContactDto(entry)).toEqual({
      wireName: 'Alice Example',
      digitalId: 1234567,
      callsign: 'AL1CE',
      city: 'Town',
      province: 'ST',
      country: 'US',
      remark: 'note',
    });
  });
});
