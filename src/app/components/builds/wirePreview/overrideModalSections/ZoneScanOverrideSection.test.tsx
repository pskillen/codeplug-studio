import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import type { Channel, Zone } from '@core/models/library.ts';
import ZoneScanOverrideSection from './ZoneScanOverrideSection.tsx';

const zone: Zone = {
  id: 'z1',
  projectId: 'p',
  revision: 1,
  updatedAt: '',
  name: 'Local',
  members: [
    { kind: 'channel', channelId: 'a' },
    { kind: 'channel', channelId: 'b', includeInScanList: 'skip' },
  ],
  comment: '',
};

function channel(id: string, name: string): Channel {
  return { id, name, callsign: '' } as unknown as Channel;
}

function renderSection(variant: 'scanList' | 'scanSet', onUpdate = vi.fn()) {
  render(
    <MantineProvider>
      <ZoneScanOverrideSection
        variant={variant}
        zone={zone}
        zones={[zone]}
        entry={{ id: 'z1', name: 'Local', channelIds: [] }}
        channelById={
          new Map([
            ['a', channel('a', 'Alpha')],
            ['b', channel('b', 'Bravo')],
          ])
        }
        showScanCarrierControls={false}
        scanListMemberCap={16}
        saving={false}
        onUpdateZoneEntry={vi.fn()}
        onUpdateMemberScanInclusion={onUpdate}
      />
    </MantineProvider>,
  );
  return onUpdate;
}

describe('ZoneScanOverrideSection, scan set variant', () => {
  it('shows Scan in this zone per member with no export switch, and warns below two', () => {
    renderSection('scanSet');
    expect(screen.queryByLabelText('Export as scan list')).toBeNull();
    expect(screen.getAllByText('Scan in this zone').length).toBeGreaterThan(0);
    expect(screen.getByText('1 / 2 scan in this zone')).toBeInTheDocument();
    expect(screen.getByText(/this zone won't scan on the radio/)).toBeInTheDocument();
    expect(screen.getByLabelText('Include Alpha in this zone’s scan')).toBeChecked();
    expect(screen.getByLabelText('Include Bravo in this zone’s scan')).not.toBeChecked();
  });

  it("saves a member's choice on this build's zone", () => {
    const onUpdate = renderSection('scanSet');
    fireEvent.click(screen.getByLabelText('Include Bravo in this zone’s scan'));
    expect(onUpdate).toHaveBeenCalledWith('z1', 'b', true);
  });

  it('keeps the scan list variant behind Export as scan list', () => {
    renderSection('scanList');
    expect(screen.getByLabelText('Export as scan list')).toBeInTheDocument();
    expect(screen.queryByText('Scan in this zone')).toBeNull();
  });
});
