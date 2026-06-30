import { useState } from 'react';
import type {
  Channel,
  ChannelModeProfileDMR,
  ChannelModeProfileFM,
  DMRTimeSlot,
  Library,
} from '@core/models/library.ts';
import { newChannel } from '@core/domain/factories.ts';
import { FieldRow } from '../../components/fields/Fields.tsx';
import { controlStyle } from '../../components/fields/styles.ts';
import { hzToMhzString, mhzStringToHz, parseOptionalInt } from '../../lib/units.ts';
import { persistence } from '../../state/persistence.ts';
import { useEntitySave } from './useEntitySave.ts';
import EditorActions from './EditorActions.tsx';

type Mode = 'fm' | 'dmr';

function firstProfileMode(channel: Channel | null): Mode {
  return channel?.modeProfiles[0]?.mode === 'dmr' ? 'dmr' : 'fm';
}

export default function ChannelEditor({
  projectId,
  entity,
  library,
}: {
  projectId: string;
  entity: Channel | null;
  library: Library;
}) {
  const base = entity ?? newChannel(projectId, '');
  const fm =
    (entity?.modeProfiles.find((p) => p.mode !== 'dmr') as ChannelModeProfileFM | undefined) ??
    null;
  const dmr =
    (entity?.modeProfiles.find((p) => p.mode === 'dmr') as ChannelModeProfileDMR | undefined) ??
    null;

  const [name, setName] = useState(base.name);
  const [callsign, setCallsign] = useState(base.callsign);
  const [rx, setRx] = useState(hzToMhzString(base.rxFrequency));
  const [tx, setTx] = useState(hzToMhzString(base.txFrequency));
  const [power, setPower] = useState(base.power === null ? '' : String(base.power));
  const [scanSkip, setScanSkip] = useState(base.scanSkip);
  const [comment, setComment] = useState(base.comment);

  const [mode, setMode] = useState<Mode>(firstProfileMode(entity));
  // FM fields
  const [squelch, setSquelch] = useState(fm?.squelch == null ? '' : String(fm.squelch));
  const [rxTone, setRxTone] = useState(fm?.rxTone ?? 'none');
  const [txTone, setTxTone] = useState(fm?.txTone ?? 'none');
  // DMR fields
  const [colourCode, setColourCode] = useState(
    dmr?.colourCode == null ? '' : String(dmr.colourCode),
  );
  const [timeslot, setTimeslot] = useState<string>(dmr?.timeslot ? String(dmr.timeslot) : '');
  const [dmrId, setDmrId] = useState(dmr?.dmrId == null ? '' : String(dmr.dmrId));
  const [contactId, setContactId] = useState(
    dmr?.contactRef?.kind === 'digitalContact' ? dmr.contactRef.id : '',
  );
  const [rxGroupListId, setRxGroupListId] = useState(dmr?.rxGroupListId ?? '');

  const { save, saving, error } = useEntitySave();

  function buildRow(): Channel {
    const profile: ChannelModeProfileFM | ChannelModeProfileDMR =
      mode === 'fm'
        ? { mode: 'fm', squelch: parseOptionalInt(squelch), rxTone, txTone }
        : {
            mode: 'dmr',
            colourCode: parseOptionalInt(colourCode),
            timeslot: timeslot === '' ? null : (Number(timeslot) as DMRTimeSlot),
            dmrId: parseOptionalInt(dmrId),
            contactRef: contactId ? { kind: 'digitalContact', id: contactId } : null,
            rxGroupListId: rxGroupListId || null,
          };
    return {
      ...base,
      name: name.trim() || 'Untitled channel',
      callsign,
      rxFrequency: mhzStringToHz(rx),
      txFrequency: mhzStringToHz(tx),
      power: parseOptionalInt(power),
      scanSkip,
      comment,
      modeProfiles: [profile],
    };
  }

  function handleSave() {
    const row = buildRow();
    void save(() => persistence.putChannel(row, entity ? entity.revision : null));
  }

  return (
    <div style={{ maxWidth: 460 }}>
      <FieldRow label="Name">
        <input style={controlStyle} value={name} onChange={(e) => setName(e.target.value)} />
      </FieldRow>
      <FieldRow label="Callsign">
        <input
          style={controlStyle}
          value={callsign}
          onChange={(e) => setCallsign(e.target.value)}
        />
      </FieldRow>
      <FieldRow label="RX frequency (MHz)">
        <input style={controlStyle} value={rx} onChange={(e) => setRx(e.target.value)} />
      </FieldRow>
      <FieldRow label="TX frequency (MHz)">
        <input style={controlStyle} value={tx} onChange={(e) => setTx(e.target.value)} />
      </FieldRow>
      <FieldRow label="Power (%)" hint="Blank = radio default">
        <input style={controlStyle} value={power} onChange={(e) => setPower(e.target.value)} />
      </FieldRow>
      <FieldRow label="Comment">
        <input style={controlStyle} value={comment} onChange={(e) => setComment(e.target.value)} />
      </FieldRow>
      <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', margin: '0.6rem 0' }}>
        <input type="checkbox" checked={scanSkip} onChange={(e) => setScanSkip(e.target.checked)} />
        <span style={{ fontSize: '0.85rem' }}>Skip on scan</span>
      </label>

      <FieldRow label="Mode">
        <select style={controlStyle} value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
          <option value="fm">FM (analogue)</option>
          <option value="dmr">DMR (digital)</option>
        </select>
      </FieldRow>

      {mode === 'fm' ? (
        <>
          <FieldRow label="Squelch" hint="Blank = default">
            <input
              style={controlStyle}
              value={squelch}
              onChange={(e) => setSquelch(e.target.value)}
            />
          </FieldRow>
          <FieldRow label="RX tone">
            <input
              style={controlStyle}
              value={rxTone}
              onChange={(e) => setRxTone(e.target.value)}
            />
          </FieldRow>
          <FieldRow label="TX tone">
            <input
              style={controlStyle}
              value={txTone}
              onChange={(e) => setTxTone(e.target.value)}
            />
          </FieldRow>
        </>
      ) : (
        <>
          <FieldRow label="Colour code">
            <input
              style={controlStyle}
              value={colourCode}
              onChange={(e) => setColourCode(e.target.value)}
            />
          </FieldRow>
          <FieldRow label="Timeslot">
            <select
              style={controlStyle}
              value={timeslot}
              onChange={(e) => setTimeslot(e.target.value)}
            >
              <option value="">—</option>
              <option value="1">1</option>
              <option value="2">2</option>
            </select>
          </FieldRow>
          <FieldRow label="DMR ID">
            <input style={controlStyle} value={dmrId} onChange={(e) => setDmrId(e.target.value)} />
          </FieldRow>
          <FieldRow label="Digital contact" hint="UUID reference">
            <select
              style={controlStyle}
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
            >
              <option value="">— none —</option>
              {library.digitalContacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FieldRow>
          <FieldRow label="RX group list" hint="UUID reference">
            <select
              style={controlStyle}
              value={rxGroupListId}
              onChange={(e) => setRxGroupListId(e.target.value)}
            >
              <option value="">— none —</option>
              {library.rxGroupLists.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </FieldRow>
        </>
      )}

      <EditorActions saving={saving} error={error} onSave={handleSave} />
    </div>
  );
}
