import { useState } from 'react';
import { Button as MantineButton, Group, Stack, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { useBuildWirePreview } from '../../../hooks/useBuildWirePreview.ts';
import { useUnsavedNavigationGuard } from '../../../hooks/useUnsavedNavigationGuard.ts';
import WirePreviewBulkEditTable from '../../../components/builds/wirePreview/WirePreviewBulkEditTable.tsx';
import { UnsavedChangesModal } from '../../../components/v2/index.ts';
import { useBuildLayout } from '../BuildLayoutContext.tsx';
import classes from '../BuildSubPage.module.css';

export default function BuildChannelsBulkEditPage() {
  const { build } = useBuildLayout();
  const { rows, nameLimit, error, setRowExcluded, setRowWireNames } = useBuildWirePreview('channel');
  const [pendingWireNames, setPendingWireNames] = useState<Map<string, string>>(() => new Map());
  const [draftEpoch, setDraftEpoch] = useState(0);
  const hasUnsavedWireNames = pendingWireNames.size > 0;
  const { modalOpen, stay, leave } = useUnsavedNavigationGuard(hasUnsavedWireNames);

  const savePendingWireNames = () => {
    if (pendingWireNames.size === 0) return;
    const entries: { row: (typeof rows)[number]; wireName: string }[] = [];
    for (const [key, wireName] of pendingWireNames) {
      const row = rows.find((entry) => entry.key === key);
      if (row) entries.push({ row, wireName });
    }
    if (entries.length === 0) return;
    setRowWireNames(entries);
    setDraftEpoch((value) => value + 1);
  };

  return (
    <div className={classes.page}>
      <div className={classes.header}>
        <h1 className={classes.title}>Bulk edit channel export names</h1>
        <p className={classes.subtitle}>
          <Link to={`/builds/${build.id}/channels`}>← Channels</Link>
          {' · '}
          {build.name}
        </p>
      </div>
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Edit wire names and skip-from-export for many channels at once. Wire name edits stay local
          until you Save. For other overrides (scan, order, format-specific fields), open a row on
          the <Link to={`/builds/${build.id}/channels`}>channels list</Link>.
        </Text>
        {error ? (
          <Text c="red" size="sm">
            {error}
          </Text>
        ) : null}
        <WirePreviewBulkEditTable
          rows={rows}
          nameLimit={nameLimit}
          onExcludedChange={setRowExcluded}
          onPendingWireNamesChange={setPendingWireNames}
          draftEpoch={draftEpoch}
        />
        <Group>
          <MantineButton disabled={!hasUnsavedWireNames} onClick={savePendingWireNames}>
            Save wire names
          </MantineButton>
          <MantineButton component={Link} to={`/builds/${build.id}/channels`} variant="default">
            Back to channel list
          </MantineButton>
        </Group>
      </Stack>
      <UnsavedChangesModal
        opened={modalOpen}
        onStay={stay}
        onLeave={leave}
        title="Unsaved wire name changes"
        message="You have unapplied wire name edits. Leave without saving?"
      />
    </div>
  );
}
