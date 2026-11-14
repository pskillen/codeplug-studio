import { describe, expect, it } from 'vitest';

import {
  DM32UV_FIRMWARE_IMAGE_SIZE,
  DM32UV_FIRMWARE_ROLE_BIN,
} from '../radios/baofeng/dm-32uv/firmware.ts';
import { UV5RMINI_UNOFFICIAL_STOCK_COPIES } from '../radios/baofeng/uv-5r-mini/firmware.ts';
import { firmwareRadioIdForModel } from './radioTargets.ts';
import { getStockFirmwareDescriptor, listStockFirmwareDescriptors } from './stockCatalog.ts';
import { stockVariantFor, stockVariants } from './stockVariants.ts';

const SHA_RE = /^[0-9a-f]{64}$/;

describe('stock firmware catalog', () => {
  const all = listStockFirmwareDescriptors();

  it('lists both radios with unique ids', () => {
    const ids = all.map((d) => d.radioId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(
      expect.arrayContaining(['baofeng-dm32uv', 'anytone-at-d890uv', 'retevis-rt95-head']),
    );
  });

  it('has unique member roles within each descriptor', () => {
    for (const d of all) {
      const roles = d.members.map((m) => m.role);
      expect(new Set(roles).size).toBe(roles.length);
    }
  });

  it('pins every hash as 64 lowercase hex', () => {
    for (const d of all) {
      if (d.zip) expect(d.zip.sha256).toMatch(SHA_RE);
      for (const m of d.members) expect(m.sha256).toMatch(SHA_RE);
    }
  });

  it('pins the DM-32UV image at the required size', () => {
    const d = getStockFirmwareDescriptor('baofeng-dm32uv');
    const bin = d.members.find((m) => m.role === DM32UV_FIRMWARE_ROLE_BIN);
    expect(bin?.size).toBe(DM32UV_FIRMWARE_IMAGE_SIZE);
  });

  it('has at least one stock source, with safe link schemes', () => {
    for (const d of all) {
      expect(d.stockSources.length).toBeGreaterThan(0);
      for (const s of d.stockSources) {
        if (s.kind === 'download') {
          expect(['http:', 'https:']).toContain(new URL(s.url).protocol);
        } else if (s.kind === 'ask-vendor' && s.contact) {
          expect(['mailto:', 'https:']).toContain(new URL(s.contact.href).protocol);
        }
      }
    }
  });

  it('pins the RT95 front panel as cdd, cdi and spi only, with a 10-byte spi', () => {
    const d = getStockFirmwareDescriptor('retevis-rt95-head');
    expect(d.members.map((m) => m.role).sort()).toEqual(['cdd', 'cdi', 'spi']);
    expect(d.members.find((m) => m.role === 'spi')?.size).toBe(10);
    expect(d.stockSources.map((s) => s.kind)).toEqual(['ask-vendor', 'download']);
  });

  it('pins the RT95 main board in the same vendor zip as the front panel', () => {
    const head = getStockFirmwareDescriptor('retevis-rt95-head');
    const main = getStockFirmwareDescriptor('retevis-rt95-main');
    expect(main.zip?.sha256).toBe(head.zip?.sha256);
    expect(main.version).toBe('MAIN V1.61 (20231202)');
    expect(main.members.map((m) => [m.role, m.size, m.sha256])).toEqual([
      ['cdd', 55652, 'ca7918ffd242362b39bda5457b2350ab69d112d4704129187909bcfa1f609551'],
      ['cdi', 278, '75fce5bd6093449b6a5cd04d2319019b1c4689ea81ac6e8328e2f40fa76af9d9'],
      ['spi', 10, '3d096d4788e747417c669f5348ac4b4c6aa3d31a2bd8dd7799300203729714c3'],
    ]);
    expect(main.bootloaderEntry.indicator).toBe('The screen says UPDATE THE RF CPU');
    expect(main.bootloaderEntry.steps.join(' ')).toContain('a Power-key off/on is not enough');
  });

  it("keeps the front panel as the RT95 model's firmware radio", () => {
    expect(firmwareRadioIdForModel('retevis-rt95')).toBe('retevis-rt95-head');
  });

  it('pins the Mini stock files, v0.27 (NRF) first, without offering stock flash', () => {
    const d = getStockFirmwareDescriptor('baofeng-uv5rmini');
    expect(d.zip).toBeUndefined();
    expect(d.stockFlashOffered).toBe(false);
    expect(d.severalStocks).toBe(true);
    expect(stockVariants(d).map((v) => [v.version, v.baseName, v.members])).toEqual([
      [
        'v0.27 (NRF)',
        'nrf-v0.27',
        [
          {
            role: 'ufw',
            fileName: 'stock-nrf-v0.27.ufw',
            size: 504832,
            sha256: '811b4b37253e0685c7efbd3ff0a24aac2bcad223e5453d95b5bfc3f42c089128',
          },
        ],
      ],
      [
        'v0.04 (NRFB)',
        'nrfb-v0.04',
        [
          {
            role: 'ufw',
            fileName: 'stock-nrfb-v0.04.ufw',
            size: 520192,
            sha256: '02419efb44081227faeccf1525bca0e6b0340c9d988ab80b2141c2ee48a7f74e',
          },
        ],
      ],
    ]);
  });

  it("lists the Mini user's own copy, then one unofficial third-party copy per stock version", () => {
    const d = getStockFirmwareDescriptor('baofeng-uv5rmini');
    expect(d.stockSources.map((s) => s.kind)).toEqual(['own-image', 'download', 'download']);
    const downloads = d.stockSources.filter((s) => s.kind === 'download');
    for (const s of downloads) {
      expect(s.official).toBe(false);
      expect(s.label).toMatch(/^Unofficial copy shared by a third party, stock /);
      expect(s.host).toBe(UV5RMINI_UNOFFICIAL_STOCK_COPIES.host);
    }
    // Each link is for one pinned stock file, and comes from the one constant that holds the links.
    expect(downloads.map((s) => [s.url, s.fileName])).toEqual(
      UV5RMINI_UNOFFICIAL_STOCK_COPIES.copies.map((c) => [c.url, c.fileName]),
    );
    for (const c of UV5RMINI_UNOFFICIAL_STOCK_COPIES.copies) {
      const variant = stockVariantFor(d, c.version);
      expect(variant?.members.map((m) => m.fileName)).toEqual([c.fileName]);
    }
    expect(JSON.stringify(d.stockSources)).not.toMatch(/read of your radio/);
  });

  it('looks up by radio id', () => {
    for (const d of all) expect(getStockFirmwareDescriptor(d.radioId)).toBe(d);
  });
});
