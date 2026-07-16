import type { AprsConfiguration, ChannelAprsBinding } from '@core/models/aprs.ts';
import type { Channel, Library } from '@core/models/library.ts';
import { assertNonEmptyName, validateEntityRef } from '../validation.ts';

export interface AprsValidationWarning {
  code:
    | 'digital_report_on_analog_channel'
    | 'orphan_report_slot_index'
    | 'channels_have_digital_aprs_without_config';
  message: string;
  channelId?: string;
  configId?: string;
}

function channelHasDmrProfile(channel: Channel): boolean {
  return channel.modeProfiles.some((profile) => profile.mode === 'dmr');
}

export function validateAprsConfigurationName(config: AprsConfiguration): void {
  assertNonEmptyName(config.name, 'APRS configuration name');
}

export function validateAprsConfigurationRefs(config: AprsConfiguration, library: Library): void {
  for (const slot of config.channelSlots) {
    if (slot.channelRef) {
      validateEntityRef(slot.channelRef, library);
    }
  }
}

export function validateChannelAprsBinding(
  binding: ChannelAprsBinding,
  config: AprsConfiguration | null,
): void {
  if (binding.reportSlotIndex == null) return;
  const max = config?.channelSlots.length ?? 0;
  if (binding.reportSlotIndex < 1 || binding.reportSlotIndex > max) {
    throw new Error(
      `APRS report slot index ${binding.reportSlotIndex} is out of range (1..${max})`,
    );
  }
}

export function collectAprsValidationWarnings(library: Library): AprsValidationWarning[] {
  const warnings: AprsValidationWarning[] = [];
  const config = library.aprsConfiguration;
  const maxSlots = config?.channelSlots.length ?? 0;

  const hasDigitalAprsChannel = library.channels.some(
    (channel) => channel.aprs?.reportType === 'digital',
  );
  if (hasDigitalAprsChannel && !config) {
    warnings.push({
      code: 'channels_have_digital_aprs_without_config',
      message: 'One or more channels have digital APRS reporting but no APRS configuration exists',
    });
  }

  for (const channel of library.channels) {
    if (!channel.aprs) continue;
    if (channel.aprs.reportType === 'digital' && !channelHasDmrProfile(channel)) {
      warnings.push({
        code: 'digital_report_on_analog_channel',
        message: `Channel "${channel.name}" has digital APRS report but no DMR mode profile`,
        channelId: channel.id,
      });
    }
    const slotIndex = channel.aprs.reportSlotIndex;
    if (slotIndex != null && (slotIndex < 1 || slotIndex > maxSlots)) {
      warnings.push({
        code: 'orphan_report_slot_index',
        message: `Channel "${channel.name}" report slot index ${slotIndex} is out of range (1..${maxSlots})`,
        channelId: channel.id,
        configId: config?.id,
      });
    }
  }

  return warnings;
}
