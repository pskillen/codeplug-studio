/**
 * Blocking modal for Web Serial read/write — steps, progress, keep-tab warning.
 * Presentational only; parent owns cancel and phase updates from existing ProgressFn.
 */

import { Alert, Button, Group, Modal, Progress, Stack, Text } from '@mantine/core';
import type { ProgressUpdate } from '@integrations/radio-io/types.ts';

export type RadioIoOperation = 'read' | 'write';

export type RadioIoProgressPhase = 'connecting' | 'preparing' | 'transfer' | 'saving';

export interface RadioIoProgressModalProps {
  opened: boolean;
  operation: RadioIoOperation;
  phase: RadioIoProgressPhase;
  progress: ProgressUpdate | null;
  /** True when the operator tried to navigate away while busy. */
  navigationBlocked?: boolean;
  onCancel: () => void;
}

interface StepDef {
  id: RadioIoProgressPhase;
  label: string;
}

const READ_STEPS: readonly StepDef[] = [
  { id: 'connecting', label: 'Connect and handshake' },
  { id: 'transfer', label: 'Download clone image' },
  { id: 'saving', label: 'Save image on this build' },
];

const WRITE_STEPS: readonly StepDef[] = [
  { id: 'connecting', label: 'Connect and handshake' },
  { id: 'preparing', label: 'Assemble channels into image' },
  { id: 'transfer', label: 'Upload to radio' },
];

function stepStatus(
  stepId: RadioIoProgressPhase,
  phase: RadioIoProgressPhase,
  steps: readonly StepDef[],
): 'done' | 'active' | 'pending' {
  const order = steps.map((s) => s.id);
  const stepIdx = order.indexOf(stepId);
  const phaseIdx = order.indexOf(phase);
  if (stepIdx < 0 || phaseIdx < 0) return 'pending';
  if (stepIdx < phaseIdx) return 'done';
  if (stepIdx === phaseIdx) return 'active';
  return 'pending';
}

export default function RadioIoProgressModal({
  opened,
  operation,
  phase,
  progress,
  navigationBlocked = false,
  onCancel,
}: RadioIoProgressModalProps) {
  const steps = operation === 'read' ? READ_STEPS : WRITE_STEPS;
  const title = operation === 'read' ? 'Reading from radio' : 'Writing to radio';
  const percent = progress?.max ? Math.min(100, (100 * progress.cur) / progress.max) : undefined;

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
        <Alert color="orange" title="Keep this tab open">
          Do not switch away, close the tab, or navigate elsewhere while the serial link is active.
          Leaving can interrupt the transfer and leave the radio or port in a bad state.
        </Alert>

        {navigationBlocked ? (
          <Alert color="red" title="Stay on this page">
            Navigation is blocked until this transfer finishes or you cancel.
          </Alert>
        ) : null}

        <Stack gap={6}>
          {steps.map((step) => {
            const status = stepStatus(step.id, phase, steps);
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

        {phase === 'transfer' ? (
          <Stack gap={4}>
            <Text size="sm">
              {progress?.msg ?? 'Transferring…'}
              {progress ? ` (${progress.cur}/${progress.max})` : ''}
            </Text>
            <Progress value={percent ?? 0} animated={percent == null || percent < 100} size="lg" />
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            {phase === 'connecting'
              ? 'Waiting for port and radio handshake…'
              : phase === 'preparing'
                ? 'Building the image from this format build…'
                : 'Saving hydration on the build…'}
          </Text>
        )}

        <Group justify="flex-end">
          <Button variant="default" color="gray" onClick={onCancel}>
            Cancel
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
