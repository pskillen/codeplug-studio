import type { BuildExportSettings } from '@core/models/formatBuild.ts';
import type {
  AnalogSquelchMode,
  ChannelBehaviourDefaults,
  EffectiveForbidTransmit,
  ForbidTransmitOverride,
  SendTalkerAliasMode,
  TxPermitMode,
} from '@core/models/channelBehaviourDefaults.ts';
import {
  DEFAULT_CHANNEL_BEHAVIOUR_DEFAULTS,
  DEFAULT_CHANNEL_BEHAVIOUR_OVERRIDES,
} from '@core/models/channelBehaviourDefaults.ts';
import type {
  Channel,
  ChannelModeProfileAnalog,
  ChannelModeProfileDMR,
} from '@core/models/library.ts';

export type BehaviourResolutionLayer = 'library' | 'channel' | 'build';

export interface ResolvedBehaviourField<T> {
  value: T;
  layer: BehaviourResolutionLayer;
}

export interface ChannelBehaviourContext {
  libraryDefaults?: ChannelBehaviourDefaults;
  buildOverrides?: Pick<
    BuildExportSettings,
    | 'defaultForbidTransmit'
    | 'defaultTxPermit'
    | 'defaultSendTalkerAlias'
    | 'defaultAnalogSquelchMode'
  >;
}

type ChannelBehaviourPick = Pick<Channel, 'forbidTransmit' | 'txPermit'>;

export function libraryBehaviourDefaults(
  defaults?: ChannelBehaviourDefaults | null,
): ChannelBehaviourDefaults {
  return defaults ?? DEFAULT_CHANNEL_BEHAVIOUR_DEFAULTS;
}

export function forbidTransmitFromLegacyBoolean(value: boolean): ForbidTransmitOverride {
  return value ? 'forbid' : 'default';
}

export function resolveEffectiveForbidTransmit(
  channel: Pick<Channel, 'forbidTransmit'>,
  context?: ChannelBehaviourContext,
): EffectiveForbidTransmit {
  const library = libraryBehaviourDefaults(context?.libraryDefaults);
  let value: EffectiveForbidTransmit = library.forbidTransmit ? 'forbid' : 'allow';
  if (channel.forbidTransmit !== 'default') {
    value = channel.forbidTransmit;
  }
  const build = context?.buildOverrides?.defaultForbidTransmit;
  if (build !== undefined) {
    value = build;
  }
  return value;
}

export function resolveEffectiveTxPermit(
  channel: Pick<Channel, 'txPermit'>,
  context?: ChannelBehaviourContext,
): TxPermitMode {
  const library = libraryBehaviourDefaults(context?.libraryDefaults);
  let value = library.txPermit;
  if (channel.txPermit !== 'default') {
    value = channel.txPermit;
  }
  const build = context?.buildOverrides?.defaultTxPermit;
  if (build !== undefined) {
    value = build;
  }
  return value;
}

export function resolveEffectiveSendTalkerAlias(
  profile: Pick<ChannelModeProfileDMR, 'sendTalkerAlias'>,
  context?: ChannelBehaviourContext,
): SendTalkerAliasMode {
  const library = libraryBehaviourDefaults(context?.libraryDefaults);
  let value = library.sendTalkerAlias;
  const override = profile.sendTalkerAlias ?? 'default';
  if (override !== 'default') {
    value = override;
  }
  const build = context?.buildOverrides?.defaultSendTalkerAlias;
  if (build !== undefined) {
    value = build;
  }
  return value;
}

export function resolveEffectiveAnalogSquelchMode(
  profile: Pick<ChannelModeProfileAnalog, 'analogSquelchMode'>,
  context?: ChannelBehaviourContext,
): AnalogSquelchMode {
  const library = libraryBehaviourDefaults(context?.libraryDefaults);
  let value = library.analogSquelchMode;
  const override = profile.analogSquelchMode ?? 'default';
  if (override !== 'default') {
    value = override;
  }
  const build = context?.buildOverrides?.defaultAnalogSquelchMode;
  if (build !== undefined) {
    value = build;
  }
  return value;
}

