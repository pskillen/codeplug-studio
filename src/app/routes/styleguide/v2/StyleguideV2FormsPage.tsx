import { Group, Stack, TextInput as MantineTextInput } from '@mantine/core';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Page, PageHeader, PageSection } from '../../../components/ui/index.ts';
import {
  Button,
  Checkbox,
  FormField,
  OverrideField,
  Pill,
  SearchInput,
  SegmentedControl,
  TextInput,
  ToggleSwitch,
} from '../../../components/v2/index.ts';

const VARIANTS = ['primary', 'secondary', 'outline', 'dashed', 'ghost', 'destructive'] as const;
const SIZES = ['sm', 'md', 'lg'] as const;

export default function StyleguideV2FormsPage() {
  const [overridden, setOverridden] = useState(false);
  const [wireName, setWireName] = useState('GB3DA-DMR');
  const [search, setSearch] = useState('');
  const [ts, setTs] = useState<'ts1' | 'ts2'>('ts2');
  const [skipScan, setSkipScan] = useState(false);
  const [selected, setSelected] = useState(true);

  return (
    <Page width="default">
      <PageHeader
        title="Forms"
        description={
          <>
            <Link to="/styleguide/v2">← Design system v2</Link>
          </>
        }
      />

      <PageSection title="Button" description="Variants and sizes from the v2 token set.">
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
      </PageSection>

      <PageSection
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
      </PageSection>

      <PageSection title="SearchInput" description="Filter bar with optional detected tag.">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          detectedTag={search ? 'Filter active' : undefined}
        />
      </PageSection>

      <PageSection title="Checkbox & ToggleSwitch">
        <Group gap="lg">
          <Checkbox checked={selected} onCheckedChange={setSelected} aria-label="Select row" />
          <ToggleSwitch checked={skipScan} onChange={setSkipScan} label="Skip scan" />
        </Group>
      </PageSection>

      <PageSection title="SegmentedControl" description="DMR timeslot picker scale.">
        <SegmentedControl
          size="md"
          options={[
            { value: 'ts1', label: 'TS1' },
            { value: 'ts2', label: 'TS2' },
          ]}
          value={ts}
          onChange={(v) => setTs(v as 'ts1' | 'ts2')}
        />
      </PageSection>

      <PageSection
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
      </PageSection>

      <PageSection
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
      </PageSection>
    </Page>
  );
}
