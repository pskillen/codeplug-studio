import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import type { Zone } from '@core/models/library.ts';
import { newChannel } from '@core/domain/factories.ts';
import ZoneMemberEditor, { zoneMembershipExclusionLabel } from './ZoneMemberEditor.tsx';

function zone(id: string, name: string, members: Zone['members']): Zone {
  return {
    id,
    projectId: 'p1',
    revision: 1,
    updatedAt: '2026-01-01T00:00:00.000Z',
    name,
    members,
    comment: '',
  };
}

describe('zoneMembershipExclusionLabel', () => {
  it('maps reason codes to operator copy', () => {
    expect(zoneMembershipExclusionLabel('self')).toBe('This zone');
    expect(zoneMembershipExclusionLabel('descendant')).toBe('Already nested under this zone');
    expect(zoneMembershipExclusionLabel('cycle')).toBe('Would create a cycle');
  });
});

describe('ZoneMemberEditor cycle-closing zones', () => {
  it('shows Scotland greyed with cycle label when editing Glasgow nested under Scotland', () => {
    const glasgow = zone('z-g', 'Glasgow', [{ kind: 'channel', channelId: 'ch-1' }]);
    const scotland = zone('z-s', 'Scotland', [{ kind: 'zone', zoneId: 'z-g' }]);
    const channels = [{ ...newChannel('p1', 'Local'), id: 'ch-1' }];
    const onChange = vi.fn();

    render(
      <MemoryRouter>
        <MantineProvider>
          <ZoneMemberEditor
            channels={channels}
            zones={[glasgow, scotland]}
            editingZoneId="z-g"
            members={glasgow.members}
            onChange={onChange}
          />
        </MantineProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Zone: Scotland')).toBeInTheDocument();
    expect(screen.getByText('Would create a cycle')).toBeInTheDocument();

    const scotlandCheckbox = screen.getByRole('checkbox', {
      name: /Zone Scotland unavailable: Would create a cycle/,
    });
    expect(scotlandCheckbox).toBeDisabled();

    fireEvent.click(scotlandCheckbox);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows descendant label for nested grandchild not already a direct member', () => {
    const grandchild = zone('z-gc', 'Grandchild', []);
    const child = zone('z-c', 'Child', [{ kind: 'zone', zoneId: 'z-gc' }]);
    const parent = zone('z-p', 'Parent', [{ kind: 'zone', zoneId: 'z-c' }]);
    const onChange = vi.fn();

    render(
      <MemoryRouter>
        <MantineProvider>
          <ZoneMemberEditor
            channels={[]}
            zones={[grandchild, child, parent]}
            editingZoneId="z-p"
            members={parent.members}
            onChange={onChange}
          />
        </MantineProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Zone: Grandchild')).toBeInTheDocument();
    expect(screen.getByText('Already nested under this zone')).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', {
        name: /Zone Grandchild unavailable: Already nested under this zone/,
      }),
    ).toBeDisabled();
  });

  it('shows self greyed when editing zone and sibling zones remain addable', () => {
    const glasgow = zone('z-g', 'Glasgow', []);
    const edinburgh = zone('z-e', 'Edinburgh', []);
    const onChange = vi.fn();

    render(
      <MemoryRouter>
        <MantineProvider>
          <ZoneMemberEditor
            channels={[]}
            zones={[glasgow, edinburgh]}
            editingZoneId="z-g"
            members={[]}
            onChange={onChange}
          />
        </MantineProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Zone: Glasgow')).toBeInTheDocument();
    expect(screen.getByText('This zone')).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: /Zone Glasgow unavailable: This zone/ }),
    ).toBeDisabled();

    const edinburghCheckbox = screen.getByRole('checkbox', { name: 'Select zone Edinburgh' });
    expect(edinburghCheckbox).not.toBeDisabled();
    fireEvent.click(edinburghCheckbox);
    fireEvent.click(screen.getByRole('button', { name: 'Add selected' }));
    expect(onChange).toHaveBeenCalledWith([{ kind: 'zone', zoneId: 'z-e' }]);
  });
});
