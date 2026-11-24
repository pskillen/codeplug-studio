import { useState, type ReactNode } from 'react';
import { Alert, Text } from '@mantine/core';
import type { WriteErrorOutcome } from '../../../services/egress/writeErrorOutcome.ts';
import { sentStateLabel } from '../../../services/egress/writeErrorOutcome.ts';
import { Button } from '../../v2/index.ts';
import classes from './ErrorPanel.module.css';

export interface ErrorPanelProps {
  outcome: WriteErrorOutcome;
  retryLabel: string | null;
  onRetry?: () => void;
  wayOut?: ReactNode;
  testId?: string;
}

function titleForSent(sent: WriteErrorOutcome['sent']): string {
  if (sent === 'may-hold-part') return 'The write stopped part way';
  if (sent === 'nothing-saved') return 'The write stopped; nothing was saved';
  return 'Nothing was written';
}

export default function ErrorPanel({
  outcome,
  retryLabel,
  onRetry,
  wayOut,
  testId = 'error-panel',
}: ErrorPanelProps) {
  if (outcome.kind === 'cancelled') return null;

  const [copied, setCopied] = useState(false);
  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(`${outcome.message}\n\n${outcome.debugText}`);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Alert color="red" mb="sm" data-testid={testId}>
      <Text fw={600} mb={4}>
        {titleForSent(outcome.sent)}
      </Text>
      <span className={classes.chip}>{sentStateLabel(outcome.sent)}</span>
      <Text size="sm">{outcome.message}</Text>
      {retryLabel && onRetry ? (
        <div style={{ marginTop: 8 }}>
          <Button variant="primary" size="sm" onClick={onRetry}>
            {retryLabel}
          </Button>
        </div>
      ) : null}
      {wayOut}
      <details style={{ marginTop: 8 }} data-testid={`${testId}-debug`}>
        <summary>Debug details</summary>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, margin: '8px 0' }}>{outcome.debugText}</pre>
        <Button variant="secondary" size="sm" onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy debug text'}
        </Button>
      </details>
      <Text size="xs" className={classes.consoleHint} mt="xs">
        Also logged to the browser console as `[radio-write]`.
      </Text>
    </Alert>
  );
}