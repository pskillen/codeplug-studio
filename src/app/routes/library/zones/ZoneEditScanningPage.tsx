import { Stack } from '@mantine/core';
import ZoneMemberEditor from '../../../components/library/ZoneMemberEditor.tsx';
import { FormSection } from '../../../components/ui/index.ts';
import { useZoneEdit } from './ZoneEditContext.tsx';
import ZoneEditHeader from './ZoneEditHeader.tsx';

export default function ZoneEditScanningPage() {
  const { entity, library, members, setMembers, setMapFilters } = useZoneEdit();

  return (
    <Stack gap="md">
      <ZoneEditHeader
        subtitle="Set zone-derived scan list inclusion per direct channel member."
        backTo={`/library/zones/${entity.id}`}
        backLabel="← Back to zone"
      />
      <FormSection title="Scan inclusion">
        <ZoneMemberEditor
          channels={library.channels}
          zones={library.zones}
          editingZoneId={entity.id}
          members={members}
          onChange={setMembers}
          onMapFiltersChange={setMapFilters}
          mode="scanOnly"
        />
      </FormSection>
    </Stack>
  );
}
