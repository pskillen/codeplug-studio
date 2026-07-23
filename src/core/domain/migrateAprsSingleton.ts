import type { AprsChannelSlot, AprsConfiguration, ChannelAprsBinding } from '@core/models/aprs.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import type { Library } from '@core/models/library.ts';
import type { EntityRef } from '@core/models/libraryTypes.ts';
import type { ProjectAggregate } from '@core/import-export/projectDocument.ts';
import { normalizeChannelBehaviourDefaults } from './normalizeChannelBehaviourDefaults.ts';
import { normalizeZoneBehaviourDefaults } from './normalizeZoneBehaviourDefaults.ts';
import { normalizeAprsConfiguration, normalizeAprsConfigurationOrNull } from './aprs/normalize.ts';

type LegacyAprsConfiguration = AprsConfiguration & {
  defaultDmrId?: number | null;
  defaultCallType?: string | null;
};

type LegacyChannelAprsBinding = ChannelAprsBinding & {
  reportChannelRef?: EntityRef | null;
};

type LegacyLibrary = Omit<Library, 'aprsConfiguration'> & {
  aprsConfiguration?: AprsConfiguration | null;
  aprsConfigurations?: AprsConfiguration[];
};

type LegacyRadioBuild = RadioBuild & {
  activeAprsConfigurationId?: string | null;
};

function stripLegacyAprsConfigFields(config: LegacyAprsConfiguration): AprsConfiguration {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- legacy wire fields dropped at migration
  const { defaultDmrId, defaultCallType, ...rest } = config;
  return normalizeAprsConfiguration(rest);
}

function migrateReportChannelRefToSlotIndex(
  reportChannelRef: EntityRef | null | undefined,
  channelSlots: AprsChannelSlot[],
  owningChannelId: string,
): number | null {
  if (!reportChannelRef || reportChannelRef.kind !== 'channel') return null;

  for (let slotIndex = 0; slotIndex < channelSlots.length; slotIndex++) {
    const slot = channelSlots[slotIndex]!;
    const slotChannelId = slot.channelRef?.id;
    if (slotChannelId === reportChannelRef.id) {
      return slotIndex + 1;
    }
    if (slot.channelRef == null && reportChannelRef.id === owningChannelId) {
      return slotIndex + 1;
    }
  }

  return null;
}

function migrateChannelAprsBinding(
  binding: LegacyChannelAprsBinding | undefined,
  aprsConfig: AprsConfiguration | null,
  channelId: string,
): ChannelAprsBinding | undefined {
  if (!binding) return undefined;

  let reportSlotIndex = binding.reportSlotIndex ?? null;
  if (reportSlotIndex == null && binding.reportChannelRef) {
    reportSlotIndex = migrateReportChannelRefToSlotIndex(
      binding.reportChannelRef,
      aprsConfig?.channelSlots ?? [],
      channelId,
    );
  }

  const migrated: ChannelAprsBinding = {
    receiveEnabled: binding.receiveEnabled,
    reportType: binding.reportType,
    digitalPttMode: binding.digitalPttMode,
    reportSlotIndex,
  };

  void (binding as LegacyChannelAprsBinding).reportChannelRef;

  if (
    !migrated.receiveEnabled &&
    migrated.reportType === 'off' &&
    migrated.digitalPttMode === 'off' &&
    migrated.reportSlotIndex == null
  ) {
    return undefined;
  }

  return migrated;
}

export function resolveAprsConfigurationFromLegacyLibrary(
  library: LegacyLibrary,
): AprsConfiguration | null {
  if (library.aprsConfiguration != null) {
    return normalizeAprsConfigurationOrNull(
      stripLegacyAprsConfigFields(library.aprsConfiguration as LegacyAprsConfiguration),
    );
  }
  const configs = library.aprsConfigurations ?? [];
  if (configs.length === 0) return null;
  return stripLegacyAprsConfigFields(configs[0] as LegacyAprsConfiguration);
}

export function migrateAprsSingletonLibrary(library: LegacyLibrary): Library {
  const aprsConfiguration = resolveAprsConfigurationFromLegacyLibrary(library);
  const channels = library.channels.map((channel) => {
    const aprs = migrateChannelAprsBinding(
      channel.aprs as LegacyChannelAprsBinding | undefined,
      aprsConfiguration,
      channel.id,
    );
    return aprs === undefined ? { ...channel, aprs: undefined } : { ...channel, aprs };
  });

  return {
    channels,
    zones: library.zones,
    talkGroups: library.talkGroups,
    digitalContacts: library.digitalContacts,
    analogContacts: library.analogContacts,
    rxGroupLists: library.rxGroupLists,
    scanLists: library.scanLists,
    aprsConfiguration,
    channelDefaults: normalizeChannelBehaviourDefaults(library.channelDefaults),
    zoneDefaults: normalizeZoneBehaviourDefaults(library.zoneDefaults),
  };
}

export function stripActiveAprsConfigurationId(build: LegacyRadioBuild): RadioBuild {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- legacy build field dropped at migration
  const { activeAprsConfigurationId, ...rest } = build;
  return rest;
}

export function migrateAprsSingletonRadioBuilds(radioBuilds: LegacyRadioBuild[]): RadioBuild[] {
  return radioBuilds.map(stripActiveAprsConfigurationId);
}

export function migrateAprsSingletonAggregate(aggregate: ProjectAggregate): ProjectAggregate {
  const legacyLibrary: LegacyLibrary = {
    channels: aggregate.channels,
    zones: aggregate.zones,
    talkGroups: aggregate.talkGroups,
    digitalContacts: aggregate.digitalContacts,
    analogContacts: aggregate.analogContacts,
    rxGroupLists: aggregate.rxGroupLists,
    scanLists: aggregate.scanLists,
    aprsConfigurations: (
      aggregate as ProjectAggregate & { aprsConfigurations?: AprsConfiguration[] }
    ).aprsConfigurations,
    aprsConfiguration: aggregate.aprsConfiguration,
    channelDefaults: normalizeChannelBehaviourDefaults(
      aggregate.channelDefaults ?? aggregate.meta.channelDefaults,
    ),
    zoneDefaults: normalizeZoneBehaviourDefaults(
      aggregate.zoneDefaults ?? aggregate.meta.zoneDefaults,
    ),
  };

  const library = migrateAprsSingletonLibrary(legacyLibrary);

  return {
    meta: aggregate.meta,
    channels: library.channels,
    zones: library.zones,
    talkGroups: library.talkGroups,
    digitalContacts: library.digitalContacts,
    analogContacts: library.analogContacts,
    rxGroupLists: library.rxGroupLists,
    scanLists: library.scanLists,
    aprsConfiguration: library.aprsConfiguration,
    channelDefaults: library.channelDefaults,
    zoneDefaults: library.zoneDefaults,
    radioBuilds: migrateAprsSingletonRadioBuilds(aggregate.radioBuilds as LegacyRadioBuild[]),
    egressPaths: aggregate.egressPaths,
  };
}
