/**
 * Backup / Restore inspect lists — fixture bags, no protocol I/O.
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { encodeChannelsIntoImage } from '@integrations/radio-io/radios/opengd77/channelCodec.ts';
import { encodeContactsIntoImage } from '@integrations/radio-io/radios/opengd77/contactCodec.ts';
import { extractOpenGd77Hydration } from '@integrations/radio-io/radios/opengd77/hydration.ts';
import { createOpenUv380Image } from '@integrations/radio-io/radios/opengd77/memory.ts';
import { encodeZonesIntoImage } from '@integrations/radio-io/radios/opengd77/zoneCodec.ts';
import RadioCloneSummaryView from './RadioCloneSummaryView.tsx';

function openGd77InspectBag() {
  const image = createOpenUv380Image();
  encodeContactsIntoImage(image, [{ index: 1, wireName: 'TG91', digitalId: 91, callType: 0 }]);
  encodeChannelsIntoImage(image, [
    {
      slotIndex: 1,
      empty: false,
      wireName: 'CH1',
      rxHz: 145_500_000,
      txHz: 145_500_000,
      rxTone: { kind: 'none' },
      txTone: { kind: 'none' },
      powerPercent: 100,
      bandwidth: 'NFM',
      mode: 'digital',
      txContactId: 1,
    },
  ]);
  encodeZonesIntoImage(image, [{ wireName: 'Local', channelNumbers: [1] }]);
  return extractOpenGd77Hydration(image, { firmware: 'R20240101000000' });
}

describe('RadioCloneSummaryView inspect variant', () => {
  it('shows expandable channel names and omits write-coverage headings', () => {
    render(
      <MantineProvider>
        <RadioCloneSummaryView bag={openGd77InspectBag()} variant="inspect" />
      </MantineProvider>,
    );

    expect(screen.getByText('On this image')).toBeInTheDocument();
    expect(screen.getByText(/Channels \(1\)/)).toBeInTheDocument();
    expect(screen.getByText('1. CH1')).toBeInTheDocument();
    expect(screen.getByText('1. Local')).toBeInTheDocument();
    expect(screen.getByText('1. TG91')).toBeInTheDocument();
    expect(screen.queryByText('Written from your build')).not.toBeInTheDocument();
    expect(screen.queryByText('Kept on Write')).not.toBeInTheDocument();
  });
});
