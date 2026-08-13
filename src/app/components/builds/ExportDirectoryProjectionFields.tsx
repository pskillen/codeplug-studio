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
  { value: 'contacts-only', label: 'Library contacts only' },
  { value: 'directory-only', label: 'Digital ID directory only' },
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
      title="Digital ID directory"
      description="Project the local RadioID directory shadow into CPS digital contact / ID list files. Directory rows are streamed from IndexedDB — not included in project YAML."
    >
      {supportsDualBank ? (
        <Stack gap="xs">
          <Text size="sm" c="dimmed">
            Dual-bank radios keep library contacts and the digital ID directory in separate CPS
            tables. When both are included, directory rows whose DMR ID matches a library contact
            are skipped.
          </Text>
          <Checkbox
            label="Include library digital contacts"
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
            label="Include digital ID directory"
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
