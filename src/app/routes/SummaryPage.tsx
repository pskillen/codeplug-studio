import type { ReactNode } from 'react';
import { Stack } from '@mantine/core';
import { Link, useNavigate } from 'react-router-dom';
import { applyFilters, DEFAULT_MAP_FILTER_OPTS } from '@core/domain/mapProjection.ts';
import { summariseLibrary } from '@core/domain/summary.ts';
import { ALL_BANDS } from '@app/lib/bands.ts';
import { getModeDefinition, normalizeChannelMode } from '@app/lib/channelModes.ts';
import CodeplugMap from '../components/CodeplugMap/CodeplugMap.tsx';
import ExportProjectYamlPanel from '../components/import-export/ExportProjectYamlPanel.tsx';
import ExportToDrivePanel from '../components/import-export/ExportToDrivePanel.tsx';
import ImportYamlIntoActivePanel from '../components/import-export/ImportYamlIntoActivePanel.tsx';
import {
  CountTile,
  DesignSystemV2Provider,
  Panel,
  Pill,
  StatusBanner,
} from '../components/v2/index.ts';
import { DSV2_TOKENS } from '../theme-v2.ts';
import { useLibrary } from '../state/useLibrary.ts';
import { useProjects } from '../state/useProjects.ts';
import classes from './SummaryPage.module.css';

export default function SummaryPage() {
  const { library, loading } = useLibrary();
  const { activeProjectId, activeProject } = useProjects();
  const navigate = useNavigate();

  if (loading) {
    return (
      <DesignSystemV2Provider>
        <div className={classes.page}>
          <h1 className={classes.title}>Summary</h1>
          <p className={classes.description}>Loading…</p>
        </div>
      </DesignSystemV2Provider>
    );
  }

  const summary = summariseLibrary(library);
  const { channels, zones } = library;
  const mapSkipped = applyFilters(channels, DEFAULT_MAP_FILTER_OPTS).skipped;

  const counts: { label: string; value: number }[] = [
    { label: 'Channels', value: summary.counts.channels },
    { label: 'Talk groups', value: summary.counts.talkGroups },
    { label: 'Digital contacts', value: summary.counts.digitalContacts },
    { label: 'Analog contacts', value: summary.counts.analogContacts },
    { label: 'RX group lists', value: summary.counts.rxGroupLists },
    { label: 'Scan lists', value: summary.counts.scanLists },
    { label: 'Zones', value: summary.counts.zones },
  ];

  const projectName = activeProject?.name ?? 'this project';

  return (
    <DesignSystemV2Provider>
      <div className={classes.page}>
        <h1 className={classes.title}>Summary</h1>
        <p className={classes.description}>
          {projectName} — everything in this project at a glance. CPS export for a radio lives under
          Export for radio.
        </p>

        <div className={classes.countGrid}>
          {counts.map((c) => (
            <CountTile key={c.label} value={c.value} label={c.label} />
          ))}
        </div>

        <div className={classes.breakdownGrid}>
          <BreakdownPanel
            title="Channels by mode"
            rows={summary.channelsByMode.map((r) => ({
              label: r.mode,
              count: r.count,
              pill: modeBreakdownPill(r.mode),
            }))}
          />
          <BreakdownPanel
            title="Channels by band"
            rows={summary.channelsByBand.map((r) => ({
              label: r.band,
              count: r.count,
              pill: bandBreakdownPill(r.band),
            }))}
          />
        </div>

        <p className={classes.locationHint}>
          {summary.channelsWithLocation} channel(s) have a location — browse on{' '}
          <Link to="/library/channels">Channels</Link> or the library map below.
        </p>

        <Panel title="Library map" className={classes.mapPanel}>
          <CodeplugMap
            channels={channels}
            zones={zones}
            allChannels={channels}
            height={480}
            onChannelClick={(id) => navigate(`/library/channels/${id}`)}
            onZoneClick={(id) => navigate(`/library/zones/${id}`)}
          />
          {mapSkipped.length > 0 ? (
            <p className={classes.mapSkipped}>
              {mapSkipped.length} channel{mapSkipped.length === 1 ? '' : 's'} not shown on map
              (missing coordinates, Use Location = No, or 0,0).
            </p>
          ) : null}
        </Panel>

        <div className={classes.integrityBanner}>
          {summary.danglingReferences.length === 0 ? (
            <StatusBanner tone="success">
              No dangling references — all relationships resolve.
            </StatusBanner>
          ) : (
            <StatusBanner tone="warning">
              <div className={classes.danglingList}>
                {summary.danglingReferences.map((d, i) => (
                  <span key={i}>
                    {d.fromKind} “{d.fromName}” references a missing {d.targetKind} (
                    {d.relationship})
                  </span>
                ))}
              </div>
            </StatusBanner>
          )}
        </div>

        <Panel title="Project interchange" sub="Lossless project backup — library, builds, and metadata as native YAML.">
          <div className={classes.interchangeGrid}>
            <div>
              <h3 className={classes.interchangeSectionTitle}>Import (replace active project)</h3>
              <ImportYamlIntoActivePanel />
            </div>
            <div>
              <h3 className={classes.interchangeSectionTitle}>Export</h3>
              <Stack gap="md">
                <ExportProjectYamlPanel key={activeProjectId ?? 'none'} />
                <ExportToDrivePanel key={`${activeProjectId ?? 'none'}-drive`} />
              </Stack>
            </div>
          </div>
        </Panel>
      </div>
    </DesignSystemV2Provider>
  );
}

function BreakdownPanel({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; count: number; pill: ReactNode }[];
}) {
  return (
    <Panel title={title}>
      {rows.length === 0 ? (
        <span className={classes.breakdownRow}>No channels.</span>
      ) : (
        <div className={classes.breakdownList}>
          {rows.map((r) => (
            <div key={r.label} className={classes.breakdownRow}>
              {r.pill}
              <span className={classes.breakdownCount}>{r.count}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function modeBreakdownPill(modeLabel: string) {
  const mode = normalizeChannelMode(modeLabel.toLowerCase());
  const def = getModeDefinition(mode);
  const textColor =
    mode === 'dstar' || mode === 'dmr' || mode === 'tetra'
      ? DSV2_TOKENS.colors.pillTextLight
      : DSV2_TOKENS.colors.pillTextDark;

  return (
    <Pill tone="semantic" color={def.color} textColor={textColor}>
      {def.label}
    </Pill>
  );
}

function bandBreakdownPill(bandLabel: string) {
  const band = ALL_BANDS.find((b) => b.label === bandLabel);
  const color = band?.color ?? DSV2_TOKENS.colors.modeOther;
  const textColor = band?.color ? DSV2_TOKENS.colors.pillTextLight : DSV2_TOKENS.colors.pillTextDark;

  return (
    <Pill tone="semantic" color={color} textColor={textColor}>
      {bandLabel}
    </Pill>
  );
}
