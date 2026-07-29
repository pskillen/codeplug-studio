import { describe, expect, it } from 'vitest';
import {
  AtD890ScriptedPipe,
  scriptAtD890Connect,
  scriptAtD890ConnectWithNegotiation,
} from './__fixtures__/scriptedPipe.ts';
import {
  AT_D890_MEMORY_REGION_GROUPS,
  AT_D890_MEMORY_REGIONS,
  runAtD890DigitalContactsDump,
  runAtD890MemoryDumpAll,
  runAtD890MemoryGroupDump,
  runAtD890MemoryRegionDump,
} from './memoryRegionExport.ts';
import {
  AT_D890_DUMP_RX_GROUP_LISTS,
  AT_D890_DUMP_RX_GROUP_SET_BYTES,
  AT_D890_DUMP_SCAN_LISTS,
  D890_MAP,
} from './constants.ts';

function writeFrames(pipe: AtD890ScriptedPipe) {
  return pipe.writes.filter((w) => w[0] === 0x57 /* 'W' */);
}

describe('AT_D890_MEMORY_REGIONS', () => {
  it('has unique ids', () => {
    const ids = AT_D890_MEMORY_REGIONS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not include DigitalContact — handled separately', () => {
    expect(AT_D890_MEMORY_REGIONS.some((r) => r.id.toLowerCase().includes('contact'))).toBe(false);
  });

  it('every chunk is 16-byte aligned in address and length', () => {
    for (const region of AT_D890_MEMORY_REGIONS) {
      for (const chunk of region.chunks) {
        expect(chunk.address % 16, `${region.id} address`).toBe(0);
        expect(chunk.length % 16, `${region.id} length`).toBe(0);
        expect(chunk.length, `${region.id} length > 0`).toBeGreaterThan(0);
      }
    }
  });

  it('dump/verify probe spans cover scan lists and RX groups through CPS UI ceiling', () => {
    const scanListData = AT_D890_MEMORY_REGIONS.find((r) => r.id === 'scanListData')!;
    const receiveGroupSet = AT_D890_MEMORY_REGIONS.find((r) => r.id === 'receiveGroupSet')!;
    const receiveGroupData = AT_D890_MEMORY_REGIONS.find((r) => r.id === 'receiveGroupData')!;

    expect(scanListData.chunks[0]!.length).toBe(AT_D890_DUMP_SCAN_LISTS * D890_MAP.ScanListStride);
    expect(receiveGroupSet.chunks[0]!.length).toBe(AT_D890_DUMP_RX_GROUP_SET_BYTES);
    expect(receiveGroupData.chunks[0]!.length).toBe(
      AT_D890_DUMP_RX_GROUP_LISTS * D890_MAP.ReceiveGroupStride,
    );
  });

  it('channelData is tiled across every block, not one 8 MB span', () => {
    const channelData = AT_D890_MEMORY_REGIONS.find((r) => r.id === 'channelData')!;
    expect(channelData.chunks).toHaveLength(D890_MAP.ChannelDataBlockCount);
    expect(channelData.chunks[0]!.address).toBe(D890_MAP.ChannelData);
    expect(channelData.chunks[1]!.address).toBe(
      D890_MAP.ChannelData + D890_MAP.ChannelDataBlockOffset,
    );
    expect(channelData.chunks[0]!.length).toBe(
      D890_MAP.ChannelDataBlockSize * D890_MAP.ChannelDataOffset,
    );
  });

  it('every region belongs to a known group', () => {
    const groupIds = new Set(AT_D890_MEMORY_REGION_GROUPS.map((g) => g.id));
    for (const region of AT_D890_MEMORY_REGIONS) {
      expect(groupIds.has(region.group), `${region.id} group "${region.group}"`).toBe(true);
    }
  });

  it('every group has at least one region', () => {
    for (const group of AT_D890_MEMORY_REGION_GROUPS) {
      expect(
        AT_D890_MEMORY_REGIONS.some((r) => r.group === group.id),
        `group "${group.id}" has no regions`,
      ).toBe(true);
    }
  });
});

