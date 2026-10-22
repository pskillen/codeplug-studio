import { Panel, StatusBanner } from '../../../components/v2/index.ts';
import classes from '../FirmwareFlasherPage.module.css';
import type { WizardStepProps } from './stepTypes.ts';

/** Rendered from the radio's descriptor; Studio holds no radio-specific copy here. */
export default function UpdateModeStep({ updater }: WizardStepProps) {
  const entry = updater.stock.bootloaderEntry;
  return (
    <Panel title="Enter update mode" sub={`Put the ${updater.label} into update mode.`}>
      <div className={classes.stack}>
        <ol className={classes.list}>
          {entry.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className={classes.copy}>
          You&apos;ll know it&apos;s in update mode when you see: <strong>{entry.indicator}</strong>
        </p>
        {/* Reserved for an update-mode illustration per radio. */}
        <div className={classes.illustrationSlot} />
        {entry.warnings.map((w) => (
          <StatusBanner key={w} tone="warning">
            {w}
          </StatusBanner>
        ))}
      </div>
    </Panel>
  );
}
