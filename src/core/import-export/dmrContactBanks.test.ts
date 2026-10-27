import { describe, expect, it } from 'vitest';
import { newDigitalContact } from '@core/domain/factories.ts';
import { dmrContactDigitalIdSet } from './dmrContactBanks.ts';

describe('dmrContactDigitalIdSet (#1438)', () => {
  it('holds DMR contact IDs only, so a directory row sharing an NXDN contact ID is written', () => {
    const rows = [
      { entity: newDigitalContact('p1', 'Alice', 1001, 'dmr') },
      { entity: newDigitalContact('p1', 'NX Carol', 3003, 'nxdn') },
      { entity: newDigitalContact('p1', 'No ID', 0, 'dmr') },
    ];
    expect([...dmrContactDigitalIdSet(rows)]).toEqual([1001]);
  });
});
