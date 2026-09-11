# United Kingdom — public service channel research findings

## Coverage summary

National coverage was feasible for two families of allocations that are published as **UK-wide** plans rather than per-brigade licences:

1. **UK Fire and Rescue Service fireground (UHF 450–470 MHz)** — the National Fire Chiefs Council (NFCC) *Fireground Radios Guidance* publishes an eight-channel analogue plan and a matching digital (DMR Tier II) plan on the same frequencies. London Fire Brigade procurement papers confirm that National Operational Guidance recommends dual-mode (analogue + digital) radios. Ofcom’s *Frequencies for emergency services in the UK* table independently lists the UHF segments that contain these spots (including 450–453, 457.0–457.25, 457.475–457.5, 462.5–462.75 and 464.0–466.0625 MHz). Sixteen CSV rows (eight channels × FM + DMR).
2. **HM Coastguard / UK marine VHF safety channels** — Ofcom’s *Frequencies for distress and safety, search and rescue and emergencies in the UK* (19 August 2022) plus Ofcom FOI 01497978 (MCA licences in 136–174 MHz, 20 September 2022) and MCA marine notices. Eleven FM rows: international Ch 16/67/73/10/6/13, two UK-only simplex centres (156.000 and 160.600 MHz), and Ch 62/63/64 recorded on the **coast-station transmit** leg used for Maritime Safety Information.

One additional **RNLI** working channel (157.550 MHz, “Channel 31”) is taken from Ofcom’s auxiliary SAR table.

Overall confidence is high for fireground frequencies/modes and for the marine voice channels that Ofcom names with an ITU channel number. Colour codes and timeslots on the DMR fireground rows come from the NFCC “UK Fire service standard DMR Tier II code plug” appendix; the PDF extract is tabular and slightly noisy, but Ch 2 and Ch 5 explicitly show colour codes 2 and 5 with timeslot 1, and the remaining digital channels follow the same one-code-per-channel pattern. Talkgroup/group ID 901 is documented there but was **not** written into `talkgroup_id` (promiscuous monitoring).

## Services found to be fully encrypted

