import { useEffect, useState } from 'react';

import type {
  FirmwareRadioLayoutQuestion,
  RadioInfoAnswers,
  RadioLayoutAnswer,
} from '@core/firmware/types.ts';
import { loadedLayouts, partnerFor } from '@core/firmware/releases/layouts.ts';
import type { PreparedFirmwareImage } from '@core/services/firmware/prepareFirmwareImage.ts';
import { RadioIoError } from '@integrations/radio-io';

import { Button, Panel, StatusBanner, TextInput } from '../../../components/v2/index.ts';
import {
  grantFirmwareRadioReportPort,
  prepareFlash,
  readFirmwareRadioReport,
  type FirmwareChoice,
} from '../../../services/firmwareFlash.ts';
import classes from '../FirmwareFlasherPage.module.css';
import type { RadioReadStatus } from '../firmwareWizardState.ts';
import LabeledCheck from './LabeledCheck.tsx';
import { shortHash, type WizardStepProps } from './stepTypes.ts';

function provenanceLabel(image: PreparedFirmwareImage): string {
  switch (image.provenance) {
    case 'stock':
      return image.title;
    case 'published':
      return `${image.title} (published)`;
    case 'unreviewed':
      return `${image.title} (unreviewed user-supplied patch)`;
  }
}

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
      <TextInput
        label={question.firmwareLabel}
        value={answers.firmware}
        onChange={(e) => onChange({ firmware: e.target.value })}
        mono
      />
      <TextInput
        label={question.hardwareLabel}
        value={answers.hardware}
        onChange={(e) => onChange({ hardware: e.target.value })}
        mono
      />
    </>
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

/** Shown with the image when the release has no file for the radio's other layout. */
const NO_PARTNER_NOTE = (layout: string): string =>
  `This release has only the ${layout} file. If the radio refuses it, Studio has no file for the other flash layout to try.`;

/** The confirm for an updater's "already runs this build" warning. */
const REINSTALL_CONFIRM_LABEL = 'Write it again anyway';

const needsConfirm = (err: unknown): err is RadioIoError =>
  err instanceof RadioIoError && err.code === 'needsConfirm';

