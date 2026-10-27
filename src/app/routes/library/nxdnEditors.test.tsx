import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  emptyLibrary,
  newDigitalContact,
  newRxGroupList,
  newTalkGroup,
} from '@core/domain/factories.ts';
import { TalkGroupEditor } from './TalkGroupEditor.tsx';
import { DigitalContactEditor } from './DigitalContactEditor.tsx';
import RxGroupListEditor from './RxGroupListEditor.tsx';

const mocks = vi.hoisted(() => ({
  putTalkGroup: vi.fn(),
  putDigitalContact: vi.fn(),
  putRxGroupList: vi.fn(),
}));

vi.mock('../../state/persistence.ts', () => ({ persistence: mocks }));
vi.mock('../../state/useLibrary.ts', async () => {
  const { emptyLibrary: empty } = await import('@core/domain/factories.ts');
  const library = empty();
  return {
    useLibrary: () => ({
      projectId: 'p',
      library,
      loading: false,
      reload: async () => {},
      deleteEntity: async () => ({ ok: true }),
      deleteAllDigitalContacts: async () => ({ ok: true }),
    }),
  };
});

function renderInRouter(element: React.ReactElement) {
  const router = createMemoryRouter([{ path: '*', element }], { initialEntries: ['/x'] });
  return render(<RouterProvider router={router} />);
}

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset().mockResolvedValue({ ok: true }));
});

describe('TalkGroupEditor NXDN ID', () => {
  it('blocks save for an out-of-range NXDN ID and shows the error', () => {
    renderInRouter(
      <TalkGroupEditor projectId="p" entity={newTalkGroup('p', 'T', 70000, 'nxdn')} />,
    );
    expect(screen.getAllByText(/NXDN IDs are 1.65519/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Save talk group' }));
    expect(mocks.putTalkGroup).not.toHaveBeenCalled();
  });

  it('saves an in-range NXDN ID', () => {
    renderInRouter(<TalkGroupEditor projectId="p" entity={newTalkGroup('p', 'T', 100, 'nxdn')} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save talk group' }));
    expect(mocks.putTalkGroup).toHaveBeenCalledTimes(1);
  });

  it('does not show the range error for a blank ID until a save is tried', () => {
    renderInRouter(<TalkGroupEditor projectId="p" entity={newTalkGroup('p', 'T', 100, 'nxdn')} />);
    fireEvent.change(screen.getByLabelText('NXDN ID'), { target: { value: '' } });
    expect(screen.queryByText(/NXDN IDs are 1.65519/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save talk group' }));
    expect(mocks.putTalkGroup).not.toHaveBeenCalled();
    expect(screen.getAllByText(/NXDN IDs are 1.65519/).length).toBeGreaterThan(0);
  });
});

describe('DigitalContactEditor NXDN ID', () => {
  it('blocks save for an out-of-range NXDN ID and shows the error', () => {
    renderInRouter(
      <DigitalContactEditor projectId="p" entity={newDigitalContact('p', 'C', 70000, 'nxdn')} />,
    );
    expect(screen.getAllByText(/NXDN IDs are 1.65519/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Save contact' }));
    expect(mocks.putDigitalContact).not.toHaveBeenCalled();
  });

  it('saves an in-range NXDN ID', () => {
    renderInRouter(
      <DigitalContactEditor projectId="p" entity={newDigitalContact('p', 'C', 100, 'nxdn')} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save contact' }));
    expect(mocks.putDigitalContact).toHaveBeenCalledTimes(1);
  });
});

describe('RxGroupListEditor mixed-mode warning', () => {
  const dmrTg = newTalkGroup('p', 'World', 91, 'dmr');
  const nxdnTg = newTalkGroup('p', 'NX', 10, 'nxdn');
  const library = { ...emptyLibrary(), talkGroups: [dmrTg, nxdnTg] };
  const member = (id: string) => ({ ref: { kind: 'talkGroup' as const, id } });

  it('warns, without blocking save, when members mix DMR and NXDN', () => {
    const list = {
      ...newRxGroupList('p', 'Mixed'),
      members: [member(dmrTg.id), member(nxdnTg.id)],
    };
    renderInRouter(<RxGroupListEditor projectId="p" entity={list} library={library} />);
    expect(screen.getByText(/mixes DMR and NXDN members/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save list' }));
    expect(mocks.putRxGroupList).toHaveBeenCalledTimes(1);
  });

  it('shows no warning for a single-mode list', () => {
    const list = { ...newRxGroupList('p', 'NX'), members: [member(nxdnTg.id)] };
    renderInRouter(<RxGroupListEditor projectId="p" entity={list} library={library} />);
    expect(screen.queryByText(/members\. Each radio/)).toBeNull();
  });
});
