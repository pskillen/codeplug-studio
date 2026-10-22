import { useEffect, useState } from 'react';

import { Panel, StatusBanner } from '../../../components/v2/index.ts';
import { prepareStockFlash, type VerifiedStockFirmware } from '../../../services/firmwareFlash.ts';
import classes from '../FirmwareFlasherPage.module.css';
import { shortHash, type WizardStepProps } from './stepTypes.ts';

/** Build the exact image to flash and run the radio's safety checks. Nothing is sent to the radio here. */
export default function PrepareStep({ state, dispatch, updater }: WizardStepProps) {
  const { stock, image } = state;
  const [failure, setFailure] = useState<{
    stock: VerifiedStockFirmware;
    message: string;
  } | null>(null);
  const error = failure && failure.stock === stock ? failure.message : null;

  useEffect(() => {
    if (!stock || image) return;
    let cancelled = false;
    prepareStockFlash(updater.radioId, stock)
      .then((prepared) => {
        if (!cancelled) dispatch({ type: 'imagePrepared', image: prepared });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setFailure({
            stock,
            message: err instanceof Error ? err.message : 'The firmware image could not be built.',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [stock, image, updater.radioId, dispatch]);

  return (
    <Panel title="Prepare" sub="Build the exact image and run the safety checks.">
      <div className={classes.stack}>
        {error ? (
          <StatusBanner tone="warning">{error} Nothing was sent to the radio.</StatusBanner>
        ) : null}
        {!image && !error ? <p className={classes.muted}>Preparing…</p> : null}
        {image ? (
          <>
            <StatusBanner tone="success">
              Ready to flash: stock firmware {image.stockVersion}.
            </StatusBanner>
            <ul className={classes.list}>
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
