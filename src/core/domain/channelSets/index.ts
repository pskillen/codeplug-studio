export type {
  ChannelSetDedupResult,
  ChannelSetDefinition,
  ChannelSetGenerateOptions,
  ChannelSetId,
  ChannelSetTemplate,
} from './types.ts';
export { CHANNEL_SET_DEFINITIONS, allChannelSetIds, channelSetDefinition } from './definitions.ts';
export { classifyChannelSetDedup } from './dedup.ts';
export { generateChannelsFromSet } from './generate.ts';
export {
  UK_UHF_SIMPLEX_HZ,
  UK_VHF_SIMPLEX_HZ,
  UK_VHF_SIMPLEX_S_NAMES,
  buildLinearGridHz,
  ukVhfSimplexSName,
  ukVhfSimplexVName,
} from './frequencies.ts';