function resolveLayerForOverride<T extends string>(
  overrideValue: T,
  buildValue: T | undefined,
  libraryValue: T,
  effective: T,
): BehaviourResolutionLayer {
  if (buildValue !== undefined && effective === buildValue) return 'build';
  if (overrideValue !== 'default' && effective === overrideValue) return 'channel';
  if (effective === libraryValue) return 'library';
  return 'build';
}

export function resolveForbidTransmitWithLayer(
  channel: Pick<Channel, 'forbidTransmit'>,
  context?: ChannelBehaviourContext,
): ResolvedBehaviourField<EffectiveForbidTransmit> {
  const build = context?.buildOverrides?.defaultForbidTransmit;
  const value = resolveEffectiveForbidTransmit(channel, context);
  const layer =
    build !== undefined && value === build
      ? 'build'
      : channel.forbidTransmit !== 'default' && value === channel.forbidTransmit
        ? 'channel'
        : 'library';
  return { value, layer };
}

export function resolveTxPermitWithLayer(
  channel: Pick<Channel, 'txPermit'>,
  context?: ChannelBehaviourContext,
): ResolvedBehaviourField<TxPermitMode> {
  const library = libraryBehaviourDefaults(context?.libraryDefaults);
  const build = context?.buildOverrides?.defaultTxPermit;
  const value = resolveEffectiveTxPermit(channel, context);
  const layer = resolveLayerForOverride(channel.txPermit, build, library.txPermit, value);
  return { value, layer };
}

export function resolveSendTalkerAliasWithLayer(
  profile: Pick<ChannelModeProfileDMR, 'sendTalkerAlias'>,
  context?: ChannelBehaviourContext,
): ResolvedBehaviourField<SendTalkerAliasMode> {
  const library = libraryBehaviourDefaults(context?.libraryDefaults);
  const build = context?.buildOverrides?.defaultSendTalkerAlias;
  const value = resolveEffectiveSendTalkerAlias(profile, context);
  const override = profile.sendTalkerAlias ?? 'default';
  const layer = resolveLayerForOverride(override, build, library.sendTalkerAlias, value);
  return { value, layer };
}

export function resolveAnalogSquelchModeWithLayer(
  profile: Pick<ChannelModeProfileAnalog, 'analogSquelchMode'>,
  context?: ChannelBehaviourContext,
): ResolvedBehaviourField<AnalogSquelchMode> {
  const library = libraryBehaviourDefaults(context?.libraryDefaults);
  const build = context?.buildOverrides?.defaultAnalogSquelchMode;
  const value = resolveEffectiveAnalogSquelchMode(profile, context);
  const override = profile.analogSquelchMode ?? 'default';
  const layer = resolveLayerForOverride(override, build, library.analogSquelchMode, value);
  return { value, layer };
}

export function buildChannelBehaviourContext(
  libraryDefaults?: ChannelBehaviourDefaults | null,
  exportSettings?: BuildExportSettings,
): ChannelBehaviourContext {
  return {
    libraryDefaults: libraryDefaults ?? undefined,
    buildOverrides: exportSettings
      ? {
          defaultForbidTransmit: exportSettings.defaultForbidTransmit,
          defaultTxPermit: exportSettings.defaultTxPermit,
          defaultSendTalkerAlias: exportSettings.defaultSendTalkerAlias,
          defaultAnalogSquelchMode: exportSettings.defaultAnalogSquelchMode,
        }
      : undefined,
  };
}

export function effectiveForbidTransmit(
  channel: Pick<Channel, 'forbidTransmit'>,
  context?: ChannelBehaviourContext,
): boolean {
  return resolveEffectiveForbidTransmit(channel, context) === 'forbid';
}

export function defaultChannelBehaviourOverrides(): ChannelBehaviourPick {
  return { ...DEFAULT_CHANNEL_BEHAVIOUR_OVERRIDES };
}
