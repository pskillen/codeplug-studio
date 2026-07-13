import type { AprsConfiguration, ChannelAprsBinding } from '@core/models/aprs.ts';
import { newId } from '@core/models/ids.ts';
import { initialRevision, isoNow } from '@core/models/revision.ts';
import { defaultAprsConfigurationFields } from './defaults.ts';
import { normalizeAprsConfiguration, normalizeChannelAprsBinding } from './normalize.ts';

export function newAprsConfiguration(projectId: string, name: string): AprsConfiguration {
  const now = isoNow();
  return normalizeAprsConfiguration({
    id: newId(),
    projectId,
    revision: initialRevision(),
    updatedAt: now,
    name,
    ...defaultAprsConfigurationFields(),
  });
}

export function normalizeAprsConfigurations(
  configs: AprsConfiguration[] | undefined,
): AprsConfiguration[] {
  return (configs ?? []).map(normalizeAprsConfiguration);
}

export function normalizeOptionalChannelAprs(
  aprs: ChannelAprsBinding | null | undefined,
): ChannelAprsBinding | undefined {
  return normalizeChannelAprsBinding(aprs);
}
