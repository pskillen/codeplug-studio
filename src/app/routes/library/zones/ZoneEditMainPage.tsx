import { Button, Group, Stack, Switch, Text, TextInput } from '@mantine/core';
import { Link, useNavigate } from 'react-router-dom';
import ZoneMemberEditor from '../../../components/library/ZoneMemberEditor.tsx';
import EntityDeleteButton from '../../../components/library/EntityDeleteButton.tsx';
import { FormSection } from '../../../components/ui/index.ts';
import { primaryButtonStyle, secondaryButtonStyle } from '../../../components/fields/styles.ts';
import { useZoneEdit } from './ZoneEditContext.tsx';
import ZoneMapSection from './ZoneMapSection.tsx';

export default function ZoneEditMainPage() {
  const navigate = useNavigate();
  const {
    entity,
    library,
    name,
    setName,
    comment,
    setComment,
    omitFromExport,
    setOmitFromExport,
    members,
    setMembers,
    setMapFilters,
  } = useZoneEdit();

  return (
    <Stack gap="md">
      <FormSection title="Identity">
        <TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <TextInput
          label="Comment"
          value={comment}
          onChange={(e) => setComment(e.currentTarget.value)}
        />
        <Switch
          label="Don't export as its own zone"
          checked={omitFromExport}
          onChange={(e) => setOmitFromExport(e.currentTarget.checked)}
        />
        <Text size="sm" c="dimmed">
          Enable when this zone is only a building block for other zones — for example a PMR446
          simplex set you nest inside every city zone. Its channels still export inside parent
          zones; this zone will not get its own row in Zones.csv.
        </Text>
        <EntityDeleteButton
          kind="zone"
          entityId={entity.id}
          label={entity.name}
          onDeleted={() => navigate('/library/zones')}
        />
      </FormSection>

      <FormSection
        title="Members"
        description="Reorder export order here. Add channels or configure scanning on dedicated screens."
      >
        <ZoneMemberEditor
          channels={library.channels}
          zones={library.zones}
          editingZoneId={entity.id}
          members={members}
          onChange={setMembers}
          onMapFiltersChange={setMapFilters}
          mode="reorder"
        />
        {library.channels.length === 0 ? (
          <Link to="/library/channels/new">Add a channel</Link>
        ) : null}
      </FormSection>

      <FormSection title="Add channels">
        <Group>
          <Button
            component={Link}
            to={`/library/zones/${entity.id}/add`}
            variant="light"
            style={secondaryButtonStyle}
          >
            Add from channel list
          </Button>
          <Button
            component={Link}
            to={`/library/zones/${entity.id}/add-from-map`}
            variant="light"
            style={secondaryButtonStyle}
          >
            Add from map
          </Button>
          <Button
            component={Link}
            to={`/library/zones/${entity.id}/scanning`}
            variant="light"
            style={primaryButtonStyle}
          >
            Configure zone scanning
          </Button>
        </Group>
      </FormSection>

      <ZoneMapSection />
    </Stack>
  );
}
