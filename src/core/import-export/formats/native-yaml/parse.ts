import type { ProjectAggregate } from '../../projectDocument.ts';

/** Parse native YAML into a project aggregate. Implemented in import slice (#58). */
export function parseProjectDocument(text: string): ProjectAggregate {
  void text;
  throw new Error('native-yaml parse not implemented');
}
