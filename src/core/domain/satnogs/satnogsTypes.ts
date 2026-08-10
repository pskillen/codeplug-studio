/**
 * Raw SatNOGS DB `/api/transmitters/` record shape (wire format), pre-mapping. Field names
 * mirror upstream JSON verbatim — see docs/reference/remote-directories/satnogs/README.md.
 */
export interface SatnogsTransmitterRaw {
  uuid: string;
  description: string | null;
  mode: string | null;
  /** Downlink centre frequency in Hz, or null when unspecified/drifting. */
  downlink_low: number | null;
  /** Uplink centre frequency in Hz, or null when this transmitter has no uplink. */
  uplink_low: number | null;
  alive: boolean;
  status: string | null;
  norad_cat_id: number;
}
