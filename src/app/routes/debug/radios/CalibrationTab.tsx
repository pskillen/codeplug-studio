import { useMemo } from 'react';
import { Alert, Stack, Text, Title } from '@mantine/core';
import {
  CalibrationChartCard,
  CalibrationChartGrid,
  CalibrationReadPicker,
  DebugSection,
  EvidenceNotice,
  HexDump,
  SensitiveRevealButton,
  UnusedRanges,
  ValueTable,
  useSensitiveReveal,
} from '@app/components/debug/index.ts';
import { DesignSystemV2Provider } from '@app/components/v2/index.ts';
import type { CalibrationView } from '@integrations/radio-io/debugView/index.ts';
import type { DebugArchive } from './captureArchive.ts';
import type { RadioDebugDescriptor } from './descriptors.ts';
import { archiveKey } from './viewerUtils.ts';

type CalibrationBuilder = NonNullable<RadioDebugDescriptor['calibration']>;

export interface CalibrationReadEntry {
  id: string;
  label: string;
  readAt: string;
}

export interface CalibrationTabProps {
  /** The page's selected read. */
  archive?: DebugArchive;
  /** The overlay read (calibration only); absent for None. */
  overlayArchive?: DebugArchive;
  calibration: CalibrationBuilder;
  entries: readonly CalibrationReadEntry[];
  readId: string | null;
  overlayId: string | null;
  onRead: (id: string) => void;
  onOverlay: (id: string | null) => void;
}

/**
 * The shared Calibration tab: the radio's `calibration(archive)` view for the read, and for the
 * overlay, drawn by the kit. Holds no radio text; the view carries every sentence.
 */
export function CalibrationTab(props: CalibrationTabProps) {
  const { archive, overlayArchive, calibration } = props;
  const reveal = useSensitiveReveal(archive ? archiveKey(archive) : undefined);
  const view = useMemo(() => (archive ? calibration(archive) : undefined), [archive, calibration]);
  const overlay = useMemo(
    () => (overlayArchive ? calibration(overlayArchive) : undefined),
    [overlayArchive, calibration],
  );
  const overlayView = overlay?.status.kind === 'ok' ? overlay : undefined;
  const hasSensitive = view?.tables.some((t) =>
    t.rows.some((r) => r.cells.some((c) => c.sensitive)),
  );
  return (
    <Stack>
      <Title order={3}>Calibration</Title>
      <DesignSystemV2Provider>
        <Stack>
          {props.entries.length > 0 && (
            <CalibrationReadPicker
              entries={props.entries.map((e) => ({
                id: e.id,
                label: e.label,
                time: new Date(e.readAt),
              }))}
              readId={props.readId}
              overlayId={props.overlayId}
              onRead={props.onRead}
              onOverlay={props.onOverlay}
            />
          )}
          {overlay && overlay.status.kind !== 'ok' && (
            <Alert title="Overlay not shown">{overlay.status.reason}</Alert>
          )}
          {!view ? (
            <Alert title="No capture">Open or read a capture to inspect its calibration.</Alert>
          ) : view.status.kind !== 'ok' ? (
            <Alert title="Not captured">{view.status.reason}</Alert>
          ) : (
            <CalibrationBody
              view={view}
              overlay={overlayView}
              revealed={reveal.revealed}
              onToggleReveal={hasSensitive ? reveal.toggle : undefined}
            />
          )}
        </Stack>
      </DesignSystemV2Provider>
    </Stack>
  );
}

function CalibrationBody({
  view,
  overlay,
  revealed,
  onToggleReveal,
}: {
  view: CalibrationView;
  overlay?: CalibrationView;
  revealed: boolean;
  onToggleReveal?: () => void;
}) {
  const overlayCharts = new Map(overlay?.charts.map((c) => [c.id, c]));
  const overlayTables = new Map(overlay?.tables.map((t) => [t.id, t]));
  return (
    <Stack>
      {view.notice && <EvidenceNotice notice={view.notice} />}
      {view.facts && view.facts.length > 0 && (
        <Text size="sm" c="dimmed">
          {view.facts.map((f) => `${f.label}: ${f.value}`).join(' · ')}
        </Text>
      )}
      {view.charts.length > 0 && (
        <CalibrationChartGrid>
          {view.charts.map((chart) => (
            <CalibrationChartCard
              key={chart.id}
              chart={chart}
              overlay={overlayCharts.get(chart.id)}
              readLabel={overlay ? 'Read' : undefined}
              overlayLabel={overlay ? 'Overlay' : undefined}
            />
          ))}
        </CalibrationChartGrid>
      )}
      {onToggleReveal && <SensitiveRevealButton revealed={revealed} onToggle={onToggleReveal} />}
      {view.tables.map((table) => (
        <DebugSection key={table.id} title={table.title} description={table.description}>
          <ValueTable table={table} overlay={overlayTables.get(table.id)} revealed={revealed} />
        </DebugSection>
      ))}
      {view.unused && view.unused.length > 0 && <UnusedRanges ranges={view.unused} />}
      {view.hex.length > 0 && (
        <DebugSection title="Raw captured bytes" collapsible defaultCollapsed>
          <HexDump sources={view.hex} revealed={revealed} />
        </DebugSection>
      )}
    </Stack>
  );
}
