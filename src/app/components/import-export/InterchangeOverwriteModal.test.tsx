import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ProjectEntityChange } from '@core/services/projectEntityDiff.ts';
import InterchangeOverwriteModal from './InterchangeOverwriteModal.tsx';
import { testProjectSyncDiff } from './testProjectSyncDiff.ts';

const backupLocalProjectYaml = vi.hoisted(() => vi.fn());
vi.mock('../../services/projectImportExportService.ts', () => ({ backupLocalProjectYaml }));

const CLEAN_LOCAL = { libraryModifiedAt: '2026-07-10T08:00:00.000Z' };
const DIRTY_LOCAL = { libraryModifiedAt: '2026-07-10T09:30:00.000Z' };
const NEWER_REMOTE = { lastModifiedAt: '2026-07-10T11:00:00.000Z', counts: { radioBuilds: 1 } };

function change(i: number, kind: ProjectEntityChange['change'] = 'added'): ProjectEntityChange {
  return { kind: 'channels', id: `c${i}`, name: `Chan ${i}`, change: kind };
}

function renderModal(props: Partial<React.ComponentProps<typeof InterchangeOverwriteModal>> = {}) {
  const onClose = vi.fn();
  const onConfirm = vi.fn();
  const onKeepLocal = vi.fn();
  const onImportAsNew = vi.fn();

  render(
    <InterchangeOverwriteModal
      opened
      projectName="Demo"
      diff={testProjectSyncDiff(CLEAN_LOCAL, NEWER_REMOTE)}
      localProjectId="proj-1"
      onClose={onClose}
      onConfirm={onConfirm}
      {...props}
    />,
  );

  return { onClose, onConfirm, onKeepLocal, onImportAsNew };
}

describe('InterchangeOverwriteModal', () => {
  beforeEach(() => {
    backupLocalProjectYaml.mockReset();
    backupLocalProjectYaml.mockResolvedValue('demo-local-backup.yaml');
  });

  it('asks which copy and shows both cards with the newer badge', () => {
    renderModal();
    expect(screen.getByText('Which copy of Demo do you want?')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'This browser' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Google Drive' })).toHaveTextContent('newer');
    expect(screen.getByRole('region', { name: 'Google Drive' })).toHaveTextContent(
      '+1 radio build',
    );
  });

  it('uses file wording when the source is a file', () => {
    renderModal({ source: 'file' });
    expect(screen.getByRole('region', { name: 'File' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use file copy' })).toBeInTheDocument();
  });

  it('without unsynced local edits: no warning, non-destructive primary', () => {
    const { onConfirm } = renderModal();
    expect(screen.getByText('No unsaved edits')).toBeInTheDocument();
    expect(screen.queryByText(/will be lost/)).not.toBeInTheDocument();
    const primary = screen.getByRole('button', { name: 'Use Drive copy' });
    expect(primary.className).not.toMatch(/destructive/);
    fireEvent.click(primary);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('with unsynced local edits: loss warning and destructive primary', () => {
    renderModal({ diff: testProjectSyncDiff(DIRTY_LOCAL, NEWER_REMOTE) });
    expect(
      screen.getByText(/Edits made in this browser after .* will be lost/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use Drive copy' }).className).toMatch(/destructive/);
  });

  it("Keep this browser's closes when no onKeepLocal is given", () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: "Keep this browser's" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Keep this browser's uses onKeepLocal when provided", () => {
    const onKeepLocal = vi.fn();
    const { onClose } = renderModal({ onKeepLocal });
    fireEvent.click(screen.getByRole('button', { name: "Keep this browser's" }));
    expect(onKeepLocal).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Back up local YAML exports the local project and stays open', async () => {
    const { onClose, onConfirm } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Back up local YAML' }));
    await waitFor(() => expect(backupLocalProjectYaml).toHaveBeenCalledWith('proj-1'));
    expect(await screen.findByText(/Downloaded demo-local-backup.yaml/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('shows mismatch actions and both project ids', () => {
    const { onConfirm, onImportAsNew } = renderModal({
      idMismatch: true,
      localProjectId: 'local-id',
      remoteProjectId: 'remote-id',
      onImportAsNew: vi.fn(),
    });
    expect(screen.getByText(/local-id/)).toBeInTheDocument();
    expect(screen.getByText(/remote-id/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "Keep this browser's" })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import as new project' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Replace local content' })).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onImportAsNew).not.toHaveBeenCalled();
  });

  it('calls confirm handlers from mismatch buttons', () => {
    const onConfirm = vi.fn();
    const onImportAsNew = vi.fn();
    renderModal({ idMismatch: true, onConfirm, onImportAsNew });
    fireEvent.click(screen.getByRole('button', { name: 'Replace local content' }));
    fireEvent.click(screen.getByRole('button', { name: 'Import as new project' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onImportAsNew).toHaveBeenCalledTimes(1);
  });

  it('lists changes with badges and caps them behind a show-all toggle', () => {
    const changes = [
      ...Array.from({ length: 9 }, (_, i) => change(i)),
      { kind: 'zones', id: 'z1', name: 'Zone X', change: 'changed' } as ProjectEntityChange,
    ];
    renderModal({ diff: testProjectSyncDiff(CLEAN_LOCAL, NEWER_REMOTE, changes) });
    expect(screen.getAllByText('Added')).toHaveLength(8);
    expect(screen.queryByText(/Zone X/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show all 10 changes' }));
    expect(screen.getByText(/Zone X/)).toBeInTheDocument();
    expect(screen.getByText('Changed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show fewer' }));
    expect(screen.queryByText(/Zone X/)).not.toBeInTheDocument();
  });

  it('says so when no entities differ', () => {
    renderModal();
    expect(
      screen.getByText(/No differences in channels, zones, or other items/),
    ).toBeInTheDocument();
  });

  it('surfaces import errors without closing', () => {
    renderModal({ error: 'YAML project id does not match active project' });
    expect(screen.getByText(/Import failed/)).toBeInTheDocument();
  });
});
