import type { PersistableRow } from './revision.ts';
import type { ProjectInterchange } from './interchange.ts';
import type { ChannelBehaviourDefaults } from './channelBehaviourDefaults.ts';
import type { ZoneBehaviourDefaults } from './zoneBehaviourDefaults.ts';

export interface ProjectMeta extends PersistableRow {
  name: string;
  description: string;
  notes: string;
  author: string;
  createdAt: string;
  interchange?: ProjectInterchange;
  /** Persisted library channel behavioural defaults (mirrored on `Library.channelDefaults`). */
  channelDefaults?: ChannelBehaviourDefaults;
  /** Persisted library zone behavioural defaults (mirrored on `Library.zoneDefaults`). */
  zoneDefaults?: ZoneBehaviourDefaults;
}
