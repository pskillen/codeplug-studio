export type PutResult =
  { ok: true; revision: number } | { ok: false; reason: 'revision_conflict' | 'not_found' };

export type EntityKind =
  'project' | 'channel' | 'talkGroup' | 'contact' | 'rxGroupList' | 'formatBuild';
