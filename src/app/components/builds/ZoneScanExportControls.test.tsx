import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { ZoneScanRowHeader } from './ZoneScanExportControls.tsx';
import type { Zone } from '@core/models/library.ts';

describe('ZoneScanRowHeader', () => {
  it('shows export-as-scan-list control and member count badge', () => {
    const zoneId = 'zone-pmr';
    const zone: Zone = {
      id: zoneId,
      projectId: 'p',
      revision: 1,
      updatedAt: '',
      name: 'PMR446',
      members: [{ kind: 'channel', channelId: 'ch-1' }],
      comment: '',
    };

    render(
      <MantineProvider>
        <ZoneScanRowHeader
          zone={zone}
          zones={[zone]}
          entry={{ id: zoneId, name: 'PMR446', channelIds: ['ch-1'] }}
          scanListMemberCap={16}
          showScanCarrierControls={true}
          expanded={false}
          saving={false}
          onToggleExpand={vi.fn()}
          onExportScanListChange={vi.fn()}
        />
      </MantineProvider>,
    );

    expect(screen.getByLabelText('Export as scan list')).toBeInTheDocument();
    expect(screen.getByText('1 / 1 scan members (cap 16)')).toBeInTheDocument();
  });
});
