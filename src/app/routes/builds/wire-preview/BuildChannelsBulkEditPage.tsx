import { useState } from 'react';
import { Button, Group, Stack, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { useBuildWirePreview } from '../../../hooks/useBuildWirePreview.ts';
import { useUnsavedNavigationGuard } from '../../../hooks/useUnsavedNavigationGuard.ts';
import WirePreviewBulkEditTable from '../../../components/builds/wirePreview/WirePreviewBulkEditTable.tsx';
import UnsavedChangesModal from '../../../components/ui/UnsavedChangesModal.tsx';
import { FormPage } from '../../../components/ui/index.ts';
import { useBuildLayout } from '../BuildLayoutContext.tsx';

export default function BuildChannelsBulkEditPage() {
  const { build } = useBuildLayout();
  const { rows, nameLimit, error, setRowExcluded, setRowWireName } = useBuildWirePreview('channel');
  const [hasUnsavedWireNames, setHasUnsavedWireNames] = useState(false);
  const { modalOpen, stay, leave } = useUnsavedNavigationGuard(hasUnsavedWireNames);

  return (
    <FormPage
      title="Bulk edit channel export names"
      description={
        <Group gap="xs">
          <Link
            to={`/builds/${build.id}/channels`}
            style={{ fontSize: 'var(--mantine-font-size-sm)' }}
          >
            ← Channels
          </Link>
          <Text size="sm" c="dimmed">
            · {build.name}
          </Text>
        </Group>
      }
    >
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
          <Button component={Link} to={`/builds/${build.id}/channels`} variant="default">
            Back to channel list
          </Button>
        </Group>
      </Stack>
      <UnsavedChangesModal
        opened={modalOpen}
        onStay={stay}
        onLeave={leave}
        title="Unsaved wire name changes"
        message="You have unapplied wire name edits. Leave without saving?"
      />
    </FormPage>
  );
}
