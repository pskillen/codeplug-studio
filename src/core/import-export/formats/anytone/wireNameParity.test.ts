import { describe, it } from 'vitest';
import {
  ANYTONE_PATHWAY_PAIRS,
  assertAnytoneWireNameParity,
  fmChannelFixture,
} from '@core/import-export/channelExpansion/__testUtils__/pathwayParity.ts';

describe('Anytone CSV ↔ serial channel wire name parity (#780)', () => {
  it('keeps full name under limit when abbreviation is set (useChannelAbbreviation on)', () => {
    const channel = fmChannelFixture({
      callsign: 'GB7GL',
      name: 'hotspot',
      abbreviation: 'Hspt',
    });
    assertAnytoneWireNameParity(
      channel,
      { useChannelAbbreviation: true },
      'GB7GL hotspot',
      ANYTONE_PATHWAY_PAIRS,
    );
  });

  it('shortens with library abbreviation when over nameLimit (useChannelAbbreviation on)', () => {
    const channel = fmChannelFixture({
      callsign: 'GB3MT',
      name: 'Mugherafelt',
      abbreviation: "M'flt",
    });
    assertAnytoneWireNameParity(
      channel,
      { useChannelAbbreviation: true },
      "GB3MT M'flt",
      ANYTONE_PATHWAY_PAIRS,
    );
  });
});
