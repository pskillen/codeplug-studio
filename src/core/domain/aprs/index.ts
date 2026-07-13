import type { AprsConfiguration } from '@core/models/aprs.ts';
import { newId } from '@core/models/ids.ts';
import { initialRevision, isoNow } from '@core/models/revision.ts';
import { defaultAprsConfigurationFields } from './defaults.ts';
import {
  normalizeAprsConfiguration,
  normalizeAprsConfigurations,
  normalizeOptionalChannelAprs,
} from './normalize.ts';

export {
  normalizeAprsConfiguration,
  normalizeAprsConfigurations,
  normalizeOptionalChannelAprs,
};

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
