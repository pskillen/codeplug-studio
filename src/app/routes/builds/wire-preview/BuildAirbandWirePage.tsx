import { useEffect, useMemo, useState } from 'react';
import { Stack, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import BuildWirePreviewListPage from './BuildWirePreviewListPage.tsx';
import { FormPage } from '../../../components/ui/index.ts';
import { useBuildLayout } from '../BuildLayoutContext.tsx';
import { usesAtD890AirbandBankSplit } from '@core/services/anytoneChannelBanks.ts';
import { assemble, type LibrarySlice } from '@core/services/assemble.ts';
import { buildRadioWriteProjection } from '../../../services/radioIoWriteProjection.ts';
import ExportWarningsAlert from '../../../components/builds/ExportWarningsAlert.tsx';
import { loadLibrarySlice } from '../../../lib/loadLibrarySlice.ts';
import { useProjects } from '../../../state/useProjects.ts';
import { persistence } from '../../../state/persistence.ts';
import { formatExportWarning, type ExportWarning } from '@core/import-export/exportWarning.ts';

function isAmAirbandWriteWarning(warning: ExportWarning): boolean {
  return /AM airband|airband bank unchanged/i.test(formatExportWarning(warning));
}

export default function BuildAirbandWirePage() {
  const { build, activeEgress } = useBuildLayout();
  const { activeProjectId } = useProjects();
  const [library, setLibrary] = useState<LibrarySlice | null>(null);

  const d890AirbandEgress = usesAtD890AirbandBankSplit(activeEgress?.profileId);
  const isWebSerial = activeEgress?.profileId === 'radio-io-at-d890uv';

  useEffect(() => {
    if (!activeProjectId) return;
    let cancelled = false;
    void loadLibrarySlice(persistence, activeProjectId).then((slice) => {
      if (!cancelled) setLibrary(slice);
    });
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, build.updatedAt]);

  const serialWarnings = useMemo(() => {
    if (!isWebSerial || !library || !activeEgress) return [];
    const assembled = assemble(build, library, {
      formatId: activeEgress.formatId,
      profileId: activeEgress.profileId,
    });
    const projection = buildRadioWriteProjection(assembled, build, library, activeEgress);
    return projection.warnings.filter(isAmAirbandWriteWarning);
  }, [activeEgress, build, isWebSerial, library]);

  if (!d890AirbandEgress) {
    return (
      <FormPage
        title="AM airband"
        description={
          <Link
            to={`/builds/${build.id}/overview`}
            style={{ fontSize: 'var(--mantine-font-size-sm)' }}
          >
            ← {build.name}
          </Link>
        }
      >
        <Text size="sm" c="dimmed">
          AM airband export review is only available on <strong>AT-D890UV</strong> builds when
          Anytone CSV or Web Serial is the active export pathway.
        </Text>
      </FormPage>
    );
  }

  return (
    <FormPage
      title="AM airband"
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
        {isWebSerial ? (
          <Text size="sm" c="dimmed">
            AM airband channels and zones project to the parallel <code>AmAir*</code> and{' '}
            <code>AmZone*</code> flash banks on the radio — separate from the MR DMR channel and
            zone banks. <strong>Zones ship with channels:</strong> both banks are written together
            when this build has airband zone membership. When the build has no airband zones, Web
            Serial <strong>leaves the radio AM bank unchanged</strong>. Mixed zones also appear on
            the Zones page for the DMR member projection only.
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            AM airband receive channels and zones export to <code>AMAir.CSV</code> and{' '}
            <code>AMZone.CSV</code> — separate from the DMR channel bank (<code>Channel.CSV</code> /{' '}
            <code>DMRZone.CSV</code>). Zones with both airband and DMR members also appear on the
            Zones page for the DMR projection.
          </Text>
        )}

        {serialWarnings.length > 0 ? <ExportWarningsAlert warnings={serialWarnings} /> : null}

        <BuildWirePreviewListPage
          embedded
          title="Channels"
          entityKind="channel"
          description={
            isWebSerial
              ? 'Receive-only AM channels in the civil airband (118–137 MHz), projected to AmAirData slots in export order.'
              : 'Receive-only AM channels in the civil airband (118–137 MHz). Wire names must match AMAir.CSV and AM zone member columns.'
          }
          anytoneBank="airband"
        />
        <BuildWirePreviewListPage
          embedded
          title="Zones"
          entityKind="zone"
          description={
            isWebSerial
              ? 'Zones with at least one airband member, projected to AmZoneData. Airband-only zones appear here only; mixed zones also appear on Zones for DMR members.'
              : 'Zones with at least one airband member. Airband-only zones appear here only; mixed zones also appear on Zones for DMR members.'
          }
          anytoneBank="airband"
        />
      </Stack>
    </FormPage>
  );
}
