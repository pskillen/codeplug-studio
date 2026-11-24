export const RADIOFOUNDRY_DEBUG_AREA2_OPTION = 'idDatabaseArea2';

export const RADIOFOUNDRY_CAPTURE_STAGES: readonly string[] = ['Connect', 'Codeplug', 'ID database'];

export const RADIOFOUNDRY_CAPTURE_OPTIONS: readonly {
  id: string;
  label: string;
  description: string;
}[] = [
  {
    id: RADIOFOUNDRY_DEBUG_AREA2_OPTION,
    label: 'Also read the DMR ID database area 2',
    description:
      "The records after the first 9,708. Up to 13.8 MB: tens of seconds over USB, about ten minutes on the DM-32UV cable. Unticked, area 1 and the radio's own count are still read.",
  },
];