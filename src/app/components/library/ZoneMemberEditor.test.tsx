import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import type { Zone } from '@core/models/library.ts';
import { newChannel } from '@core/domain/factories.ts';
import { DesignSystemV2Provider } from '../v2/index.ts';
import ZoneMemberEditor, { zoneMembershipExclusionLabel } from './ZoneMemberEditor.tsx';

function renderEditor(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <MantineProvider>
        <DesignSystemV2Provider>{ui}</DesignSystemV2Provider>
      </MantineProvider>
    </MemoryRouter>,
  );
}

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

    renderEditor(
      <ZoneMemberEditor
        channels={channels}
        zones={[glasgow, scotland]}
        editingZoneId="z-g"
        members={glasgow.members}
        onChange={onChange}
      />,
    );

    expect(screen.getByText('Scotland')).toBeInTheDocument();
    expect(screen.getByText('Would create a cycle')).toBeInTheDocument();

    const scotlandCheckbox = screen.getByRole('checkbox', { name: 'Add Scotland' });
    expect(scotlandCheckbox).toBeDisabled();

    fireEvent.click(scotlandCheckbox);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows descendant label for nested grandchild not already a direct member', () => {
    const grandchild = zone('z-gc', 'Grandchild', []);
    const child = zone('z-c', 'Child', [{ kind: 'zone', zoneId: 'z-gc' }]);
    const parent = zone('z-p', 'Parent', [{ kind: 'zone', zoneId: 'z-c' }]);
    const onChange = vi.fn();

    renderEditor(
      <ZoneMemberEditor
        channels={[]}
        zones={[grandchild, child, parent]}
        editingZoneId="z-p"
        members={parent.members}
        onChange={onChange}
      />,
    );

    expect(screen.getByText('Grandchild')).toBeInTheDocument();
    expect(screen.getByText('Already nested under this zone')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Add Grandchild' })).toBeDisabled();
  });

  it('shows self greyed when editing zone and sibling zones remain addable', () => {
    const glasgow = zone('z-g', 'Glasgow', []);
    const edinburgh = zone('z-e', 'Edinburgh', []);
    const onChange = vi.fn();

    renderEditor(
      <ZoneMemberEditor
        channels={[]}
        zones={[glasgow, edinburgh]}
        editingZoneId="z-g"
        members={[]}
        onChange={onChange}
      />,
    );

    expect(screen.getByText('Glasgow')).toBeInTheDocument();
    expect(screen.getByText('This zone')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Add Glasgow' })).toBeDisabled();

    const edinburghCheckbox = screen.getByRole('checkbox', { name: 'Add Edinburgh' });
    expect(edinburghCheckbox).not.toBeDisabled();
    fireEvent.click(edinburghCheckbox);
    fireEvent.click(screen.getByRole('button', { name: /Add selected/ }));
    expect(onChange).toHaveBeenCalledWith([{ kind: 'zone', zoneId: 'z-e' }]);
  });
});
