import { useState } from 'react';
import type { EntityRef, Library, RxGroupList } from '@core/models/library.ts';
import { newRxGroupList } from '@core/domain/factories.ts';
import { FieldRow } from '../../components/fields/Fields.tsx';
import { controlStyle } from '../../components/fields/styles.ts';
import { persistence } from '../../state/persistence.ts';
import { useEntitySave } from './useEntitySave.ts';
import EditorActions from './EditorActions.tsx';

function refKey(kind: EntityRef['kind'], id: string): string {
  return `${kind}:${id}`;
}

export default function RxGroupListEditor({
  projectId,
  entity,
  library,
}: {
  projectId: string;
  entity: RxGroupList | null;
  library: Library;
}) {
  const base = entity ?? newRxGroupList(projectId, '');
  const [name, setName] = useState(base.name);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(base.members.map((m) => refKey(m.ref.kind, m.ref.id))),
  );
  const { save, saving, error } = useEntitySave('rx-group-lists');

  function toggle(kind: EntityRef['kind'], id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      const key = refKey(kind, id);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleSave() {
    const members: RxGroupList['members'] = [];
    for (const tg of library.talkGroups) {
      if (selected.has(refKey('talkGroup', tg.id)))
        members.push({ ref: { kind: 'talkGroup', id: tg.id } });
    }
    for (const dc of library.digitalContacts) {
      if (selected.has(refKey('digitalContact', dc.id)))
        members.push({ ref: { kind: 'digitalContact', id: dc.id } });
    }
    const row: RxGroupList = { ...base, name: name.trim() || 'Untitled list', members };
    void save(() => persistence.putRxGroupList(row, entity ? entity.revision : null));
  }

  return (
    <div style={{ maxWidth: 460 }}>
      <FieldRow label="Name">
        <input style={controlStyle} value={name} onChange={(e) => setName(e.target.value)} />
      </FieldRow>
      <MemberPicker
        title="Talk groups"
        rows={library.talkGroups}
        selected={selected}
        kind="talkGroup"
        onToggle={toggle}
      />
      <MemberPicker
        title="Digital contacts"
        rows={library.digitalContacts}
        selected={selected}
        kind="digitalContact"
        onToggle={toggle}
      />
      <EditorActions
        saving={saving}
        error={error}
        onSave={handleSave}
        cancelPath="/library/rx-group-lists"
      />
    </div>
  );
}

function MemberPicker({
  title,
  rows,
  selected,
  kind,
  onToggle,
}: {
  title: string;
  rows: { id: string; name: string }[];
  selected: Set<string>;
  kind: EntityRef['kind'];
  onToggle: (kind: EntityRef['kind'], id: string) => void;
}) {
  return (
    <div style={{ margin: '0.6rem 0' }}>
      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#3e4c59' }}>{title}</div>
      {rows.length === 0 ? (
        <p style={{ color: '#9aa5b1', fontSize: '0.8rem', margin: '0.25rem 0' }}>None available.</p>
      ) : (
        rows.map((row) => (
          <label key={row.id} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={selected.has(`${kind}:${row.id}`)}
              onChange={() => onToggle(kind, row.id)}
            />
            <span style={{ fontSize: '0.85rem' }}>{row.name}</span>
          </label>
        ))
      )}
    </div>
  );
}
