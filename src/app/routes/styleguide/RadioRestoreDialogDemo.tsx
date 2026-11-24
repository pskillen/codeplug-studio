import { useState } from 'react';
import { Group } from '@mantine/core';
import { Button } from '../../components/v2/index.ts';
import RadioRestoreDialog from '../../components/builds/RadioRestoreDialog/RadioRestoreDialog.tsx';
import type {
  RestoreFlowActions,
  RestoreFlowView,
} from '../../components/builds/RadioRestoreDialog/useRadioRestoreFlow.ts';
import type { WriteShellOptions } from '../../services/egress/writeShellOptions.ts';
import { createMemoryMap } from '@integrations/radio-io/kit/memoryMap.ts';
import { RADIO_BACKUP_FORMAT, RADIO_BACKUP_VERSION } from '@integrations/radio-io/backup/index.ts';

const DEMO_OPTIONS: WriteShellOptions = {
  radioLabel: 'AT-D890UV',
  parts: { contacts: false, keps: false, settings: false },
  contactStore: 'generic',
  readPlan: true,
  programHoldSafeMs: 30_000,
  restartAfterEndSeconds: 0,
  check: { available: false },
};

const DEMO_BACKUP = {
  source: 'file' as const,
  manifest: {
    format: RADIO_BACKUP_FORMAT,
    version: RADIO_BACKUP_VERSION,
    capturedAt: '2026-08-13T12:00:00.000Z',
    capturedVia: 'web-serial' as const,
    app: { buildEnv: 'test', buildVersion: '0' },
    radioModelId: 'AT-D890UV',
    descriptorLabel: 'AT-D890UV',
    coverage: 'full-clone' as const,
    imageByteLength: 16,
    serial: 'SN-FULL-STYLEGUIDE-0099887766',
    regions: [
      {
        id: 'channels',
        label: 'Channels',
        address: 0,
        byteLength: 8,
        path: 'regions/channels.bin',
        restoreRole: 'restorable' as const,
      },
    ],
  },
  image: createMemoryMap(16),
  zipBytes: new Uint8Array(4),
};

const noop: RestoreFlowActions = {
  onClose: () => undefined,
  onAbort: () => undefined,
  onCancelReview: () => undefined,
  onRestore: () => undefined,
  onRetry: () => undefined,
  onBackToExport: () => undefined,
};

export default function RadioRestoreDialogDemo() {
  const [mode, setMode] = useState<'review' | 'refusal' | null>(null);

  const view: RestoreFlowView =
    mode === 'refusal'
      ? {
          open: true,
          step: 'connect',
          busy: false,
          errorOutcome: {
            kind: 'error',
            retry: 'none',
            sent: 'nothing-sent',
            message:
              'Restore refused — connected serial "SN-FULL-WRONG-123" does not match backup serial "SN-FULL-STYLEGUIDE-0099887766".',
            debugText: 'error: RadioRestoreError\ncode: serial-mismatch',
            code: 'serial-mismatch',
          },
          retryLabel: null,
          preflight: {
            status: 'refused',
            identity: { model: 'AT-D890UV' },
            rows: [
              { label: 'Model', value: 'AT-D890UV', status: 'ok' },
              { label: 'Serial', value: 'SN-FULL-WRONG-123', status: 'ok' },
              {
                label: 'Serial matches the backup',
                value: 'SN-FULL-STYLEGUIDE-0099887766',
                status: 'warn',
              },
            ],
          },
          identity: null,
          rangeMismatch: false,
          regionIds: ['channels'],
          backup: DEMO_BACKUP,
          progress: null,
          restoreStartedAt: null,
          restoreRows: [],
          restartSecondsLeft: 0,
        }
      : mode === 'review'
        ? {
            open: true,
            step: 'review',
            busy: false,
            errorOutcome: null,
            retryLabel: null,
            preflight: { status: 'passed', rows: [] },
            identity: { label: 'AT-D890UV', serial: 'SN-FULL-STYLEGUIDE-0099887766' },
            rangeMismatch: true,
            regionIds: ['channels'],
            backup: DEMO_BACKUP,
            progress: null,
            restoreStartedAt: null,
            restoreRows: [],
            restartSecondsLeft: 0,
          }
        : {
            open: false,
            step: 'connect',
            busy: false,
            errorOutcome: null,
            retryLabel: null,
            preflight: { status: 'checking', rows: [] },
            identity: null,
            rangeMismatch: false,
            regionIds: [],
            backup: null,
            progress: null,
            restoreStartedAt: null,
            restoreRows: [],
            restartSecondsLeft: 0,
          };

  return (
    <>
      <Group gap="sm">
        <Button variant="secondary" size="sm" onClick={() => setMode('review')}>
          Restore · Review
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setMode('refusal')}>
          Restore · serial mismatch
        </Button>
      </Group>
      <RadioRestoreDialog
        options={DEMO_OPTIONS}
        view={
          mode === 'review'
            ? {
                ...view,
                identity: view.identity,
              }
            : view
        }
        actions={{
          ...noop,
          onClose: () => setMode(null),
          onCancelReview: () => setMode(null),
        }}
      />
    </>
  );
}
