import type { ChannelModeProfile, ChannelTone, Library } from '@core/models/library.ts';
import { entityRefDisplayName } from '../../../lib/entityRefs.ts';

export interface ChannelFact {
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
  label: string,
  value: string | number | null | undefined,
  mono = false,
) {
  if (value == null) return;
  const text = String(value).trim();
  if (!text) return;
  facts.push(mono ? { label, value: text, mono } : { label, value: text });
}

function ownIdName(library: Library, id: string | null): string | null {
  if (!id) return null;
  const row = library.ownDigitalIds.find((r) => r.id === id);
  if (!row) return null;
  return row.name.trim() ? `${row.name} (${row.number})` : String(row.number);
}

/**
 * Read-only facts for one mode profile on the channel view page. Only fields that are set are
 * returned — the view hides what the editor shows as empty inputs. The RX group list is not a
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
        if (rx === tx) push(facts, 'Tone', rx, true);
        else {
          push(facts, 'TX tone', tx, true);
          push(facts, 'RX tone', rx, true);
        }
      }
      if (profile.mode === 'ssb')
        push(facts, 'Sideband', (profile.ssbSideband ?? 'usb').toUpperCase());
      if (profile.bandwidthKHz != null) push(facts, 'Bandwidth', `${profile.bandwidthKHz} kHz`);
      if (profile.squelch != null) push(facts, 'Squelch', `${profile.squelch}%`);
      break;
    }
    case 'dmr':
      push(facts, 'Colour code', profile.colourCode, true);
      push(facts, 'Timeslot', profile.timeslot != null ? `TS${profile.timeslot}` : null);
      push(facts, 'Talk group', entityRefDisplayName(profile.contactRef, library));
      push(
        facts,
        'DMR mode',
        profile.dmrMode === 'repeater'
          ? 'Repeater'
          : profile.dmrMode === 'dmo-simplex'
            ? 'Simplex'
            : null,
      );
      push(facts, 'Your ID', ownIdName(library, profile.ownDigitalIdId));
      break;
    case 'dstar':
      push(facts, 'UR', profile.urCall, true);
      push(facts, 'RPT1', profile.rpt1Call, true);
      push(facts, 'RPT2', profile.rpt2Call, true);
      break;
    case 'ysf':
      push(facts, 'DG-ID', profile.dgId, true);
      push(facts, 'WIRES-X ID', profile.wiresDtmfId, true);
      break;
    case 'nxdn':
      if (profile.rxRan != null && profile.rxRan === profile.txRan)
        push(facts, 'RAN', profile.rxRan, true);
      else {
        push(facts, 'TX RAN', profile.txRan, true);
        push(facts, 'RX RAN', profile.rxRan, true);
      }
      push(facts, 'Talk group', entityRefDisplayName(profile.contactRef, library));
      push(
        facts,
        'Rate',
        profile.nxdnRate === 'nxdn48' ? 'NXDN48' : profile.nxdnRate === 'nxdn96' ? 'NXDN96' : null,
      );
      push(facts, 'Your ID', ownIdName(library, profile.ownDigitalIdId));
      break;
    case 'tetra':
      push(facts, 'MCC', profile.mcc, true);
      push(facts, 'MNC', profile.mnc, true);
      push(facts, 'GSSI', profile.gssi, true);
      push(facts, 'Colour code', profile.colorCode, true);
      push(facts, 'Talk group', entityRefDisplayName(profile.talkGroupRef, library));
      break;
    case 'p25':
    case 'm17':
      break;
  }
  return facts;
}

/** The profile's RX group list id, for modes that have one (DMR, NXDN). */
export function modeProfileRxGroupListId(profile: ChannelModeProfile): string | null {
  if (profile.mode === 'dmr' || profile.mode === 'nxdn') return profile.rxGroupListId ?? null;
  return null;
}
