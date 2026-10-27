import { Checkbox, Stack, Text } from '@mantine/core';
import { BuildCapabilityTrait, traitProfileFor } from '@core/models/traits.ts';
import { cpsDualBankOptionsForBuild } from '@core/domain/digitalIdDirectoryProjection.ts';
import type { BuildExportSettings, RadioBuild } from '@core/models/formatBuild.ts';
import { FieldCard } from '../fields/Fields.tsx';

export interface ExportDirectoryProjectionFieldsProps {
  build: RadioBuild;
  formatId: string;
  profileId: string;
  saving: boolean;
  onPatch: (patch: Partial<BuildExportSettings>) => void;
}

function dualBankFormatNote(formatId: string): string {
  switch (formatId) {
    case 'opengd77':
      return 'OpenGD77 CPS has no User Database file. Include ID directory warns and does not add rows to Contacts.csv — use Web Serial Write for incoming-call lookup IDs. Contacts stay in Contacts.csv. The radio may hold the same DMR ID in both stores.';
    case 'dm32':
      return 'DM-32 CPS DigitalContacts.csv is capped at 250 rows. Include ID directory warns and does not add rows to that file or DMR-ID.csv — use Web Serial Write for address-book lookup IDs. Contacts stay in DigitalContacts.csv. Duplicate DMR IDs: library wins on Web Serial Both.';
    case 'anytone':
      return "Contacts always go to DMRTalkGroups.CSV as private calls, so channels and RX group lists find them. These boxes choose what goes to DMRDigitalContactList.CSV, the radio's ID database: your contacts, the ID directory, or both. ID directory rows for a DMR ID that is already a contact are skipped.";
    default:
      return 'Dual-bank radios keep contacts and the ID directory in separate CPS tables. When both are included, directory rows whose DMR ID matches a contact are skipped.';
  }
}

export default function ExportDirectoryProjectionFields({
  build,
  formatId,
  profileId,
  saving,
  onPatch,
}: ExportDirectoryProjectionFieldsProps) {
  const traits = traitProfileFor(profileId)?.traits ?? [];
  const supportsDualBank = traits.includes(BuildCapabilityTrait.SeparateDigitalIdList);

  if (!supportsDualBank) {
    return null;
  }

  // Stored choice, else the deprecated pre-#1433 Anytone single-bank mode, else the default.
  const dualToggles = cpsDualBankOptionsForBuild(build.exportSettings);

  return (
    <FieldCard
      title="ID directory"
      description="Project your ID directory into CPS digital contact / ID list files. Directory rows are streamed from IndexedDB — not included in project YAML."
    >
      <Stack gap="xs">
        <Text size="sm" c="dimmed">
          {dualBankFormatNote(formatId)}
        </Text>
        <Checkbox
          label="Include contacts"
          checked={dualToggles.includeLibraryContacts}
          disabled={saving}
          onChange={(event) => {
            const checked = (event.currentTarget ?? event.target).checked;
            onPatch({
              cpsDualBankDirectory: {
                ...dualToggles,
                includeLibraryContacts: checked,
              },
            });
          }}
        />
        <Checkbox
          label="Include ID directory"
          checked={dualToggles.includeDigitalIdDirectory}
          disabled={saving}
          onChange={(event) => {
            const checked = (event.currentTarget ?? event.target).checked;
            onPatch({
              cpsDualBankDirectory: {
                ...dualToggles,
                includeDigitalIdDirectory: checked,
              },
            });
          }}
        />
      </Stack>
    </FieldCard>
  );
}
