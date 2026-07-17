import { Alert, List, Text } from '@mantine/core';

/** Must match DM32 export guide filename from core (`aprsGuide.ts`). */
const DM32_APRS_GUIDE_FILE_NAME = 'APRS.md';

export interface Dm32AprsSetupAlertProps {
  /** Resolved export file names for this build (may include APRS.md). */
  exportFileNames: readonly string[];
}

/**
 * On-screen CPS APRS setup tip when the DM32 export ZIP will include APRS.md.
 */
export default function Dm32AprsSetupAlert({ exportFileNames }: Dm32AprsSetupAlertProps) {
  if (!exportFileNames.includes(DM32_APRS_GUIDE_FILE_NAME)) return null;

  return (
    <Alert color="yellow" title="DM-32 APRS setup (manual in CPS)">
      <Text size="sm">
        Baofeng DM-32UV CPS does not import an APRS.csv file. After importing the CSV bundle, open
        APRS in CPS and set:
      </Text>
      <List size="sm" mt="xs" withPadding>
        <List.Item>Scheduled send time</List.Item>
        <List.Item>Call type</List.Item>
        <List.Item>Upload number (DMR ID)</List.Item>
        <List.Item>Report channels 1–8 (channel names)</List.Item>
      </List>
      <Text size="sm" mt="xs">
        Suggested values are in <Text span fw={600}>{DM32_APRS_GUIDE_FILE_NAME}</Text> inside the
        export ZIP (also visible in Preview).
      </Text>
    </Alert>
  );
}
