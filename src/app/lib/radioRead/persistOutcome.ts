export type PersistReadPlanOutcome =
  | { ok: true; created: number; updated: number }
  | {
      ok: false;
      reason: 'revision_conflict' | 'not_found' | 'persist_failed';
      message: string;
      created: number;
      updated: number;
    };
