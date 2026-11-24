/**
 * Step 6: done (#1393). What was written, warnings, whether a check ran. Write another radio
 * returns to step 2 with the same ticks; Close ends the dialog.
 */

import { useState } from 'react';
import { Alert, Stack, Text } from '@mantine/core';
import type { ExportWarning } from '@core/import-export/exportWarning.ts';
import { pushKepsExcludedWarning } from '@core/import-export/exportWarning.ts';
import { WarningsList } from '../../../egress/index.ts';
import { Button, Checkbox } from '../../../v2/index.ts';
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
  if (summary.settingsChanged !== null) {
    lines.push(
      summary.settingsChanged === 0
        ? 'Radio settings: this radio already had them.'
        : `Radio settings written (${summary.settingsChanged} ${summary.settingsChanged === 1 ? 'change' : 'changes'}).`,
    );
  } else if (summary.settingsTicked) {
    lines.push('Radio settings: kept as this radio had them.');
  }
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
  const [timingsCopied, setTimingsCopied] = useState(false);
  const [timingsCopyFailed, setTimingsCopyFailed] = useState(false);
  const summary = view.summary;
  if (!summary) return null;
  const who = summary.identity
    ? `${summary.identity.name ?? summary.identity.model}${
        summary.identity.serial ? ` (${summary.identity.serial})` : ''
      }`
    : config.radioLabel;
  const recapWarnings: ExportWarning[] = [...summary.warnings];
  for (const s of summary.kepsResult?.skipped ?? []) {
    pushKepsExcludedWarning(recapWarnings, {
      satelliteId: s.satelliteId,
      transmitterId: null,
      reason: s.reason,
      label: s.satelliteId,
    });
  }
  for (const s of summary.kepsResult?.skippedTransmitters ?? []) {
    pushKepsExcludedWarning(recapWarnings, {
      satelliteId: s.satelliteId,
      transmitterId: s.transmitterId,
      reason: s.reason,
      label: `${s.satelliteId} / ${s.transmitterId}`,
    });
  }
  const kepsNotWritten = summary.kepsTicked && !summary.kepsResult;
  const wroteSomething =
    summary.codeplugWritten || summary.contactsWritten || summary.settingsChanged !== null;
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
          {config.options.successNote ? (
            <Text size="sm" data-testid="write-stepper-success-note">
              {config.options.successNote}
            </Text>
          ) : null}
        </Stack>
      </Alert>
      {config.radioSettings && summary.settingsTicked ? (
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Checkbox
            checked={config.radioSettings.applyToEveryRadio}
            onCheckedChange={config.radioSettings.onApplyToEveryRadioChange}
          />
          <Text size="sm">Don&apos;t ask again for other radios until I reload</Text>
        </label>
      ) : null}
      {summary.checkResult ? (
        <div>
          <Button variant="ghost" size="sm" onClick={actions.onViewCheckReport}>
            View check report
          </Button>
        </div>
      ) : null}
      {summary.writeTimings ? (
        <div>
          <Button
            variant="ghost"
            size="sm"
            data-testid="write-stepper-copy-timings"
            onClick={() => {
              const text = summary.writeTimings!;
              void navigator.clipboard
                .writeText(text)
                .then(() => setTimingsCopied(true))
                .catch(() => {
                  console.warn('[d890-write-timing] clipboard write failed');
                  setTimingsCopyFailed(true);
                });
            }}
          >
            {timingsCopied ? 'Copied' : timingsCopyFailed ? 'Copy failed' : 'Copy write timings'}
          </Button>
        </div>
      ) : null}
      {recapWarnings.length > 0 ? (
        <WarningsList warnings={recapWarnings} mode="recap" channelLabel={view.channelLabel} />
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
