import { useState } from 'react';
import type { AnalogContact } from '@core/models/library.ts';
import { newAnalogContact } from '@core/domain/factories.ts';
import { FieldRow } from '../../components/fields/Fields.tsx';
import { controlStyle } from '../../components/fields/styles.ts';
import { persistence } from '../../state/persistence.ts';
import { useEntitySave } from './useEntitySave.ts';
import EditorActions from './EditorActions.tsx';

export function AnalogContactEditor({
  projectId,
  entity,
}: {
  projectId: string;
  entity: AnalogContact | null;
}) {
  const base = entity ?? newAnalogContact(projectId, '');
  const [name, setName] = useState(base.name);
  const [code, setCode] = useState(base.code);
  const [comment, setComment] = useState(base.comment);
  const { save, saving, error } = useEntitySave('analog-contacts');

  function handleSave() {
    const row: AnalogContact = {
      ...base,
      name: name.trim() || 'Untitled contact',
      code,
      comment,
    };
    void save(() => persistence.putAnalogContact(row, entity ? entity.revision : null));
  }

  return (
    <div style={{ maxWidth: 460 }}>
      <FieldRow label="Name">
        <input style={controlStyle} value={name} onChange={(e) => setName(e.target.value)} />
      </FieldRow>
      <FieldRow label="Code">
        <input style={controlStyle} value={code} onChange={(e) => setCode(e.target.value)} />
      </FieldRow>
      <FieldRow label="Comment">
        <input style={controlStyle} value={comment} onChange={(e) => setComment(e.target.value)} />
      </FieldRow>
      <EditorActions
        saving={saving}
        error={error}
        onSave={handleSave}
        cancelPath="/library/contacts"
      />
    </div>
  );
}
