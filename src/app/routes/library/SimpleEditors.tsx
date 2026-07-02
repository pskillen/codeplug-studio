import { useState } from 'react';
import type { AnalogContact, DigitalChannelMode, DigitalContact } from '@core/models/library.ts';
import { newAnalogContact, newDigitalContact } from '@core/domain/factories.ts';
import { FieldRow } from '../../components/fields/Fields.tsx';
import { controlStyle } from '../../components/fields/styles.ts';
import { parseOptionalInt } from '../../lib/units.ts';
import { persistence } from '../../state/persistence.ts';
import { useEntitySave } from './useEntitySave.ts';
import EditorActions from './EditorActions.tsx';

const DIGITAL_MODES: DigitalChannelMode[] = ['dmr', 'dstar', 'ysf', 'p25', 'nxdn', 'm17', 'tetra'];

function DigitalModeSelect({
  value,
  onChange,
}: {
  value: DigitalChannelMode;
  onChange: (m: DigitalChannelMode) => void;
}) {
  return (
    <select
      style={controlStyle}
      value={value}
      onChange={(e) => onChange(e.target.value as DigitalChannelMode)}
    >
      {DIGITAL_MODES.map((m) => (
        <option key={m} value={m}>
          {m.toUpperCase()}
        </option>
      ))}
    </select>
  );
}

export function DigitalContactEditor({
  projectId,
  entity,
}: {
  projectId: string;
  entity: DigitalContact | null;
}) {
  const base = entity ?? newDigitalContact(projectId, '', 0);
  const [name, setName] = useState(base.name);
  const [mode, setMode] = useState<DigitalChannelMode>(base.mode);
  const [digitalId, setDigitalId] = useState(String(base.digitalId));
  const [comment, setComment] = useState(base.comment);
  const { save, saving, error } = useEntitySave('digital-contacts');

  function handleSave() {
    const row: DigitalContact = {
      ...base,
      name: name.trim() || 'Untitled contact',
      mode,
      digitalId: parseOptionalInt(digitalId) ?? 0,
      comment,
    };
    void save(() => persistence.putDigitalContact(row, entity ? entity.revision : null));
  }

  return (
    <div style={{ maxWidth: 460 }}>
      <FieldRow label="Name">
        <input style={controlStyle} value={name} onChange={(e) => setName(e.target.value)} />
      </FieldRow>
      <FieldRow label="Mode">
        <DigitalModeSelect value={mode} onChange={setMode} />
      </FieldRow>
      <FieldRow label="Contact ID">
        <input
          style={controlStyle}
          value={digitalId}
          onChange={(e) => setDigitalId(e.target.value)}
        />
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
