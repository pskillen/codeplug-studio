# Ireland — public service channel research findings

Republic of Ireland only (ISO 3166-1 alpha-2: IE). Northern Ireland is part of the United Kingdom and is out of scope. No UK fireground, Airwave, or Ofcom channel was used as evidence of an Irish assignment.

## Coverage summary

The honest picture is that **almost nothing used by Irish statutory emergency services is monitorable analogue FM**. Fire, ambulance, Garda, mountain rescue, and agency-to-agency coordination have moved (or are mandated) onto the encrypted TETRA Managed National Digital Radio Service. What remains openly documented and unencrypted is **marine VHF**: Irish Coast Guard public-facing distress/working channels, plus a handful of port VTS/harbour working channels.

`channels.csv` therefore contains **18 rows**, all analogue FM, all `encryption=none`:

| Group                                                                      | Rows | Confidence                   |
| -------------------------------------------------------------------------- | ---- | ---------------------------- |
| Irish Coast Guard distress/safety (Ch 16, Ch 67)                           | 2    | high                         |
| Irish Coast Guard working channels (Ch 01, 02, 03, 04, 05, 61, 62, 63, 64) | 9    | high                         |
| Dublin Port VTS (Ch 12, 13, 09)                                            | 3    | high                         |
| Port of Cork Harbour Radio (Ch 12, 14)                                     | 2    | high                         |
| Shannon Foynes port working (Ch 11, 14)                                    | 2    | medium (2021 official guide) |

No fire, SAR land, ambulance, utility, or DMR rows met the sourcing bar. That is a result, not a gap in effort.

ComReg’s Radio Frequency Plan (ComReg 24/105R1, 18 December 2025) and the interactive RFPI allocate **bands** (maritime mobile around 156–162 MHz; PMR in VHF low/high and UHF 450–470 MHz; emergency digital radio 380–395 MHz). They do **not** publish a national fireground channel plan or named incident-ground simplex frequencies. Band tables were not converted into channel rows.

## Services found to be fully encrypted

These are dead ends for receive-only memories. Do not re-search them expecting analogue FM channel lists.

1. **Managed National Digital Radio Service (MNDRS / NDRS)** — TETRA, 380.2125–384.9875 MHz paired with 390.2125–394.9875 MHz, licensee Tetra Ireland. ComReg “Emergency Service Digital Radio” page; S.I. 324/2008. TETRA Ireland states air-interface encryption “removes any risk of unauthorised external eavesdropping,” with optional end-to-end encryption. S.I. 324/2008 defines “emergency service” as An Garda Síochána, fire brigade services, ambulance services, boat and coastal rescue (including Air Corps rescue), and mountain and cave rescue.

2. **An Garda Síochána** — primary users of the national TETRA network (TETRA Ireland case material; S.I. 324/2008). Encrypted; no unencrypted Garda channel recorded.

3. **Local-authority fire services** — Kilkenny Fire and Rescue Service Fire and Emergency Operations Plan 2022–2026 (official local-authority consultation document) states migration to the National Digital Radio Service / TETRA platform and continued use of TETRA via the Eastern Regional Communications Centre. National Directorate material from the CAMP programme similarly directed fire services onto NDRS. No published national analogue fireground plan was found. Individual brigades may still hold legacy ComReg business-radio licences; those assignments are not published as a channel plan and were not inferred from the PMR pool.

4. **HSE National Ambulance Service** — operates on the national TETRA/NDRS platform (TETRA Ireland / industry write-ups describing NAS as live on Tetra; S.I. 324/2008 includes ambulance). No unencrypted NAS voice channel recorded. Talkgroup names seen in third-party hospital radio notes were **not** copied (trunked tactical detail is out of scope).

5. **Mountain Rescue Ireland** — TETRA Ireland case study: teams migrated from licensed VHF to NDRS/TETRA for “secure reliable” communications; coverage testing in Wicklow black spots. No current analogue team-common frequency published.

6. **Irish Coast Guard (agency radio, as distinct from marine VHF)** — TETRA Ireland and related material list the Coast Guard among MNDRS users for interoperability with Garda, HSE and fire. That **internal** path is encrypted. Public-facing **marine VHF** (Channels 16, 67, and the working channels in Marine Notice 61 of 2020) remains analogue FM and is what is recorded.

TETRA and GSM-R are out of the CSV schema (`mode` is only `fm` or `dmr`). They are not listed as `encryption=none`.

## Regions or services not covered

**Fire / rescue fireground.** Fire is organised by ~31 local authorities, not a single national fire service. Searches of ComReg publications, gov.ie, county fire-and-emergency operations plans, and FOI-style disclosures did not yield a published list of analogue fireground frequencies. Establishing that absence is the fire result for Ireland.

**Civil Defence.** The organisation states it operates a national VHF wide-area system, on-site UHF, TETRA terminals for interoperability, and marine VHF for water operations. **No frequencies** are published on that page (fetch of `civildefence.ie/services/communications/` returned HTTP 409 at research time; search snippets were treated as leads only). No Civil Defence rows.

**Irish Cave Rescue Organisation (ICRO).** No public frequency list. The organisation operates on the island of Ireland including Northern Ireland; NI data is out of scope. Eligible for MDRS under S.I. 324/2008.

**RNLI (Republic of Ireland stations).** No primary Irish source listing RNLI-private channels was used. RNLI traffic that occurs on marine VHF 16 / Coast Guard working channels is already covered by the IRCG rows.

