import { useEffect, useState } from 'react';

import type { PreparedFirmwareImage } from '@core/services/firmware/prepareFirmwareImage.ts';

import { Panel, StatusBanner } from '../../../components/v2/index.ts';
import { prepareFlash, type FirmwareChoice } from '../../../services/firmwareFlash.ts';
import classes from '../FirmwareFlasherPage.module.css';
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

/** Build the exact image to flash and run the radio's safety checks. Nothing is sent to the radio here. */
export default function PrepareStep({ state, dispatch, updater }: WizardStepProps) {
  const { stock, image, choice, loadedPatch } = state;
  const [failure, setFailure] = useState<{
    for: readonly [unknown, FirmwareChoice, unknown];
    message: string;
  } | null>(null);
  const error =
    failure &&
    failure.for[0] === stock &&
    failure.for[1] === choice &&
    failure.for[2] === loadedPatch
      ? failure.message
      : null;

  useEffect(() => {
    if (!stock || image) return;
    let cancelled = false;
    prepareFlash(updater.radioId, stock, choice, loadedPatch ?? undefined)
      .then((prepared) => {
        if (!cancelled) dispatch({ type: 'imagePrepared', image: prepared });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setFailure({
            for: [stock, choice, loadedPatch],
            message: err instanceof Error ? err.message : 'The firmware image could not be built.',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [stock, image, choice, loadedPatch, updater.radioId, dispatch]);

  return (
    <Panel title="Prepare" sub="Build the exact image and run the safety checks.">
      <div className={classes.stack}>
        {error ? (
          <StatusBanner tone="warning">{error} Nothing was sent to the radio.</StatusBanner>
        ) : null}
        {!image && !error ? <p className={classes.muted}>Preparing…</p> : null}
        {image ? (
          <>
            <StatusBanner tone="success">Ready to flash: {provenanceLabel(image)}.</StatusBanner>
            <ul className={classes.list}>
              <li>Stock firmware: {image.stockVersion}</li>
              {image.versionStamp ? <li>Version stamp: {image.versionStamp}</li> : null}
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
