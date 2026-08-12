import type { Channel } from '@core/models/library.ts';
import type { ChannelMode } from '@core/models/libraryTypes.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import {
  getRadioRfCapabilities,
  type RadioFrequencyRange,
  type RadioRfCapabilities,
} from '@core/radio-targets/rfCapabilities.ts';

export type ChannelIneligibilityReason = 'unsupported-mode' | 'out-of-range';

export interface ChannelEligibilityOptions {
  /** When true (default), channels outside supported frequency ranges are ineligible. */
  hideOutsideFrequencyRange?: boolean;
}

const DEFAULT_OPTIONS: Required<ChannelEligibilityOptions> = {
  hideOutsideFrequencyRange: true,
};

function resolveOptions(options?: ChannelEligibilityOptions): Required<ChannelEligibilityOptions> {
  return {
    hideOutsideFrequencyRange:
      options?.hideOutsideFrequencyRange ?? DEFAULT_OPTIONS.hideOutsideFrequencyRange,
  };
}

/** Modes on the channel that the radio target supports. */
export function supportedChannelModes(channel: Channel, caps: RadioRfCapabilities): ChannelMode[] {
  const supported = new Set(caps.supportedModes);
  return channel.modeProfiles.map((profile) => profile.mode).filter((mode) => supported.has(mode));
}

function rxFrequencyMhz(channel: Channel): number | null {
  if (channel.rxFrequency == null) return null;
  return channel.rxFrequency / 1_000_000;
}

/**
 * Exported for reuse by other eligibility checks that need the same plain numeric
 * band-membership test without the channel-specific wrapping semantics below (e.g.
 * satellite uplink/downlink frequency gating — `satelliteCapability.ts`).
 */
export function frequencyInRange(mhz: number, band: RadioFrequencyRange): boolean {
  return mhz >= band.minMhz && mhz <= band.maxMhz;
}

function channelMatchesFrequencyRange(
  channel: Channel,
  band: RadioFrequencyRange,
  eligibleModes: readonly ChannelMode[],
): boolean {
  const bandModes = new Set(band.modes);
  const overlappingModes = eligibleModes.filter((mode) => bandModes.has(mode));
  if (overlappingModes.length === 0) return false;

  const rxMhz = rxFrequencyMhz(channel);
  if (rxMhz == null) return false;
  return frequencyInRange(rxMhz, band);
}

export function getChannelIneligibilityReason(
  channel: Channel,
  radioTargetId: string,
  options?: ChannelEligibilityOptions,
): ChannelIneligibilityReason | null {
  const caps = getRadioRfCapabilities(radioTargetId);
  if (!caps) return null;

  const resolved = resolveOptions(options);
  const eligibleModes = supportedChannelModes(channel, caps);
  if (eligibleModes.length === 0) return 'unsupported-mode';

  if (!resolved.hideOutsideFrequencyRange) return null;

  const matchesBand = caps.frequencyRanges.some((band) =>
    channelMatchesFrequencyRange(channel, band, eligibleModes),
  );
  if (!matchesBand) return 'out-of-range';

  return null;
}

export function channelEligibleForRadio(
  channel: Channel,
  radioTargetId: string,
  options?: ChannelEligibilityOptions,
): boolean {
  return getChannelIneligibilityReason(channel, radioTargetId, options) == null;
}

export function resolveChannelEligibilityOptions(build: RadioBuild): ChannelEligibilityOptions {
  return {
    hideOutsideFrequencyRange: build.exportSettings?.hideChannelsOutsideFrequencyRange !== false,
  };
}

export function isChannelEligibleForBuild(channel: Channel, build: RadioBuild): boolean {
  return channelEligibleForRadio(
    channel,
    build.radioTargetId,
    resolveChannelEligibilityOptions(build),
  );
}

/** Build-scoped channel list for Radio Build pages (modes + optional frequency gate). */
export function filterChannelsEligibleForBuild(
  build: RadioBuild,
  channels: readonly Channel[],
): Channel[] {
  return channels.filter((channel) => isChannelEligibleForBuild(channel, build));
}

export function filterChannelIdsEligibleForBuild(
  build: RadioBuild,
  channelIds: readonly string[],
  channelById: ReadonlyMap<string, Channel>,
): string[] {
  return channelIds.filter((id) => {
    const channel = channelById.get(id);
    return channel != null && isChannelEligibleForBuild(channel, build);
  });
}

/** Channels skipped by RF eligibility (not excluded by build override). */
export function listIneligibleChannels(
  build: RadioBuild,
  channels: readonly Channel[],
  options?: ChannelEligibilityOptions,
): { channel: Channel; reason: ChannelIneligibilityReason }[] {
  const resolved = resolveOptions(options ?? resolveChannelEligibilityOptions(build));
  const ineligible: { channel: Channel; reason: ChannelIneligibilityReason }[] = [];
  for (const channel of channels) {
    const reason = getChannelIneligibilityReason(channel, build.radioTargetId, resolved);
    if (reason) ineligible.push({ channel, reason });
  }
  return ineligible;
}

export function formatChannelEligibilityWarning(
  skipped: readonly { channel: Channel; reason: ChannelIneligibilityReason }[],
): string[] {
  if (skipped.length === 0) return [];
  const byReason = {
    'unsupported-mode': skipped.filter((row) => row.reason === 'unsupported-mode'),
    'out-of-range': skipped.filter((row) => row.reason === 'out-of-range'),
  };
  const warnings: string[] = [];
  if (byReason['unsupported-mode'].length > 0) {
    const names = byReason['unsupported-mode'].map((row) => row.channel.name).join(', ');
    warnings.push(
      `Skipping ${byReason['unsupported-mode'].length} channel(s) with unsupported mode(s): ${names}`,
    );
  }
  if (byReason['out-of-range'].length > 0) {
    const names = byReason['out-of-range'].map((row) => row.channel.name).join(', ');
    warnings.push(
      `Skipping ${byReason['out-of-range'].length} channel(s) outside supported frequency range: ${names}`,
    );
  }
  return warnings;
}
