import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import InterchangeOverwriteModal from './InterchangeOverwriteModal.tsx';
import { testProjectSyncDiff } from './testProjectSyncDiff.ts';

function renderModal(props: Partial<React.ComponentProps<typeof InterchangeOverwriteModal>> = {}) {
  const onClose = vi.fn();
  const onConfirm = vi.fn();
  const onImportAsNew = vi.fn();

  render(
    <MantineProvider>
      <InterchangeOverwriteModal
        opened
        title="Refresh from Google Drive?"
        projectName="Demo"
        diff={testProjectSyncDiff({}, { counts: { channels: 3 } })}
        onClose={onClose}
        onConfirm={onConfirm}
        {...props}
      />
    </MantineProvider>,
  );

  return { onClose, onConfirm, onImportAsNew };
}

describe('InterchangeOverwriteModal', () => {
  it('shows single overwrite button when project ids match', () => {
    renderModal();

    expect(screen.getByRole('button', { name: 'Overwrite local copy' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Import as new project' })).not.toBeInTheDocument();
    expect(screen.getByText('Channels')).toBeInTheDocument();
  });

  it('shows mismatch override actions when project ids differ', () => {
    renderModal({
      idMismatch: true,
      localProjectId: 'local-id',
      remoteProjectId: 'remote-id',
      onImportAsNew: vi.fn(),
    });

    expect(screen.getByText(/Local project id: local-id/)).toBeInTheDocument();
    expect(screen.getByText(/Remote project id: remote-id/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Replace local content' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import as new project' })).toBeInTheDocument();
  });

  it('surfaces import errors without closing', () => {
    renderModal({ error: 'YAML project id does not match active project' });

    expect(screen.getByText('Import failed')).toBeInTheDocument();
    expect(screen.getByText(/does not match active project/)).toBeInTheDocument();
  });

  it('calls confirm handlers from buttons', () => {
    const onConfirm = vi.fn();
    const onImportAsNew = vi.fn();
    renderModal({ idMismatch: true, onConfirm, onImportAsNew });

    fireEvent.click(screen.getByRole('button', { name: 'Replace local content' }));
    fireEvent.click(screen.getByRole('button', { name: 'Import as new project' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onImportAsNew).toHaveBeenCalledTimes(1);
  });
});
