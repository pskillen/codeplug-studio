import { Stack } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { summariseLibrary } from '@core/domain/summary.ts';
import ExportProjectYamlPanel from '../components/import-export/ExportProjectYamlPanel.tsx';
import ExportToDrivePanel from '../components/import-export/ExportToDrivePanel.tsx';
import ImportYamlIntoActivePanel from '../components/import-export/ImportYamlIntoActivePanel.tsx';
import {
  Button,
  CountTile,
  DesignSystemV2Provider,
  Panel,
  StatusBanner,
} from '../components/v2/index.ts';
import { useLibrary } from '../state/useLibrary.ts';
import { useFormatBuilds } from '../state/useFormatBuilds.ts';
import { useProjects } from '../state/useProjects.ts';
import classes from './SummaryPage.module.css';

export default function SummaryPage() {
  const { library, loading } = useLibrary();
  const { builds, loading: buildsLoading } = useFormatBuilds();
  const { activeProjectId, activeProject } = useProjects();
  const navigate = useNavigate();

  if (loading || buildsLoading) {
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
  const contactCount = summary.counts.digitalContacts + summary.counts.analogContacts;
  const projectName = activeProject?.name ?? 'this project';

  const counts: { label: string; value: number }[] = [
    { label: 'Channels', value: summary.counts.channels },
    { label: 'Zones', value: summary.counts.zones },
    { label: 'Talk groups', value: summary.counts.talkGroups },
    { label: 'Contacts', value: contactCount },
    { label: 'RX group lists', value: summary.counts.rxGroupLists },
    { label: 'Builds', value: builds.length },
  ];

  const exportPath = builds.length > 0 ? `/builds/${builds[0]?.id}/export` : '/builds';

  return (
    <DesignSystemV2Provider>
      <div className={classes.page}>
        <h1 className={classes.title}>Summary</h1>
        <p className={classes.description}>{projectName}</p>

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

        <div className={classes.countGrid}>
          {counts.map((c) => (
            <CountTile key={c.label} value={c.value} label={c.label} />
          ))}
        </div>

        <div className={classes.shortcutGrid}>
          <Panel title="Continue in Library">
            <p className={classes.shortcutCopy}>
              Curate channels, zones, contacts, and talk groups for this project.
            </p>
            <Button variant="outline" size="sm" onClick={() => navigate('/library/channels')}>
              Open Library
            </Button>
          </Panel>
          <Panel title="Continue exporting">
            <p className={classes.shortcutCopy}>
              Assemble a format build and export CPS-ready files for your radio.
            </p>
            <Button variant="outline" size="sm" onClick={() => navigate(exportPath)}>
              Go to Export
            </Button>
          </Panel>
        </div>

        <Panel
          title="Project interchange"
          sub="Lossless project backup — library, builds, and metadata as native YAML."
          className={classes.interchangePanel}
        >
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