**Other ports and harbours.** Only Dublin, Cork, and Shannon Foynes had current-enough official notices retrieved. Waterford, Galway, Drogheda, Dun Laoghaire, Killybegs, and others almost certainly use ITU Appendix 18 port-operations channels (often 12/14/16) but were not recorded without an official notice in hand. Do not fill them from marina hobbyist lists.

**PMR / business radio / UHF “a few MHz above 70 cm”.** ComReg business-radio guidance lists **available** PMR bands (VHF low 68–87.5 MHz, VHF high ~163–174 MHz, UHF 450–470 MHz) for licensing. That is a pool, not a named statutory-service assignment. No row was invented from those tables.

**Aeronautical** (HEMS air-ground, military SAR helicopters on AM). Mode `am` is out of schema. Irish Air Corps is also in the S.I. 324 emergency-service definition for digital radio.

**Irish Rail Railway Mobile Radio.** ComReg lists Irish Rail GSM-R in 874.4–879.7 / 919.4–924.7 MHz (licence from 27 November 2025). Dedicated non-public digital railway radio; not unencrypted FM/DMR. Excluded.

**DSC Channel 70** (156.525 MHz). Documented, but digital selective calling only — not FM voice. Excluded.

**Historic IRCG duplex channels** (23, 24, 26, 28, 83, 85, etc.). Replaced in 2020. Not recorded as active. See source conflicts.

## Source conflicts

1. **Irish Coast Guard working channels, 2020 change.** Marine Notices 36 and 44 of 2020 proposed moving several hilltop sites off the old duplex set (e.g. Dublin CH83→CH03, Cork CH26→CH02, Valentia CH24→CH62, Shannon CH28→CH64). Marine Notice 61 of 2020 is the completion notice and is treated as current. Older sailing-club tables, the 2023 Port of Cork information manual (Cork Coastguard “VHF CH 26”), and Shannon Foynes guides listing “Shannon Coastguard Radio Ch 16/24” are **superseded** for Coast Guard working channels. Port VHF 12/14 in those same documents can still be valid.

2. **Shannon Foynes Coast Guard vs port channels.** The 2021 Port Information Guide’s Coast Guard column is stale; port Channels 11 and 14 are still used as documented there, recorded at **medium** confidence because the guide is from 2021.

3. **Hobbyist “British & Irish VHF marine channel” PDFs.** Mix ROI and NI harbours, pre-2020 Coast Guard channels, and no upstream citations. Not used as a source for any row.

4. **ComReg PMR annexes vs fireground.** Listing a 12.5 kHz UHF raster is not evidence that any named Irish fire authority uses a given centre frequency.

No two primary sources disagreed on a frequency that was actually recorded; conflicts were historic-vs-current channel **numbers**.

## Legal context

Factual pointers only; not a legal opinion.

- **Wireless Telegraphy Act 1926, s.3** (as amended): keeping or possessing apparatus for wireless telegraphy in the State requires a licence unless an exemption applies. Irish Statute Book: https://www.irishstatutebook.ie/eli/1926/act/45/section/3/enacted/en/html

- **S.I. No. 197/2005** (as amended by S.I. 292/2005): ComReg exemption for apparatus **only capable of reception** and **inherently incapable of transmission** (not a television set). Article 5 of S.I. 197/2005 states that such apparatus “shall not be used to improperly divulge the purport of any message communication, or signal sent or proposed to be sent by wireless telegraphy.” ComReg’s licence-exemption list points to these instruments under “General Radio Receivers (excluding Television Sets).” https://www.irishstatutebook.ie/eli/2005/si/197

- **Wireless Telegraphy Act 1926, s.11(2)**: “No person shall improperly divulge the purport of any message, communication, or signal sent or proposed to be sent by wireless telegraphy.” s.11(3) provides a misdemeanour penalty. https://www.irishstatutebook.ie/eli/1926/act/45/section/11/enacted/en/html

- **ComReg licensing overview**: possession and use of radio equipment is governed by the 1926 Act; unlicensed or non-compliant possession or use is described as illegal. https://www.comreg.ie/industry/radio-spectrum/licensing/

- Marine VHF **transmit** from a vessel is separately subject to a Ships Radio Licence and operator qualification (Department of Transport maritime radio procedures). This dataset is receive-only by product design.

These are statutory texts and regulator pages, not advice on whether programming a licensed amateur transceiver for receive-only memories is within the receive-only exemption.

## Open questions for a human

1. **Ship this marine-only file, or wait for fire?** There is no defendable Irish fireground list today. Shipping 18 marine/port channels is accurate; adding fire later would need local-authority FOI, not interpolation of ComReg PMR rasters.

2. **Duplex IRCG rows use coast-station transmit as `rx_frequency_hz`.** That matches what a marine radio set to the channel receives from the shore station. A listener wanting ship-side traffic would use `duplex_partner_hz`. Confirm that convention before import.

3. **Shannon Foynes (2021) medium-confidence rows** — keep, drop, or replace if a 2025/2026 SFPC notice is obtained.

4. **Port VTS vs “public service.”** Dublin/Cork/Shannon are statutory harbour authorities, unencrypted, published. Other ports were omitted for lack of retrieved notices, not because they are secret.

5. **Legal product copy.** Counsel should decide what the UI says about listening in Ireland, given s.11(2) and the receive-only exemption’s non-divulgence condition. This file only cites the texts.

6. **Galley Head** is documented as Channel 16 only; no extra working channel was invented.

7. **Lough Foyle** is a trans-boundary lough. Channel 01 is recorded as an Irish Coast Guard (Malin Head) local working channel. A UK agent should not treat that as a PSNI/MCA assignment without a UK source.