| Service | System | Why it is a dead end | Source |
| --- | --- | --- | --- |
| UK police, fire and ambulance **main-scheme** operational radio (England, Scotland, Wales) | **Airwave** TETRA | Ofcom states the Airwave service is not a publicly available service. Use of terminals requires a **TEA2** (TETRA Encryption Algorithm 2) sub-licence from the Home Office Airwave Accreditation Secretariat. | [Ofcom Emergency services](https://www.ofcom.org.uk/spectrum/radio-equipment/emergency-services); [Airwave Sharers List Process (PDF)](https://www.ofcom.org.uk/siteassets/resources/documents/manage-your-licence/business-radio/airwave-emergency-services/airwave-sharers-list-process.pdf?v=335390) |
| Successor to Airwave | **Emergency Services Network (ESN)** | Home Office / ESMCP 4G/5G critical communications overlay on a commercial mobile network; Ofcom describes it as the next-generation service for England, Scotland and Wales. Not an unencrypted analogue/DMR voice allocation. | Same Ofcom emergency-services page (updated 23 June 2025); parliamentary written answer on ESMCP transition (target Airwave shutdown 31 December 2029): https://questions-statements.parliament.uk/written-questions/detail/2026-02-04/110903/ |

No Airwave or ESN talkgroups, TETRA carriers, or 380–395 / 410–412 / 420–422 MHz emergency-service blocks were recorded as channels. Ofcom’s emergency-services frequency table lists those UHF TETRA-range blocks without labelling them as clear-speech assignments.

**Fireground is the exception, not the main scheme:** NFCC guidance states that although DMR can support encryption, “regulations require that transmissions are in clear speech (i.e. not encrypted).” That is why fireground rows have `encryption=none`.

Northern Ireland uses the same national fireground UHF plan in the NFCC document (UK-wide, not geographically assigned). Airwave/ESN remarks above follow Ofcom’s England/Scotland/Wales wording for ESN; NI main-scheme detail was not separately evidenced.

## Regions or services not covered

- **Individual English (≈44) and Welsh (3) fire and rescue services, and SFRS site-specific extra licences.** The national fireground eight-channel set is UK-wide; extra “service defined” use of Ch 7 or additional Ofcom business-radio assignments (for example an SFRS technically assigned licence around 462.1–462.3 MHz reported only via scanner-hobbyist discussion of the Wireless Telegraphy Register) were **not** taken from a retrieved official schedule, so they are omitted. SFRS does not need a separate fireground table: it uses the national plan.
- **England/Wales mountain rescue, cave rescue, lowland search teams as named channel lists.** Ofcom publishes **assignments**, not team-by-team channel cards:
  - 86.30625–86.31875 MHz — “UK - Land Search & Rescue” (one 12.5 kHz-wide assignment; centre would be 86.3125 MHz).
  - 155.34375–155.35625 MHz — “Land Search & Rescue – Scotland only” (one 12.5 kHz assignment; centre would be 155.3500 MHz).
  - 158.65 MHz — “Land SAR - Scotland” (spot; channel width not stated).
  - Wider MCA land-SAR management ranges (147.34375–147.49375 MHz, 155.7750–155.9625 MHz, 155.9625–155.9875 MHz) are **bands**, not enumerated channels.

  No CSV rows were emitted for these: Ofcom does not state analogue-FM vs DMR, CTCSS, or encryption. Interpolating 12.5 kHz steps across the wider MCA ranges is forbidden. Scottish Mountain Rescue’s Ofcom EMF consultation response only confirms typical operation “at 155 MHz”, not a channel plan.

- **Polycon** helicopter winch UHF (Ofcom: 408.9625–409.2625 and 418.9875–419.2875 MHz) — ranges, not channels; aircraft crew safety system; omitted.
- **BA telemetry** 469.900 MHz — NFCC lists it as telemetry, not voice; omitted.
- **Historic VHF 80 MHz fireground** — NFCC: no longer licensed; using it is described as illegal. Omitted (`historic` would still be a frequency we should not encourage).
- **Ambulance / HEMS air-ground** — no unencrypted published voice plan found; ambulance operational voice is on Airwave/ESN.
- **Police** — Airwave/ESN only for operational voice in the sources consulted.
- **Aeronautical distress 121.5 / 123.1 MHz** — AM; out of schema (`mode` is `fm` or `dmr` only).
- **Marine Ch 70 (DSC), AIS1/AIS2** — not FM voice.
- **RNLI crew paging 153.075 MHz** — Ofcom: paging, not documented as FM voice.
- **Simple UK / Business Radio light shared channels** — nationally licensed PMR pools, not statutory-service allocations; skipped as low priority.
- **Utilities, highways, transport** — not pursued beyond a quick check; no easy official channel card found.

## Source conflicts

- **Fireground duplex programming direction.** The Ofcom licence extract in the NFCC PDF lists some pairs as Tx 457.0875 / Rx 462.5875, while the **channel plan** (mobile-oriented) lists portable repeaters as Tx 462.5875 / Rx 457.0875. The CSV follows the **channel plan and DMR codeplug** (mobile receive = 457.0875 / 457.1375) so a receive-only memory hears the repeater output / what handhelds hear. The other leg is in `duplex_partner_hz` only.
- **Hobbyist DMR colour-code tables** (scanner wikis / forums) match the NFCC codeplug (CC = channel number, TS1, TG 901). Those sites were not used as citations; the NFCC PDF is the source. No conflict that required `confidence=low`.
- **156.000 vs 160.600 MHz.** Ofcom lists both as “HMCG SAR on the UK coast”; the MCA FOI lists both as separate UK simplex centres. They were **not** paired as duplex.
- **Grenfell Inquiry PDF URL.** `assets.grenfelltowerinquiry.org.uk/...` currently **HTTP 301** to the UK Government Web Archive copy (snapshot 20250319155650). Content was retrieved (NFCC document; download banner 9 November 2020). Cite the Inquiry URL as the exhibit identifier; expect the archive redirect.

## Legal context

Factual pointers only — not an opinion on whether receive-only memories are lawful.

- Wireless telegraphy licences for FRS UHF fireground use are issued by Ofcom under **section 8 of the Wireless Telegraphy Act 2006**. NFCC *Fireground Radios Guidance* and London Fire Brigade LFC-0481 both state this. See also the Act: https://www.legislation.gov.uk/ukpga/2006/36/contents
- **Section 48** of the Wireless Telegraphy Act 2006 (Interception and disclosure of messages) provides that a person commits an offence if, without lawful authority, they use wireless telegraphy apparatus with intent to obtain information as to the contents, sender or addressee of a message of which they are not an intended recipient, or disclose such information. Liability on summary conviction is a fine not exceeding level 5 on the standard scale. Text: https://www.legislation.gov.uk/ukpga/2006/36/section/48
- Marine VHF in UK waters is additionally framed by the **ITU Radio Regulations** and MCA **MGN 324 (M+F) Amendment 2** (Channel 16 / 70 misuse; ship radio operator certification). That notice is about **use of marine VHF transmitters**, not a reception statute.
- Ofcom IR 2026 requires maritime VHF equipment to follow ITU RR Appendix 18 channel arrangements (and to disable unlicensed channels on the transmitter).

## Open questions for a human

1. **Should dual-mode fireground ship with DMR as `is_primary_mode`?** NFCC’s digital plan (2017 review) and LFB NOG procurement treat digital as the direction of travel, with analogue kept for interoperability. Some brigades may still be analogue-primary. Switching the primary flag is a product choice, not a frequency dispute.
2. **Should DMR colour codes / timeslot 1 ship?** They are in the NFCC standard codeplug. Leaving them blank would still allow promiscuous decode on some radios; filling them matches the published interoperability plug. Group ID 901 was deliberately omitted from `talkgroup_id`.
3. **Wireless Telegraphy Act 2006 s.48** sits next to a feature that adds receive-only memories for fireground and (non-distress) working channels. Product/legal review should decide whether the in-app copy must point at s.48 (and marine watchkeeping rules) before this dataset is offered to operators.
4. **Land SAR spots** (86.3125 MHz centre, 155.350 MHz Scotland centre, 158.65 MHz) are regulator-published but lack mode/encryption. A later pass could add them if an official mountain-rescue handbook states FM and clear speech.
5. **Whether to include marine Ch 16 / MSI duplex channels** in a ham 2 m-adjacent preset list: they are nationally allocated and unencrypted, but they are the distress/calling and safety-information system, not “incidental monitoring near 144–146 MHz” in the same sense as 155 MHz land SAR.
6. **Live NFCC URL.** Current NFCC Operational Guidance on nationalfirechiefs.org.uk is login-gated. The Grenfell exhibit is the freely retrieved full text; a human may prefer a current UKFRS download if one is published without login.
