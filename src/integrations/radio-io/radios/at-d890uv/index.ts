/**
 * Anytone AT-D890UV radio module — sparse 16-byte selective clone.
 */

export {
  AT_D890_BLOCK_SIZE,
  AT_D890_CONNECTION,
  AT_D890_LIMITS,
  AT_D890UV_MODEL_IDS,
  D890_MAP,
} from './constants.ts';
export { createAtD890uvProtocol, AtD890uvProtocol, type AtD890DownloadCache } from './protocol.ts';
export { AT_D890UV_DESCRIPTOR, AT_D890UV_MODEL_ID } from './descriptor.ts';
export {
  extractAtD890uvHydration,
  extractAtD890uvHydrationFromProtocol,
  mergeChannelsIntoAtD890uvHydration,
  memoryMapFromAtD890uvHydration,
} from './hydration.ts';
export {
  decodeChannelsFromAtD890Cache,
  encodeChannelsIntoAtD890Image,
  parseAtD890ChannelRecord,
  encodeAtD890ChannelRecord,
} from './channelCodec.ts';
export {
  summariseAtD890uvClone,
  type AtD890uvCloneSummary,
  type AtD890RetainGroupSummary,
} from './cloneSummary.ts';
export {
  settingsRetainPreview,
  optionalSettingsRetainPreview,
  optionalSettingsAprsPreview,
  alarmRetainPreview,
  localInfoRegisterPreview,
  AT_D890_NOT_IN_CAPTURE,
  type AtD890RetainPreviewRow,
  type AtD890RegisterRow,
} from './retainPreview.ts';
export {
  AT_D890_WRITTEN_FROM_BUILD_LABELS,
  AT_D890_DIGITAL_CONTACTS_WRITE_GAP,
  atD890WriteRole,
  atD890RegionLabel,
} from './writeRole.ts';
export {
  AT_D890_PROBE,
  analyseAtD890EraseUnit,
  assertAtD890ProbeSpanUnused,
  classifyAtD890Sentinel,
  estimateAtD890RmwSeconds,
  inferAtD890Aliasing,
  listAtD890ProbeSentinels,
  readAtD890ProbeTag,
  summariseAtD890Throughput,
  verifyAtD890Paint,
  type AtD890AliasVerdict,
  type AtD890EraseUnitResult,
  type AtD890SentinelReading,
  type AtD890ThroughputResult,
} from './eraseUnitProbe.ts';
export {
  AT_D890_BLOCK_CANDIDATES,
  benchmarkAtD890Sweep,
  estimateAtD890RmwCost,
  profileAtD890AccessPattern,
  profileAtD890Link,
  negotiateAtD890ReadBlockSize,
  type AtD890AccessProfile,
  type AtD890BlockTrial,
  type AtD890LinkProfile,
  type AtD890StrideSample,
  type AtD890SweepResult,
} from './linkProbe.ts';
export {
  AT_D890_WRITE_BLOCK_CANDIDATES,
  atD890WriteProbeAddress,
  buildAtD890WriteTrials,
  classifyAtD890WriteReadback,
  isAtD890InertPayload,
  makeAtD890WritePayload,
  summariseAtD890WriteProbe,
  type AtD890WriteOutcome,
  type AtD890WriteProbeVerdict,
  type AtD890WriteTrial,
  type AtD890WriteTrialResult,
} from './writeBlockProbe.ts';
export {
  runAtD890LinkProbe,
  runAtD890WriteBlockProbe,
  runAtD890WriteBlockVerify,
  runAtD890ProbeDiagnose,
  runAtD890ProbeInspect,
  runAtD890ProbeMeasure,
  runAtD890ProbePaint,
  runAtD890ProbeVerifyAndMark,
  type AtD890LinkProbeResult,
  type AtD890WriteProbeResult,
  type AtD890ProbeDiagnoseResult,
  type AtD890ProbeInspectResult,
} from './eraseUnitProbeRunner.ts';
export {
  AT_D890_WRITE_COVERAGE_ROWS,
  AT_D890_WRITE_COVERAGE_STATUS_LABEL,
  type AtD890WriteCoverageRow,
  type AtD890WriteCoverageStatus,
} from './writeCoverage.ts';