/** Build the exact image to flash and run the radio's safety checks. Nothing is sent to the radio here. */
export default function PrepareStep({ state, dispatch, updater }: WizardStepProps) {
  const { stock, image, choice, loadedPatch, radioInfo, radioRead, reinstallConfirmed } = state;
  const question = updater.stock.radioLayout;
  // The radio is read first when it may report about itself; the question is asked only without a report.
  const report = question?.report && updater.radioReport ? question.report : undefined;
  const asksQuestion =
    !!question && (!report || (radioRead !== null && radioRead.kind !== 'report'));
  const answer: RadioLayoutAnswer | null = !question
    ? null
    : radioRead?.kind === 'report' && report
      ? radioRead.answer
      : asksQuestion
        ? question.resolve(radioInfo)
        : { kind: 'incomplete' };
  // Undefined when the radio has one layout; null while the answer gives none.
  const radioLayout: string | null | undefined = !answer
    ? undefined
    : answer.kind === 'layout'
      ? answer.layout
      : null;
  // The build the radio says it runs, where it says so; it decides "already installed".
  const radioBuild = answer?.kind === 'layout' ? answer.build : undefined;
  // A radio that reported about itself runs a modded build, even when it named none.
  const radioReported = answer?.kind === 'layout' && answer.reported === true;
  type Inputs = readonly [unknown, FirmwareChoice | null, unknown, unknown, unknown, unknown];
  const inputs: Inputs = [stock, choice, loadedPatch, radioLayout, radioBuild, radioReported];
  const sameInputs = (a: Inputs) => a.every((v, i) => v === inputs[i]);
  const [failure, setFailure] = useState<{
    for: Inputs;
    confirmed: boolean;
    message: string;
  } | null>(null);
  // The updater's warning that asks for an explicit confirm. Kept while the confirm is ticked, so it can be unticked.
  const [warningFor, setWarningFor] = useState<{ for: Inputs; message: string } | null>(null);
  const error =
    failure && sameInputs(failure.for) && failure.confirmed === reinstallConfirmed
      ? failure.message
      : null;
  const warning = warningFor && sameInputs(warningFor.for) ? warningFor.message : null;
  const awaitingConfirm = warning !== null && !reinstallConfirmed;
  // A release with files by layout but none for the other layout: no retry if the radio refuses this one.
  const noPartner =
    !!image?.radioLayout &&
    !!loadedPatch &&
    loadedLayouts(loadedPatch).length > 0 &&
    !partnerFor(loadedPatch, image.radioLayout);

  useEffect(() => {
    if (!stock || !choice || image || radioLayout === null) return;
    let cancelled = false;
    const key: Inputs = [stock, choice, loadedPatch, radioLayout, radioBuild, radioReported];
    prepareFlash(
      updater.radioId,
      stock,
      choice,
      loadedPatch ?? undefined,
      radioLayout,
      radioBuild,
      reinstallConfirmed,
      radioReported,
    )
      .then((prepared) => {
        if (!cancelled) dispatch({ type: 'imagePrepared', image: prepared });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (needsConfirm(err)) {
          // Not a refusal: nothing was sent, and the image is built once the operator confirms.
          setWarningFor({ for: key, message: err.message });
          return;
        }
        setFailure({
          for: key,
          confirmed: reinstallConfirmed,
          message: err instanceof Error ? err.message : 'The firmware image could not be built.',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [
    stock,
    image,
    choice,
    loadedPatch,
    radioLayout,
    radioBuild,
    reinstallConfirmed,
    radioReported,
    updater.radioId,
    dispatch,
  ]);

  return (
    <Panel title="Prepare" sub="Build the exact image and run the safety checks.">
      <div className={classes.stack}>
        {report ? (
          <ReadRadio
            report={report}
            status={radioRead}
            radioId={updater.radioId}
            onRead={(status) => dispatch({ type: 'radioRead', status })}
          />
        ) : null}
        {question && asksQuestion ? (
          <RadioLayoutQuestion
            question={question}
            answers={radioInfo}
            onChange={(patch) => dispatch({ type: 'setRadioInfo', patch })}
          />
        ) : null}
        {answer?.kind === 'refused' ? (
          <StatusBanner tone="warning">{answer.message}</StatusBanner>
        ) : null}
        {answer?.kind === 'layout' && answer.details ? (
          <ul className={classes.list}>
            {answer.details.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        ) : null}
        {answer?.kind === 'layout' && answer.warning ? (
          <StatusBanner tone="warning">{answer.warning}</StatusBanner>
        ) : null}
        {answer?.kind === 'incomplete' && asksQuestion ? (
          <p className={classes.muted}>Enter both Radio Info lines to prepare the image.</p>
        ) : null}
        {error ? (
          <StatusBanner tone="warning">{error} Nothing was sent to the radio.</StatusBanner>
        ) : null}
        {warning ? (
          <>
            <StatusBanner tone="warning">{warning}</StatusBanner>
            <LabeledCheck
              label={REINSTALL_CONFIRM_LABEL}
              checked={reinstallConfirmed}
              onChange={(value) => dispatch({ type: 'setReinstallConfirmed', value })}
            />
            {awaitingConfirm ? (
              <p className={classes.muted}>Nothing is sent to the radio unless you confirm.</p>
            ) : null}
          </>
        ) : null}
        {!image && !error && !awaitingConfirm && radioLayout !== null ? (
          <p className={classes.muted}>Preparing…</p>
        ) : null}
        {image ? (
          <>
            <StatusBanner tone="success">Ready to flash: {provenanceLabel(image)}.</StatusBanner>
            <ul className={classes.list}>
              <li>Stock firmware: {image.stockVersion}</li>
              {image.versionStamp ? <li>Version stamp: {image.versionStamp}</li> : null}
              {image.radioLayout ? <li>Flash layout: {image.radioLayout}</li> : null}
              {noPartner ? <li>{NO_PARTNER_NOTE(image.radioLayout!)}</li> : null}
              {Object.entries(image.sha256).map(([role, sha]) => (
                <li key={role}>
                  {role}: <span className={classes.mono}>{shortHash(sha)}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </Panel>
  );
}
