import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import ZoneMemberEditor, {
  ZoneMemberAddOverlay,
} from '../../../components/library/ZoneMemberEditor.tsx';
import EntityDeleteButton from '../../../components/library/EntityDeleteButton.tsx';
import { FormField, Panel, TextInput, ToggleSwitch } from '../../../components/v2/index.ts';
import { useZoneEdit } from './ZoneEditContext.tsx';
import ZoneMapSection from './ZoneMapSection.tsx';
import classes from './ZoneEditLayout.module.css';
import workspaceClasses from './ZoneEditWorkspace.module.css';

const SCANNING_DESCRIPTION =
  "How members are scanned depends on the target radio. Some radios scan a list Studio projects from this membership — the control below decides each channel's inclusion in that projected list. Others treat the zone itself as the scan list, where this setting has no effect.";

export default function ZoneEditMainPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [addOpen, setAddOpen] = useState(() => searchParams.get('add') === 'members');
  const scanningRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (searchParams.get('add') !== 'members') return;
    const next = new URLSearchParams(searchParams);
    next.delete('add');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (window.location.hash === '#scanning') {
      scanningRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

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

      <div className={workspaceClasses.workspace}>
        <div className={workspaceClasses.membersColumn}>
          <ZoneMemberEditor
            channels={library.channels}
            zones={library.zones}
            editingZoneId={entity.id}
            members={members}
            onChange={setMembers}
            onMapFiltersChange={setMapFilters}
            mode="members"
            onAdd={() => setAddOpen(true)}
          />
          {library.channels.length === 0 ? (
            <Link to="/library/channels/new">Add a channel</Link>
          ) : null}
        </div>
        <div className={workspaceClasses.mapColumn}>
          <ZoneMapSection title="Coverage" />
        </div>
      </div>

      <div ref={scanningRef} id="scanning" className={workspaceClasses.scanningSection}>
        <Panel title="Scanning behaviour" sub={SCANNING_DESCRIPTION}>
          <ZoneMemberEditor
            channels={library.channels}
            zones={library.zones}
            editingZoneId={entity.id}
            members={members}
            onChange={setMembers}
            mode="scanning"
          />
        </Panel>
      </div>

      <p className={classes.hint}>
        <Link to={`/library/zones/${entity.id}/add-from-map`}>Add from map</Link> — grow membership
        from geographic suggestions (#943).
      </p>

      <ZoneMemberAddOverlay
        open={addOpen}
        zoneName={name.trim() || 'Untitled zone'}
        onCancel={() => setAddOpen(false)}
        onCommit={() => setAddOpen(false)}
        channels={library.channels}
        zones={library.zones}
        editingZoneId={entity.id}
        members={members}
        onChange={setMembers}
      />
    </>
  );
}
