/**
 * Blocking modal for Web Serial read/write — steps, progress, keep-tab warning.
 * Presentational only; parent owns cancel / dismiss and phase updates from ProgressFn.
 */

import { Alert, Button, Group, Modal, Progress, Stack, Text } from '@mantine/core';
import type { ProgressUpdate } from '@integrations/radio-io/types.ts';

export type RadioIoOperation = 'read' | 'write';

export type RadioIoProgressPhase =
  | 'connecting'
  | 'preparing'
  | 'transfer'
  | 'saving'
  | 'done';

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
): StepDef[] {
  if (operation === 'write') {
    const steps: StepDef[] = [
      { id: 'connecting', label: 'Connect and handshake' },
      { id: 'preparing', label: 'Assemble channels into image' },
      ...(transferStages.length > 0
        ? transferStages.map((label) => ({ id: `stage:${label}`, label }))
        : [{ id: 'transfer', label: 'Upload to radio' }]),
    ];
    if (phase === 'done') {
      steps.push({ id: 'done', label: 'Write complete' });
    }
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
): string {
  if (phase === 'connecting') return 'connecting';
  if (phase === 'preparing') return 'preparing';
  if (phase === 'saving') return 'saving';
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

export default function RadioIoProgressModal({
  opened,
  operation,
  phase,
  progress,
  transferStages = [],
  navigationBlocked = false,
  onCancel,
  onClose,
}: RadioIoProgressModalProps) {
  const steps = buildSteps(operation, transferStages, phase);
  const activeId = activeStepId(phase, progress, transferStages);
  const title = operation === 'read' ? 'Reading from radio' : 'Writing to radio';
  const percent = progress?.max ? Math.min(100, (100 * progress.cur) / progress.max) : undefined;
  const complete = phase === 'done';

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
        {complete ? (
          <Alert color="green" title={operation === 'write' ? 'Write finished' : 'Read finished'}>
            {operation === 'write'
              ? 'All selected blocks were sent. Review the checklist below, then close when ready.'
              : 'Clone image is saved on this build. You can close this dialog.'}
          </Alert>
        ) : (
          <Alert color="orange" title="Keep this tab open">
            Do not switch away, close the tab, or navigate elsewhere while the serial link is
            active. Leaving can interrupt the transfer and leave the radio or port in a bad state.
          </Alert>
        )}

        {navigationBlocked && !complete ? (
          <Alert color="red" title="Stay on this page">
            Navigation is blocked until this transfer finishes or you cancel.
          </Alert>
        ) : null}

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

        {!complete && phase === 'transfer' ? (
          <Stack gap={4}>
            <Text size="sm">
              {progress?.msg ?? 'Transferring…'}
              {progress ? ` (${progress.cur}/${progress.max})` : ''}
            </Text>
            <Progress value={percent ?? 0} animated={percent == null || percent < 100} size="lg" />
          </Stack>
        ) : !complete ? (
          <Text size="sm" c="dimmed">
            {phase === 'connecting'
              ? 'Waiting for port and radio handshake…'
              : phase === 'preparing'
                ? 'Building the image from this format build…'
                : phase === 'saving'
                  ? 'Saving hydration on the build…'
                  : 'Transferring…'}
          </Text>
        ) : progress?.msg ? (
          <Text size="sm" c="dimmed">
            Last: {progress.msg}
          </Text>
        ) : null}

        <Group justify="flex-end">
          {complete ? (
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