describe('runAtD890MemoryRegionDump', () => {
  it('reads the requested region and never writes', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890ConnectWithNegotiation(pipe, 0x10);
    const content = new Uint8Array(D890_MAP.MasterIdLength).map((_, i) => i & 0xff);
    pipe.readResponder = (addr, len) => {
      if (addr === D890_MAP.LocalInfo) return new Uint8Array(len).fill(0xff);
      if (addr >= D890_MAP.MasterIdData && addr + len <= D890_MAP.MasterIdData + content.length) {
        return content.subarray(addr - D890_MAP.MasterIdData, addr - D890_MAP.MasterIdData + len);
      }
      return null;
    };

    const result = await runAtD890MemoryRegionDump(pipe, 'masterIdData');

    expect(result.region.id).toBe('masterIdData');
    expect(result.bytes).toEqual(content);
    expect(writeFrames(pipe)).toEqual([]);
  });

  it('rejects an unknown region id', async () => {
    const pipe = new AtD890ScriptedPipe();
    await expect(runAtD890MemoryRegionDump(pipe, 'notARegion')).rejects.toThrow(RangeError);
  });
});

describe('runAtD890MemoryDumpAll', () => {
  it('dumps every documented region and never writes', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890ConnectWithNegotiation(pipe, 0x10);
    pipe.readResponder = (addr, len) => {
      void addr;
      return new Uint8Array(len).fill(0xab);
    };

    const result = await runAtD890MemoryDumpAll(pipe);

    expect(result.files.size).toBe(AT_D890_MEMORY_REGIONS.length);
    for (const region of AT_D890_MEMORY_REGIONS) {
      const expectedLength = region.chunks.reduce((sum, c) => sum + c.length, 0);
      expect(result.files.get(region.id)?.length).toBe(expectedLength);
    }
    expect(result.totalBytes).toBeGreaterThan(0);
    expect(writeFrames(pipe)).toEqual([]);
  });
});

describe('runAtD890MemoryGroupDump', () => {
  it('dumps only the regions in the requested group and never writes', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890ConnectWithNegotiation(pipe, 0x10);
    pipe.readResponder = (addr, len) => {
      void addr;
      return new Uint8Array(len).fill(0xcd);
    };

    const result = await runAtD890MemoryGroupDump(pipe, 'airband');

    const expectedIds = AT_D890_MEMORY_REGIONS.filter((r) => r.group === 'airband').map(
      (r) => r.id,
    );
    expect([...result.files.keys()]).toEqual(expectedIds);
    expect(writeFrames(pipe)).toEqual([]);
  });

  it('rejects an unknown group id', async () => {
    const pipe = new AtD890ScriptedPipe();
    await expect(runAtD890MemoryGroupDump(pipe, 'notAGroup')).rejects.toThrow(RangeError);
  });
});

describe('runAtD890DigitalContactsDump', () => {
  it('reconstructs the linear order and contact streams from block-hopped addresses', async () => {
    const pipe = new AtD890ScriptedPipe();

    const contactCount = 2;
    const dataLinearLength = 40; // block 0, addrMod 40 — within DigitalContactDataBlockLength
    const endAddress = D890_MAP.DigitalContactData + dataLinearLength;

    const meta = new Uint8Array(D890_MAP.DigitalContactMetaLength);
    new DataView(meta.buffer).setUint32(0, contactCount, true);
    new DataView(meta.buffer).setUint32(4, endAddress, true);

    const orderBytes = new Uint8Array(contactCount * D890_MAP.DigitalContactOrderEntrySize).map(
      (_, i) => (0x10 + i) & 0xff,
    );
    const dataBytes = new Uint8Array(48).map((_, i) => (0x40 + i) & 0xff);

    scriptAtD890Connect(pipe);
    pipe.readResponder = (addr, len) => {
      if (addr === D890_MAP.LocalInfo) return new Uint8Array(len).fill(0xff);
      if (addr === D890_MAP.DigitalContactMeta && len === meta.length) return meta;
      if (
        addr >= D890_MAP.DigitalContactOrder &&
        addr + len <= D890_MAP.DigitalContactOrder + orderBytes.length
      ) {
        const off = addr - D890_MAP.DigitalContactOrder;
        return orderBytes.subarray(off, off + len);
      }
      if (
        addr >= D890_MAP.DigitalContactData &&
        addr + len <= D890_MAP.DigitalContactData + dataBytes.length
      ) {
        const off = addr - D890_MAP.DigitalContactData;
        return dataBytes.subarray(off, off + len);
      }
      return null;
    };

    const result = await runAtD890DigitalContactsDump(pipe);

    expect(result.contactCount).toBe(contactCount);
    expect(result.order).toEqual(orderBytes);
    expect(result.contacts).toEqual(dataBytes.subarray(0, dataLinearLength));
    expect(writeFrames(pipe)).toEqual([]);
  });
});
