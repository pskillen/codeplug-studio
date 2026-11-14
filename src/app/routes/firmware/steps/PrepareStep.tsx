import { NativeSelect } from '@mantine/core';
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
  noFileForRadioMessage,
  prepareFlash,
  readFirmwareRadioReport,
  releaseHasFileForLayout,
  type FirmwareChoice,
} from '../../../services/firmwareFlash.ts';
import classes from '../FirmwareFlasherPage.module.css';
import type { RadioReadStatus } from '../firmwareWizardState.ts';
import DeveloperOnly from './DeveloperOnly.tsx';
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

/** Shown with the image when the release has no other file for this radio to try after a refusal. */
export const NO_PARTNER_NOTE =
  'If the radio refuses this file, this release has no other file for this radio to try.';

/** The confirm for an updater's "already runs this build" warning. */
const REINSTALL_CONFIRM_LABEL = 'Write it again anyway';

const needsConfirm = (err: unknown): err is RadioIoError =>
  err instanceof RadioIoError && err.code === 'needsConfirm';

/** Build the exact image to flash and run the radio's safety checks. Nothing is sent to the radio here. */
export default function PrepareStep({ state, dispatch, updater }: WizardStepProps) {
  // The flash layout is an internal detail (#1670): shown only through DeveloperOnly, which no check reads.
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
  // Undefined when the radio has one layout; null while the answer gives none. After the radio refused one layout's
  // file before installing anything, its layout is taken to be the other one (the retry).
  const layoutRetry = state.layoutRetry;
  const radioLayout: string | null | undefined = !answer
    ? undefined
    : answer.kind === 'layout'
      ? (layoutRetry?.to ?? answer.layout)
      : null;
  // The build the radio says it runs, where it says so; it decides "already installed".
  const radioBuild = answer?.kind === 'layout' ? answer.build : undefined;
  // A radio that reported about itself runs a modded build, even when it named none.
  const radioReported = answer?.kind === 'layout' && answer.reported === true;
  // The code base the radio runs: what its report says, or what the answers name. After a retry, a radio that didn't
  // report is taken to run the base of the file prepared for the other layout (its answers were wrong); a reported
  // base stands, so the interlocks refuse a retry that would change it.
  const radioCodeBase =
    answer?.kind !== 'layout'
      ? undefined
      : layoutRetry && !answer.reported
        ? layoutRetry.toBase
        : answer.codeBase;
  type Inputs = readonly [
    unknown,
    FirmwareChoice | null,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
  ];
  const inputs: Inputs = [
    stock,
    choice,
    loadedPatch,
    radioLayout,
    radioBuild,
    radioReported,
    radioCodeBase,
  ];
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
  // A release with files by layout but no partner for this one (none for the other layout, or only for another
  // variant): no retry if the radio refuses this one.
  const noPartner =
    !!image?.radioLayout &&
    !!loadedPatch &&
    loadedLayouts(loadedPatch).length > 0 &&
    !partnerFor(loadedPatch, image.radioLayout, {
      refusedBase: image.baseName,
      variantOfBase: updater.stock.releaseLayouts?.variantOfBase,
    });
  // The release has files by layout but none for this radio (its layout, and its base where known): say so and stop
  // before anything is prepared. Never the nearest build instead.
  const unavailable =
    !!loadedPatch &&
    typeof radioLayout === 'string' &&
    !releaseHasFileForLayout(loadedPatch, radioLayout, radioCodeBase)
      ? noFileForRadioMessage(loadedPatch, radioLayout, radioCodeBase)
      : null;

  useEffect(() => {
    if (!stock || !choice || image || radioLayout === null || unavailable) return;
    let cancelled = false;
    const key: Inputs = [
      stock,
      choice,
      loadedPatch,
      radioLayout,
      radioBuild,
      radioReported,
      radioCodeBase,
    ];
    prepareFlash(
      updater.radioId,
      stock,
      choice,
      loadedPatch ?? undefined,
      radioLayout,
      radioBuild,
      reinstallConfirmed,
      radioReported,
      radioCodeBase,
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
    radioCodeBase,
    unavailable,
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
        {layoutRetry && answer?.kind === 'layout' ? (
          <StatusBanner tone="info">
            The radio refused the first file before installing anything, so Studio prepares this
            release's other file for it
            <DeveloperOnly>{` (${layoutRetry.from} refused, ${layoutRetry.to} next)`}</DeveloperOnly>
            .
          </StatusBanner>
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
          <p className={classes.muted}>Answer each line to prepare the image.</p>
        ) : null}
        {unavailable && !image ? (
          <StatusBanner tone="warning">
            {unavailable} Nothing was prepared or sent to the radio.
            {radioLayout ? <DeveloperOnly>{` Flash layout: ${radioLayout}.`}</DeveloperOnly> : null}
          </StatusBanner>
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
        {!image && !error && !awaitingConfirm && !unavailable && radioLayout !== null ? (
          <p className={classes.muted}>Preparing…</p>
        ) : null}
        {image ? (
          <>
            <StatusBanner tone="success">Ready to flash: {provenanceLabel(image)}.</StatusBanner>
            <ul className={classes.list}>
              <li>Stock firmware: {image.stockVersion}</li>
              {image.versionStamp ? <li>Version stamp: {image.versionStamp}</li> : null}
              {image.radioLayout ? (
                <DeveloperOnly>
                  <li>Flash layout: {image.radioLayout}</li>
                </DeveloperOnly>
              ) : null}
              {noPartner ? <li>{NO_PARTNER_NOTE}</li> : null}
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
