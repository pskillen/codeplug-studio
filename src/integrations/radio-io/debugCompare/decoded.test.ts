import { describe, expect, it } from 'vitest';
import { diffDecoded, fieldCounts, type DecodedDomain, type DecodedRecord } from './index.ts';

const rec = (
  key: string,
  values: Record<string, string | undefined>,
  extra: Partial<DecodedRecord> = {},
): DecodedRecord => ({
  key,
  identity: { name: key },
  fields: Object.entries(values).map(([id, value]) => ({ id, label: id.toUpperCase(), value })),
  ...extra,
});
const domain = (records: DecodedRecord[], over: Partial<DecodedDomain> = {}): DecodedDomain => ({
  id: 'd',
  label: 'D',
  occupancyCaptured: true,
  records,
  ...over,
});

describe('diffDecoded', () => {
  it('reports changed, unchanged and the changed field only', () => {
    const r = diffDecoded(
      [domain([rec('a', { rx: '1', tx: '2' }), rec('b', { rx: '1' })])],
      [domain([rec('a', { rx: '9', tx: '2' }), rec('b', { rx: '1' })])],
    );
    expect(r.records.map((x) => x.kind)).toEqual(['changed', 'unchanged']);
    expect(r.records[0]!.fields.filter((f) => f.kind === 'changed')).toEqual([
      { id: 'rx', label: 'RX', kind: 'changed', a: '1', b: '9' },
    ]);
    expect(r.domains[0]).toMatchObject({ changed: 1, unchanged: 1, occupancyCompared: true });
  });

  it('reads a field without a value as incomparable, never zero', () => {
    const r = diffDecoded(
      [domain([rec('a', { rx: undefined, tx: '2' })])],
      [domain([rec('a', { rx: '0', tx: '2' })])],
    );
    expect(r.records[0]!.fields.find((f) => f.id === 'rx')).toMatchObject({ kind: 'incomparable' });
    expect(r.records[0]!.kind).toBe('unchanged');
    expect(r.records[0]!.incomparableFields).toBe(1);
  });

  it('marks a record incomparable when no field can be compared', () => {
    const r = diffDecoded(
      [domain([rec('a', { rx: undefined })])],
      [domain([rec('a', { rx: '1' })])],
    );
    expect(r.records[0]!.kind).toBe('incomparable');
  });

  it('adds and removes records only when both sides captured occupancy', () => {
    const withOcc = diffDecoded(
      [domain([rec('a', { rx: '1' })])],
      [domain([rec('a', { rx: '1' }), rec('b', { rx: '2' })])],
    );
    expect(withOcc.records.find((x) => x.key === 'b')!.kind).toBe('added');
    const reverse = diffDecoded(
      [domain([rec('a', { rx: '1' }), rec('b', { rx: '2' })])],
      [domain([rec('a', { rx: '1' })])],
    );
    expect(reverse.records.find((x) => x.key === 'b')!.kind).toBe('removed');
    const noOcc = diffDecoded(
      [domain([rec('a', { rx: '1' })], { occupancyCaptured: false })],
      [domain([rec('a', { rx: '1' }), rec('b', { rx: '2' })])],
    );
    expect(noOcc.records.find((x) => x.key === 'b')!.kind).toBe('incomparable');
    expect(noOcc.domains[0]).toMatchObject({ occupancyCompared: false, incomparable: 1 });
  });

  it('reads filled and emptied slots as added and removed', () => {
    const empty = rec('s', {}, { occupied: false });
    const full = rec('s', { rx: '1' }, { occupied: true });
    expect(diffDecoded([domain([empty])], [domain([full])]).records[0]).toMatchObject({
      kind: 'added',
      fields: [{ id: 'rx', kind: 'added', b: '1' }],
    });
    expect(diffDecoded([domain([full])], [domain([empty])]).records[0]!.kind).toBe('removed');
    // Not captured occupancy: no claim.
    expect(
      diffDecoded(
        [domain([empty], { occupancyCaptured: false })],
        [domain([full], { occupancyCaptured: false })],
      ).records[0]!.kind,
    ).toBe('incomparable');
  });

  it('keeps an identity change visible as identityA and identityB', () => {
    const r = diffDecoded(
      [domain([rec('s', { n: 'x' }, { identity: { callsign: 'GB3AA', name: 'Old' } })])],
      [domain([rec('s', { n: 'x' }, { identity: { callsign: 'GB3AA', name: 'New' } })])],
    ).records[0]!;
    expect(r.identityA).toEqual({ callsign: 'GB3AA', name: 'Old' });
    expect(r.identityB).toEqual({ callsign: 'GB3AA', name: 'New' });
  });

  it('is incomparable when a domain is in one capture only', () => {
    const r = diffDecoded([domain([rec('a', { rx: '1' })])], []);
    expect(r.records[0]!.kind).toBe('incomparable');
    expect(r.domains[0]).toMatchObject({ incomparable: 1 });
  });

  it('reads a changed sensitive field as changed without its values, until revealed', () => {
    const pw = (v: string): DecodedDomain =>
      domain([
        {
          key: 's',
          identity: {},
          fields: [{ id: 'pw', label: 'Password', value: v, sensitive: true }],
        },
      ]);
    const hidden = diffDecoded([pw('1111')], [pw('2222')]);
    expect(hidden.records[0]!.kind).toBe('changed');
    expect(hidden.records[0]!.fields[0]).toEqual({
      id: 'pw',
      label: 'Password',
      kind: 'changed',
      sensitive: true,
    });
    expect(JSON.stringify(hidden)).not.toMatch(/1111|2222/);
    expect(
      diffDecoded([pw('1111')], [pw('2222')], { revealSensitive: true }).records[0]!.fields[0],
    ).toMatchObject({
      a: '1111',
      b: '2222',
    });
    expect(diffDecoded([pw('1111')], [pw('1111')]).records[0]!.kind).toBe('unchanged');
  });
});

describe('fieldCounts', () => {
  it('counts changed fields and records per domain', () => {
    const d = diffDecoded(
      [domain([rec('a', { rx: '1', tx: '2' }), rec('b', { rx: '1' })])],
      [domain([rec('a', { rx: '9', tx: '3' }), rec('b', { rx: '1' })])],
    );
    expect(fieldCounts(d)).toEqual([{ domainId: 'd', changedFields: 2, changedRecords: 1 }]);
  });
});
