import { useState } from 'react';
import type { Library, Zone } from '@core/models/library.ts';
import { newZone } from '@core/domain/factories.ts';
import { FieldRow } from '../../components/fields/Fields.tsx';
import { controlStyle } from '../../components/fields/styles.ts';
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
  const [members, setMembers] = useState<Set<string>>(new Set(base.members.map((m) => m.id)));
  const [exportScratchChannel, setExportScratch] = useState(base.exportScratchChannel);
  const [exportScanList, setExportScanList] = useState(base.exportScanList);
  const [scanCarrier, setScanCarrier] = useState(hzToMhzString(base.scanCarrierFrequencyHz));
  const [comment, setComment] = useState(base.comment);
  const { save, saving, error } = useEntitySave();

  function toggle(channelId: string) {
    setMembers((prev) => {
      const next = new Set(prev);
      if (next.has(channelId)) next.delete(channelId);
      else next.add(channelId);
      return next;
    });
  }

  function handleSave() {
    const row: Zone = {
      ...base,
      name: name.trim() || 'Untitled zone',
      members: library.channels
        .filter((c) => members.has(c.id))
        .map((c) => ({ kind: 'channel' as const, id: c.id })),
      exportScratchChannel,
      exportScanList,
      scanCarrierFrequencyHz: mhzStringToHz(scanCarrier),
      comment,
    };
    void save(() => persistence.putZone(row, entity ? entity.revision : null));
  }

  return (
    <div style={{ maxWidth: 460 }}>
      <FieldRow label="Name">
        <input style={controlStyle} value={name} onChange={(e) => setName(e.target.value)} />
      </FieldRow>

      <div style={{ margin: '0.6rem 0' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#3e4c59' }}>Channels</div>
        {library.channels.length === 0 ? (
          <p style={{ color: '#9aa5b1', fontSize: '0.8rem', margin: '0.25rem 0' }}>
            No channels available.
          </p>
        ) : (
          library.channels.map((c) => (
            <label key={c.id} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <input type="checkbox" checked={members.has(c.id)} onChange={() => toggle(c.id)} />
              <span style={{ fontSize: '0.85rem' }}>{c.name}</span>
            </label>
          ))
        )}
      </div>

      <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', margin: '0.4rem 0' }}>
        <input
          type="checkbox"
          checked={exportScratchChannel}
          onChange={(e) => setExportScratch(e.target.checked)}
        />
        <span style={{ fontSize: '0.85rem' }}>Export scratch channel</span>
      </label>
      <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', margin: '0.4rem 0' }}>
        <input
          type="checkbox"
          checked={exportScanList}
          onChange={(e) => setExportScanList(e.target.checked)}
        />
        <span style={{ fontSize: '0.85rem' }}>Export as scan list</span>
      </label>
      <FieldRow label="Scan carrier frequency (MHz)" hint="Blank = none">
        <input
          style={controlStyle}
          value={scanCarrier}
          onChange={(e) => setScanCarrier(e.target.value)}
        />
      </FieldRow>
      <FieldRow label="Comment">
        <input style={controlStyle} value={comment} onChange={(e) => setComment(e.target.value)} />
      </FieldRow>

      <EditorActions saving={saving} error={error} onSave={handleSave} />
    </div>
  );
}
