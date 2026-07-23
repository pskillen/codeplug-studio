/**
 * DM-32UV write-role manifest tests.
 */

import { describe, expect, it } from 'vitest';
import { DM32_METADATA } from './constants.ts';
import { classifyDm32Metadata } from './memory.ts';
import { dm32WriteRole, dm32BlockLabel } from './writeRole.ts';

describe('dm32WriteRole', () => {
  it('marks library-modelled blocks as replaced', () => {
    expect(dm32WriteRole(DM32_METADATA.CHANNEL_FIRST, 'channel')).toBe('replaced');
    expect(dm32WriteRole(DM32_METADATA.ZONE, 'zone')).toBe('replaced');
    expect(dm32WriteRole(DM32_METADATA.SCAN_LIST, 'scan')).toBe('replaced');
    expect(dm32WriteRole(DM32_METADATA.TX_CONTACT_LOW, 'unknown')).toBe('replaced');
    expect(dm32WriteRole(DM32_METADATA.TALK_GROUPS, 'unknown')).toBe('replaced');
    expect(dm32WriteRole(DM32_METADATA.RX_GROUPS, 'rxgroup')).toBe('replaced');
  });

  it('marks retain regions as kept', () => {
    expect(dm32WriteRole(DM32_METADATA.VFO_SETTINGS, 'vfo')).toBe('kept');
    expect(dm32WriteRole(DM32_METADATA.QUICK_MESSAGES, 'message')).toBe('kept');
    expect(dm32WriteRole(DM32_METADATA.DMR_RADIO_IDS, 'dmrradioid')).toBe('kept');
    expect(dm32WriteRole(DM32_METADATA.CALIBRATION, 'calibration')).toBe('kept');
  });

  it('keeps VFO bank when not a channel bank address', () => {
    expect(
      dm32WriteRole(DM32_METADATA.VFO_BANK, 'channel', {
        address: 0x9000,
        channelBankAddresses: new Set([0x1000]),
      }),
    ).toBe('kept');
    expect(
      dm32WriteRole(DM32_METADATA.VFO_BANK, 'channel', {
        address: 0x1000,
        channelBankAddresses: new Set([0x1000]),
      }),
    ).toBe('replaced');
  });
});

describe('dm32BlockLabel', () => {
  it('uses operator-facing labels without hex', () => {
    expect(dm32BlockLabel(DM32_METADATA.VFO_SETTINGS, 'vfo')).toBe('Radio settings');
    expect(dm32BlockLabel(DM32_METADATA.ZONE, 'zone')).toBe('Zone data');
    expect(
      dm32BlockLabel(
        DM32_METADATA.TX_CONTACT_LOW,
        classifyDm32Metadata(DM32_METADATA.TX_CONTACT_LOW),
      ),
    ).toContain('TX contacts');
  });
});
