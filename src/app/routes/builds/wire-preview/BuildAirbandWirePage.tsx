import { Stack, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import BuildWirePreviewListPage from './BuildWirePreviewListPage.tsx';
import { FormPage } from '../../../components/ui/index.ts';
import { useBuildLayout } from '../BuildLayoutContext.tsx';

export default function BuildAirbandWirePage() {
  const { build } = useBuildLayout();

  return (
    <FormPage
      title="Airband"
      description={
        <Link
          to={`/builds/${build.id}/overview`}
          style={{ fontSize: 'var(--mantine-font-size-sm)' }}
        >
          ← {build.name}
        </Link>
      }
    >
      <Stack gap="xl">
        <Text size="sm" c="dimmed">
          AM airband receive channels and zones export to <code>AMAir.CSV</code> and{' '}
          <code>AMZone.CSV</code> — separate from the DMR channel bank and <code>DMRZone.CSV</code>.
          Zones with both airband and DMR members also appear on the Zones page for the DMR
          projection.
        </Text>
        <BuildWirePreviewListPage
          embedded
          title="Channels"
          entityKind="channel"
          description="Receive-only AM channels in the civil airband (118–137 MHz). Wire names must match AMAir.CSV and AM zone member columns."
          anytoneBank="airband"
        />
        <BuildWirePreviewListPage
          embedded
          title="Zones"
          entityKind="zone"
          description="Zones with at least one airband member. Airband-only zones appear here only; mixed zones also appear on Zones for DMR members."
          anytoneBank="airband"
        />
      </Stack>
    </FormPage>
  );
}
