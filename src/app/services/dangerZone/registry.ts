/**
 * Danger zone registry (#1369): rare jobs that change the radio itself, listed on the Danger zone area.
 * A tool joins by adding an entry here and its own guarded send path. There is no prod gate (owner decision).
 * See DESIGN.md "Danger zone" and docs/features/radio-read-write/danger-zone.md.
 */

export interface DangerZoneToolDescriptor {
  /** Stable id. */
  id: string;
  title: string;
  /** What it does, one or two sentences. */
  summary: string;
  /** What it costs the user (what is wiped, what is saved). */
  cost: string;
  /** Rough time to run, in minutes. */
  minutes: number;
  /** Radio target ids (`RadioBuild.radioTargetId`) the tool is for. */
  radios: readonly string[];
  /** Route of the tool's own wizard, relative to the build (`export/danger-zone/<tool>`). Absent: no Start yet. */
  route?: string;
}

export const AT_D890_FREQUENCY_RANGE_TOOL_ID = 'd890-frequency-range';
export const RADIOFOUNDRY_STORAGE_CLAIM_TOOL_ID = 'radiofoundry-storage-claim';

const RADIOFOUNDRY_DANGER_TARGET_IDS = [
  'retevis-rt90-radiofoundry',
  'retevis-rt84-radiofoundry',
  'baofeng-dm32uv-radiofoundry',
  'baofeng-dm1701-radiofoundry',
  'tyt-md9600-radiofoundry',
] as const;

export const DANGER_ZONE_TOOLS: readonly DangerZoneToolDescriptor[] = [
  {
    id: AT_D890_FREQUENCY_RANGE_TOOL_ID,
    title: 'Change frequency range',
    summary:
      'Sets which frequencies the radio may transmit on, for example Amateur Europe to Amateur US.',
    cost: 'The radio wipes its channels and settings when the range changes; Studio backs them up first and puts them back.',
    minutes: 10,
    radios: ['anytone-at-d890uv', 'anytone-at-d890uv-mm9pdy'],
    route: 'export/danger-zone/frequency-range',
  },
  {
    id: RADIOFOUNDRY_STORAGE_CLAIM_TOOL_ID,
    title: 'Unlock settings storage',
    summary:
      'Claims the flash settings area RadioFoundry refused to write while it still held data from the old firmware.',
    cost: "Erases the old firmware's 40 KB settings area; Studio saves it to a file first.",
    minutes: 2,
    radios: RADIOFOUNDRY_DANGER_TARGET_IDS,
    route: 'export/danger-zone/storage-claim',
  },
];
