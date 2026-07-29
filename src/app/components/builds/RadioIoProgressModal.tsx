/**
 * Blocking modal for Web Serial read/write — steps, progress, keep-tab warning.
 * Presentational only; parent owns cancel / dismiss and phase updates from ProgressFn.
 */

import { Alert, Button, Group, Modal, Progress, ScrollArea, Stack, Text } from '@mantine/core';
import type { ProgressUpdate } from '@integrations/radio-io/types.ts';

export type RadioIoOperation = 'read' | 'write';

export type RadioIoProgressPhase =
  'connecting' | 'preparing' | 'transfer' | 'saving' | 'verifying' | 'done';

export type RadioIoWriteVerifyStatus = 'none' | 'unverified' | 'verifying' | 'verified' | 'failed';

export interface RadioIoProgressModalProps {
  opened: boolean;
  operation: RadioIoOperation;
  phase: RadioIoProgressPhase;
  progress: ProgressUpdate | null;
  /**
   * Transfer checklist labels accumulated from `ProgressUpdate.stage` (e.g. Channels,
   * Zones). Shown as extra list items between connect and save/upload.
   */
  transferStages?: readonly string[];
  /** True when the operator tried to navigate away while busy. */
  navigationBlocked?: boolean;
  /** AT-D890 optional post-write full-memory verify. */
  writeVerifyStatus?: RadioIoWriteVerifyStatus;
  /** When false during `unverified`, Verify write stays disabled (brief post-write debounce). */
  verifyButtonEnabled?: boolean;
  onVerify?: () => void;
  onCloseWithoutVerify?: () => void;
  /** Abort in-flight transfer (shown while not complete). */
  onCancel: () => void;
  /** Dismiss after success (`phase === 'done'`). Write keeps the modal open until this. */
  onClose?: () => void;
}

interface StepDef {
  id: string;
  label: string;
}

function buildSteps(
  operation: RadioIoOperation,
  transferStages: readonly string[],
  phase: RadioIoProgressPhase,
  writeVerifyStatus: RadioIoWriteVerifyStatus,
): StepDef[] {
  if (operation === 'write') {
    const postUpload = writeVerifyStatus !== 'none' || phase === 'done' || phase === 'verifying';

    if (postUpload) {
      const steps: StepDef[] = [
        { id: 'connecting', label: 'Connect and handshake' },
        { id: 'preparing', label: 'Assemble channels into image' },
        { id: 'transfer', label: 'Upload to radio' },
      ];
      if (writeVerifyStatus !== 'none') {
        steps.push({ id: 'verify', label: 'Verify write (optional)' });
      }
      if (phase === 'done' && writeVerifyStatus === 'verified') {
        steps.push({ id: 'done', label: 'Write complete — verify passed' });
      } else if (phase === 'done' && writeVerifyStatus === 'failed') {
        steps.push({ id: 'done', label: 'Write complete — verify failed' });
      } else if (phase === 'done' && writeVerifyStatus === 'none') {
        steps.push({ id: 'done', label: 'Write complete' });
      }
      return steps;
    }

    const steps: StepDef[] = [
      { id: 'connecting', label: 'Connect and handshake' },
      { id: 'preparing', label: 'Assemble channels into image' },
      ...(transferStages.length > 0
        ? transferStages.map((label) => ({ id: `stage:${label}`, label }))
        : [{ id: 'transfer', label: 'Upload to radio' }]),
    ];
    return steps;
  }
  const steps: StepDef[] = [
    { id: 'connecting', label: 'Connect and handshake' },
    ...(transferStages.length > 0
      ? transferStages.map((label) => ({ id: `stage:${label}`, label }))
      : [{ id: 'transfer', label: 'Download clone image' }]),
    { id: 'saving', label: 'Save image on this build' },
  ];
  if (phase === 'done') {
    steps.push({ id: 'done', label: 'Read complete' });
  }
  return steps;
}

function activeStepId(
  phase: RadioIoProgressPhase,
  progress: ProgressUpdate | null,
  transferStages: readonly string[],
  writeVerifyStatus: RadioIoWriteVerifyStatus,
): string {
  if (phase === 'connecting') return 'connecting';
  if (phase === 'preparing') return 'preparing';
  if (phase === 'saving') return 'saving';
  if (phase === 'verifying' || writeVerifyStatus === 'verifying') return 'verify';
  if (phase === 'done' && (writeVerifyStatus === 'verified' || writeVerifyStatus === 'failed')) {
    return 'done';
  }
  if (phase === 'done' && writeVerifyStatus === 'unverified') {
    return 'verify';
  }
  if (phase === 'done') return 'done';
  if (progress?.stage) return `stage:${progress.stage}`;
  if (transferStages.length > 0) return `stage:${transferStages[transferStages.length - 1]}`;
  return 'transfer';
}

function stepStatus(
  stepId: string,
  activeId: string,
  steps: readonly StepDef[],
): 'done' | 'active' | 'pending' {
  const stepIdx = steps.findIndex((s) => s.id === stepId);
  const activeIdx = steps.findIndex((s) => s.id === activeId);
  if (stepIdx < 0 || activeIdx < 0) return 'pending';
  if (stepIdx < activeIdx) return 'done';
  if (stepIdx === activeIdx) return 'active';
  return 'pending';
}

