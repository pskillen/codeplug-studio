import { Group, Stack, Text } from '@mantine/core';
import { useMemo, useState } from 'react';
import {
  BatteryChart,
  CalibrationChartCard,
  CalibrationChartGrid,
  CalibrationReadPicker,
  ConfidenceBadge,
  DebugSection,
  EvidenceNotice,
  FrequencyCurveChart,
  HexDecValue,
  HexDump,
  MemoryCategories,
  MemoryCategoryPanel,
  NumericTable,
  SensitiveRevealButton,
  SettingsTable,
  StepBarChart,
  TrimDisplay,
  UnusedRanges,
  ValueTable,
  identityLabel,
  useSensitiveReveal,
} from '../../components/debug/index.ts';
import { ToggleSwitch, type DataTableColumn } from '../../components/v2/index.ts';
import { FirmwareSwitch } from '../debug/radios/FirmwareSwitch.tsx';
import { StyleguidePageShell, StyleguideSection } from './StyleguidePageShell.tsx';

const noopCapture = () => Promise.resolve({} as never);
import {
  DEBUG_DEMO_HEX,
  DEBUG_DEMO_MEMORY_CAVEAT,
  DEBUG_DEMO_MEMORY_ROWS,
  DEBUG_DEMO_NOTICE,
  DEBUG_DEMO_READS,
  DEBUG_DEMO_UNUSED,
  debugDemoCharts,
  debugDemoSettingsView,
  debugDemoValueTable,
  type DebugDemoMemoryRow,
} from './fixtures.ts';

const READ_LABEL = 'Read A';
const OVERLAY_LABEL = 'Read B';

const MEMORY_COLUMNS: DataTableColumn<DebugDemoMemoryRow>[] = [
  {
    key: 'slot',
    header: 'Slot',
    render: (r) => r.slot,
    sortable: true,
    sortValue: (r) => r.slot,
    width: '4rem',
  },
  {
    key: 'identity',
    header: 'Callsign · Name',
    render: (r) => identityLabel(r.callsign, r.name),
    sortable: true,
    sortValue: (r) => identityLabel(r.callsign, r.name),
  },
  {
    key: 'rx',
    header: 'RX MHz',
    render: (r) => r.rx.toFixed(4),
    sortable: true,
    sortValue: (r) => r.rx,
    align: 'right',
  },
  {
    key: 'tx',
    header: 'TX MHz',
    render: (r) => r.tx.toFixed(4),
    sortable: true,
    sortValue: (r) => r.tx,
    align: 'right',
  },
  { key: 'tone', header: 'Tone', render: (r) => r.tone },
];

function DemoMemoryPanel() {
  return (
    <MemoryCategoryPanel
      summary="4 channels listed of 128 slots"
      caveat={DEBUG_DEMO_MEMORY_CAVEAT}
      searchPlaceholder="Search channels"
      caption="Demo memory channels"
      columns={MEMORY_COLUMNS}
      rows={DEBUG_DEMO_MEMORY_ROWS}
      getRowId={(r) => r.id}
      searchText={(r) => `${r.slot} ${r.callsign} ${r.name} ${r.rx} ${r.tx} ${r.tone}`}
      defaultSort={{ key: 'slot', direction: 'asc' }}
      mobileIdentity={(r) => identityLabel(r.callsign, r.name)}
      mobileIdentityLabel="Channel"
      details={(r) => (
        <Text size="sm">
          Slot {r.slot}: receives {r.rx} MHz, transmits {r.tx} MHz, tone {r.tone}.
        </Text>
      )}
    />
  );
}

