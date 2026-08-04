import { Link, useNavigate } from 'react-router-dom';
import ZoneMemberEditor from '../../../components/library/ZoneMemberEditor.tsx';
import EntityDeleteButton from '../../../components/library/EntityDeleteButton.tsx';
import { Button, FormField, Panel, TextInput, ToggleSwitch } from '../../../components/v2/index.ts';
import { useZoneEdit } from './ZoneEditContext.tsx';
import ZoneMapSection from './ZoneMapSection.tsx';
import classes from './ZoneEditLayout.module.css';

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
    <>
      <Panel title="Identity">
        <div className={classes.fieldStack}>
          <FormField label="Name">
            <TextInput
              variant="plain"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              aria-label="Name"
            />
          </FormField>
          <FormField label="Comment">
            <TextInput
              variant="plain"
              value={comment}
              onChange={(e) => setComment(e.currentTarget.value)}
              aria-label="Comment"
            />
          </FormField>
          <ToggleSwitch
            label="Don't export as its own zone"
            checked={omitFromExport}
            onChange={(checked) => setOmitFromExport(checked)}
          />
          <p className={classes.hint}>
            Enable when this zone is only a building block for other zones — for example a PMR446
            simplex set you nest inside every city zone. Its channels still export inside parent
            zones; this zone will not get its own row in Zones.csv.
          </p>
          <EntityDeleteButton
            kind="zone"
            entityId={entity.id}
            label={entity.name}
            onDeleted={() => navigate('/library/zones')}
          />
        </div>
      </Panel>

      <Panel
        title="Members"
        sub="Reorder export order here. Add channels or configure scanning on dedicated screens."
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
      </Panel>

      <Panel title="Add channels">
        <div className={classes.actionRow}>
          <Button variant="secondary" onClick={() => navigate(`/library/zones/${entity.id}/add`)}>
            Add from channel list
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate(`/library/zones/${entity.id}/add-from-map`)}
          >
            Add from map
          </Button>
          <Button variant="primary" onClick={() => navigate(`/library/zones/${entity.id}/scanning`)}>
            Configure zone scanning
          </Button>
        </div>
      </Panel>

      <ZoneMapSection />
    </>
  );
}
