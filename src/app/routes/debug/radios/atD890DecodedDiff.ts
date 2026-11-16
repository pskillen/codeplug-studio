/**
 * Decoded field differences between two AT-D890UV debug archives.
 *
 * Pure. It reuses the memory projection and the core calibration decoder and never decodes bytes
 * itself. Records are matched by radio slot; settings and calibration fields by stable field id.
 * A side that did not capture a value contributes "unavailable", never zero, empty or deleted.
 * Additions and removals are reported only when both sides captured their occupancy bitmap.
 */
import {
  decodeAtD890Calibration,
  type AtD890Calibration,
} from '@core/radios/anytone/at-d890uv/calibration.ts';
import {
  projectAtD890Memory,
  type AtD890MemoryProjection,
} from '@integrations/radio-io/radios/at-d890uv/debugMemory.ts';
import type {
  DecodedDomain,
  DecodedRecord,
  DecodedSnapshot,
} from '@integrations/radio-io/debugCompare/index.ts';
import type { DebugArchive } from './captureArchive.ts';
import { selectAtD890TuneRegion } from './AtD890Calibration.tsx';
import { isAtD890ClassifiedRange, readAtD890Provenance } from './atD890Provenance.ts';

export type AtD890DiffDomain =
  'channel' | 'zone' | 'contact' | 'rx-group' | 'scan-list' | 'setting' | 'calibration';

export const AT_D890_DIFF_DOMAIN_LABELS: Record<AtD890DiffDomain, string> = {
  channel: 'Channels',
  zone: 'Zones',
  contact: 'Contacts and talk groups',
  'rx-group': 'RX groups',
  'scan-list': 'Scan lists',
  setting: 'Settings',
  calibration: 'Calibration',
};

export interface AtD890FieldChange {
  field: string;
  before: string;
  after: string;
}

/** A field not captured on at least one side, keeping whatever the other side did capture. */
export interface AtD890UnavailableField {
  field: string;
  /** Captured value of the first / second capture; `undefined` when that side lacks it. */
  before?: string;
  after?: string;
  missing: 'first' | 'second' | 'both';
}

export interface AtD890DiffRow {
  domain: AtD890DiffDomain;
  /** Slot number or stable field id. */
  key: string;
  label: string;
  kind: 'changed' | 'added' | 'removed' | 'incomparable';
  changes: readonly AtD890FieldChange[];
  /** Fields (or the whole record) not captured on at least one side. */
  unavailable: readonly AtD890UnavailableField[];
  /** Firmware-dependent meaning caveats of the compared values; they never become verdicts. */
  caveats: readonly string[];
  note?: string;
  /** A password field: the page hides every value of this row until the viewer reveals it. */
  sensitive?: boolean;
}

export interface AtD890DomainSummary {
  domain: AtD890DiffDomain;
  /** False when a side did not capture the occupancy evidence needed to call additions or removals. */
  occupancyComparable: boolean;
  compared: number;
  /** Matched records or fields with nothing captured on either side; no row is listed for them. */
  uncapturedBoth: number;
  note?: string;
}

export interface AtD890DecodedDiff {
  rows: readonly AtD890DiffRow[];
  domains: readonly AtD890DomainSummary[];
}

/** `undefined` means the value was not captured on that side. */
type Fields = Record<string, string | undefined>;
interface Described {
  label: string;
  sensitive?: boolean;
  fields: Fields;
  caveats?: readonly string[];
}
interface Side {
  /** True when the occupancy bitmap was captured, so absent slots are genuinely absent. */
  occupancy: boolean;
  items: ReadonlyMap<string, Described>;
}

const UNSET = '(unset)';
const text = (value: unknown): string =>
  value === undefined ? UNSET : (JSON.stringify(value) ?? String(value));
const flatten = (obj: object, keys: readonly string[]): Fields =>
  Object.fromEntries(keys.map((k) => [k, text((obj as Record<string, unknown>)[k])]));
const keysOf = (objs: readonly object[]): string[] =>
  [...new Set(objs.flatMap((o) => Object.keys(o)))].sort();
const members = (list: readonly { position: number; rawIndex: number }[]) =>
  list.map((m) => `${m.position}:${m.rawIndex}`).join(', ') || '(none)';
const slotKey = (slot: number) => String(slot);
const hexBytes = (bytes: readonly number[]) =>
  bytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

