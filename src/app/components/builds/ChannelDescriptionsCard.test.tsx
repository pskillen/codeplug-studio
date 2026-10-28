import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { withExportEligibleDefaults } from '@core/domain/channelTestHelpers.ts';
import { newChannel, newRadioBuildForProfile, newZone } from '@core/domain/factories.ts';
import { seedZoneGroupingFromLibrary } from '@core/domain/zoneGroupingLayout.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import ChannelDescriptionsCard from './ChannelDescriptionsCard.tsx';

const channel = withExportEligibleDefaults({
  ...newChannel('p1', 'Calling ch', 'TEST01'),
  id: 'ch-a',
  rxFrequency: 146_520_000,
  txFrequency: 146_520_000,
});
const zone = {
  ...newZone('p1', 'Local'),
  id: 'z1',
  members: [{ kind: 'channel' as const, channelId: 'ch-a' }],
};
const library: LibrarySlice = {
  channels: [channel],
  zones: [zone],
  scanLists: [],
  talkGroups: [],
  digitalContacts: [],
  analogContacts: [],
  rxGroupLists: [],
  aprsConfiguration: null,
};
const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-rt95-mm9pdy');
build.layout = { sections: [seedZoneGroupingFromLibrary(library)] };

const persistBuild = vi.fn();
vi.mock('../../hooks/useBuildWirePreview.ts', () => ({
  useBuildWirePreview: () => ({ build, library, persistBuild, saving: false }),
}));

function renderCard() {
  return render(
    <MantineProvider>
      <ChannelDescriptionsCard egress={egress} limit={12} />
    </MantineProvider>,
  );
}

describe('ChannelDescriptionsCard', () => {
  it('lists the radio name and the description the radio will get', () => {
    renderCard();
    expect(screen.getByText('TEST01')).toBeTruthy();
    const input = screen.getByRole('textbox', { name: 'Description for Calling ch' });
    expect((input as HTMLInputElement).value).toBe('Calling ch');
    expect(input.getAttribute('maxlength')).toBe('12');
  });

  it('persists an override on blur', () => {
    renderCard();
    const input = screen.getByRole('textbox', { name: 'Description for Calling ch' });
    fireEvent.change(input, { target: { value: 'Mine' } });
    fireEvent.blur(input);
    expect(persistBuild).toHaveBeenCalledTimes(1);
    const mutate = persistBuild.mock.calls[0]![0] as (b: typeof build) => typeof build;
    const next = mutate(build);
    expect(next.channelOverrides.find((o) => o.libraryEntityId === 'ch-a')?.wireDescription).toBe(
      'Mine',
    );
  });
});
