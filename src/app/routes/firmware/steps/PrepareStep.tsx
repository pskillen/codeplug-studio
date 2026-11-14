import { useEffect, useState } from 'react';

import type { FirmwareRadioLayoutQuestion, RadioInfoAnswers } from '@core/firmware/types.ts';
import { loadedLayouts, partnerFor } from '@core/firmware/releases/layouts.ts';
import type { PreparedFirmwareImage } from '@core/services/firmware/prepareFirmwareImage.ts';
import { RadioIoError } from '@integrations/radio-io';

import { Button, Panel, StatusBanner } from '../../../components/v2/index.ts';
import { prepareFlash, type FirmwareChoice } from '../../../services/firmwareFlash.ts';
import classes from '../FirmwareFlasherPage.module.css';
import { radioCheckAnswer, radioCheckSetup } from '../radioCheck.ts';
import DeveloperOnly from './DeveloperOnly.tsx';
import LabeledCheck from './LabeledCheck.tsx';
import { RadioAnswerDetails } from './RadioCheckStep.tsx';
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

/** Prepare's link back to the "Your radio" step. */
export const CHANGE_RADIO_ANSWER = 'Check your radio again';

/**
 * The radio's answer from the "Your radio" step, read-only (#1670): Prepare computes it again and runs every interlock
 * on it, but changing it happens back on that step.
 */
function RadioAnswerReadOnly({
  question,
  answers,
  fromReport,
  complete,
  onChange,
}: {
  question: FirmwareRadioLayoutQuestion;
  answers: RadioInfoAnswers;
  fromReport: boolean;
  complete: boolean;
  onChange: (() => void) | undefined;
}) {
  const lines: [string, string][] = [[question.firmwareLabel, answers.firmware]];
  if (question.suffixLabel) lines.push([question.suffixLabel, answers.suffix ?? '']);
  lines.push([question.hardwareLabel, answers.hardware]);
  return (
    <>
      {!complete ? (
        <p className={classes.muted}>
          Studio needs to know about your radio before it prepares the image.
        </p>
      ) : fromReport ? (
        <p className={classes.copy}>Your radio, as it reported itself:</p>
      ) : (
        <>
          <p className={classes.copy}>Your radio, as you answered:</p>
          <ul className={classes.list}>
            {lines.map(([label, value]) => (
              <li key={label}>
                {label}: {value}
              </li>
            ))}
          </ul>
        </>
      )}
      {onChange ? (
        <div>
          <Button variant="secondary" size="sm" onClick={onChange}>
            {CHANGE_RADIO_ANSWER}
          </Button>
        </div>
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
  const { stock, image, choice, loadedPatch, radioInfo, reinstallConfirmed } = state;
  const setup = radioCheckSetup(updater);
  const layoutRetry = state.layoutRetry;
  const {
    answer,
    asksQuestion,
    radioLayout,
    radioBuild,
    radioReported,
    radioCodeBase,
    unavailable,
  } = radioCheckAnswer(state, setup);
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
        {setup ? (
          <RadioAnswerReadOnly
            question={setup.question}
            answers={radioInfo}
            fromReport={!asksQuestion}
            complete={answer?.kind === 'layout'}
            onChange={
              state.radioCheck ? () => dispatch({ type: 'goTo', step: 'check' }) : undefined
            }
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
        {layoutRetry && answer?.kind === 'layout' ? (
          <StatusBanner tone="info">
            The radio refused the first file before installing anything, so Studio prepares this
            release's other file for it
            <DeveloperOnly>{` (${layoutRetry.from} refused, ${layoutRetry.to} next)`}</DeveloperOnly>
            .
          </StatusBanner>
        ) : null}
        <RadioAnswerDetails answer={answer} />
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
