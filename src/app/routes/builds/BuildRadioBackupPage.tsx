/**
 * Per-build Backup / Restore tab — zip on disk + in-RAM inspect.
 * Session data stays in React memory; never writes egress hydration or project state (#1138).
 */

import { Navigate } from 'react-router-dom';
import { Stack, Text } from '@mantine/core';
import { FormPage } from '../../components/ui/index.ts';
import { findRadioIoEgress } from '../../lib/buildEgressUi.ts';
import { useBuildLayout } from './BuildLayoutContext.tsx';

export default function BuildRadioBackupPage() {
  const { build, egressPaths } = useBuildLayout();
  const radioEgress = findRadioIoEgress(egressPaths);

  if (!radioEgress) {
    return <Navigate to={`/builds/${build.id}/export`} replace />;
  }

  return (
    <FormPage
      title="Backup / Restore"
      description={
        <Text size="sm" component="span">
          Snapshot the connected radio to a zip on your disk, or open a backup file to inspect it.
          This is not Write — nothing is saved to your project. Restore is not available yet.
        </Text>
      }
    >
      <Stack gap="lg">
        <Text size="sm" c="dimmed">
          Backup radio and open-file actions land in the next slice of this tab.
        </Text>
      </Stack>
    </FormPage>
  );
}
