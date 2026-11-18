import type { RadioBuild } from '@core/models/radioBuild.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
import type { ProjectPersistence } from '@integrations/persistence/index.ts';

export async function persistReadBuild(
  persistence: ProjectPersistence,
  args:
    | { kind: 'update'; build: RadioBuild; expectedRevision: number }
    | { kind: 'create'; build: RadioBuild; egressPaths: EgressPath[] },
): Promise<
  | { ok: true; buildId: string }
  | { ok: false; reason: 'revision_conflict' | 'not_found' | 'persist_failed'; message: string }
> {
  try {
    return await persistence.runWithoutNotifications(async () => {
      const result = await persistence.putRadioBuild(
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
      if (args.kind === 'create') {
        for (const egress of args.egressPaths) {
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
      }
      return { ok: true, buildId: args.build.id };
    });
  } catch {
    return { ok: false, reason: 'persist_failed', message: 'Could not save the build.' };
  }
}
