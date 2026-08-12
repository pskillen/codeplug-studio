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
  const { rows, nameLimit, error, setRowExcluded, setRowWireName } = useBuildWirePreview('channel');
  const [hasUnsavedWireNames, setHasUnsavedWireNames] = useState(false);
  const { modalOpen, stay, leave } = useUnsavedNavigationGuard(hasUnsavedWireNames);

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
          Edit wire names and skip-from-export for many channels at once. For other overrides (scan,
          order, format-specific fields), open a row on the{' '}
          <Link to={`/builds/${build.id}/channels`}>channels list</Link>.
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
          onWireNameChange={setRowWireName}
          onUnsavedChangesChange={setHasUnsavedWireNames}
        />
        <Group>
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
