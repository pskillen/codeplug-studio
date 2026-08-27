import { Group, Stack, TextInput as MantineTextInput } from '@mantine/core';
import { useState } from 'react';
import GradientSegmentedControl, {
  GRADIENT_SEGMENT_IDLE_VALUE,
} from '../../components/ui/GradientSegmentedControl.tsx';
import BulkEditField from '../../components/library/BulkEditField.tsx';
import { StyleguidePageShell, StyleguideSection } from './StyleguidePageShell.tsx';
import {
  Button,
  Checkbox,
  Combobox,
  type ComboboxOption,
  FileDropzone,
  FormField,
  OverrideField,
  PercentLevelSlider,
  Pill,
  SearchInput,
  SegmentedControl,
  TextInput,
  ToggleSwitch,
} from '../../components/v2/index.ts';

const VARIANTS = ['primary', 'secondary', 'outline', 'dashed', 'ghost', 'destructive'] as const;
const SIZES = ['sm', 'md', 'lg'] as const;

const REPEATER_OPTIONS: ComboboxOption<string>[] = [
  { value: 'gb3da', label: 'GB3DA Stornoway', sublabel: '145.575 MHz' },
  { value: 'gb3iv', label: 'GB3IV Inverness', sublabel: '145.175 MHz' },
  { value: 'gb7gm', label: 'GB7GM Glasgow', sublabel: '145.6375 MHz' },
];

