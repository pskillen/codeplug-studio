import type {
  DecodedDomain,
  DecodedIdentity,
  FieldDiffKind,
  DecodedField,
  DecodedRecord,
  DecodedSnapshot,
  DomainDiffSummary,
  FieldDiff,
  RecordDiff,
  RecordDiffKind,
} from './types.ts';

export interface DiffDecodedOptions {
  /** Include the values of sensitive fields (the operator pressed Show password). Default false. */
  revealSensitive?: boolean;
}

export interface DecodedDiff {
  domains: readonly DomainDiffSummary[];
  /** Every record of both captures, unchanged ones included, in domain then record order. */
  records: readonly RecordDiff[];
}

type Side = 'both' | 'a-only' | 'b-only';

function diffFields(
  a: readonly DecodedField[] | undefined,
  b: readonly DecodedField[] | undefined,
  side: Side,
  reveal: boolean,
): FieldDiff[] {
  const mapA = new Map((a ?? []).map((f) => [f.id, f]));
  const mapB = new Map((b ?? []).map((f) => [f.id, f]));
  const ids = [...new Set([...mapA.keys(), ...mapB.keys()])];
  return ids.map((id) => {
    const fa = mapA.get(id);
    const fb = mapB.get(id);
    const sensitive = Boolean(fa?.sensitive || fb?.sensitive);
    const hide = sensitive && !reveal;
    const va = fa?.value;
    const vb = fb?.value;
    let kind: FieldDiff['kind'];
    if (side === 'b-only') kind = 'added';
    else if (side === 'a-only') kind = 'removed';
    else if (va === undefined || vb === undefined) kind = 'incomparable';
    else kind = va === vb ? 'unchanged' : 'changed';
    return {
      id,
      label: (fb ?? fa)!.label,
      kind,
      ...(sensitive ? { sensitive: true } : {}),
      ...((fb ?? fa)!.address === undefined ? {} : { address: (fb ?? fa)!.address }),
      ...(va === undefined || hide ? {} : { a: va }),
      ...(vb === undefined || hide ? {} : { b: vb }),
    };
  });
}

function kindOfFields(fields: readonly FieldDiff[]): RecordDiffKind {
  if (fields.some((f) => f.kind === 'changed')) return 'changed';
  if (fields.length > 0 && fields.every((f) => f.kind === 'incomparable')) return 'incomparable';
  return 'unchanged';
}

/** A record without a stated `occupied` is occupied; unknown when the capture lists no occupancy. */
function occupancy(domain: DecodedDomain, r: DecodedRecord): boolean | undefined {
  return domain.occupancyCaptured ? (r.occupied ?? true) : undefined;
}

function diffRecord(
  id: string,
  da: DecodedDomain,
  db: DecodedDomain,
  a: DecodedRecord | undefined,
  b: DecodedRecord | undefined,
  reveal: boolean,
): RecordDiff {
  const rec = (a ?? b)!;
  const note = b?.note ?? a?.note;
  const common = {
    domainId: id,
    key: rec.key,
    ...(rec.slot === undefined ? {} : { slot: rec.slot }),
    ...(a ? { identityA: a.identity } : {}),
    ...(b ? { identityB: b.identity } : {}),
    caveats: [...new Set([...(a?.caveats ?? []), ...(b?.caveats ?? [])])],
    ...(note ? { note } : {}),
  };
  const finish = (kind: RecordDiffKind, fields: FieldDiff[]): RecordDiff => ({
    ...common,
    kind,
    fields,
    incomparableFields: fields.filter((f) => f.kind === 'incomparable').length,
  });
  const both = da.occupancyCaptured && db.occupancyCaptured;
  if (!a || !b) {
    const side: Side = a ? 'a-only' : 'b-only';
    const fields = diffFields(a?.fields, b?.fields, side, reveal);
    if (!both)
      return finish(
        'incomparable',
        fields.map((f) => ({ ...f, kind: 'incomparable' as const })),
      );
    // The other capture lists no such record; an empty one on this side is no change.
    if ((a ?? b)!.occupied === false) return finish('unchanged', fields);
    return finish(a ? 'removed' : 'added', fields);
  }
  const fields = diffFields(a.fields, b.fields, 'both', reveal);
  const oa = occupancy(da, a);
  const ob = occupancy(db, b);
  if (oa !== undefined && ob !== undefined && oa !== ob) {
    const filled = ob;
    return finish(
      filled ? 'added' : 'removed',
      fields.map((f) =>
        f.kind === 'incomparable'
          ? { ...f, kind: filled ? ('added' as const) : ('removed' as const) }
          : f,
      ),
    );
  }
  return finish(kindOfFields(fields), fields);
}

/**
 * Diff two decoded captures. Records match by `key`. A record one capture lacks, or occupied in
 * one and empty in the other, reads added or removed only when both captures say which records
 * exist (`occupancyCaptured`); otherwise it is incomparable. A field without a value on a side
 * is incomparable, never zero. Sensitive values stay out of the result unless `revealSensitive`;
 * a changed one still reads changed.
 */
