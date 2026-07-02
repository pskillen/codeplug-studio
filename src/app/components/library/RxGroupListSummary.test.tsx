import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import {
  emptyLibrary,
  newDigitalContact,
  newRxGroupList,
  newTalkGroup,
} from '@core/domain/factories.ts';
import RxGroupListSummary from './RxGroupListSummary.tsx';

function renderSummary(listId: string | null, library = emptyLibrary()) {
  return render(
    <MantineProvider>
      <MemoryRouter>
        <RxGroupListSummary listId={listId} library={library} />
      </MemoryRouter>
    </MantineProvider>,
  );
}

describe('RxGroupListSummary', () => {
  it('renders nothing when no list is selected', () => {
    renderSummary(null);
    expect(screen.queryByText(/member/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('shows members with slot override and link to editor', () => {
    const tg = newTalkGroup('p1', 'Scotland', 950);
    const dc = newDigitalContact('p1', 'Local', 1234567, 'dmr');
    const list = newRxGroupList('p1', 'Repeater RX');
    list.members = [
      { ref: { kind: 'talkGroup', id: tg.id }, timeSlotOverride: 2 },
      { ref: { kind: 'digitalContact', id: dc.id } },
    ];
    const library = {
      ...emptyLibrary(),
      talkGroups: [tg],
      digitalContacts: [dc],
      rxGroupLists: [list],
    };

    renderSummary(list.id, library);

    expect(screen.getByRole('link', { name: 'Repeater RX' })).toHaveAttribute(
      'href',
      `/library/rx-group-lists/${list.id}`,
    );
    expect(screen.getByText('Scotland')).toBeInTheDocument();
    expect(screen.getByText('Local')).toBeInTheDocument();
    expect(screen.getByText('TS2')).toBeInTheDocument();
    expect(screen.getByText('2 members')).toBeInTheDocument();
  });

  it('handles missing list and broken refs', () => {
    renderSummary('missing');
    expect(screen.getByText('RX group list not found')).toBeInTheDocument();

    const list = newRxGroupList('p1', 'Empty');
    list.members = [{ ref: { kind: 'talkGroup', id: 'gone' } }];
    const library = { ...emptyLibrary(), rxGroupLists: [list] };
    renderSummary(list.id, library);
    expect(screen.getByText('Missing talk group')).toBeInTheDocument();
  });
});
