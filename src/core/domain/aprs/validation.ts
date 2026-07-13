import type { AprsConfiguration } from '@core/models/aprs.ts';
import type { Channel, Library } from '@core/models/library.ts';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import { libraryEntityIds, validateEntityRef, assertNonEmptyName } from '../validation.ts';

export interface AprsValidationWarning {
  code: 'digital_report_on_analog_channel' | 'orphan_report_channel_ref';
  message: string;
  channelId?: string;
  configId?: string;
}

function channelHasDmrProfile(channel: Channel): boolean {
  return channel.modeProfiles.some((profile) => profile.mode === 'dmr');
}

export function validateAprsConfigurationName(config: AprsConfiguration, library: Library): void {
  assertNonEmptyName(config.name, 'APRS configuration name');
  const duplicate = library.aprsConfigurations.some(
    (row) => row.id !== config.id && row.name.trim() === config.name.trim(),
  );
  if (duplicate) {
    throw new Error(`Duplicate APRS configuration name: ${config.name}`);
  }
}

export function validateAprsConfigurationRefs(config: AprsConfiguration, library: Library): void {
  for (const slot of config.channelSlots) {
    if (slot.channelRef) {
      validateEntityRef(slot.channelRef, library);
    }
  }
}

export function validateActiveAprsConfigurationId(build: FormatBuild, library: Library): void {
  const id = build.activeAprsConfigurationId?.trim();
  if (!id) return;
  const { aprsConfigurationIds } = libraryEntityIds(library);
  if (!aprsConfigurationIds.has(id)) {
    throw new Error(`Active APRS configuration not found in library: ${id}`);
  }
}

export function validateChannelAprsRefs(channel: Channel, library: Library): void {
  if (!channel.aprs?.reportChannelRef) return;
  validateEntityRef(channel.aprs.reportChannelRef, library);
}

export function collectAprsValidationWarnings(
  library: Library,
  activeConfig: AprsConfiguration | null,
): AprsValidationWarning[] {
  const warnings: AprsValidationWarning[] = [];
  const slotChannelIds = new Set(
    (activeConfig?.channelSlots ?? [])
      .map((slot) => slot.channelRef?.id)
      .filter((id): id is string => Boolean(id)),
  );

  for (const channel of library.channels) {
    if (!channel.aprs) continue;
    if (channel.aprs.reportType === 'digital' && !channelHasDmrProfile(channel)) {
      warnings.push({
        code: 'digital_report_on_analog_channel',
        message: `Channel "${channel.name}" has digital APRS report but no DMR mode profile`,
        channelId: channel.id,
      });
    }
    const reportRef = channel.aprs.reportChannelRef?.id;
    if (reportRef && activeConfig && slotChannelIds.size > 0 && !slotChannelIds.has(reportRef)) {
      warnings.push({
        code: 'orphan_report_channel_ref',
        message: `Channel "${channel.name}" report channel ref is not in active APRS slot channels`,
        channelId: channel.id,
        configId: activeConfig.id,
      });
    }
  }

  return warnings;
}
