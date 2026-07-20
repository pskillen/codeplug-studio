/** NeonPlug `codeplug.json` wire shapes — import/export boundary only. */

export type NeonplugChannelMode = 'Analog' | 'Digital' | 'Fixed Analog' | 'Fixed Digital';
export type NeonplugBandwidth = '12.5kHz' | '25kHz';
export type NeonplugPowerLevel = 'Low' | 'Medium' | 'High';
export type NeonplugAprsReportMode = 'Off' | 'Digital' | 'Analog';
export type NeonplugRxSquelchMode = 'Carrier/CTC' | 'Optional' | 'CTC&Opt' | 'CTC|Opt';
export type NeonplugSignalingType = 'None' | 'DTMF' | 'Two Tone' | 'Five Tone' | 'MDC1200';
export type NeonplugPttIdType = 'Off' | 'BOT' | 'EOT' | 'Both';

export interface NeonplugCtcssDcs {
  type: 'CTCSS' | 'DCS' | 'None';
  value?: number;
  polarity?: 'N' | 'P';
}

/** Shared Channel object NeonPlug uses across radios. */
export interface NeonplugChannel {
  number: number;
  name: string;
  rxFrequency: number;
  txFrequency: number;
  mode: NeonplugChannelMode;
  forbidTx: boolean;
  loneWorker: boolean;
  bandwidth: NeonplugBandwidth;
  scanAdd: boolean;
  scanListId: number;
  forbidTalkaround: boolean;
  unknown1A_6_4: number;
  unknown1A_3: boolean;
  aprsReceive: boolean;
  emergencyIndicator: boolean;
  emergencyAck: boolean;
  emergencySystemId: number;
  digitalEmergencySystemId: number;
  power: NeonplugPowerLevel;
  aprsReportMode: NeonplugAprsReportMode;
  unknown1C_1_0: number;
  voxFunction: boolean;
  scramble: boolean;
  compander: boolean;
  talkback: boolean;
  unknown1D_3_0: number;
  squelchLevel: number;
  pttIdDisplay: boolean;
  pttId: number;
  colorCode: number;
  rxCtcssDcs: NeonplugCtcssDcs;
  txCtcssDcs: NeonplugCtcssDcs;
  unknown25_7_6: number;
  companderDup: boolean;
  voxRelated: boolean;
  unknown25_3_0: number;
  pttIdDisplay2: boolean;
  rxSquelchMode: NeonplugRxSquelchMode;
  unknown26_3_1: number;
  unknown26_0: boolean;
  stepFrequency: number;
  signalingType: NeonplugSignalingType;
  pttIdType: NeonplugPttIdType;
  unknown29_3_2: number;
  unknown29_1_0: number;
  unknown2A: number;
  dmrRadioIdIndex: number;
  contactId: number;
  /** Digital-only fields — present when mode is Digital / Fixed Digital. */
  rxGroupListId?: number;
  slotOperation?: number;
  encryption?: boolean;
  encryptionId?: number;
  tdmaDirectMode?: boolean;
  shortDataConfirm?: boolean;
  privateConfirm?: boolean;
}

export interface NeonplugRadioInfo {
  model: string;
  firmware?: string;
  buildDate?: string;
  dspVersion?: string;
  radioVersion?: string;
  codeplugVersion?: string;
  maxContacts?: number;
  memoryLayout?: { configStart: number; configEnd: number };
  vframes?: Record<string, never>;
}

/** Top-level `codeplug.json` envelope (channels-first slice; sibling arrays empty until #540). */
export interface NeonplugCodeplugData {
  version: string;
  exportDate: string;
  channels: NeonplugChannel[];
  zones: unknown[];
  scanLists: unknown[];
  contacts: unknown[];
  rxGroups: unknown[];
  radioIds: unknown[];
  quickContacts: unknown[];
  messages: unknown[];
  digitalEmergencies: unknown[];
  analogEmergencies: unknown[];
  encryptionKeys: unknown[];
  digitalEmergencyConfig: null;
  radioSettings: null;
  radioInfo: NeonplugRadioInfo;
}