export function diffDecoded(
  a: DecodedSnapshot,
  b: DecodedSnapshot,
  options: DiffDecodedOptions = {},
): DecodedDiff {
  const reveal = options.revealSensitive === true;
  const byIdA = new Map(a.map((d) => [d.id, d]));
  const byIdB = new Map(b.map((d) => [d.id, d]));
  const domainIds = [...new Set([...byIdA.keys(), ...byIdB.keys()])];
  const domains: DomainDiffSummary[] = [];
  const records: RecordDiff[] = [];
  for (const id of domainIds) {
    const da = byIdA.get(id);
    const db = byIdB.get(id);
    const domain = (db ?? da)!;
    const out: RecordDiff[] = [];
    if (!da || !db) {
      // In one capture only: nothing to compare against.
      for (const r of domain.records) {
        const side: Side = da ? 'a-only' : 'b-only';
        const fields = diffFields(
          da ? r.fields : undefined,
          db ? r.fields : undefined,
          side,
          reveal,
        );
        out.push({
          domainId: id,
          key: r.key,
          ...(r.slot === undefined ? {} : { slot: r.slot }),
          ...(da ? { identityA: r.identity } : { identityB: r.identity }),
          kind: 'incomparable',
          fields: fields.map((f) => ({ ...f, kind: 'incomparable' as const })),
          incomparableFields: fields.length,
          caveats: r.caveats ?? [],
        });
      }
    } else {
      const mapB = new Map(db.records.map((r) => [r.key, r]));
      const seen = new Set<string>();
      for (const ra of da.records) {
        seen.add(ra.key);
        out.push(diffRecord(id, da, db, ra, mapB.get(ra.key), reveal));
      }
      for (const rb of db.records)
        if (!seen.has(rb.key)) out.push(diffRecord(id, da, db, undefined, rb, reveal));
    }
    const count = (k: RecordDiffKind) => out.filter((r) => r.kind === k).length;
    const note = db?.note ?? da?.note;
    const occupancyCompared = Boolean(da?.occupancyCaptured && db?.occupancyCaptured);
    domains.push({
      id,
      label: domain.label,
      changed: count('changed'),
      added: count('added'),
      removed: count('removed'),
      unchanged: count('unchanged'),
      incomparable: count('incomparable'),
      occupancyCompared,
      unavailable: !da || !db || (out.length === 0 && !occupancyCompared),
      ...(note ? { note } : {}),
    });
    records.push(...out);
  }
  return { domains, records };
}

export interface DomainFieldCounts {
  domainId: string;
  /** Fields that read changed, across every record of the domain. */
  changedFields: number;
  /** Records with at least one changed field. */
  changedRecords: number;
}

/** Per-domain changed-field counts, for the compare summary. */
export function fieldCounts(diff: DecodedDiff): DomainFieldCounts[] {
  return diff.domains.map((d) => {
    const records = diff.records.filter((r) => r.domainId === d.id);
    const changedFields = records.reduce(
      (n, r) => n + r.fields.filter((f) => f.kind === 'changed').length,
      0,
    );
    const changedRecords = records.filter((r) => r.fields.some((f) => f.kind === 'changed')).length;
    return { domainId: d.id, changedFields, changedRecords };
  });
}

/** Callsign first, then name; the name alone when there is no callsign. */
export function identityText(id: DecodedIdentity | undefined): string {
  if (!id) return '';
  return [id.callsign, id.name].filter(Boolean).join(' ');
}

/** `Slot 7 · GB3GL Glasgow (was GB3GL Old)`; the record key when it has neither slot nor identity. */
export function recordTitle(r: RecordDiff): string {
  const slot = r.slot === undefined ? '' : `Slot ${r.slot}`;
  const a = identityText(r.identityA);
  const b = identityText(r.identityB);
  const current = b || a;
  const was = a && b && a !== b ? ` (was ${a})` : '';
  return [slot, `${current}${was}`.trim()].filter(Boolean).join(' · ') || r.key;
}

/**
 * One changed value in the radio-neutral shape the shared "Decoded changes" list draws, whatever
 * the radio: section (category), record, label, values A and B, address, sensitive flag.
 * `a` and `b` are absent for a sensitive value that is not revealed, and on a side the record lacks.
 */
export interface DecodedChange {
  section: string;
  record: string;
  label: string;
  kind: FieldDiffKind;
  a?: string;
  b?: string;
  address?: number;
  sensitive?: boolean;
}

/** The changed, added and removed fields of a decoded diff, in domain then record order. */
export function decodedChanges(diff: DecodedDiff): DecodedChange[] {
  const section = new Map(diff.domains.map((d) => [d.id, d.label]));
  return diff.records.flatMap((r) =>
    r.fields
      .filter((f) => f.kind === 'changed' || f.kind === 'added' || f.kind === 'removed')
      .map((f) => ({
        section: section.get(r.domainId) ?? r.domainId,
        record: recordTitle(r),
        label: f.label,
        kind: f.kind,
        ...(f.a === undefined ? {} : { a: f.a }),
        ...(f.b === undefined ? {} : { b: f.b }),
        ...(f.address === undefined ? {} : { address: f.address }),
        ...(f.sensitive ? { sensitive: true } : {}),
      })),
  );
}

/** Fields not captured on at least one side: unknown, so never counted as changes. */
export function notCapturedCount(diff: DecodedDiff): number {
  return diff.records.reduce(
    (n, r) => n + r.fields.filter((f) => f.kind === 'incomparable').length,
    0,
  );
}
