import { describe, expect, it } from 'vitest';
import {
  buildChannelBehaviourContext,
  forbidTransmitFromLegacyBoolean,
  resolveEffectiveForbidTransmit,
  resolveEffectiveSendTalkerAlias,
  resolveEffectiveTxPermit,
  resolveForbidTransmitWithLayer,
} from './resolve.ts';
import { DEFAULT_CHANNEL_BEHAVIOUR_OVERRIDES } from '@core/models/channelBehaviourDefaults.ts';
import { DEFAULT_CHANNEL_BEHAVIOUR_DEFAULTS } from '@core/models/channelBehaviourDefaults.ts';
import type { Channel } from '@core/models/library.ts';

function channel(partial: Partial<Channel>): Channel {
  return {
    id: 'ch-1',
    projectId: 'proj',
    revision: 1,
    updatedAt: '2026-01-01T00:00:00.000Z',
    name: 'Test',
    callsign: '',
    rxFrequency: null,
    txFrequency: null,
    location: null,
    useLocation: false,
    maidenheadLocator: null,
    power: null,
    scanInclusion: 'default',
    ...DEFAULT_CHANNEL_BEHAVIOUR_OVERRIDES,
    comment: '',
    modeProfiles: [],
    ...partial,
  };
}

describe('channelBehaviourDefaults resolve', () => {
  it('migrates legacy forbid boolean', () => {
    expect(forbidTransmitFromLegacyBoolean(true)).toBe('forbid');
    expect(forbidTransmitFromLegacyBoolean(false)).toBe('default');
  });

  it('resolves forbid transmit library → channel → build', () => {
    const ctx = buildChannelBehaviourContext(
      { ...DEFAULT_CHANNEL_BEHAVIOUR_DEFAULTS, forbidTransmit: true },
      { defaultForbidTransmit: 'allow' },
    );
    expect(resolveEffectiveForbidTransmit(channel({ forbidTransmit: 'default' }), ctx)).toBe(
      'allow',
    );
    expect(resolveEffectiveForbidTransmit(channel({ forbidTransmit: 'forbid' }), ctx)).toBe(
      'allow',
    );
    expect(
      resolveEffectiveForbidTransmit(
        channel({ forbidTransmit: 'forbid' }),
        buildChannelBehaviourContext(DEFAULT_CHANNEL_BEHAVIOUR_DEFAULTS, {
          defaultForbidTransmit: 'allow',
        }),
      ),
    ).toBe('allow');
  });

  it('resolves tx permit and talker alias from library defaults', () => {
    const ctx = buildChannelBehaviourContext({
      ...DEFAULT_CHANNEL_BEHAVIOUR_DEFAULTS,
      txPermit: 'busyLock',
      sendTalkerAlias: 'on',
    });
    expect(resolveEffectiveTxPermit(channel({}), ctx)).toBe('busyLock');
    expect(resolveEffectiveSendTalkerAlias({ sendTalkerAlias: 'default' }, ctx)).toBe('on');
    expect(resolveEffectiveTxPermit(channel({ txPermit: 'permitAlways' }), ctx)).toBe(
      'permitAlways',
    );
    expect(resolveEffectiveSendTalkerAlias({ sendTalkerAlias: 'off' }, ctx)).toBe('off');
  });

  it('reports winning layer for forbid transmit', () => {
    expect(
      resolveForbidTransmitWithLayer(
        channel({ forbidTransmit: 'default' }),
        buildChannelBehaviourContext({
          ...DEFAULT_CHANNEL_BEHAVIOUR_DEFAULTS,
          forbidTransmit: true,
        }),
      ),
    ).toEqual({ value: 'forbid', layer: 'library' });
    expect(resolveForbidTransmitWithLayer(channel({ forbidTransmit: 'allow' }))).toEqual({
      value: 'allow',
      layer: 'channel',
    });
  });
});
