import type { ChannelBehaviourDefaults } from '@core/models/channelBehaviourDefaults.ts';
import { DEFAULT_CHANNEL_BEHAVIOUR_DEFAULTS } from '@core/models/channelBehaviourDefaults.ts';

/** Normalise persisted or imported library channel defaults. */
export function normalizeChannelBehaviourDefaults(
  defaults?: Partial<ChannelBehaviourDefaults> | null,
): ChannelBehaviourDefaults {
  if (!defaults) return { ...DEFAULT_CHANNEL_BEHAVIOUR_DEFAULTS };
  return {
    forbidTransmit: defaults.forbidTransmit ?? DEFAULT_CHANNEL_BEHAVIOUR_DEFAULTS.forbidTransmit,
    txPermit: defaults.txPermit ?? DEFAULT_CHANNEL_BEHAVIOUR_DEFAULTS.txPermit,
    sendTalkerAlias: defaults.sendTalkerAlias ?? DEFAULT_CHANNEL_BEHAVIOUR_DEFAULTS.sendTalkerAlias,
    analogSquelchMode:
      defaults.analogSquelchMode ?? DEFAULT_CHANNEL_BEHAVIOUR_DEFAULTS.analogSquelchMode,
  };
}
