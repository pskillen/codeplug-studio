import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Channel } from '@core/models/library.ts';
import { newChannel } from '@core/domain/factories.ts';
import type { RepeaterListing } from '@integrations/repeaters/index.ts';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import RepeaterListingUpdateDialog from './RepeaterListingUpdateDialog.tsx';

const listing: RepeaterListing = {
  source: 'ukrepeater',
  remoteId: '1',
  callsign: 'GB3DA',
  name: 'Danbury',
  rxFrequencyHz: 145_725_000,
  txFrequencyHz: 145_125_000,
  rxToneHz: null,
  txToneHz: 88.5,
  modes: ['fm'],
  primaryMode: 'fm',
  colourCode: null,
  locator: 'IO91',
  location: { lat: 51.75, lon: 0.55 },
  band: '2M',
  status: 'OPERATIONAL',
};

function channelWithRxTone(): Channel {
  return {
    ...newChannel('p1', 'Danbury', 'GB3DA'),
    rxFrequency: 145_725_000,
    txFrequency: 145_125_000,
    modeProfiles: [
      { mode: 'fm', rxTone: '88.5', txTone: '88.5', squelch: null, bandwidthKHz: null },
    ],
  };
}

describe('RepeaterListingUpdateDialog', () => {
  it('shows a warning pill and unchecked box for a row that would clear the RX tone (#1254)', () => {
    render(
      <DesignSystemV2Provider>
        <RepeaterListingUpdateDialog
          channel={channelWithRxTone()}
          listing={listing}
          opened
          onClose={() => undefined}
        />
      </DesignSystemV2Provider>,
    );

    const rxToneRow = screen.getByText('RX tone').closest('tr');
    expect(rxToneRow).not.toBeNull();
    const checkbox = rxToneRow!.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    expect(screen.getByText('None')).toBeInTheDocument();
  });
});
