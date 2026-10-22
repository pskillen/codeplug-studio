import { describe, expect, it } from 'vitest';

import {
  DM32UV_FIRMWARE_IMAGE_SIZE,
  DM32UV_FIRMWARE_ROLE_BIN,
} from '../radios/baofeng/dm-32uv/firmware.ts';
import { getStockFirmwareDescriptor, listStockFirmwareDescriptors } from './stockCatalog.ts';

const SHA_RE = /^[0-9a-f]{64}$/;

describe('stock firmware catalog', () => {
  const all = listStockFirmwareDescriptors();

  it('lists both radios with unique ids', () => {
    const ids = all.map((d) => d.radioId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(['baofeng-dm32uv', 'anytone-at-d890uv']));
  });

  it('has unique member roles within each descriptor', () => {
    for (const d of all) {
      const roles = d.members.map((m) => m.role);
      expect(new Set(roles).size).toBe(roles.length);
    }
  });

  it('pins every hash as 64 lowercase hex', () => {
    for (const d of all) {
      expect(d.zip.sha256).toMatch(SHA_RE);
      for (const m of d.members) expect(m.sha256).toMatch(SHA_RE);
    }
  });

  it('pins the DM-32UV image at the required size', () => {
    const d = getStockFirmwareDescriptor('baofeng-dm32uv');
    const bin = d.members.find((m) => m.role === DM32UV_FIRMWARE_ROLE_BIN);
    expect(bin?.size).toBe(DM32UV_FIRMWARE_IMAGE_SIZE);
  });

  it('looks up by radio id', () => {
    for (const d of all) expect(getStockFirmwareDescriptor(d.radioId)).toBe(d);
  });
});
