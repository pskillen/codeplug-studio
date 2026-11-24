import { useState } from 'react';
import { Stack } from '@mantine/core';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import ExportFileDialog from '../../components/builds/ExportFileDialog/ExportFileDialog.tsx';
import { Button } from '../../components/v2/index.ts';

const DEMO_PROBLEM_WARNINGS = [
  {
    kind: 'unlinked' as const,
    severity: 'problem' as const,
    message: 'Including 2 channel(s) not linked to a zone',
  },
  {
    kind: 'general' as const,
    severity: 'problem' as const,
    message: 'Zone "Home" member cap reached',
  },
];

export default function ExportFileDialogDemo() {
  const { build, egress } = newRadioBuildForProfile('styleguide', 'opengd77-1701');
  const [open, setOpen] = useState(false);
  const [showDone, setShowDone] = useState(false);

  return (
    <Stack gap="sm">
      <Button
        variant="secondary"
        onClick={() => {
          setShowDone(false);
          setOpen(true);
        }}
      >
        Open Checks demo
      </Button>
      <Button
        variant="secondary"
        onClick={() => {
          setShowDone(true);
          setOpen(true);
        }}
      >
        Open done step demo
      </Button>
      <ExportFileDialog
        open={open}
        onClose={() => setOpen(false)}
        build={build}
        projectId="styleguide"
        activeEgress={egress}
        formatId="opengd77"
        formatLabel="OpenGD77 CSV"
        buildProfileId="opengd77-1701"
        exportProfileId="opengd77-1701"
        onExportProfileIdChange={() => {}}
        runtimeExportOverrides={{ egressId: egress.id }}
        suggestedZipName="demo-opengd77.zip"
        exportFileNames={['Channels.csv', 'Zones.csv']}
        hasChannels
        reloadEgressPaths={async () => {}}
      />
      <p style={{ fontSize: 12, color: 'var(--mantine-color-dimmed)' }}>
        Demo uses live export checks against an empty styleguide project. For a static Checks layout
        with
        {` `}
        {DEMO_PROBLEM_WARNINGS.length} problems, use the OpenGD77 export page after seeding
        channels.
        {showDone ? ' (Done step: complete a download in the dialog.)' : null}
      </p>
    </Stack>
  );
}
