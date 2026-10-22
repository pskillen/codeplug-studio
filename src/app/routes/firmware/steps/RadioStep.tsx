import type { Dispatch } from 'react';

import type { FirmwareUpdaterDescriptor } from '@integrations/radio-io';

import { Panel } from '../../../components/v2/index.ts';
import classes from '../FirmwareFlasherPage.module.css';
import type { FirmwareWizardAction, FirmwareWizardState } from '../firmwareWizardState.ts';

export default function RadioStep({
  offered,
  state,
  dispatch,
}: {
  offered: readonly FirmwareUpdaterDescriptor[];
  state: FirmwareWizardState;
  dispatch: Dispatch<FirmwareWizardAction>;
}) {
  return (
    <Panel title="Radio" sub="Which radio are you updating?">
      <div className={classes.cards} role="radiogroup" aria-label="Radio">
        {offered.map((d) => {
          const selected = state.radioId === d.radioId;
          return (
            <button
              key={d.radioId}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`${classes.card} ${selected ? classes.cardSelected : ''}`}
              onClick={() => dispatch({ type: 'selectRadio', radioId: d.radioId })}
            >
              <span className={classes.cardTitle}>{d.label}</span>
              <span className={classes.cardMeta}>Stock firmware {d.stock.version}</span>
              <span className={classes.cardMeta}>Takes {d.expectedDuration}</span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
