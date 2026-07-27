import { describe, expect, it } from 'vitest';
import {
  assertAtD890SentinelRegionsUnchanged,
  snapshotAtD890SentinelRegions,
} from './sentinelVerify.ts';
import { AtD890ScriptedPipe, scriptAtD890SentinelReads } from './__fixtures__/scriptedPipe.ts';
import { D890_MAP } from './constants.ts';

describe('sentinelVerify', () => {
  it('passes when pre/post sentinel snapshots match', async () => {
    const pipe = new AtD890ScriptedPipe();
    const local = new Uint8Array(D890_MAP.LocalInfoLength).fill(0x11);
    scriptAtD890SentinelReads(pipe, { LocalInfo: local });
    scriptAtD890SentinelReads(pipe, { LocalInfo: local });
    const before = await snapshotAtD890SentinelRegions(pipe);
    const after = await snapshotAtD890SentinelRegions(pipe);
    expect(() => assertAtD890SentinelRegionsUnchanged(before, after)).not.toThrow();
  });

  it('fails when LocalInfo sentinel changes', () => {
    const localPre = new Uint8Array(D890_MAP.LocalInfoLength).fill(0x11);
    const localPost = new Uint8Array(D890_MAP.LocalInfoLength).fill(0x22);
    const optionalMain = new Uint8Array(0x200).fill(0xff);
    const optionalExt = new Uint8Array(0x60).fill(0xff);
    const before = new Map([
      ['LocalInfo', localPre],
      ['OptionalSettingsMain', optionalMain],
      ['OptionalSettingsExt', optionalExt],
    ]);
    const after = new Map([
      ['LocalInfo', localPost],
      ['OptionalSettingsMain', optionalMain],
      ['OptionalSettingsExt', optionalExt],
    ]);
    expect(() => assertAtD890SentinelRegionsUnchanged(before, after)).toThrow(
      /sentinel LocalInfo changed/,
    );
  });
});
