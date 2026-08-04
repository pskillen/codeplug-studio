import { Panel } from '../../../components/v2/index.ts';
import ZoneMemberEditor from '../../../components/library/ZoneMemberEditor.tsx';
import { useZoneEdit } from './ZoneEditContext.tsx';
import ZoneMapSection from './ZoneMapSection.tsx';
import classes from './ZoneEditLayout.module.css';

export default function ZoneEditAddPage() {
  const { entity, library, members, setMembers, setMapFilters } = useZoneEdit();

  return (
    <>
      <p className={classes.hint}>
        Add channels and nested zones from the library pool. Changes save with the zone header
        actions.
      </p>
      <Panel title="Add members">
        <ZoneMemberEditor
          channels={library.channels}
          zones={library.zones}
          editingZoneId={entity.id}
          members={members}
          onChange={setMembers}
          onMapFiltersChange={setMapFilters}
          mode="addPool"
        />
      </Panel>
      <ZoneMapSection />
    </>
  );
}