function diffDomain(
  domain: AtD890DiffDomain,
  a: Side,
  b: Side,
  summary: Pick<AtD890DomainSummary, 'note'> = {},
): { rows: AtD890DiffRow[]; summary: AtD890DomainSummary } {
  const rows: AtD890DiffRow[] = [];
  const keys = [...new Set([...a.items.keys(), ...b.items.keys()])].sort((x, y) => {
    const nx = Number(x);
    const ny = Number(y);
    return Number.isNaN(nx) || Number.isNaN(ny) ? x.localeCompare(y) : nx - ny;
  });
  const occupancyComparable = a.occupancy && b.occupancy;
  let compared = 0;
  let uncapturedBoth = 0;
  for (const key of keys) {
    const x = a.items.get(key);
    const y = b.items.get(key);
    if (x && y) {
      compared++;
      if (
        Object.values(x.fields).every((v) => v === undefined) &&
        Object.values(y.fields).every((v) => v === undefined)
      ) {
        uncapturedBoth++;
        continue;
      }
      const changes: AtD890FieldChange[] = [];
      const unavailable: AtD890UnavailableField[] = [];
      for (const field of new Set([...Object.keys(x.fields), ...Object.keys(y.fields)])) {
        const before = x.fields[field];
        const after = y.fields[field];
        if (before === undefined || after === undefined)
          unavailable.push({
            field,
            before,
            after,
            missing:
              before === undefined && after === undefined
                ? 'both'
                : before === undefined
                  ? 'first'
                  : 'second',
          });
        else if (before !== after) changes.push({ field, before, after });
      }
      if (changes.length || unavailable.length)
        rows.push({
          domain,
          key,
          label: y.label || x.label,
          kind: changes.length ? 'changed' : 'incomparable',
          changes,
          unavailable,
          caveats: [...new Set([...(x.caveats ?? []), ...(y.caveats ?? [])])],
          ...(x.sensitive || y.sensitive ? { sensitive: true } : {}),
        });
    } else {
      const only = (x ?? y)!;
      const present = x ? 'first' : 'second';
      if (occupancyComparable)
        rows.push({
          domain,
          key,
          label: only.label,
          kind: x ? 'removed' : 'added',
          changes: [],
          unavailable: [],
          caveats: only.caveats ?? [],
          note: `Occupied only in the ${present} capture; both occupancy bitmaps were captured.`,
        });
      else
        rows.push({
          domain,
          key,
          label: only.label,
          kind: 'incomparable',
          changes: [],
          unavailable: [],
          caveats: only.caveats ?? [],
          note: `Present only in the ${present} capture. The other capture did not capture occupancy, so this is not a deletion.`,
        });
    }
  }
  return { rows, summary: { domain, occupancyComparable, compared, uncapturedBoth, ...summary } };
}

const side = (occupancy: boolean, entries: readonly (readonly [string, Described])[]): Side => ({
  occupancy,
  items: new Map(entries),
});

function channelSide(p: AtD890MemoryProjection, keys: readonly string[]): Side {
  return side(
    p.channels.bitmap === 'captured',
    p.channels.entries.map((e) => {
      const s = e.state;
      if (s.kind === 'decoded')
        return [
          slotKey(e.slot),
          {
            label: s.channel.wireName || '(unnamed)',
            fields: { state: 'decoded', ...flatten(s.channel, keys) },
          },
        ] as const;
      const state =
        s.kind === 'not-captured'
          ? undefined
          : s.kind === 'invalid-record'
            ? `invalid-record: ${s.reason}`
            : s.kind;
      return [slotKey(e.slot), { label: '', fields: { state } }] as const;
    }),
  );
}

function zoneSide(p: AtD890MemoryProjection): Side {
  return side(
    p.zones.bitmap === 'captured',
    p.zones.entries.map(
      (z) =>
        [
          slotKey(z.slot),
          {
            label: z.name.status === 'captured' ? z.name.text : '',
            fields: {
              name: z.name.status === 'captured' ? z.name.text || '(unnamed)' : undefined,
              members: z.members.status === 'captured' ? members(z.members.list) : undefined,
            },
          },
        ] as const,
    ),
  );
}

function contactSide(p: AtD890MemoryProjection, keys: readonly string[]): Side {
  return side(
    p.bank.bitmap === 'captured',
    p.bank.entries.map((e) => {
      const s = e.state;
      if (s.kind === 'decoded')
        return [
          slotKey(e.slot),
          {
            label: s.record.name || s.record.callsign || '(unnamed)',
            fields: { state: 'decoded', ...flatten(s.record, keys) },
          },
        ] as const;
      if (s.kind === 'not-captured')
        return [slotKey(e.slot), { label: '', fields: { state: undefined } }] as const;
      return [
        slotKey(e.slot),
        {
          label: s.name,
          fields: {
            state: s.kind,
            rawCallType: String(s.rawCallType),
            name: s.name,
            ...(s.kind === 'malformed' ? { reason: s.reason } : {}),
          },
        },
      ] as const;
    }),
  );
}

