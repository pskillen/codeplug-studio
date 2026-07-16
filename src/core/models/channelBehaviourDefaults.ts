/** Library-wide default for TX deny — applies when channel override is `default`. */
export type LibraryForbidTransmitDefault = boolean;

/** Per-channel TX deny — `default` defers to library + build cascade. */
export type ForbidTransmitOverride = 'default' | 'allow' | 'forbid';

/** Resolved TX deny after cascade. */
export type EffectiveForbidTransmit = 'allow' | 'forbid';

export type TxPermitMode = 'permitAlways' | 'busyLock';
export type TxPermitOverride = 'default' | TxPermitMode;

export type SendTalkerAliasMode = 'on' | 'off';
export type SendTalkerAliasOverride = 'default' | SendTalkerAliasMode;

export type AnalogSquelchMode = 'carrier' | 'tone';
export type AnalogSquelchModeOverride = 'default' | AnalogSquelchMode;

/** Library-wide behavioural defaults for channels. */
export interface ChannelBehaviourDefaults {
  /** When true, channels with `forbidTransmit: default` are receive-only at export. */
  forbidTransmit: LibraryForbidTransmitDefault;
  txPermit: TxPermitMode;
  sendTalkerAlias: SendTalkerAliasMode;
  analogSquelchMode: AnalogSquelchMode;
}

export const DEFAULT_CHANNEL_BEHAVIOUR_DEFAULTS: ChannelBehaviourDefaults = {
  forbidTransmit: false,
  txPermit: 'permitAlways',
  sendTalkerAlias: 'on',
  analogSquelchMode: 'carrier',
};

/** Default per-channel override fields (defer to library + build cascade). */
export const DEFAULT_CHANNEL_BEHAVIOUR_OVERRIDES = {
  forbidTransmit: 'default' as ForbidTransmitOverride,
  txPermit: 'default' as TxPermitOverride,
  sendTalkerAlias: 'default' as SendTalkerAliasOverride,
  analogSquelchMode: 'default' as AnalogSquelchModeOverride,
};
