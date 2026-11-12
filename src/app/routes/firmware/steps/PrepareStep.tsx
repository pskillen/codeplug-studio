import { useEffect, useState } from 'react';

import type { FirmwareRadioLayoutQuestion, RadioInfoAnswers } from '@core/firmware/types.ts';
import type { PreparedFirmwareImage } from '@core/services/firmware/prepareFirmwareImage.ts';

import { Panel, StatusBanner, TextInput } from '../../../components/v2/index.ts';
import { prepareFlash, type FirmwareChoice } from '../../../services/firmwareFlash.ts';
import classes from '../FirmwareFlasherPage.module.css';
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

/** The radio's Radio Info lines, for a radio that comes in more than one hardware layout. Rendered from its descriptor. */
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
      {question.build ? (
        <>
          <TextInput
            label={question.build.label}
            value={answers.build}
            onChange={(e) => onChange({ build: e.target.value })}
            mono
          />
          <p className={classes.muted}>{question.build.help}</p>
        </>
      ) : null}
      <LabeledCheck
        label={question.override.label}
        checked={answers.override}
        onChange={(override) => onChange({ override })}
      />
      <p className={classes.muted}>{question.override.help}</p>
    </>
  );
}

/** Build the exact image to flash and run the radio's safety checks. Nothing is sent to the radio here. */
export default function PrepareStep({ state, dispatch, updater }: WizardStepProps) {
  const { stock, image, choice, loadedPatch, radioInfo } = state;
  const question = updater.stock.radioLayout;
  const answer = question ? question.resolve(radioInfo) : null;
  // Undefined when the radio has one layout; null while the operator's answer gives none.
  const radioLayout: string | null | undefined = !answer
    ? undefined
    : answer.kind === 'layout'
      ? answer.layout
      : null;
  const [failure, setFailure] = useState<{
    for: readonly [unknown, FirmwareChoice, unknown, unknown];
    message: string;
  } | null>(null);
  const error =
    failure &&
    failure.for[0] === stock &&
    failure.for[1] === choice &&
    failure.for[2] === loadedPatch &&
    failure.for[3] === radioLayout
      ? failure.message
      : null;

  useEffect(() => {
    if (!stock || !choice || image || radioLayout === null) return;
    let cancelled = false;
    prepareFlash(updater.radioId, stock, choice, loadedPatch ?? undefined, radioLayout)
      .then((prepared) => {
        if (!cancelled) dispatch({ type: 'imagePrepared', image: prepared });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setFailure({
            for: [stock, choice, loadedPatch, radioLayout],
            message: err instanceof Error ? err.message : 'The firmware image could not be built.',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [stock, image, choice, loadedPatch, radioLayout, updater.radioId, dispatch]);

  return (
    <Panel title="Prepare" sub="Build the exact image and run the safety checks.">
      <div className={classes.stack}>
        {question ? (
          <RadioLayoutQuestion
            question={question}
            answers={radioInfo}
            onChange={(patch) => dispatch({ type: 'setRadioInfo', patch })}
          />
        ) : null}
        {answer?.kind === 'refused' ? (
          <StatusBanner tone="warning">{answer.message}</StatusBanner>
        ) : null}
        {answer?.kind === 'incomplete' ? (
          <p className={classes.muted}>Enter both Radio Info lines to prepare the image.</p>
        ) : null}
        {error ? (
          <StatusBanner tone="warning">{error} Nothing was sent to the radio.</StatusBanner>
        ) : null}
        {!image && !error && radioLayout !== null ? (
          <p className={classes.muted}>Preparing…</p>
        ) : null}
        {image ? (
          <>
            <StatusBanner tone="success">Ready to flash: {provenanceLabel(image)}.</StatusBanner>
            <ul className={classes.list}>
              <li>Stock firmware: {image.stockVersion}</li>
              {image.versionStamp ? <li>Version stamp: {image.versionStamp}</li> : null}
              {image.radioLayout ? <li>Hardware layout: {image.radioLayout}</li> : null}
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
