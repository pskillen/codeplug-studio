import { Panel } from '../../../components/v2/index.ts';
import classes from '../FirmwareFlasherPage.module.css';
import type { WizardStepProps } from './stepTypes.ts';

/** What to flash. Stock is always offered: it is also the recovery path. */
export default function FirmwareStep({ updater }: WizardStepProps) {
  return (
    <Panel title="Firmware" sub="Choose what to put on the radio.">
      <div className={classes.cards} role="radiogroup" aria-label="Firmware">
        <button
          type="button"
          role="radio"
          aria-checked
          className={`${classes.card} ${classes.cardSelected}`}
        >
          <span className={classes.cardTitle}>Stock firmware ({updater.stock.version})</span>
          <span className={classes.cardMeta}>
            The vendor&apos;s own firmware. Also the way back if a flash goes wrong.
          </span>
        </button>
      </div>
    </Panel>
  );
}
