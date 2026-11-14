import { NativeSelect } from '@mantine/core';
import { useState } from 'react';

import type { FirmwareRadioLayoutQuestion, RadioInfoAnswers } from '@core/firmware/types.ts';

import { Button, Panel, StatusBanner, TextInput } from '../../../components/v2/index.ts';
import {
  grantFirmwareRadioReportPort,
  readFirmwareRadioReport,
} from '../../../services/firmwareFlash.ts';
import classes from '../FirmwareFlasherPage.module.css';
import { radioCheckAnswer, radioCheckSetup, type RadioReadStatus } from '../radioCheck.ts';
import DeveloperOnly from './DeveloperOnly.tsx';
import type { WizardStepProps } from './stepTypes.ts';

/** The radio's Radio Info lines, for a radio whose firmware comes in more than one flash layout. From its descriptor. */
function RadioLayoutQuestion({
  question,
  answers,
  onChange,
}: {
  question: FirmwareRadioLayoutQuestion;
  answers: RadioInfoAnswers;
  onChange: (patch: Partial<RadioInfoAnswers>) => void;
}) {
  return (
    <>
      <p className={classes.copy}>{question.intro}</p>
      <ol className={classes.list}>
        {question.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      {question.warning ? <StatusBanner tone="warning">{question.warning}</StatusBanner> : null}
      <RadioInfoLine
        label={question.firmwareLabel}
        help={question.firmwareHelp}
        options={question.firmwareOptions}
        value={answers.firmware}
        onChange={(firmware) => onChange({ firmware })}
      />
      {question.suffixLabel ? (
        <RadioInfoLine
          label={question.suffixLabel}
          help={question.suffixHelp}
          options={question.suffixOptions}
          value={answers.suffix ?? ''}
          onChange={(suffix) => onChange({ suffix })}
        />
      ) : null}
      <RadioInfoLine
        label={question.hardwareLabel}
        help={question.hardwareHelp}
        options={question.hardwareOptions}
        value={answers.hardware}
        onChange={(hardware) => onChange({ hardware })}
      />
    </>
  );
}

/** One Radio Info line: a dropdown of the supported values where the descriptor lists them, else typed. */
function RadioInfoLine({
  label,
  help,
  options,
  value,
  onChange,
}: {
  label: string;
  help?: string;
  options: readonly string[] | undefined;
  value: string;
  onChange: (value: string) => void;
}) {
  if (!options) {
    return (
      <TextInput label={label} value={value} onChange={(e) => onChange(e.target.value)} mono />
    );
  }
  return (
    <NativeSelect
      label={label}
      description={help}
      value={value}
      data={[{ value: '', label: 'Choose…', disabled: true }, ...options]}
      onChange={(e) => onChange(e.currentTarget.value)}
    />
  );
}

/** Shown when the read found no report: the question below is then asked. */
const NO_REPORT_NOTE =
  'Studio found no MM9PDY radio report: the radio runs stock firmware, or an MM9PDY build from before the report.';

/**
 * Read the radio before update mode, for a radio whose firmware may report about itself. Read-only: one handshake and
 * one read. A report decides the layout; no report, or a failed read, falls back to the Radio Info question.
 */
function ReadRadio({
  report,
  status,
  radioId,
  onRead,
}: {
  report: NonNullable<FirmwareRadioLayoutQuestion['report']>;
  status: RadioReadStatus | null;
  radioId: WizardStepProps['updater']['radioId'];
  onRead: (status: RadioReadStatus | null) => void;
}) {
  const [reading, setReading] = useState(false);
  const read = async () => {
    setReading(true);
    onRead(null);
    try {
      const port = await grantFirmwareRadioReportPort(radioId);
      const out = await readFirmwareRadioReport({ radioId, port });
      if (!out.ok) {
        onRead({ kind: 'failed', message: out.message });
        return;
      }
      const answer = report.resolve(out.bytes);
      onRead(answer ? { kind: 'report', answer } : { kind: 'none' });
    } catch (err) {
      onRead({
        kind: 'failed',
        message: err instanceof Error ? err.message : 'The radio was not read.',
      });
    } finally {
      setReading(false);
    }
  };
  return (
    <>
      <p className={classes.copy}>{report.intro}</p>
      <ol className={classes.list}>
        {report.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <div>
        <Button onClick={read} disabled={reading}>
          {reading ? 'Reading…' : status ? 'Read the radio again' : 'Read the radio'}
        </Button>
      </div>
      {status?.kind === 'none' ? <p className={classes.muted}>{NO_REPORT_NOTE}</p> : null}
      {status?.kind === 'failed' ? (
        <StatusBanner tone="warning">
          Studio couldn't read the radio: {status.message} Nothing was written. Check the radio is
          switched on normally and the cable is in, then read it again, or answer from its Radio
          Info screen below.
        </StatusBanner>
      ) : null}
    </>
  );
}

/** Shown once the check passes. */
export const RADIO_CHECK_PASSED = 'Studio can update this radio. Continue to the stock firmware.';
/** Shown once the check passes and a release is chosen. */
export const RADIO_CHECK_PASSED_RELEASE =
  'Studio can update this radio, and the chosen release has a file for it. Continue to the stock firmware.';

/**
 * "Your radio": read the radio, or ask its Radio Info lines, before Studio asks for any stock file (#1670). Only for a
 * radio whose firmware comes in more than one flash layout. Nothing here is sent to the radio but the read-only
 * report read; Prepare computes the same answer again and runs every interlock on it.
 */
export default function RadioCheckStep({ state, dispatch, updater }: WizardStepProps) {
  const setup = radioCheckSetup(updater);
  if (!setup) return null;
  const { question, report } = setup;
  const { answer, asksQuestion, radioLayout, unavailable } = radioCheckAnswer(state, setup);
  return (
    <Panel title="Your radio" sub="Check Studio can update this radio before you find any files.">
      <div className={classes.stack}>
        {report ? (
          <ReadRadio
            report={report}
            status={state.radioRead}
            radioId={updater.radioId}
            onRead={(status) => dispatch({ type: 'radioRead', status })}
          />
        ) : null}
        {asksQuestion ? (
          <RadioLayoutQuestion
            question={question}
            answers={state.radioInfo}
            onChange={(patch) => dispatch({ type: 'setRadioInfo', patch })}
          />
        ) : null}
        {answer?.kind === 'refused' ? (
          <StatusBanner tone="warning">{answer.message}</StatusBanner>
        ) : null}
        {answer?.kind === 'refused' && answer.detail ? (
          <DeveloperOnly>
            <p className={classes.muted}>{answer.detail}</p>
          </DeveloperOnly>
        ) : null}
        <RadioAnswerDetails answer={answer} />
        {answer?.kind === 'incomplete' && asksQuestion ? (
          <p className={classes.muted}>Answer each line to go on.</p>
        ) : null}
        {unavailable ? (
          <StatusBanner tone="warning">
            {unavailable} Nothing was prepared or sent to the radio.
            {radioLayout ? <DeveloperOnly>{` Flash layout: ${radioLayout}.`}</DeveloperOnly> : null}
          </StatusBanner>
        ) : null}
        {answer?.kind === 'layout' && !unavailable ? (
          <StatusBanner tone="success">
            {state.loadedPatch ? RADIO_CHECK_PASSED_RELEASE : RADIO_CHECK_PASSED}
          </StatusBanner>
        ) : null}
      </div>
    </Panel>
  );
}

/** What the radio said about itself, and any warning with the answer: information only. Shared with Prepare. */
export function RadioAnswerDetails({
  answer,
}: {
  answer: ReturnType<typeof radioCheckAnswer>['answer'];
}) {
  if (answer?.kind !== 'layout') return null;
  return (
    <>
      {answer.details ? (
        <ul className={classes.list}>
          {answer.details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      ) : null}
      {answer.warning ? <StatusBanner tone="warning">{answer.warning}</StatusBanner> : null}
    </>
  );
}
