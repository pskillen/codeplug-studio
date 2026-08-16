import { describe, expect, it } from 'vitest';
import { newChannel } from '@core/domain/factories.ts';
import {
  channelEligibleForRadio,
  getChannelIneligibilityReason,
  supportedChannelModes,
} from './channelEligibility.ts';
import { getRadioRfCapabilities } from '@core/radio-targets/rfCapabilities.ts';

const projectId = '11111111-1111-4111-8111-111111111111';

function channelWith(modes: Array<'fm' | 'am' | 'dmr'>, rxHz: number | null, name = 'Test') {
  const ch = newChannel(projectId, name);
  ch.rxFrequency = rxHz;
  ch.modeProfiles = modes.map((mode) => {
    if (mode === 'dmr') {
      return {
        mode: 'dmr' as const,
        dmrMode: null,
        colourCode: null,
        timeslot: null,
        dmrId: null,
        contactRef: null,
        rxGroupListId: null,
        sendTalkerAlias: 'default' as const,
      };
    }
    if (mode === 'am') {
      return {
        mode: 'am' as const,
        rxTone: 'none' as const,
        txTone: 'none' as const,
        squelch: null,
        bandwidthKHz: null,
        analogSquelchMode: 'default' as const,
      };
    }
    return {
      mode: 'fm' as const,
      rxTone: 'none' as const,
      txTone: 'none' as const,
      squelch: null,
      bandwidthKHz: 12.5,
      analogSquelchMode: 'default' as const,
    };
  });
  return ch;
}

describe('channelEligibility', () => {
  it('RT95 rejects AM channels regardless of frequency', () => {
    const air = channelWith(['am'], 118_800_000);
    expect(channelEligibleForRadio(air, 'retevis-rt95')).toBe(false);
    expect(getChannelIneligibilityReason(air, 'retevis-rt95')).toBe('unsupported-mode');
  });

  it('RT95 accepts in-band FM', () => {
    const fm = channelWith(['fm'], 145_500_000);
    expect(channelEligibleForRadio(fm, 'retevis-rt95')).toBe(true);
  });

  it('UV-5R Mini accepts in-band AM airband', () => {
    const air = channelWith(['am'], 118_800_000);
    expect(channelEligibleForRadio(air, 'baofeng-uv5r-mini')).toBe(true);
  });

  it('DM-32UV accepts AM airband in the receive-only 87–136 MHz band', () => {
    const air = channelWith(['am'], 118_800_000);
    expect(channelEligibleForRadio(air, 'baofeng-dm32uv')).toBe(true);
    expect(getChannelIneligibilityReason(air, 'baofeng-dm32uv')).toBeNull();
  });

  it('DM-32UV rejects AM above the receive-only band', () => {
    const air = channelWith(['am'], 145_500_000);
    expect(channelEligibleForRadio(air, 'baofeng-dm32uv')).toBe(false);
    expect(getChannelIneligibilityReason(air, 'baofeng-dm32uv')).toBe('out-of-range');
  });

  it('DM-1701 rejects AM channels', () => {
    const air = channelWith(['am'], 118_800_000);
    expect(channelEligibleForRadio(air, 'baofeng-dm1701')).toBe(false);
    expect(getChannelIneligibilityReason(air, 'baofeng-dm1701')).toBe('unsupported-mode');
  });

  it('DM-1701 accepts in-band FM and DMR', () => {
    const fm = channelWith(['fm'], 145_500_000);
    const dmr = channelWith(['dmr'], 430_125_000);
    expect(channelEligibleForRadio(fm, 'baofeng-dm1701')).toBe(true);
    expect(channelEligibleForRadio(dmr, 'baofeng-dm1701')).toBe(true);
  });

  it('rejects out-of-band FM when frequency gate is on', () => {
    const fm = channelWith(['fm'], 500_000_000);
    expect(channelEligibleForRadio(fm, 'baofeng-dm1701')).toBe(false);
    expect(getChannelIneligibilityReason(fm, 'baofeng-dm1701')).toBe('out-of-range');
  });

  it('allows out-of-band FM when frequency gate is off', () => {
    const fm = channelWith(['fm'], 500_000_000);
    expect(
      channelEligibleForRadio(fm, 'baofeng-dm1701', { hideOutsideFrequencyRange: false }),
    ).toBe(true);
  });

  it('treats missing RX as out-of-range when frequency gate is on', () => {
    const fm = channelWith(['fm'], null);
    expect(channelEligibleForRadio(fm, 'baofeng-dm1701')).toBe(false);
    expect(getChannelIneligibilityReason(fm, 'baofeng-dm1701')).toBe('out-of-range');
  });

  it('dual-mode channel passes when at least one supported mode matches band', () => {
    const dual = channelWith(['fm', 'dmr'], 145_500_000);
    const modes = supportedChannelModes(dual, getRadioRfCapabilities('baofeng-dm1701')!);
    expect(modes).toEqual(['fm', 'dmr']);
    expect(channelEligibleForRadio(dual, 'baofeng-dm1701')).toBe(true);
  });

  it('rejects digital-only channel on flat-memory UV Mini', () => {
    const dmr = channelWith(['dmr'], 430_125_000);
    expect(channelEligibleForRadio(dmr, 'baofeng-uv5r-mini')).toBe(false);
    expect(getChannelIneligibilityReason(dmr, 'baofeng-uv5r-mini')).toBe('unsupported-mode');
  });
});
