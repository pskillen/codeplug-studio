import type { ProjectAggregate } from '../../projectDocument.ts';

/** Serialise a project aggregate to native YAML. Implemented in export slice (#57). */
export function serialiseProject(aggregate: ProjectAggregate): string {
  void aggregate;
  throw new Error('native-yaml serialise not implemented');
}
