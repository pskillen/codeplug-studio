import { Stack } from '@mantine/core';
import ZoneMemberEditor from '../../../components/library/ZoneMemberEditor.tsx';
import { FormSection } from '../../../components/ui/index.ts';
import { useZoneEdit } from './ZoneEditContext.tsx';
import ZoneEditHeader from './ZoneEditHeader.tsx';
import ZoneMapSection from './ZoneMapSection.tsx';

export default function ZoneEditAddPage() {
  const { entity, library, members, setMembers, setMapFilters } = useZoneEdit();

  return (
    <Stack gap="md">
      <ZoneEditHeader
        subtitle="Add channels and nested zones from the library pool."
        backTo={`/library/zones/${entity.id}`}
        backLabel="← Back to zone"
      />
      <FormSection title="Add members">
        <ZoneMemberEditor
          channels={library.channels}
          zones={library.zones}
          editingZoneId={entity.id}
          members={members}
          onChange={setMembers}
          onMapFiltersChange={setMapFilters}
          mode="addPool"
        />
      </FormSection>
      <ZoneMapSection />
    </Stack>
  );
}
