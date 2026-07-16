import type { BuildExportSettings } from '@core/models/formatBuild.ts';
import type {
  AnalogSquelchMode,
  ChannelBehaviourDefaults,
  EffectiveForbidTransmit,
  ForbidTransmitOverride,
  SendTalkerAliasMode,
  TxPermitMode,
} from '@core/models/channelBehaviourDefaults.ts';
import { DEFAULT_CHANNEL_BEHAVIOUR_DEFAULTS } from '@core/models/channelBehaviourDefaults.ts';
import type { Channel } from '@core/models/library.ts';

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

type ChannelBehaviourPick = Pick<
  Channel,
  'forbidTransmit' | 'txPermit' | 'sendTalkerAlias' | 'analogSquelchMode'
>;

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
  channel: Pick<Channel, 'sendTalkerAlias'>,
  context?: ChannelBehaviourContext,
): SendTalkerAliasMode {
  const library = libraryBehaviourDefaults(context?.libraryDefaults);
  let value = library.sendTalkerAlias;
  if (channel.sendTalkerAlias !== 'default') {
    value = channel.sendTalkerAlias;
  }
  const build = context?.buildOverrides?.defaultSendTalkerAlias;
  if (build !== undefined) {
    value = build;
  }
  return value;
}

export function resolveEffectiveAnalogSquelchMode(
  channel: Pick<Channel, 'analogSquelchMode'>,
  context?: ChannelBehaviourContext,
): AnalogSquelchMode {
  const library = libraryBehaviourDefaults(context?.libraryDefaults);
  let value = library.analogSquelchMode;
  if (channel.analogSquelchMode !== 'default') {
    value = channel.analogSquelchMode;
  }
  const build = context?.buildOverrides?.defaultAnalogSquelchMode;
  if (build !== undefined) {
    value = build;
  }
  return value;
}

function resolveLayerForOverride<T extends string>(
  channelValue: T,
  buildValue: T | undefined,
  libraryValue: T,
  effective: T,
): BehaviourResolutionLayer {
  if (buildValue !== undefined && effective === buildValue) return 'build';
  if (channelValue !== 'default' && effective === channelValue) return 'channel';
  if (effective === libraryValue) return 'library';
  return 'build';
}

export function resolveForbidTransmitWithLayer(
  channel: Pick<Channel, 'forbidTransmit'>,
  context?: ChannelBehaviourContext,
): ResolvedBehaviourField<EffectiveForbidTransmit> {
  const library = libraryBehaviourDefaults(context?.libraryDefaults);
  const libraryEffective: EffectiveForbidTransmit = library.forbidTransmit ? 'forbid' : 'allow';
  const build = context?.buildOverrides?.defaultForbidTransmit;
  const value = resolveEffectiveForbidTransmit(channel, context);
  const layer =
    build !== undefined && value === build
      ? 'build'
      : channel.forbidTransmit !== 'default' && value === channel.forbidTransmit
        ? 'channel'
        : 'library';
  void libraryEffective;
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
  channel: Pick<Channel, 'sendTalkerAlias'>,
  context?: ChannelBehaviourContext,
): ResolvedBehaviourField<SendTalkerAliasMode> {
  const library = libraryBehaviourDefaults(context?.libraryDefaults);
  const build = context?.buildOverrides?.defaultSendTalkerAlias;
  const value = resolveEffectiveSendTalkerAlias(channel, context);
  const layer = resolveLayerForOverride(channel.sendTalkerAlias, build, library.sendTalkerAlias, value);
  return { value, layer };
}

export function resolveAnalogSquelchModeWithLayer(
  channel: Pick<Channel, 'analogSquelchMode'>,
  context?: ChannelBehaviourContext,
): ResolvedBehaviourField<AnalogSquelchMode> {
  const library = libraryBehaviourDefaults(context?.libraryDefaults);
  const build = context?.buildOverrides?.defaultAnalogSquelchMode;
  const value = resolveEffectiveAnalogSquelchMode(channel, context);
  const layer = resolveLayerForOverride(
    channel.analogSquelchMode,
    build,
    library.analogSquelchMode,
    value,
  );
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
  return {
    forbidTransmit: 'default',
    txPermit: 'default',
    sendTalkerAlias: 'default',
    analogSquelchMode: 'default',
  };
}