/** `/styleguide/debug`: every kit component of the radio debug pages on synthetic data. */
export default function StyleguideDebugPage() {
  const [overlayOn, setOverlayOn] = useState(false);
  const [rawBytes, setRawBytes] = useState(false);
  const [readId, setReadId] = useState<string | null>('read-a');
  const [overlayId, setOverlayId] = useState<string | null>(null);
  const reveal = useSensitiveReveal(1);

  const charts = useMemo(() => debugDemoCharts(false), []);
  const overlayCharts = useMemo(() => debugDemoCharts(true), []);
  const [power, squelch, battery, trimPpm, trimRaw] = [
    charts[0]!,
    charts[2]!,
    charts[3]!,
    charts[4]!,
    charts[5]!,
  ];
  const ov = (i: number) => (overlayOn ? overlayCharts[i] : undefined);
  const labels = overlayOn ? { readLabel: READ_LABEL, overlayLabel: OVERLAY_LABEL } : {};

  const valueTable = useMemo(() => debugDemoValueTable(false), []);
  const overlayValueTable = useMemo(() => debugDemoValueTable(true), []);
  const settings = useMemo(() => debugDemoSettingsView(false), []);

  if (power.kind !== 'frequency-curve' || squelch.kind !== 'step-bars') return null;
  if (battery.kind !== 'battery' || trimPpm.kind !== 'trim' || trimRaw.kind !== 'trim') return null;
  const ovPower = ov(0);
  const ovSquelch = ov(2);
  const ovBattery = ov(3);
  const ovTrimPpm = ov(4);
  const ovTrimRaw = ov(5);

  return (
    <StyleguidePageShell
      title="Debug pages"
      description="Chart cards, value tables, settings and memory panels of the radio debug pages. Synthetic data for a made-up radio. The kit is dark only (v2 tokens); it has no light theme."
    >
      <Stack gap="md">
        <Group gap="lg">
          <ToggleSwitch label="Overlay" checked={overlayOn} onChange={setOverlayOn} />
          <ToggleSwitch label="Raw bytes" checked={rawBytes} onChange={setRawBytes} />
        </Group>
        <Text size="sm" c="dimmed">
          Overlay draws a second read on every demo that supports it. Raw bytes opens the Address
          and Raw columns of the settings table and the numeric tables.
        </Text>

        <StyleguideSection
          title="Firmware switch"
          description="Expected firmware under the radio title on debug pages: three families with a dashed dot when no reader yet, and a single-option control that is shown but not clickable."
        >
          <Stack gap="md">
            <FirmwareSwitch
              value="opengd77"
              onChange={() => {}}
              options={[
                { firmware: 'stock', capture: noopCapture },
                { firmware: 'opengd77', capture: noopCapture },
                { firmware: 'radiofoundry' },
              ]}
            />
            <FirmwareSwitch
              value="stock"
              onChange={() => {}}
              options={[{ firmware: 'stock', capture: noopCapture }]}
            />
          </Stack>
        </StyleguideSection>

        <StyleguideSection
          title="DebugSection"
          description="A titled section with a one-line description, meta on the right and an optional disclosure."
        >
          <DebugSection
            id="demo-section"
            title="Demo section"
            description="A dimmed description under the title."
            meta={<code>0x1000</code>}
            collapsible
          >
            <Text size="sm">Body content. The body is unmounted while collapsed.</Text>
          </DebugSection>
        </StyleguideSection>

        <StyleguideSection
          title="EvidenceNotice and ConfidenceBadge"
          description="The once-per-page evidence notice, and the two-axis confidence badges (layout, meaning)."
        >
          <Stack gap="sm">
            <EvidenceNotice notice={DEBUG_DEMO_NOTICE} />
            <EvidenceNotice
              notice={{
                title: 'Facts about this read',
                lines: ['Two bands, synthetic.'],
                tone: 'info',
              }}
            />
            <Group gap="xs">
              <ConfidenceBadge value="traced" kind="layout" />
              <ConfidenceBadge value="partially-traced" kind="meaning" />
              <ConfidenceBadge value="inferred" kind="meaning" />
              <ConfidenceBadge value="unknown" kind="layout" />
              <ConfidenceBadge value="unused" kind="layout" />
            </Group>
          </Stack>
        </StyleguideSection>

        <StyleguideSection
          title="HexDecValue"
          description="One number in the right format: hex and decimal for raw bytes, plain decimal with a unit for physical values, hex alone for addresses."
        >
          <Stack gap={4}>
            <Text size="sm">
              Raw byte: <HexDecValue value={26} />
            </Text>
            <Text size="sm">
              Count: <HexDecValue value={128} format="decimal" unit="channels" />
            </Text>
            <Text size="sm">
              Frequency: <HexDecValue value={12800} format="decimal" unit="kHz" />
            </Text>
            <Text size="sm">
              Address: <HexDecValue value={0x1050} width={2} format="hex" />
            </Text>
            <Text size="sm">
              Not captured: <HexDecValue value={undefined} />
            </Text>
            <Text size="sm">
              Sensitive: <HexDecValue value={7} masked />
            </Text>
          </Stack>
        </StyleguideSection>

        <StyleguideSection
          title="CalibrationChartCard and CalibrationChartGrid"
          description="Every chart kind in its card, picked by the view's kind. With Overlay on, a diff badge and a second series appear."
        >
          <CalibrationChartGrid>
            {charts.map((chart, i) => (
              <CalibrationChartCard key={chart.id} chart={chart} overlay={ov(i)} {...labels} />
            ))}
          </CalibrationChartGrid>
        </StyleguideSection>

        <StyleguideSection
          title="FrequencyCurveChart"
          description="Drive against MHz, one line per power level. MHz on x, never an index."
        >
          <FrequencyCurveChart
            chart={power}
            overlay={ovPower?.kind === 'frequency-curve' ? ovPower : undefined}
            {...labels}
          />
        </StyleguideSection>

        <StyleguideSection
          title="StepBarChart"
          description="One bar per step, such as a ten-step squelch ladder."
        >
          <StepBarChart
            chart={squelch}
            overlay={ovSquelch?.kind === 'step-bars' ? ovSquelch : undefined}
            {...labels}
          />
        </StyleguideSection>

        <StyleguideSection
          title="BatteryChart"
          description="A six-step ladder, with volts where the radio gives a scale."
        >
          <BatteryChart
            chart={battery}
            overlay={ovBattery?.kind === 'battery' ? ovBattery : undefined}
            {...labels}
          />
        </StyleguideSection>

        <StyleguideSection
          title="TrimDisplay"
          description="A trim on its scale. The first sits at +2 ppm; the second has no ppm scale and says so."
        >
          <Stack gap="md">
            <TrimDisplay
              chart={trimPpm}
              overlay={ovTrimPpm?.kind === 'trim' ? ovTrimPpm : undefined}
              {...labels}
            />
            <TrimDisplay
              chart={trimRaw}
              overlay={ovTrimRaw?.kind === 'trim' ? ovTrimRaw : undefined}
              {...labels}
            />
          </Stack>
        </StyleguideSection>

        <StyleguideSection
          title="CalibrationReadPicker"
          description="Choose the read to show and an optional overlay read."
        >
          <CalibrationReadPicker
            entries={DEBUG_DEMO_READS}
            readId={readId}
            overlayId={overlayId}
            onRead={setReadId}
            onOverlay={setOverlayId}
          />
        </StyleguideSection>

        <StyleguideSection
          title="NumericTable"
          description="The numbers behind a chart, folded. A row can be a reference and carry a delta."
        >
          <NumericTable
            table={power.table}
            overlay={overlayOn && ovPower ? ovPower.table : undefined}
            defaultOpen={rawBytes}
            label="Power numbers"
            {...(overlayOn ? { readLabel: READ_LABEL, overlayLabel: OVERLAY_LABEL } : {})}
          />
        </StyleguideSection>

        <StyleguideSection
          title="ValueTable"
          description="Named fields with decoded text, raw bytes, confidence and source. One sensitive row stays masked until Show password; the reference row is called out by its note."
        >
          <Stack gap="sm">
            <SensitiveRevealButton revealed={reveal.revealed} onToggle={reveal.toggle} />
            <ValueTable
              table={valueTable}
              overlay={overlayOn ? overlayValueTable : undefined}
              revealed={reveal.revealed}
              overlayLabel={OVERLAY_LABEL}
            />
          </Stack>
        </StyleguideSection>

        <StyleguideSection
          title="SettingsTable and SensitiveRevealButton"
          description="Settings in groups with defaults, confidence and a folded trailing section. Raw bytes starts the Address and Raw columns open."
        >
          <SettingsTable
            key={String(rawBytes)}
            view={settings}
            revealed={reveal.revealed}
            onToggleReveal={reveal.toggle}
            defaultShowRaw={rawBytes}
          />
        </StyleguideSection>

        <StyleguideSection
          title="UnusedRanges and HexDump"
          description="Ranges the firmware never reads, and a hex view whose password bytes stay masked until revealed."
        >
          <Stack gap="md">
            <UnusedRanges ranges={DEBUG_DEMO_UNUSED} defaultOpen={rawBytes} />
            <HexDump sources={DEBUG_DEMO_HEX} revealed={reveal.revealed} collapseRuns />
          </Stack>
        </StyleguideSection>

        <StyleguideSection
          title="MemoryCategories and MemoryCategoryPanel"
          description="One dropdown of Memory categories; each is a count sentence, dimmed caveat, search and a sortable table. Callsign first, then name."
        >
          <MemoryCategories
            categories={[
              { value: 'channels', label: 'Channels', count: 4, render: () => <DemoMemoryPanel /> },
              {
                value: 'zones',
                label: 'Zones',
                render: () => <Text size="sm">A second category renders only when chosen.</Text>,
              },
            ]}
            notDecoded={['scan lists', 'contacts']}
          />
        </StyleguideSection>
      </Stack>
    </StyleguidePageShell>
  );
}
