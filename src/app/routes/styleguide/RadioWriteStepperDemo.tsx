/**
 * Styleguide demo of the Write stepper (#1393): one button per step, dummy data, no radio.
 */

import { useState } from 'react';
import { Group } from '@mantine/core';
import RadioWriteStepper from '../../components/builds/RadioWriteStepper/RadioWriteStepper.tsx';
import {
  demoFlowView,
  demoStepperConfig,
  noopActions,
} from '../../components/builds/RadioWriteStepper/stepperDemo.ts';
import {
  WRITE_STEP_LABEL,
  WRITE_STEPS,
  type WriteFlowView,
  type WriteStep,
} from '../../components/builds/RadioWriteStepper/types.ts';
import {
  DEFAULT_WRITE_PARTS,
  type WriteParts,
} from '../../components/builds/RadioWriteStepper/writeParts.ts';
import { reviewSectionsFor } from '../../components/builds/RadioWriteStepper/reviewSections.tsx';
import { AT_D890UV_DESCRIPTOR } from '@integrations/radio-io/radios/at-d890uv/descriptor.ts';
import { Button } from '../../components/v2/index.ts';

const IDENTITY = { model: 'AT-D890UV', serial: 'DEMO0000', name: 'MM9PDY-2', firmware: 'MM9PDY' };

function viewFor(step: WriteStep, parts: WriteParts): WriteFlowView {
  const base = demoFlowView({ step, parts, identity: step === 'whatToWrite' ? null : IDENTITY });
  switch (step) {
    case 'connectRead':
      return {
        ...base,
        busy: true,
        progress: { cur: 40, max: 100, msg: 'Zones', stage: 'Zones' },
        readRows: [
          { id: 'a', label: 'Local info', status: 'success', weight: 256 },
          { id: 'b', label: 'Channels', status: 'success', weight: 20000 },
          { id: 'c', label: 'Zones', status: 'active', weight: 6000 },
          { id: 'd', label: 'Scan lists', status: 'pending', weight: 3000 },
        ],
      };
    case 'review': {
      const contactsNote = parts.contacts ? '1200 digital contacts will be written.' : null;
      const kepsCount = parts.keps ? 24 : null;
      return {
        ...base,
        review: {
          channelCount: 412,
          contactsNote,
          kepsCount,
          estimateSeconds: 100,
          identityOnly: false,
          sections: reviewSectionsFor(AT_D890UV_DESCRIPTOR, {
            identity: IDENTITY,
            parts,
            channelCount: 412,
            contactsNote,
            kepsCount,
            estimateSeconds: 100,
            identityOnly: false,
            restartsAfterWrite: true,
          }),
        },
      };
    }
    case 'writing':
      return {
        ...base,
        busy: true,
        progress: { cur: 3, max: 18, msg: 'Scan lists', stage: 'Scan lists' },
        writeRows: [
          { id: 'a', label: 'Channels', status: 'success', weight: 20000 },
          { id: 'b', label: 'Zones', status: 'success', weight: 6000 },
          { id: 'c', label: 'Scan lists', status: 'active', weight: 3000 },
          { id: 'd', label: 'Upload', status: 'pending', weight: 40000 },
        ],
      };
    case 'restartCheck':
      return { ...base, restartSecondsLeft: 12, checkStatus: 'available' };
    case 'done':
      return {
        ...base,
        summary: {
          codeplugWritten: true,
          contactsWritten: parts.contacts,
          settingsChanged: null,
          settingsTicked: false,
          channelCount: 412,
          kepsResult: null,
          kepsTicked: parts.keps,
          kepsError: null,
          warnings: [],
          checkStatus: 'skipped',
          checkResult: null,
          identity: IDENTITY,
        },
      };
    default:
      return base;
  }
}

export default function RadioWriteStepperDemo() {
  const [step, setStep] = useState<WriteStep | null>(null);
  const [parts, setParts] = useState<WriteParts>({ ...DEFAULT_WRITE_PARTS });
  const view = viewFor(step ?? 'whatToWrite', parts);
  const actions = {
    ...noopActions(),
    onClose: () => setStep(null),
    onPartsChange: setParts,
  };
  return (
    <>
      <Group gap="xs">
        {WRITE_STEPS.map((s, i) => (
          <Button key={s} variant="secondary" size="sm" onClick={() => setStep(s)}>
            {`${i + 1}. ${WRITE_STEP_LABEL[s]}`}
          </Button>
        ))}
      </Group>
      <RadioWriteStepper
        config={demoStepperConfig()}
        view={{ ...view, open: step !== null }}
        actions={actions}
      />
    </>
  );
}
