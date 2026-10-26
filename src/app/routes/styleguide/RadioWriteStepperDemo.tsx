/**
 * Styleguide demo of the Write stepper (#1393): one button per step, dummy data, no radio.
 */

import { useEffect, useMemo, useState } from 'react';
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
import { decodeAtD890RadioSettings } from '@integrations/radio-io/radios/at-d890uv/index.ts';
import '../../components/builds/RadioWriteStepper/d890/registerAtD890Review.tsx';
import {
  createAtD890ReviewController,
  type AtD890ReviewController,
} from '../../components/builds/RadioWriteStepper/d890/atD890ReviewController.ts';
import {
  atD890ReceiveOnlyChannels,
  atD890ReviewRange,
} from '../../components/builds/RadioWriteStepper/d890/atD890ReviewFacts.ts';
import { clearAllOverrides, setOverride } from '../../state/atD890RadioSettingsSession.ts';
import type { RadioChannelDto } from '@integrations/radio-io/radioChannelDto.ts';
import { Button } from '../../components/v2/index.ts';

const D890_DEMO_BUILD = 'styleguide-d890-review';

type D890Variant = 'same' | 'other' | 'receiveOnly' | 'nudge' | 'backupSaved';

const D890_VARIANTS: { id: D890Variant; label: string }[] = [
  { id: 'same', label: 'D890 Review: same radio' },
  { id: 'other', label: 'D890 Review: another radio' },
  { id: 'receiveOnly', label: 'D890 Review: receive-only' },
  { id: 'nudge', label: 'D890 Review: step-key nudge' },
  { id: 'backupSaved', label: 'D890 Review: backup saved' },
];

function demoChannel(slotIndex: number, name: string, mhz: number): RadioChannelDto {
  return {
    slotIndex,
    empty: false,
    wireName: name,
    rxHz: mhz * 1e6,
    txHz: mhz * 1e6,
    rxTone: { kind: 'none' },
    txTone: { kind: 'none' },
    powerPercent: null,
    bandwidth: 'FM',
  };
}

/** A controller for one demo variant: dummy radio, no serial port. */
function demoD890Controller(variant: D890Variant): AtD890ReviewController {
  const snapshot = {
    localInfo: new Uint8Array(0x100),
    main: new Uint8Array(0x200),
    ext: new Uint8Array(0x60),
    masterId: new Uint8Array(0x40),
    bandCode: 3,
  };
  const target = variant === 'nudge' ? ('mm9pdy' as const) : ('stock' as const);
  const channels =
    variant === 'receiveOnly'
      ? [
          demoChannel(1, 'GB3DP', 145.5),
          demoChannel(2, 'PMR 1', 446.00625),
          demoChannel(3, 'Marine 16', 156.8),
          demoChannel(4, 'Airband', 150.0),
        ]
      : [demoChannel(1, 'GB3DP', 145.5)];
  const other = variant === 'other' || variant === 'receiveOnly';
  return createAtD890ReviewController({
    buildId: D890_DEMO_BUILD,
    serial: 'DEMO0000',
    masterIdName: 'MM9PDY-2',
    range: atD890ReviewRange(snapshot),
    receiveOnly: atD890ReceiveOnlyChannels(channels, snapshot.bandCode),
    snapshot,
    target,
    decoded: decodeAtD890RadioSettings(snapshot, target),
    initialSettingsTicked: variant !== 'nudge',
    sameRadio: !other && variant !== 'nudge',
    applyToEveryRadio: false,
    settingsOnly: false,
    fullReadHeld: true,
    readRestSeconds: null,
    initialChoice: other || variant === 'nudge' ? 'keep' : 'apply',
    initialBackup:
      variant === 'backupSaved'
        ? { status: 'saved', at: Date.parse('2026-10-26T14:02:00') }
        : { status: 'none' },
    onSaveBackup: () => undefined,
    onReviewSettings: () => undefined,
    onUseStepKeys: () => undefined,
  });
}

const IDENTITY = { model: 'AT-D890UV', serial: 'DEMO0000', name: 'MM9PDY-2', firmware: 'MM9PDY' };

function viewFor(step: WriteStep, parts: WriteParts, d890?: AtD890ReviewController): WriteFlowView {
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
            ...(d890 ? { atD890: d890 } : {}),
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
  const [d890Variant, setD890Variant] = useState<D890Variant | null>(null);
  const d890 = useMemo(
    () => (d890Variant ? demoD890Controller(d890Variant) : undefined),
    [d890Variant],
  );
  useEffect(() => {
    clearAllOverrides(D890_DEMO_BUILD);
    setOverride(D890_DEMO_BUILD, 'volumeBar', true);
    setOverride(D890_DEMO_BUILD, 'menuExitTime', 1);
    setOverride(D890_DEMO_BUILD, 'callSignColour', 6);
    return () => clearAllOverrides(D890_DEMO_BUILD);
  }, []);
  const shownParts = d890 ? { ...parts, settings: d890.getState().settingsTicked } : parts;
  const view = viewFor(d890 ? 'review' : (step ?? 'whatToWrite'), shownParts, d890);
  const actions = {
    ...noopActions(),
    onClose: () => {
      setStep(null);
      setD890Variant(null);
    },
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
      <Group gap="xs">
        {D890_VARIANTS.map((v) => (
          <Button key={v.id} variant="secondary" size="sm" onClick={() => setD890Variant(v.id)}>
            {v.label}
          </Button>
        ))}
      </Group>
      <RadioWriteStepper
        config={demoStepperConfig()}
        view={{ ...view, open: step !== null || d890Variant !== null }}
        actions={actions}
      />
    </>
  );
}
