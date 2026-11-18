import { newRadioBuild, newRadioBuildWithEgresses } from '@core/domain/factories.ts';
import { radioTargetFor, radioTargetIdForProfile } from '@core/radio-targets/catalog.ts';
import { librarySliceFrom } from '@core/services/assemble.ts';
import { mapReadChannels } from '@core/services/radioRead/mapReadChannel.ts';
import { readChannelNameCandidates } from '@core/services/radioRead/readNameCandidates.ts';
import { readZoneNameCandidates } from '@core/services/radioRead/readZoneNameCandidates.ts';
import { selectReadBuild, planReadBuild } from '@core/services/radioRead/readBuild.ts';
import { planReadChannelUpsert } from '@core/services/radioRead/upsertReadChannels.ts';
import { planReadZoneUpsert } from '@core/services/radioRead/upsertReadZones.ts';
import type { ProjectPersistence } from '@integrations/persistence/index.ts';
import type { RadioLibraryRead } from '@integrations/radio-io/readIntoLibrary.ts';
import { persistReadChannelPlan } from '@app/lib/radioRead/persistReadChannelPlan.ts';
import { persistReadZonePlan } from '@app/lib/radioRead/persistReadZonePlan.ts';
import { persistReadBuild } from '@app/lib/radioRead/persistReadBuild.ts';
import { LibraryService } from '@app/state/libraryService.ts';
import { BuildService } from '@app/state/buildService.ts';

export interface RadioReadSummary {
  modelLabel: string;
  firmwareLabel: string;
  channels: { created: number; updated: number; unchanged: number };
  zones: { created: number; updated: number; unchanged: number; warnings: string[] };
  build: {
    id: string;
    name: string;
    action: 'created' | 'updated';
    targetLabel: string;
    channelsLeftOut: number;
    zonesLeftOut: number;
  };
  buildNote?: string;
  droppedFields: readonly string[];
  notes: readonly string[];
}
export type RadioReadOutcome =
  { ok: true; summary: RadioReadSummary } | { ok: false; message: string };

export function descriptorSupportsReadIntoLibrary(descriptor: {
  readIntoLibrary?: unknown;
}): boolean {
  return descriptor.readIntoLibrary != null;
}

export async function applyRadioReadToLibrary({
  persistence,
  projectId,
  read,
  startedFromBuildId,
}: {
  persistence: ProjectPersistence;
  projectId: string;
  read: RadioLibraryRead;
  startedFromBuildId?: string | null;
}): Promise<RadioReadOutcome> {
  let channelsSaved = 0;
  let zonesSaved = 0;
  const saved = () => `${channelsSaved} channels and ${zonesSaved} zones saved.`;
  try {
    return await persistence.runWithoutNotifications(async () => {
      const libraryService = new LibraryService(persistence);
      let library = await libraryService.loadLibrary(projectId);
      const builds = await new BuildService(persistence).listBuilds(projectId);
      const targetId = radioTargetIdForProfile(read.profileId);
      if (!targetId)
        return {
          ok: false,
          message: `Unknown radio profile: ${read.profileId}. Nothing was saved.`,
        };
      const targetLabel = radioTargetFor(targetId)?.label ?? targetId;
      const existing = selectReadBuild({ builds, radioTargetId: targetId, startedFromBuildId });
      const created = existing ? null : newRadioBuildWithEgresses(projectId, targetId);
      const planned = existing ?? created!.build;
      const started = builds.find((build) => build.id === startedFromBuildId);
      const buildNote =
        started && started.radioTargetId !== targetId
          ? `This radio runs ${read.firmwareLabel} but the build you started from is for ${radioTargetFor(started.radioTargetId)?.label ?? started.radioTargetId}; the ${targetLabel} build was used instead.`
          : undefined;
      const nameBuild = existing ?? newRadioBuild(projectId, targetId);
      const slice = librarySliceFrom(library);
      const channelCandidates = readChannelNameCandidates(
        slice,
        nameBuild,
        'radio-io',
        read.profileId,
      );
      const zoneCandidates = read.zones.length
        ? readZoneNameCandidates(slice, nameBuild, 'radio-io', read.profileId)
        : undefined;
      const channelPlan = planReadChannelUpsert(
        library,
        projectId,
        mapReadChannels(read.channels),
        { nameCandidatesByChannelId: channelCandidates },
      );
      const channelResult = await persistReadChannelPlan(persistence, channelPlan);
      channelsSaved = channelResult.created + channelResult.updated;
      if (!channelResult.ok) return { ok: false, message: `${channelResult.message} ${saved()}` };
      const zonePlan = read.zones.length
        ? planReadZoneUpsert(library, projectId, read.zones, channelPlan.slotToChannelId, {
            nameCandidatesByZoneId: zoneCandidates,
          })
        : undefined;
      if (zonePlan) {
        const zoneResult = await persistReadZonePlan(persistence, zonePlan);
        zonesSaved = zoneResult.created + zoneResult.updated;
        if (!zoneResult.ok) return { ok: false, message: `${zoneResult.message} ${saved()}` };
      }
      library = await libraryService.loadLibrary(projectId);
      const buildPlan = planReadBuild({
        build: planned,
        library: librarySliceFrom(library),
        slotToChannelId: channelPlan.slotToChannelId,
        zones: zonePlan?.entries ?? [],
      });
      const buildResult = await persistReadBuild(
        persistence,
        existing
          ? {
              kind: 'update',
              build: buildPlan.build,
              expectedRevision: existing.revision,
              skipUnchangedWrite: true,
            }
          : { kind: 'create', build: buildPlan.build, egressPaths: created!.egressPaths },
      );
      if (!buildResult.ok)
        return {
          ok: false,
          message: `${buildResult.message} ${saved()} The build may have been partially saved.`,
        };
      return {
        ok: true,
        summary: {
          modelLabel: read.modelLabel,
          firmwareLabel: read.firmwareLabel,
          channels: {
            created: channelPlan.creates.length,
            updated: channelPlan.updates.length,
            unchanged: channelPlan.unchanged.length,
          },
          zones: {
            created: zonePlan?.creates.length ?? 0,
            updated: zonePlan?.updates.length ?? 0,
            unchanged: zonePlan?.unchanged.length ?? 0,
            warnings:
              zonePlan?.warnings.map(
                (w) =>
                  `Zone ${w.zoneName}: channel ${w.slot} is empty on the radio and was left out.`,
              ) ?? [],
          },
          build: {
            id: buildPlan.build.id,
            name: buildPlan.build.name,
            action: existing ? 'updated' : 'created',
            targetLabel,
            channelsLeftOut: buildPlan.summary.channelsLeftOut,
            zonesLeftOut: buildPlan.summary.zonesLeftOut,
          },
          ...(buildNote ? { buildNote } : {}),
          droppedFields: read.droppedFields,
          notes: read.notes,
        },
      };
    });
  } catch {
    return {
      ok: false,
      message: `Could not apply the radio read. ${saved()} The build may have been partially saved.`,
    };
  }
}