function rxGroupSide(p: AtD890MemoryProjection): Side {
  return side(
    p.rxGroups.bitmap === 'captured',
    p.rxGroups.entries.map(
      (g) =>
        [
          slotKey(g.slot),
          {
            label: g.name.status === 'captured' ? g.name.text : '',
            fields: {
              name: g.name.status === 'captured' ? g.name.text || '(unnamed)' : undefined,
              members: g.members.status === 'captured' ? members(g.members.list) : undefined,
              timeSlots:
                g.members.status === 'captured' && g.overrides === 'captured'
                  ? g.members.list.map((m) => `${m.position}:${m.timeSlot ?? '-'}`).join(', ') ||
                    '(none)'
                  : undefined,
            },
          },
        ] as const,
    ),
  );
}

function scanListSide(p: AtD890MemoryProjection): Side {
  const priority = (v: { kind: string; word: number }) => `${v.kind}:${v.word}`;
  return side(
    p.scanLists.bitmap === 'captured',
    p.scanLists.entries.map(
      (l) =>
        [
          slotKey(l.slot),
          {
            label: l.name.status === 'captured' ? l.name.text : '',
            fields: {
              name: l.name.status === 'captured' ? l.name.text || '(unnamed)' : undefined,
              members: l.members.status === 'captured' ? members(l.members.list) : undefined,
              select: l.priority.status === 'captured' ? String(l.priority.select.raw) : undefined,
              first: l.priority.status === 'captured' ? priority(l.priority.first) : undefined,
              second: l.priority.status === 'captured' ? priority(l.priority.second) : undefined,
            },
          },
        ] as const,
    ),
  );
}

/** Registered settings are a fixed set, so there is no occupancy to compare. */
function settingSide(p: AtD890MemoryProjection): Side {
  return side(
    true,
    p.settings.fields.map(
      (f) =>
        [
          f.id,
          {
            label: f.label,
            ...(f.sensitive ? { sensitive: true } : {}),
            caveats: f.conditional ? [f.conditional] : [],
            fields:
              f.status === 'captured'
                ? {
                    value:
                      f.valueLabel ?? (f.value === undefined ? '(not recognised)' : text(f.value)),
                    raw: hexBytes(f.raw ?? []),
                  }
                : { value: undefined, raw: undefined },
          },
        ] as const,
    ),
  );
}

function calibrationSide(cal: AtD890Calibration): Side {
  const entries: [string, Described][] = [];
  for (const s of cal.scalars)
    entries.push([
      s.id,
      {
        label: s.label,
        fields: { value: s.value === undefined ? undefined : String(s.value) },
      },
    ]);
  for (const t of cal.tables)
    entries.push([
      t.id,
      {
        label: t.label,
        fields: Object.fromEntries(
          t.values.map((v, i) => [`[${i}]`, v === undefined ? undefined : String(v)]),
        ),
      },
    ]);
  return side(true, entries);
}

/** The decoded differences, or `undefined` when either archive is not an AT-D890UV capture. */
export function diffAtD890Decoded(
  first: DebugArchive,
  second: DebugArchive,
): AtD890DecodedDiff | undefined {
  if (first.manifest.radioModelId !== 'AT-D890UV' || second.manifest.radioModelId !== 'AT-D890UV')
    return undefined;
  const a = projectAtD890Memory(first.manifest.regions, first.regions);
  const b = projectAtD890Memory(second.manifest.regions, second.regions);
  const decodedChannels = (p: AtD890MemoryProjection) =>
    p.channels.entries.flatMap((e) => (e.state.kind === 'decoded' ? [e.state.channel] : []));
  const decodedContacts = (p: AtD890MemoryProjection) =>
    p.bank.entries.flatMap((e) => (e.state.kind === 'decoded' ? [e.state.record] : []));
  const channelKeys = keysOf([...decodedChannels(a), ...decodedChannels(b)]);
  const contactKeys = keysOf([...decodedContacts(a), ...decodedContacts(b)]);
  const parts = [
    diffDomain('channel', channelSide(a, channelKeys), channelSide(b, channelKeys)),
    diffDomain('zone', zoneSide(a), zoneSide(b)),
    diffDomain('contact', contactSide(a, contactKeys), contactSide(b, contactKeys)),
    diffDomain('rx-group', rxGroupSide(a), rxGroupSide(b)),
    diffDomain('scan-list', scanListSide(a), scanListSide(b)),
    diffDomain('setting', settingSide(a), settingSide(b)),
  ];
  const tuneA = selectAtD890TuneRegion(first);
  const tuneB = selectAtD890TuneRegion(second);
  if (tuneA.status === 'ok' && tuneB.status === 'ok') {
    parts.push(
      diffDomain(
        'calibration',
        calibrationSide(decodeAtD890Calibration(tuneA.bytes)),
        calibrationSide(decodeAtD890Calibration(tuneB.bytes)),
      ),
    );
  } else
    parts.push({
      rows: [],
      summary: {
        domain: 'calibration',
        occupancyComparable: false,
        compared: 0,
        uncapturedBoth: 0,
        note: 'Both captures need a live tune unit (tune A); tune B is never substituted.',
      },
    });
  return { rows: parts.flatMap((p) => p.rows), domains: parts.map((p) => p.summary) };
}

