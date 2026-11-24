import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { getDebugReadHistory } from './debugReadHistory.ts';
import { exampleArchive } from './debugReadHistory.fixture.ts';
import { SiblingReads } from './SiblingReads.tsx';
import type { RadioDebugDescriptor } from './descriptors.ts';

const rf: Pick<RadioDebugDescriptor, 'radio' | 'firmware'> = {
  radio: 'md-9600',
  firmware: 'radiofoundry',
};

afterEach(() => {
  act(() => {
    getDebugReadHistory({ slug: 'md-9600-opengd77', archiveModelId: 'MD-9600' }).clear();
    getDebugReadHistory({ slug: 'rt95', archiveModelId: 'retevis-rt95' }).clear();
  });
});

describe('SiblingReads', () => {
  it('summarises sibling history and calls onSwitch', () => {
    const og = getDebugReadHistory({ slug: 'md-9600-opengd77', archiveModelId: 'MD-9600' });
    const archive = exampleArchive();
    og.add({ ...archive, manifest: { ...archive.manifest, radioModelId: 'MD-9600' } });
    const firstId = og.getSnapshot().entries[0]!.id;
    act(() => og.markDownloaded([firstId]));
    og.add({ ...archive, manifest: { ...archive.manifest, radioModelId: 'MD-9600' } });
    const onSwitch = vi.fn();
    render(
      <MantineProvider>
        <SiblingReads descriptor={rf} onSwitch={onSwitch} />
      </MantineProvider>,
    );
    expect(
      screen.getByText(/2 OpenGD77 reads in this tab \(1 not downloaded\)/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Switch' }));
    expect(onSwitch).toHaveBeenCalledWith('opengd77');
  });

  it('renders nothing when the sibling store is empty', () => {
    render(
      <MantineProvider>
        <SiblingReads descriptor={rf} onSwitch={vi.fn()} />
      </MantineProvider>,
    );
    expect(screen.queryByText(/reads in this tab/)).not.toBeInTheDocument();
  });

  it('renders nothing for a single-firmware radio', () => {
    const archive = exampleArchive();
    getDebugReadHistory({ slug: 'rt95', archiveModelId: 'retevis-rt95' }).add({
      ...archive,
      manifest: { ...archive.manifest, radioModelId: 'retevis-rt95' },
    });
    render(
      <MantineProvider>
        <SiblingReads descriptor={{ radio: 'rt95', firmware: 'stock' }} onSwitch={vi.fn()} />
      </MantineProvider>,
    );
    expect(screen.queryByText(/reads in this tab/)).not.toBeInTheDocument();
  });
});
