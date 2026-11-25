import type { ChannelModeProfile, ChannelTone, Library } from '@core/models/library.ts';
import { entityRefDisplayName } from '../../../lib/entityRefs.ts';

export interface ChannelFact {
  key: string;
  label: string;
  value: string;
  /** Render in the monospace face (identifiers, tones, codes). */
  mono?: boolean;
}

function tone(value: ChannelTone | undefined): string | null {
  return value && value !== 'none' ? value : null;
}

function push(
  facts: ChannelFact[],
  key: string,
  label: string,
  value: string | number | null | undefined,
  mono = false,
) {
  if (value == null) return;
  const text = String(value).trim();
  if (!text) return;
  facts.push(mono ? { key, label, value: text, mono } : { key, label, value: text });
}

function ownIdName(library: Library, id: string | null): string | null {
  if (!id) return null;
  const row = library.ownDigitalIds.find((r) => r.id === id);
  if (!row || row.protocol === 'm17') return null;
  return row.name.trim() ? `${row.name} (${row.number})` : String(row.number);
}

/**
 * Read-only facts for one mode profile on the channel view page. Only fields that are set are
 * returned, with effective defaults shown where they describe how the channel operates. The RX group list is not a
 * fact: the view summarises it separately (`RxGroupListBrief`).
 */
export function modeProfileFacts(profile: ChannelModeProfile, library: Library): ChannelFact[] {
  const facts: ChannelFact[] = [];
  switch (profile.mode) {
    case 'fm':
    case 'am':
    case 'ssb': {
      const rx = tone(profile.rxTone);
      const tx = tone(profile.txTone);
      if (rx || tx) {
        if (rx === tx) push(facts, 'tone', 'Tone', rx, true);
        else {
          push(facts, 'txTone', 'TX tone', tx, true);
          push(facts, 'rxTone', 'RX tone', rx, true);
        }
      }
      if (profile.mode === 'ssb')
        push(facts, 'sideband', 'Sideband', (profile.ssbSideband ?? 'usb').toUpperCase());
      if (profile.bandwidthKHz != null)
        push(facts, 'bandwidth', 'Bandwidth', `${profile.bandwidthKHz} kHz`);
      if (profile.squelch != null) push(facts, 'squelch', 'Squelch', `${profile.squelch}%`);
      break;
    }
    case 'dmr':
      push(facts, 'colourCode', 'Colour code', profile.colourCode, true);
      push(
        facts,
        'timeslot',
        'Timeslot',
        profile.timeslot != null ? `TS${profile.timeslot}` : null,
      );
      push(facts, 'talkGroup', 'Talk group', entityRefDisplayName(profile.contactRef, library));
      push(
        facts,
        'dmrMode',
        'DMR mode',
        profile.dmrMode === 'repeater'
          ? 'Repeater'
          : profile.dmrMode === 'dmo-simplex'
            ? 'Simplex'
            : null,
      );
      push(facts, 'ownId', 'Your ID', ownIdName(library, profile.ownDigitalIdId));
      if (profile.sendTalkerAlias === 'on') push(facts, 'talkerAlias', 'Talker alias', 'On');
      if (profile.sendTalkerAlias === 'off') push(facts, 'talkerAlias', 'Talker alias', 'Off');
      break;
    case 'dstar':
      push(facts, 'ur', 'UR', profile.urCall, true);
      push(facts, 'rpt1', 'RPT1', profile.rpt1Call, true);
      push(facts, 'rpt2', 'RPT2', profile.rpt2Call, true);
      break;
    case 'ysf':
      push(facts, 'dgId', 'DG-ID', profile.dgId, true);
      push(facts, 'wiresId', 'WIRES-X ID', profile.wiresDtmfId, true);
      break;
    case 'nxdn':
      if (profile.rxRan != null && profile.rxRan === profile.txRan)
        push(facts, 'ran', 'RAN', profile.rxRan, true);
      else {
        push(facts, 'txRan', 'TX RAN', profile.txRan, true);
        push(facts, 'rxRan', 'RX RAN', profile.rxRan, true);
      }
      push(facts, 'talkGroup', 'Talk group', entityRefDisplayName(profile.contactRef, library));
      push(
        facts,
        'rate',
        'Rate',
        profile.nxdnRate === 'nxdn48' ? 'NXDN48' : profile.nxdnRate === 'nxdn96' ? 'NXDN96' : null,
      );
      push(facts, 'ownId', 'Your ID', ownIdName(library, profile.ownDigitalIdId));
      break;
    case 'tetra':
      push(facts, 'mcc', 'MCC', profile.mcc, true);
      push(facts, 'mnc', 'MNC', profile.mnc, true);
      push(facts, 'gssi', 'GSSI', profile.gssi, true);
      push(facts, 'colourCode', 'Colour code', profile.colorCode, true);
      push(facts, 'talkGroup', 'Talk group', entityRefDisplayName(profile.talkGroupRef, library));
      break;
    case 'm17':
      push(facts, 'can', 'CAN', profile.can ?? 0, true);
      push(facts, 'destination', 'Destination', profile.destination || 'ALL', true);
      push(facts, 'listen', 'Listen', profile.playEveryCan ? 'Every CAN' : 'This CAN only');
      break;
    case 'p25':
      break;
  }
  return facts;
}

/** The profile's RX group list id, for modes that have one (DMR, NXDN). */
export function modeProfileRxGroupListId(profile: ChannelModeProfile): string | null {
  if (profile.mode === 'dmr' || profile.mode === 'nxdn') return profile.rxGroupListId ?? null;
  return null;
}
