/**
 * Step 6: done (#1393). What was written, warnings, whether a check ran. Write another radio
 * returns to step 2 with the same ticks; Close ends the dialog.
 */

import { Alert, Stack, Text } from '@mantine/core';
import { formatExportWarning } from '@core/import-export/exportWarning.ts';
import { Button } from '../../../v2/index.ts';
import { maskSerial } from '../maskSerial.ts';
import classes from '../RadioWriteStepper.module.css';
import type {
  WriteFlowActions,
  WriteFlowView,
  WriteStepperConfig,
  WriteSummary,
} from '../types.ts';

interface StepProps {
  config: WriteStepperConfig;
  view: WriteFlowView;
  actions: WriteFlowActions;
}

function writtenLines(summary: WriteSummary): string[] {
  const lines: string[] = [];
  if (summary.codeplugWritten) {
    lines.push(
      summary.channelCount === 1
        ? 'Codeplug written (1 channel).'
        : `Codeplug written (${summary.channelCount} channels).`,
    );
  }
  if (summary.contactsWritten) lines.push('Digital contacts written.');
  if (summary.kepsResult) {
    lines.push(`Satellite keps written (${summary.kepsResult.written} transmitters).`);
  } else if (summary.kepsTicked) {
    lines.push(
      summary.kepsError
        ? `Satellite keps were not written: ${summary.kepsError}. Write them again from Write.`
        : 'Satellite keps: not written.',
    );
  }
  return lines;
}

function checkLine(summary: WriteSummary): string {
  switch (summary.checkStatus) {
    case 'passed':
      return 'Check write: passed. Every staged block matches what is on the radio.';
    case 'failed':
      return 'Check write: some staged blocks do not match.';
    case 'skipped':
      return 'Check write: skipped.';
    default:
      return 'Check write: not run.';
  }
}

export function DoneBody({ config, view, actions }: StepProps) {
  const summary = view.summary;
  if (!summary) return null;
  const who = summary.identity
    ? `${summary.identity.name ?? summary.identity.model}${
        summary.identity.serial ? ` (${maskSerial(summary.identity.serial)})` : ''
      }`
    : config.radioLabel;
  const kepsSkips = [
    ...(summary.kepsResult?.skipped ?? []).map((s) => `Skipped ${s.satelliteId}: ${s.reason}`),
    ...(summary.kepsResult?.skippedTransmitters ?? []).map(
      (s) => `Skipped ${s.satelliteId} / ${s.transmitterId}: ${s.reason}`,
    ),
  ];
  const notes = [...summary.warnings.map((w) => formatExportWarning(w)), ...kepsSkips];
  const kepsNotWritten = summary.kepsTicked && !summary.kepsResult;
  const wroteSomething = summary.codeplugWritten || summary.contactsWritten;
  return (
    <div className={classes.stack}>
      <Alert
        color={summary.checkStatus === 'failed' ? 'red' : kepsNotWritten ? 'yellow' : 'green'}
        title={
          kepsNotWritten
            ? wroteSomething
              ? `${who} written, satellite keps not written`
              : `${who}: satellite keps not written`
            : `${who} written`
        }
      >
        <Stack gap={2}>
          {writtenLines(summary).map((l) => (
            <Text key={l} size="sm">
              {l}
            </Text>
          ))}
          <Text size="sm">{checkLine(summary)}</Text>
          {config.successNote ? (
            <Text size="sm" data-testid="write-stepper-success-note">
              {config.successNote}
            </Text>
          ) : null}
        </Stack>
      </Alert>
      {summary.checkResult ? (
        <div>
          <Button variant="ghost" size="sm" onClick={actions.onViewCheckReport}>
            View check report
          </Button>
        </div>
      ) : null}
      {notes.length > 0 ? (
        <Alert color="yellow" title="Notes">
          <Stack gap={4}>
            {notes.map((n, i) => (
              <Text key={i} size="sm">
                {n}
              </Text>
            ))}
          </Stack>
        </Alert>
      ) : null}
    </div>
  );
}

export function DoneFooter({ actions }: StepProps) {
  return (
    <>
      <Button variant="secondary" size="sm" onClick={actions.onWriteAnother}>
        Write another radio
      </Button>
      <Button variant="primary" size="sm" onClick={actions.onClose}>
        Close
      </Button>
    </>
  );
}
