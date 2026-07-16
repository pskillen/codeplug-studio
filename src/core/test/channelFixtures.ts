import { newChannel } from '@core/domain/factories.ts';
import type { Channel } from '@core/models/library.ts';

/** Build a typed test channel with factory defaults and overrides. */
export function makeTestChannel(
  projectId: string,
  name: string,
  overrides: Partial<Channel> = {},
  callsign = '',
): Channel {
  return { ...newChannel(projectId, name, callsign), ...overrides };
}
