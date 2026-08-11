/**
 * Anytone AT-D890UV radio module — sparse 16-byte selective clone.
 */

export {
  AT_D890_BLOCK_SIZE,
  AT_D890_CONNECTION,
  AT_D890_LIMITS,
  AT_D890_SATELLITE,
  AT_D890UV_MODEL_IDS,
  D890_MAP,
} from './constants.ts';
export {
  encodeSatelliteRecord,
  isWriteEligible as isAtD890SatelliteWriteEligible,
  listCapabilitySkippedTransmitters,
  packSatelliteWriteRecords,
  previewSatelliteWriteRecords,
  SATELLITE_RECORD_BYTES,
  type CapabilitySkippedTransmitter,
  type SatelliteWritePreviewEntry,
  type SatelliteWriteRecord,
} from './satelliteCodec.ts';
export { uploadAtD890SatelliteRecords } from './satelliteWrite.ts';
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
  AT_D890_CONFIG_ALIAS_PAIRS,
  AT_D890_CONFIG_ALIAS_STRIDE,
  analyseAtD890ConfigAliasPair,
  analyseAtD890ConfigAliasReport,
  formatAtD890ConfigAliasMarkdown,
  type AtD890ConfigAliasPairId,
  type AtD890ConfigAliasPairResult,
  type AtD890ConfigAliasReport,
  type AtD890ConfigAliasStatus,
  type AtD890SparseRmwGate,
} from './configAliasProbe.ts';
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
  runAtD890ConfigAliasCheck,
  runAtD890ProbeDiagnose,
  runAtD890ProbeInspect,
  runAtD890ProbeMeasure,
  runAtD890ProbePaint,
  runAtD890ProbeVerifyAndMark,
  type AtD890ConfigAliasCheckResult,
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
export {
  AT_D890_DUMP_REGIONS,
  AT_D890_MEMORY_REGION_GROUPS,
  AT_D890_MEMORY_REGIONS,
  runAtD890DigitalContactsDump,
  runAtD890MemoryDumpAll,
  runAtD890WriteVerifyMemoryRead,
  runAtD890MemoryGroupDump,
  runAtD890MemoryRegionDump,
  type AtD890DigitalContactsDumpResult,
  type AtD890MemoryDumpAllResult,
  type AtD890MemoryRegion,
  type AtD890MemoryRegionChunk,
  type AtD890MemoryRegionDumpResult,
  type AtD890MemoryRegionGroup,
  type AtD890WriteVerifyMemoryReadResult,
} from './memoryRegionExport.ts';
export {
  buildAtD890WriteVerifyResult,
  captureAtD890WriteStagingSnapshot,
  cloneAtD890WriteStagingSnapshot,
  compareStagingAgainstRegionDump,
  formatAtD890WriteVerifyDebugMarkdown,
  formatAtD890WriteVerifyMarkdown,
  labelForAtD890SentinelId,
  listStagingAddressesOutsideModelledRegions,
  atD890AddressInModelledRegions,
  summarizeVerifyByRegion,
  AT_D890_RMW_SPILL_REGION_ID,
  AT_D890_RMW_SPILL_REGION_LABEL,
  AT_D890_RMW_SPILL_GROUP,
  type AtD890RegionVerifyRow,
  type AtD890RegionVerifyStatus,
  type AtD890StagingChunkMismatch,
  type AtD890StagingChunkMismatchKind,
  type AtD890WriteStagingSnapshot,
  type AtD890WriteVerifyDebugContext,
  type AtD890WriteVerifyResult,
} from './writeMemoryVerify.ts';
