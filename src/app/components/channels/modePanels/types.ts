import type { ChannelMode } from '@core/models/libraryTypes.ts';
import type { Channel, ChannelModeProfile, Library } from '@core/models/library.ts';

/** The profile members whose `mode` can be M (distributes over the union). */
type ProfileWithMode<P, M> = P extends { mode: infer PM } ? (M extends PM ? P : never) : never;

/**
 * The profile type for one mode. Analogue modes share ChannelModeProfileAnalog, so a plain
 * Extract<…, { mode: M }> would miss that profile for 'fm', 'am' and 'ssb'.
 */
export type ProfileFor<M extends ChannelMode> = ProfileWithMode<ChannelModeProfile, M>;

export interface ModePanelContext {
  library: Library;
  /** The saved channel, for actions that need a persisted row (BrandMeister RX-list sync); null on New channel. */
  savedChannel: Channel | null;
  /** Live form frequencies in Hz (DMR simplex/repeater hint). */
  rxFrequency: number | null;
  txFrequency: number | null;
  /** Phone layout (MOBILE_MAX_WIDTH_MEDIA_QUERY): two-up rows stack. */
  compact: boolean;
}

export interface ModePanelProps<P extends ChannelModeProfile = ChannelModeProfile> {
  profile: P;
  onPatch: (patch: Partial<P>) => void;
  context: ModePanelContext;
}
