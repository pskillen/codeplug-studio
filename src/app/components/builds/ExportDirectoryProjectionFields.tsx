import { Checkbox, Select, Stack, Text } from '@mantine/core';
import { BuildCapabilityTrait, traitProfileFor } from '@core/models/traits.ts';
import {
  defaultDualBankWriteOptions,
  defaultSingleBankProjectionMode,
  type SingleBankDigitalProjectionMode,
} from '@core/domain/digitalIdDirectoryProjection.ts';
import type { BuildExportSettings, RadioBuild } from '@core/models/formatBuild.ts';
import { FieldCard } from '../fields/Fields.tsx';

export interface ExportDirectoryProjectionFieldsProps {
  build: RadioBuild;
  formatId: string;
  profileId: string;
  saving: boolean;
  onPatch: (patch: Partial<BuildExportSettings>) => void;
}

const SINGLE_BANK_CPS_MODES: { value: SingleBankDigitalProjectionMode; label: string }[] = [
  { value: 'contacts-only', label: 'Contacts only' },
  { value: 'directory-only', label: 'ID directory only' },
  { value: 'merge', label: 'Merge (library wins on duplicate ID)' },
  { value: 'skip', label: 'Skip (omit digital contact CPS file rows)' },
];

export default function ExportDirectoryProjectionFields({
  build,
  formatId,
  profileId,
  saving,
  onPatch,
}: ExportDirectoryProjectionFieldsProps) {
  const traits = traitProfileFor(profileId)?.traits ?? [];
  const supportsDualBank = traits.includes(BuildCapabilityTrait.SeparateDigitalIdList);
  const supportsSingleBank = formatId === 'anytone' && !supportsDualBank;

  if (!supportsDualBank && !supportsSingleBank) {
    return null;
  }

  const dualToggles =
    build.exportSettings?.cpsDualBankDirectory ?? defaultDualBankWriteOptions('codeplug');
  const singleMode =
    build.exportSettings?.cpsSingleBankProjectionMode ??
    defaultSingleBankProjectionMode('codeplug');

  return (
    <FieldCard
      title="ID directory"
      description="Project your ID directory into CPS digital contact / ID list files. Directory rows are streamed from IndexedDB — not included in project YAML."
    >
      {supportsDualBank ? (
        <Stack gap="xs">
          <Text size="sm" c="dimmed">
            {formatId === 'opengd77'
              ? 'OpenGD77 CPS has no User Database file. Include ID directory warns and does not add rows to Contacts.csv — use Web Serial Write for incoming-call lookup IDs. Contacts stay in Contacts.csv. The radio may hold the same DMR ID in both stores.'
              : formatId === 'dm32'
                ? 'DM-32 CPS DigitalContacts.csv is capped at 250 rows. Include ID directory warns and does not add rows to that file or DMR-ID.csv — use Web Serial Write for address-book lookup IDs. Contacts stay in DigitalContacts.csv. Duplicate DMR IDs: library wins on Web Serial Both.'
                : 'Dual-bank radios keep contacts and the ID directory in separate CPS tables. When both are included, directory rows whose DMR ID matches a contact are skipped.'}
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
      ) : null}
      {supportsSingleBank ? (
        <Stack gap="xs">
          <Text size="sm" c="dimmed">
            AT-D890 uses one digital contact bank in CPS. Merge skips directory rows whose DMR ID
            already exists on a library contact.
          </Text>
          <Select
            label="Digital contact projection"
            value={singleMode}
            data={SINGLE_BANK_CPS_MODES}
            disabled={saving}
            onChange={(value) =>
              onPatch({
                cpsSingleBankProjectionMode:
                  (value as SingleBankDigitalProjectionMode) ??
                  defaultSingleBankProjectionMode('codeplug'),
              })
            }
          />
        </Stack>
      ) : null}
    </FieldCard>
  );
}
