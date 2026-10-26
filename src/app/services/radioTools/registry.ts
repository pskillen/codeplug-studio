/**
 * Radio tools registry (#1369): rare jobs that change the radio itself, listed on the Radio tools area.
 * A tool joins by adding an entry here, its own guarded send path and its own prod gate.
 * See DESIGN.md "Radio tools" and docs/features/radio-read-write/radio-tools.md.
 */

export interface RadioToolDescriptor {
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
  /** Hidden on the prod site until the owner has run the tool on a radio. Cleared in its own commit. */
  prodDisabled: boolean;
  /** Route of the tool's own wizard, relative to the build (`export/radio-tools/<tool>`). Absent: no Start yet. */
  route?: string;
}

export const AT_D890_FREQUENCY_RANGE_TOOL_ID = 'd890-frequency-range';

export const RADIO_TOOLS: readonly RadioToolDescriptor[] = [
  {
    id: AT_D890_FREQUENCY_RANGE_TOOL_ID,
    title: 'Change frequency range',
    summary:
      'Sets which frequencies the radio may transmit on, for example Amateur Europe to Amateur US.',
    cost: 'The radio wipes its channels and settings when the range changes; Studio backs them up first and puts them back.',
    minutes: 10,
    radios: ['anytone-at-d890uv', 'anytone-at-d890uv-mm9pdy'],
    prodDisabled: true,
  },
];
