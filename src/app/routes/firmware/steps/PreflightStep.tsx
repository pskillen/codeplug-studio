import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { radioTargetIdsForFirmwareRadio } from '@core/firmware/radioTargets.ts';

import { Panel } from '../../../components/v2/index.ts';
import { useFormatBuilds } from '../../../state/useFormatBuilds.ts';
import classes from '../FirmwareFlasherPage.module.css';
import type { PreflightCheck } from '../firmwareWizardState.ts';
import LabeledCheck from './LabeledCheck.tsx';
import type { WizardStepProps } from './stepTypes.ts';

export const RISK_ACKNOWLEDGEMENT =
  'This is experimental amateur firmware tooling. Flashing can leave your radio unable to boot until it is recovered, and you flash at your own risk.';

const OTHER_CHECKS: { check: Exclude<PreflightCheck, 'risk'>; label: string }[] = [
  { check: 'battery', label: 'The battery is charged' },
  { check: 'cable', label: "I'm using a short, direct USB cable (no hub)" },
  { check: 'otherApps', label: 'The vendor CPS and other Studio tabs are closed' },
];

/** Required for every flash: stock, published release or user patch. */
export default function PreflightStep({ state, dispatch, updater }: WizardStepProps) {
  const { builds } = useFormatBuilds();
  const matching = useMemo(() => {
    const ids = new Set(radioTargetIdsForFirmwareRadio(updater.radioId));
    return builds.filter((b) => ids.has(b.radioTargetId));
  }, [builds, updater.radioId]);

  const set = (check: PreflightCheck) => (value: boolean) =>
    dispatch({ type: 'setCheck', check, value });

  return (
    <div className={classes.stack}>
      <Panel title="Before you flash" sub="Tick every box to continue.">
        <div className={classes.checks}>
          <div>
            {state.image ? (
              <p className={classes.riskText}>
                You are flashing the {state.image.title} to the {updater.label}.
              </p>
            ) : null}
            <p className={classes.riskText}>{RISK_ACKNOWLEDGEMENT}</p>
            <LabeledCheck
              label="I understand and accept the risk"
              checked={state.checks.risk}
              onChange={set('risk')}
            />
          </div>
          {OTHER_CHECKS.map(({ check, label }) => (
            <LabeledCheck
              key={check}
              label={label}
              checked={state.checks[check]}
              onChange={set(check)}
            />
          ))}
        </div>
      </Panel>
      <Panel
        title="Back up first"
        sub="Flashing firmware doesn't touch your codeplug, but back up anyway."
      >
        {matching.length > 0 ? (
          <ul className={classes.list}>
            {matching.map((b) => (
              <li key={b.id}>
                <Link to={`/builds/${b.id}/backup`}>Back up from {b.name}</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className={classes.copy}>
            Open a project with a build for this radio and use its Backup tab.
          </p>
        )}
      </Panel>
    </div>
  );
}