export default function StyleguideFormsPage() {
  const [overridden, setOverridden] = useState(false);
  const [wireName, setWireName] = useState('GB3DA-DMR');
  const [search, setSearch] = useState('');
  const [ts, setTs] = useState<'ts1' | 'ts2'>('ts2');
  const [txPermit, setTxPermit] = useState<'default' | 'permitAlways' | 'busyLock'>('default');
  const [bulkTx, setBulkTx] = useState<string>(GRADIENT_SEGMENT_IDLE_VALUE);
  const [bulkPowerOptedIn, setBulkPowerOptedIn] = useState(false);
  const [bulkPower, setBulkPower] = useState<number | null>(50);
  const [skipScan, setSkipScan] = useState(false);
  const [selected, setSelected] = useState(true);
  const [droppedFileName, setDroppedFileName] = useState<string | undefined>();
  const [repeaterQuery, setRepeaterQuery] = useState('');
  const [repeater, setRepeater] = useState<ComboboxOption<string> | null>(null);

  const repeaterResults = REPEATER_OPTIONS.filter((option) =>
    option.label.toLowerCase().includes(repeaterQuery.toLowerCase()),
  );

  return (
    <StyleguidePageShell title="Forms" description="Button variants, inputs, and form chrome.">
      <StyleguideSection title="Button" description="Variants and sizes from the v2 token set.">
        <Stack gap="md">
          {SIZES.map((size) => (
            <Group key={size} gap="sm" wrap="wrap">
              {VARIANTS.map((variant) => (
                <Button key={`${size}-${variant}`} variant={variant} size={size}>
                  {variant}
                </Button>
              ))}
            </Group>
          ))}
        </Stack>
      </StyleguideSection>

      <StyleguideSection
        title="TextInput & FormField"
        description="Standalone input and label-above-box wrapper."
      >
        <Stack gap="md">
          <TextInput label="Name" value="Wrotham" readOnly />
          <FormField label="Callsign" value="GB3LR" />
          <FormField label="Editable">
            <TextInput variant="plain" value="WROTHM" readOnly aria-label="Abbreviation" />
          </FormField>
        </Stack>
      </StyleguideSection>

      <StyleguideSection title="SearchInput" description="Filter bar with optional detected tag.">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          detectedTag={search ? 'Filter active' : undefined}
        />
      </StyleguideSection>

      <StyleguideSection title="Checkbox & ToggleSwitch">
        <Group gap="lg">
          <Checkbox checked={selected} onCheckedChange={setSelected} aria-label="Select row" />
          <ToggleSwitch checked={skipScan} onChange={setSkipScan} label="Skip scan" />
        </Group>
      </StyleguideSection>

      <StyleguideSection title="SegmentedControl" description="DMR timeslot picker scale.">
        <SegmentedControl
          size="md"
          options={[
            { value: 'ts1', label: 'TS1' },
            { value: 'ts2', label: 'TS2' },
          ]}
          value={ts}
          onChange={(v) => setTs(v as 'ts1' | 'ts2')}
        />
      </StyleguideSection>

      <StyleguideSection
        title="OverrideField"
        description="Library default vs per-build override chrome."
      >
        <OverrideField
          label="Wire name"
          description="CPS channel name for this build"
          libraryHint="GB3DA Stornoway"
          overridden={overridden}
          highlighted={overridden}
          onOverride={() => setOverridden(true)}
          onReset={() => {
            setOverridden(false);
            setWireName('GB3DA-DMR');
          }}
        >
          {overridden ? (
            <MantineTextInput
              value={wireName}
              onChange={(e) => setWireName(e.currentTarget.value)}
              aria-label="Wire name value"
            />
          ) : null}
        </OverrideField>
      </StyleguideSection>

      <StyleguideSection
        title="FileDropzone"
        description="Drag/drop + click-to-browse, collapsing to a selected-file row."
      >
        <FileDropzone
          label="Drop a project YAML here"
          hint="Single .yaml / .yml native YAML project file"
          accept=".yaml,.yml"
          fileName={droppedFileName}
          onFilesSelected={([file]) => setDroppedFileName(file?.name)}
          onClear={() => setDroppedFileName(undefined)}
        />
      </StyleguideSection>

      <StyleguideSection
        title="Combobox"
        description="Async search-select; committed chip state with a Change link."
      >
        <Combobox
          value={repeater}
          inputValue={repeaterQuery}
          onInputChange={setRepeaterQuery}
          options={repeaterResults}
          onSelect={setRepeater}
          onClear={() => setRepeater(null)}
          placeholder="Search repeaters…"
        />
      </StyleguideSection>

      <StyleguideSection
        title="Pill extensions"
        description="Removable and dashed add chips (see data-display too)."
      >
        <Group gap="sm">
          <Pill tone="neutral" onRemove={() => undefined}>
            Home zone
          </Pill>
          <Pill tone="dashed" onClick={() => undefined}>
            + DMR
          </Pill>
        </Group>
      </StyleguideSection>
      <StyleguideSection
        title="PercentLevelSlider"
        description="Power/squelch percentage with radio-default checkbox."
      >
        <PercentLevelSlider label="Power" value={50} onChange={() => undefined} />
      </StyleguideSection>
      <StyleguideSection
        title="GradientSegmentedControl — row layout, idle, shared hint"
        description="layout='row' puts label/description left, control right at intrinsic width (collapses to full-width stacking on mobile). The neutral 'Default' option renders with no colour override. Bulk edit prepends an offset No change segment and can outline a shared value without selecting it. Sliders use BulkEditField (No change / Set)."
      >
        <Stack gap="md">
          <GradientSegmentedControl
            label="TX permit"
            description="Busy lock stops you transmitting while the frequency is in use. Permit always lets you hold TX anyway."
            value={txPermit}
            onChange={setTxPermit}
            scheme="three"
            layout="row"
            data={[
              { value: 'default', label: 'Default' },
              { value: 'permitAlways', label: 'Permit always' },
              { value: 'busyLock', label: 'Busy lock' },
            ]}
          />
          <GradientSegmentedControl
            label="Transmit (bulk edit)"
            description="No change is idle. The outline on Allow TX is a shared-value hint — it does not apply an override until you select it."
            value={bulkTx}
            onChange={setBulkTx}
            idleOption={{ value: GRADIENT_SEGMENT_IDLE_VALUE, label: 'No change' }}
            sharedValue="allow"
            scheme="allowForbid"
            layout="row"
            data={[
              { value: 'default', label: 'Default' },
              { value: 'allow', label: 'Allow TX' },
              { value: 'forbid', label: 'RX only' },
            ]}
          />
          <BulkEditField
            optedIn={bulkPowerOptedIn}
            onOptedInChange={setBulkPowerOptedIn}
            sharedHint="50%"
          >
            <PercentLevelSlider label="Power" value={bulkPower} onChange={setBulkPower} />
          </BulkEditField>
        </Stack>
      </StyleguideSection>
    </StyleguidePageShell>
  );
}
