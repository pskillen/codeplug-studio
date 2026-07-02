import { stringify } from 'yaml';
import {
  documentFromAggregate,
  type ProjectAggregate,
} from '../../projectDocument.ts';

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      sorted[key] = sortKeysDeep(record[key]);
    }
    return sorted;
  }
  return value;
}

/** Serialise a project aggregate to native YAML v1. */
export function serialiseProject(aggregate: ProjectAggregate): string {
  const document = documentFromAggregate(aggregate);
  const sorted = sortKeysDeep(document);
  return stringify(sorted, { lineWidth: 0 }).trimEnd();
}
