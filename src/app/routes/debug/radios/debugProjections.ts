import {
  buildDm32SparseCapture,
  projectDm32Memory,
} from '@integrations/radio-io/radios/dm32uv/debugMemory.ts';
import { projectDm32Settings } from '@integrations/radio-io/radios/dm32uv/debugMemorySettings.ts';
import { projectDm32MemoryLists } from '@integrations/radio-io/radios/dm32uv/debugMemoryZones.ts';
import {
  projectDm32Lists,
  resolveDm32ChannelReferences,
} from '@integrations/radio-io/radios/dm32uv/debugMemoryLists.ts';
import { projectAtD890Memory } from '@integrations/radio-io/radios/at-d890uv/debugMemory.ts';
import { AT_D890UV_MODEL_IDS } from '@integrations/radio-io/radios/at-d890uv/constants.ts';
import { DM32_MODEL_IDS } from '@integrations/radio-io/radios/dm32uv/constants.ts';
import { memoByArchive } from './archiveMemo.ts';
import type { DebugArchive } from './captureArchive.ts';

const isDm32 = (id: string) => (DM32_MODEL_IDS as readonly string[]).includes(id);
const isAtD890 = (id: string) => (AT_D890UV_MODEL_IDS as readonly string[]).includes(id);

/** The DM-32UV decode shared by the Memory and Settings tabs; undefined for another radio's archive. */
export const decodeDm32Archive = memoByArchive((archive: DebugArchive) => {
  if (!isDm32(archive.manifest.radioModelId)) return undefined;
  const memory = projectDm32MemoryLists(projectDm32Memory(buildDm32SparseCapture(archive)));
  const lists = projectDm32Lists(memory.capture);
  return {
    memory,
    lists,
    references: resolveDm32ChannelReferences(memory.channels, lists),
    settings: projectDm32Settings(memory.capture),
  };
});

/** The AT-D890UV projection shared by the Memory and Settings tabs; undefined for another radio's archive. */
export const projectAtD890Archive = memoByArchive((archive: DebugArchive) =>
  isAtD890(archive.manifest.radioModelId)
    ? projectAtD890Memory(archive.manifest.regions, archive.regions)
    : undefined,
);
