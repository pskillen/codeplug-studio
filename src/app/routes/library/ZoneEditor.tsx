import { useState } from 'react';
import { Checkbox, Stack, TextInput } from '@mantine/core';
import { Link } from 'react-router-dom';
import type { Library, Zone } from '@core/models/library.ts';
import { newZone } from '@core/domain/factories.ts';
import { FormSection } from '../../components/ui/index.ts';
import ZoneMemberPicker, {
  zoneMembersFromSelectedIds,
} from '../../components/library/ZoneMemberPicker.tsx';
import { hzToMhzString, mhzStringToHz } from '../../lib/units.ts';
import { persistence } from '../../state/persistence.ts';
import { useEntitySave } from './useEntitySave.ts';
import EditorActions from './EditorActions.tsx';

export default function ZoneEditor({
  projectId,
  entity,
  library,
}: {
  projectId: string;
  entity: Zone | null;
  library: Library;
}) {
  const base = entity ?? newZone(projectId, '');
  const [name, setName] = useState(base.name);
  const [selectedIds, setSelectedIds] = useState<string[]>(base.members.map((m) => m.id));
  const [exportScratchChannel, setExportScratch] = useState(base.exportScratchChannel);
  const [exportScanList, setExportScanList] = useState(base.exportScanList);
  const [scanCarrier, setScanCarrier] = useState(hzToMhzString(base.scanCarrierFrequencyHz));
  const [comment, setComment] = useState(base.comment);
  const { save, saving, error } = useEntitySave('zones');

  function handleSave() {
    const row: Zone = {
      ...base,
      name: name.trim() || 'Untitled zone',
      members: zoneMembersFromSelectedIds(selectedIds),
      exportScratchChannel,
      exportScanList,
      scanCarrierFrequencyHz: mhzStringToHz(scanCarrier),
      comment,
    };
    void save(() => persistence.putZone(row, entity ? entity.revision : null));
  }

  return (
    <Stack gap="md" maw={720}>
      <FormSection title="Identity">
        <TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} />
      </FormSection>

      <FormSection title="Members" description="Order matches export order for zone-capable builds.">
        <ZoneMemberPicker
          channels={library.channels}
          selectedIds={selectedIds}
          onChange={setSelectedIds}
        />
        {library.channels.length === 0 ? (
          <Link to="/library/channels/new">Add a channel</Link>
        ) : null}
      </FormSection>

      <FormSection title="Export options">
        <Checkbox
          label="Export scratch channel"
          checked={exportScratchChannel}
          onChange={(e) => setExportScratch(e.currentTarget.checked)}
        />
        <Checkbox
          label="Export as scan list"
          checked={exportScanList}
          onChange={(e) => setExportScanList(e.currentTarget.checked)}
        />
        <TextInput
          label="Scan carrier frequency (MHz)"
          description="Blank = none"
          value={scanCarrier}
          onChange={(e) => setScanCarrier(e.currentTarget.value)}
        />
        <TextInput label="Comment" value={comment} onChange={(e) => setComment(e.currentTarget.value)} />
      </FormSection>

      <EditorActions saving={saving} error={error} onSave={handleSave} />
    </Stack>
  );
}
