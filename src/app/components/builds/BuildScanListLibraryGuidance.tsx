import { Anchor, List, Stack, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useBuildLayout } from '../../routes/builds/BuildLayoutContext.tsx';
import { useProjects } from '../../state/useProjects.ts';
import { persistence } from '../../state/persistence.ts';
import { loadLibrarySlice } from '../../lib/loadLibrarySlice.ts';

export default function BuildScanListLibraryGuidance() {
  const { build } = useBuildLayout();
  const { activeProjectId } = useProjects();
  const [scanListCount, setScanListCount] = useState<number | null>(null);

  useEffect(() => {
    if (!activeProjectId) return;
    let cancelled = false;
    void loadLibrarySlice(persistence, activeProjectId).then((slice) => {
      if (!cancelled) setScanListCount(slice.scanLists.length);
    });
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, build.updatedAt]);

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        Scan list membership is curated in the library once and reused across builds. Override CPS
        wire names for <strong>{build.name}</strong> in the table below.
      </Text>
      <List size="sm" spacing="xs">
        <List.Item>
          <Anchor component={Link} to="/library/scan-lists">
            Library → Scan lists
          </Anchor>{' '}
          — create lists and choose member channels (ScanList.CSV).
        </List.Item>
        <List.Item>
          <Anchor component={Link} to={`/builds/${build.id}/channels`}>
            Build → Channels
          </Anchor>{' '}
          — assign each exported channel&apos;s Scan List column (Channel.CSV).
        </List.Item>
      </List>
      {scanListCount === 0 ? (
        <Text size="sm" c="orange">
          No library scan lists yet.{' '}
          <Anchor component={Link} to="/library/scan-lists/new">
            Create a scan list
          </Anchor>{' '}
          before exporting.
        </Text>
      ) : null}
    </Stack>
  );
}