/** A `Side` as a decoded domain: records keyed by `keyPrefix` + the item key, values unchanged. */
function domainOf(id: string, domain: AtD890DiffDomain, s: Side, keyPrefix: string): DecodedDomain {
  return {
    id,
    label: AT_D890_DIFF_DOMAIN_LABELS[domain],
    occupancyCaptured: s.occupancy,
    records: [...s.items].map(([key, item]): DecodedRecord => ({
      key: `${keyPrefix}${key}`,
      ...(keyPrefix === 'slot-' ? { slot: Number(key) } : {}),
      identity: item.label ? { name: item.label } : {},
      fields: Object.entries(item.fields).map(([field, value]) => ({
        id: field,
        label: field,
        value,
        ...(item.sensitive ? { sensitive: true } : {}),
      })),
      ...(item.caveats?.length ? { caveats: item.caveats } : {}),
    })),
  };
}

const unitClaim = (v: string | null) => (typeof v === 'string' ? v : undefined);

/** Acquisition claims per classified read range: archive claims, never proof of the unit. */
function evidenceDomain(archive: DebugArchive): DecodedDomain {
  const provenance = readAtD890Provenance(archive);
  if (!provenance)
    return {
      id: 'evidence',
      label: 'Evidence and provenance',
      occupancyCaptured: false,
      records: [],
      note: 'Provenance unavailable: the acquisition claim is missing, malformed or inconsistent with stored regions.',
    };
  return {
    id: 'evidence',
    label: 'Evidence and provenance',
    // A range read in one capture only is not evidence of a change.
    occupancyCaptured: false,
    records: provenance.ranges.filter(isAtD890ClassifiedRange).map((r) => ({
      key: `${r.kind === 'sparse' ? 'sparse' : `vital:${r.requestedUnit}`}:${r.address}`,
      identity: { name: `0x${r.address.toString(16).toUpperCase()}, ${r.byteLength} bytes` },
      fields: [
        { id: 'kind', label: 'Acquisition kind', value: r.kind },
        { id: 'requestedUnit', label: 'Requested unit', value: unitClaim(r.requestedUnit) },
        {
          id: 'respondingUnit',
          label: 'Responding unit claim',
          value: unitClaim(r.respondingUnit),
        },
        {
          id: 'bothReadsMatched',
          label: 'Repeat-read claim',
          value: r.bothReadsMatched === null ? undefined : String(r.bothReadsMatched),
        },
      ],
    })),
    note: 'Acquisition claims from the archive. They do not establish which physical unit responded.',
  };
}

/** The AT-D890UV capture as decoded domains; empty for another radio's archive. */
export function atD890DecodedSnapshot(archive: DebugArchive): DecodedSnapshot {
  if (archive.manifest.radioModelId !== 'AT-D890UV') return [];
  const p = projectAtD890Memory(archive.manifest.regions, archive.regions);
  const channels = p.channels.entries.flatMap((e) =>
    e.state.kind === 'decoded' ? [e.state.channel] : [],
  );
  const contacts = p.bank.entries.flatMap((e) =>
    e.state.kind === 'decoded' ? [e.state.record] : [],
  );
  const tune = selectAtD890TuneRegion(archive);
  const calibration: DecodedDomain =
    tune.status === 'ok'
      ? domainOf(
          'calibration',
          'calibration',
          calibrationSide(decodeAtD890Calibration(tune.bytes)),
          '',
        )
      : {
          id: 'calibration',
          label: AT_D890_DIFF_DOMAIN_LABELS.calibration,
          occupancyCaptured: false,
          records: [],
          note: 'Both captures need a live tune unit (tune A); tune B is never substituted.',
        };
  return [
    evidenceDomain(archive),
    domainOf('channels', 'channel', channelSide(p, keysOf(channels)), 'slot-'),
    domainOf('zones', 'zone', zoneSide(p), 'slot-'),
    domainOf('contacts', 'contact', contactSide(p, keysOf(contacts)), 'slot-'),
    domainOf('rx-groups', 'rx-group', rxGroupSide(p), 'slot-'),
    domainOf('scan-lists', 'scan-list', scanListSide(p), 'slot-'),
    domainOf('settings', 'setting', settingSide(p), ''),
    calibration,
  ];
}
