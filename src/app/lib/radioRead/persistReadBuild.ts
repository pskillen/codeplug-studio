import { seedEgressPathsForBuild } from '@core/domain/factories.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
import type { ProjectPersistence } from '@integrations/persistence/index.ts';

export async function persistReadBuild(
  persistence: ProjectPersistence,
  args:
    | { kind: 'update'; build: RadioBuild; expectedRevision: number; skipUnchangedWrite?: boolean }
    | { kind: 'create'; build: RadioBuild; egressPaths: EgressPath[] },
): Promise<
  | { ok: true; buildId: string }
  | { ok: false; reason: 'revision_conflict' | 'not_found' | 'persist_failed'; message: string }
> {
  try {
    return await persistence.runWithoutNotifications(async () => {
      const stored =
        args.kind === 'update'
          ? await persistence.getRadioBuild(args.build.projectId, args.build.id)
          : null;
      const unchanged =
        args.kind === 'update' &&
        args.skipUnchangedWrite &&
        stored &&
        stored.revision === args.expectedRevision &&
        JSON.stringify(stored) === JSON.stringify(args.build);
      const result = unchanged
        ? { ok: true as const }
        : await persistence.putRadioBuild(
            args.build,
            args.kind === 'update' ? args.expectedRevision : null,
          );
      if (!result.ok)
        return {
          ok: false,
          reason: result.reason,
          message:
            result.reason === 'revision_conflict'
              ? 'Build was updated elsewhere. Reload and try again.'
              : 'Could not save the build.',
        };
      const existing =
        args.kind === 'update'
          ? await persistence.listEgressPathsForBuild(args.build.projectId, args.build.id)
          : [];
      const candidates =
        args.kind === 'create' ? args.egressPaths : seedEgressPathsForBuild(args.build);
      for (const candidate of candidates) {
        if (
          existing.some(
            (path) =>
              path.formatId === candidate.formatId && path.profileId === candidate.profileId,
          )
        )
          continue;
        const egress =
          args.kind === 'update' &&
          candidate.formatId === args.build.defaultEgressFormatId &&
          candidate.profileId === args.build.defaultEgressProfileId &&
          args.build.defaultEgressPathId
            ? { ...candidate, id: args.build.defaultEgressPathId }
            : candidate;
        const saved = await persistence.putEgressPath(egress, null);
        if (!saved.ok)
          return {
            ok: false,
            reason: saved.reason,
            message:
              saved.reason === 'revision_conflict'
                ? 'Build was updated elsewhere. Reload and try again.'
                : 'Could not save the build.',
          };
      }
      return { ok: true, buildId: args.build.id };
    });
  } catch {
    return { ok: false, reason: 'persist_failed', message: 'Could not save the build.' };
  }
}