function writeDoneAlert(writeVerifyStatus: RadioIoWriteVerifyStatus): {
  color: string;
  title: string;
  body: string;
} {
  if (writeVerifyStatus === 'verified') {
    return {
      color: 'green',
      title: 'Write finished — verify passed',
      body: 'Every staged block Studio transmitted matches what is on the radio now, and preserved settings are unchanged.',
    };
  }
  if (writeVerifyStatus === 'failed') {
    return {
      color: 'red',
      title: 'Write verify failed',
      body: 'Some staged blocks or preserved settings do not match. See the verify report for addresses and regions.',
    };
  }
  if (writeVerifyStatus === 'unverified') {
    return {
      color: 'blue',
      title: 'Write finished',
      body: 'The radio restarts after a write while flash commits. Wait until it shows its normal screen, then click Verify write to reconnect and compare memory byte-for-byte with what was transmitted.',
    };
  }
  if (writeVerifyStatus === 'verifying') {
    return {
      color: 'blue',
      title: 'Verifying write',
      body: 'Reading modelled memory from the radio and comparing against what Studio transmitted.',
    };
  }
  return {
    color: 'green',
    title: 'Write finished',
    body: 'All selected blocks were sent. Review the checklist below, then close when ready.',
  };
}

export default function RadioIoProgressModal({
  opened,
  operation,
  phase,
  progress,
  transferStages = [],
  navigationBlocked = false,
  writeVerifyStatus = 'none',
  verifyButtonEnabled = true,
  onVerify,
  onCloseWithoutVerify,
  onCancel,
  onClose,
}: RadioIoProgressModalProps) {
  const steps = buildSteps(operation, transferStages, phase, writeVerifyStatus);
  const activeId = activeStepId(phase, progress, transferStages, writeVerifyStatus);
  const title = operation === 'read' ? 'Reading from radio' : 'Writing to radio';
  const percent = progress?.max ? Math.min(100, (100 * progress.cur) / progress.max) : undefined;
  const complete = phase === 'done';
  const verifying = phase === 'verifying' || writeVerifyStatus === 'verifying';
  const awaitingVerify = writeVerifyStatus === 'unverified';
  const showPostUploadAlert = complete || verifying || writeVerifyStatus === 'unverified';

  return (
    <Modal
      opened={opened}
      onClose={() => undefined}
      title={title}
      centered
      size="md"
      closeOnClickOutside={false}
      closeOnEscape={false}
      withCloseButton={false}
    >
      <Stack gap="md">
        {showPostUploadAlert ? (
          <>
            {(() => {
              const alert =
                operation === 'write'
                  ? writeDoneAlert(writeVerifyStatus)
                  : {
                      color: 'green',
                      title: 'Read finished',
                      body: 'Clone image is saved on this build. You can close this dialog.',
                    };
              return (
                <Alert color={alert.color} title={alert.title}>
                  <Text size="sm">{alert.body}</Text>
                </Alert>
              );
            })()}
          </>
        ) : (
          <Alert color="orange" title="Keep this tab open">
            Do not switch away, close the tab, or navigate elsewhere while the serial link is
            active. Leaving can interrupt the transfer and leave the radio or port in a bad state.
          </Alert>
        )}

        {navigationBlocked && !complete && !verifying ? (
          <Alert color="red" title="Stay on this page">
            Navigation is blocked until this transfer finishes or you cancel.
          </Alert>
        ) : null}

        <ScrollArea.Autosize mah={160} type="auto">
          <Stack gap={6}>
            {steps.map((step) => {
              const status = stepStatus(step.id, activeId, steps);
              return (
                <Text
                  key={step.id}
                  size="sm"
                  fw={status === 'active' ? 600 : 400}
                  c={status === 'pending' ? 'dimmed' : undefined}
                >
                  {status === 'done' ? '✓ ' : status === 'active' ? '→ ' : '· '}
                  {step.label}
                </Text>
              );
            })}
          </Stack>
        </ScrollArea.Autosize>

        {verifying ? (
          <Stack gap={4}>
            <Text size="sm">
              {progress?.msg ?? 'Reading memory…'}
              {progress ? ` (${progress.cur}/${progress.max})` : ''}
            </Text>
            <Progress value={percent ?? 0} animated={percent == null || percent < 100} size="lg" />
          </Stack>
        ) : !complete && phase === 'transfer' ? (
          <Stack gap={4}>
            <Text size="sm">
              {progress?.msg ?? 'Transferring…'}
              {progress ? ` (${progress.cur}/${progress.max})` : ''}
            </Text>
            <Progress value={percent ?? 0} animated={percent == null || percent < 100} size="lg" />
          </Stack>
        ) : !complete && !verifying ? (
          <Text size="sm" c="dimmed">
            {phase === 'connecting'
              ? 'Waiting for port and radio handshake…'
              : phase === 'preparing'
                ? 'Building the image from this format build…'
                : phase === 'saving'
                  ? 'Saving hydration on the build…'
                  : 'Transferring…'}
          </Text>
        ) : null}

        <Group justify="flex-end">
          {complete && awaitingVerify ? (
            <>
              <Button variant="default" onClick={() => onCloseWithoutVerify?.()}>
                Skip verify
              </Button>
              <Button
                onClick={() => onVerify?.()}
                disabled={writeVerifyStatus === 'unverified' && !verifyButtonEnabled}
              >
                Verify write
              </Button>
            </>
          ) : complete ? (
            <Button onClick={() => onClose?.()}>Close</Button>
          ) : (
            <Button variant="default" color="gray" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  );
}
