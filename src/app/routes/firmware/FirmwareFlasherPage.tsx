/**
 * `/firmware` — flash firmware to a radio over Web Serial. Firmware belongs to the radio, not to a project: no
 * active project is needed and nothing is stored. See docs/features/firmware-flashing/.
 */
import { useCallback, useMemo, useReducer, useState } from 'react';

import { isCapacitorSerialSupported, isWebSerialSupported } from '@integrations/radio-io';

import {
  Button,
  DesignSystemV2Provider,
  EmptyState,
  Stepper,
  type StepperStep,
} from '../../components/v2/index.ts';
import { listOfferedFirmwareUpdaters } from '../../services/firmwareFlashEnvGate.ts';
import classes from './FirmwareFlasherPage.module.css';
import {
  canAdvance,
  FIRMWARE_WIZARD_STEPS,
  firmwareWizardReducer,
  INITIAL_FIRMWARE_WIZARD_STATE,
  type FirmwareWizardStep,
} from './firmwareWizardState.ts';
import ReleaseBrowser from './ReleaseBrowser.tsx';
import FirmwareStep from './steps/FirmwareStep.tsx';
import FlashStep from './steps/FlashStep.tsx';
import PreflightStep from './steps/PreflightStep.tsx';
import PrepareStep from './steps/PrepareStep.tsx';
import RadioStep from './steps/RadioStep.tsx';
import StockStep from './steps/StockStep.tsx';
import UpdateModeStep from './steps/UpdateModeStep.tsx';

const STEP_LABELS: Record<FirmwareWizardStep, string> = {
  radio: 'Radio',
  firmware: 'Firmware',
  stock: 'Stock firmware',
  prepare: 'Prepare',
  preflight: 'Before you flash',
  updateMode: 'Update mode',
  flash: 'Flash',
};

export const FIRMWARE_UNAVAILABLE_ON_SITE =
  'The firmware flasher is not available on this site yet.';
export const FIRMWARE_DESKTOP_ONLY =
  'Firmware flashing is available in a desktop browser (Chrome or Edge) for now.';

function Unavailable({ message }: { message: string }) {
  return (
    <DesignSystemV2Provider>
      <div className={classes.page}>
        <h1 className={classes.title}>Firmware flasher</h1>
        <EmptyState title="Firmware flasher unavailable" description={message} />
      </div>
    </DesignSystemV2Provider>
  );
}

export default function FirmwareFlasherPage() {
  const offered = useMemo(() => listOfferedFirmwareUpdaters(), []);
  const [state, dispatch] = useReducer(firmwareWizardReducer, INITIAL_FIRMWARE_WIZARD_STATE);
  const [running, setRunning] = useState(false);
  const onRunningChange = useCallback((r: boolean) => setRunning(r), []);

  if (offered.length === 0) {
    return (
      <Unavailable
        message={
          isCapacitorSerialSupported() ? FIRMWARE_DESKTOP_ONLY : FIRMWARE_UNAVAILABLE_ON_SITE
        }
      />
    );
  }
  if (!isWebSerialSupported()) {
    return (
      <DesignSystemV2Provider>
        <div className={classes.page}>
          <h1 className={classes.title}>Firmware flasher</h1>
          <ReleaseBrowser offered={offered} />
        </div>
      </DesignSystemV2Provider>
    );
  }

  const updater = offered.find((d) => d.radioId === state.radioId) ?? null;
  const currentIndex = FIRMWARE_WIZARD_STEPS.indexOf(state.step);
  const steps: StepperStep[] = FIRMWARE_WIZARD_STEPS.map((id, i) => ({
    id,
    label: STEP_LABELS[id],
    status: i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'pending',
  }));

  const stepProps = updater ? { state, dispatch, updater } : null;

  let body;
  if (state.step === 'radio' || !stepProps) {
    body = <RadioStep offered={offered} state={state} dispatch={dispatch} />;
  } else {
    switch (state.step) {
      case 'firmware':
        body = <FirmwareStep {...stepProps} />;
        break;
      case 'stock':
        body = <StockStep {...stepProps} />;
        break;
      case 'prepare':
        body = <PrepareStep {...stepProps} />;
        break;
      case 'preflight':
        body = <PreflightStep {...stepProps} />;
        break;
      case 'updateMode':
        body = <UpdateModeStep {...stepProps} />;
        break;
      case 'flash':
        body = state.image ? (
          <FlashStep
            {...stepProps}
            image={state.image}
            onReenterUpdateMode={() => dispatch({ type: 'goTo', step: 'updateMode' })}
            onChooseFirmware={() => dispatch({ type: 'goTo', step: 'firmware' })}
            onRunningChange={onRunningChange}
          />
        ) : null;
        break;
    }
  }

  return (
    <DesignSystemV2Provider>
      <div className={classes.page}>
        <h1 className={classes.title}>Firmware flasher</h1>
        <p className={classes.description}>
          Flash firmware to your radio over USB. Firmware belongs to the radio, not to a project:
          nothing here changes your codeplug, and nothing is stored.
        </p>
        <div className={classes.stepperRow}>
          <Stepper className={classes.stepper} ariaLabel="Firmware flasher steps" steps={steps} />
          {currentIndex > 0 && !running ? (
            <button
              type="button"
              className={classes.startOver}
              onClick={() => dispatch({ type: 'restart' })}
            >
              Start over
            </button>
          ) : null}
        </div>
        {body}
        <div className={classes.actions}>
          <Button
            variant="secondary"
            onClick={() => dispatch({ type: 'back' })}
            disabled={currentIndex === 0 || running}
          >
            Back
          </Button>
          {state.step !== 'flash' ? (
            <Button
              variant="primary"
              onClick={() => dispatch({ type: 'next' })}
              disabled={!canAdvance(state)}
            >
              Continue
            </Button>
          ) : null}
        </div>
      </div>
    </DesignSystemV2Provider>
  );
}
