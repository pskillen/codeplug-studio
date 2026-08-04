import { Panel } from '../../../components/v2/index.ts';
import ZoneMemberEditor from '../../../components/library/ZoneMemberEditor.tsx';
import { useZoneEdit } from './ZoneEditContext.tsx';
import classes from './ZoneEditLayout.module.css';

export default function ZoneEditScanningPage() {
  const { entity, library, members, setMembers, setMapFilters } = useZoneEdit();

  return (
    <>
      <p className={classes.hint}>
        Set zone-derived scan list inclusion per direct channel member. Changes save with the zone
        header actions.
      </p>
      <Panel title="Scan inclusion">
        <ZoneMemberEditor
          channels={library.channels}
          zones={library.zones}
          editingZoneId={entity.id}
          members={members}
          onChange={setMembers}
          onMapFiltersChange={setMapFilters}
          mode="scanOnly"
        />
      </Panel>
    </>
  );
}
