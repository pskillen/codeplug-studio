import { OPENGD77_SETTINGS_GAP_LENGTH } from './constants.ts';

/** Id of the capture option that also reads the User Database. */
export const OPENGD77_DEBUG_USER_DATABASE_OPTION = 'userDatabase';

/** Caption sentence under the OpenGD77 identity grid. */
export const OPENGD77_IDENTITY_NOTE =
  'Values are the captured FirmwareInfo reply, as reported. A revision string is not proof of provenance. The reply has no serial and cannot tell stock builds from forks or mods. Radio type does not distinguish DM-1701 from RT-84 or MD-9600 from RT-90.';

/** Backup-tab notice about what the OpenGD77 read sends and how to recover. */
export const OPENGD77_READ_NOTICE = {
  title: 'Read-only capture and recovery',
  text: `The capture only reads: it sends a ping, the FirmwareInfo request, the CPS screen command, reads of the registered flash spans and the ${OPENGD77_SETTINGS_GAP_LENGTH}-byte settings struct tail, the occupied User Database when ticked, and the CPS close. It takes minutes, and a large User Database makes it much longer. Cancel stops at the next frame and sends only the CPS close. If the radio stays on the CPS screen after a failure, power-cycle it.`,
};

/** Tick boxes on the Backup tab that change what Read radio reads. */
export const OPENGD77_CAPTURE_OPTIONS: readonly {
  id: string;
  label: string;
  description: string;
}[] = [
  {
    id: OPENGD77_DEBUG_USER_DATABASE_OPTION,
    label: 'Also read the User Database',
    description:
      'The DMR ID lookup list. It can be up to about 14 MB and add many minutes to the read. Unticked, only that region is skipped.',
  },
];
