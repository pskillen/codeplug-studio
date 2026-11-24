export const RADIOFOUNDRY_DEBUG_AREA2_OPTION = 'idDatabaseArea2';

export const RADIOFOUNDRY_CAPTURE_STAGES: readonly string[] = [
  'Connect',
  'Codeplug',
  'ID database',
];

export const RADIOFOUNDRY_READ_NOTICE = {
  title: 'Read-only capture',
  text: 'The read sends only INFO, VERSION, checksum (SUMS) and block (READ) requests, and one ID-database count (IDDB). A frame guard refuses anything else. The radio keeps working while it is read; there is nothing to recover afterwards. Cancel stops at the next request.',
};

export const RADIOFOUNDRY_CALIBRATION_NOTE =
  'RadioFoundry calibration is not read yet. The codeplug protocol never serves 0x10000–0x1FFFF, where calibration and the settings ring live; reading it needs a separate read-only storage request, planned for later.';

export const RADIOFOUNDRY_DEBUG_OPENGD77_FOUND =
  "This radio didn't answer as RadioFoundry. It answered like OpenGD77 firmware. Nothing was read.";

export const RADIOFOUNDRY_DEBUG_NO_ANSWER =
  "This radio didn't answer as RadioFoundry. Nothing was read.";

export const RADIOFOUNDRY_DEBUG_HOTSPOT_HINT =
  "An OpenGD77 radio in hotspot mode doesn't answer either.";

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
