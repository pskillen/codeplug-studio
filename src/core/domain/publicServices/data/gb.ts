/**
 * Generated from scripts/public-services/research/gb/channels.csv.
 * Do not edit by hand; run `node scripts/public-services/csv-to-dataset.mjs`.
 */
import type { PublicServiceCountry } from '../types.ts';

const country: PublicServiceCountry = {
  countryCode: 'GB',
  countryLabel: 'United Kingdom',
  datasetVersion: '2026-09-11',
  groups: [
    {
      groupId: 'gb-ukfrs-fireground',
      label: 'UK FRS national fireground',
      category: 'fire',
      serviceOrg: 'UK Fire and Rescue Services',
      entries: [
        {
          channelId: 'ch-1',
          name: 'UKFRS FG1',
          label: 'UK FRS Fireground 1 General incident',
          rxFrequencyHz: 457037500,
          txFrequencyHz: 457037500,
          modes: [
            {
              mode: 'dmr',
              isPrimary: true,
              colourCode: 1,
              timeslot: 1,
            },
            {
              mode: 'fm',
              isPrimary: false,
              bandwidthKHz: 12.5,
            },
          ],
          status: 'active',
          confidence: 'high',
          source: {
            type: 'official',
            url: 'https://assets.grenfelltowerinquiry.org.uk/CWJ00000114_National%20Operational%20Guidance%20and%20National%20Fire%20Chiefs%20Council%20%27Fireground%20Radios%20Guidance%27.pdf',
            title: 'NFCC Fireground Radios Guidance (Grenfell Inquiry exhibit CWJ00000114)',
            date: '2020-11-09',
            url2: 'https://www.ofcom.org.uk/siteassets/resources/documents/spectrum/spectrum-information/frequency-allocation-table/fat-emergency-services.pdf?v=322548',
          },
          notes:
            'National UK-wide simplex assignment licensed by Ofcom to FRS. NFCC states regulations require clear speech (not encrypted). DMR is the post-2017 recommended primary; analogue remains for interoperability. NFCC standard DMR codeplug uses colour code 1 timeslot 1 and group ID 901 (talkgroup_id left blank for promiscuous monitor use). Original URL 301s to the UK Government Web Archive.',
        },
        {
          channelId: 'ch-2',
          name: 'UKFRS FG2',
          label: 'UK FRS Fireground 2 Portable repeaters',
          rxFrequencyHz: 457087500,
          txFrequencyHz: 462587500,
          modes: [
            {
              mode: 'dmr',
              isPrimary: true,
              colourCode: 2,
              timeslot: 1,
            },
            {
              mode: 'fm',
              isPrimary: false,
              bandwidthKHz: 12.5,
            },
          ],
          status: 'active',
          confidence: 'high',
          source: {
            type: 'official',
            url: 'https://assets.grenfelltowerinquiry.org.uk/CWJ00000114_National%20Operational%20Guidance%20and%20National%20Fire%20Chiefs%20Council%20%27Fireground%20Radios%20Guidance%27.pdf',
            title: 'NFCC Fireground Radios Guidance (Grenfell Inquiry exhibit CWJ00000114)',
            date: '2020-11-09',
            url2: 'https://www.ofcom.org.uk/siteassets/resources/documents/spectrum/spectrum-information/frequency-allocation-table/fat-emergency-services.pdf?v=322548',
          },
          notes:
            'Portable-repeater (half-duplex) assignment. rx_frequency_hz is the mobile receive / repeater-output leg; tx_frequency_hz is the mobile transmit leg. NFCC standard DMR codeplug: colour code 2 timeslot 1.',
        },
        {
          channelId: 'ch-3',
          name: 'UKFRS FG3',
          label: 'UK FRS Fireground 3 Breathing apparatus',
          rxFrequencyHz: 457487500,
          txFrequencyHz: 457487500,
          modes: [
            {
              mode: 'dmr',
              isPrimary: true,
              colourCode: 3,
              timeslot: 1,
            },
            {
              mode: 'fm',
              isPrimary: false,
              bandwidthKHz: 12.5,
            },
          ],
          status: 'active',
          confidence: 'high',
          source: {
            type: 'official',
            url: 'https://assets.grenfelltowerinquiry.org.uk/CWJ00000114_National%20Operational%20Guidance%20and%20National%20Fire%20Chiefs%20Council%20%27Fireground%20Radios%20Guidance%27.pdf',
            title: 'NFCC Fireground Radios Guidance (Grenfell Inquiry exhibit CWJ00000114)',
            date: '2020-11-09',
            url2: 'https://www.ofcom.org.uk/siteassets/resources/documents/spectrum/spectrum-information/frequency-allocation-table/fat-emergency-services.pdf?v=322548',
          },
          notes:
            'National simplex BA communications channel. Distinct from the BA telemetry assignment at 469.900 MHz which is not voice and is not recorded here.',
        },
        {
          channelId: 'ch-4',
          name: 'UKFRS FG4',
          label: 'UK FRS Fireground 4 Command support',
          rxFrequencyHz: 457187500,
          txFrequencyHz: 457187500,
          modes: [
            {
              mode: 'dmr',
              isPrimary: true,
              colourCode: 4,
              timeslot: 1,
            },
            {
              mode: 'fm',
              isPrimary: false,
              bandwidthKHz: 12.5,
            },
          ],
          status: 'active',
          confidence: 'high',
          source: {
            type: 'official',
            url: 'https://assets.grenfelltowerinquiry.org.uk/CWJ00000114_National%20Operational%20Guidance%20and%20National%20Fire%20Chiefs%20Council%20%27Fireground%20Radios%20Guidance%27.pdf',
            title: 'NFCC Fireground Radios Guidance (Grenfell Inquiry exhibit CWJ00000114)',
            date: '2020-11-09',
            url2: 'https://www.ofcom.org.uk/siteassets/resources/documents/spectrum/spectrum-information/frequency-allocation-table/fat-emergency-services.pdf?v=322548',
          },
          notes:
            'National simplex command-support channel. NFCC standard DMR codeplug: colour code 4 timeslot 1.',
        },
        {
          channelId: 'ch-5',
          name: 'UKFRS FG5',
          label: 'UK FRS Fireground 5 Fixed site repeaters',
          rxFrequencyHz: 457137500,
          txFrequencyHz: 462637500,
          modes: [
            {
              mode: 'dmr',
              isPrimary: true,
              colourCode: 5,
              timeslot: 1,
            },
            {
              mode: 'fm',
              isPrimary: false,
              bandwidthKHz: 12.5,
            },
          ],
          status: 'active',
          confidence: 'high',
          source: {
            type: 'official',
            url: 'https://assets.grenfelltowerinquiry.org.uk/CWJ00000114_National%20Operational%20Guidance%20and%20National%20Fire%20Chiefs%20Council%20%27Fireground%20Radios%20Guidance%27.pdf',
            title: 'NFCC Fireground Radios Guidance (Grenfell Inquiry exhibit CWJ00000114)',
            date: '2020-11-09',
            url2: 'https://www.ofcom.org.uk/siteassets/resources/documents/spectrum/spectrum-information/frequency-allocation-table/fat-emergency-services.pdf?v=322548',
          },
          notes:
            'Fixed-site repeater (half-duplex) assignment. rx_frequency_hz is the mobile receive / repeater-output leg; tx_frequency_hz is the mobile transmit leg. NFCC standard DMR codeplug: colour code 5 timeslot 1.',
        },
        {
          channelId: 'ch-6',
          name: 'UKFRS FG6',
          label: 'UK FRS Fireground 6 BA sector/functional',
          rxFrequencyHz: 457237500,
          txFrequencyHz: 457237500,
          modes: [
            {
              mode: 'dmr',
              isPrimary: true,
              colourCode: 6,
              timeslot: 1,
            },
            {
              mode: 'fm',
              isPrimary: false,
              bandwidthKHz: 12.5,
            },
          ],
          status: 'active',
          confidence: 'high',
          source: {
            type: 'official',
            url: 'https://assets.grenfelltowerinquiry.org.uk/CWJ00000114_National%20Operational%20Guidance%20and%20National%20Fire%20Chiefs%20Council%20%27Fireground%20Radios%20Guidance%27.pdf',
            title: 'NFCC Fireground Radios Guidance (Grenfell Inquiry exhibit CWJ00000114)',
            date: '2020-11-09',
            url2: 'https://www.ofcom.org.uk/siteassets/resources/documents/spectrum/spectrum-information/frequency-allocation-table/fat-emergency-services.pdf?v=322548',
          },
          notes:
            'National simplex BA sector / functional-roles channel. NFCC standard DMR codeplug: colour code 6 timeslot 1.',
        },
        {
          channelId: 'ch-7',
          name: 'UKFRS FG7',
          label: 'UK FRS Fireground 7 Service defined',
          rxFrequencyHz: 450100000,
          txFrequencyHz: 450100000,
          modes: [
            {
              mode: 'dmr',
              isPrimary: true,
              colourCode: 7,
              timeslot: 1,
            },
            {
              mode: 'fm',
              isPrimary: false,
              bandwidthKHz: 12.5,
            },
          ],
          status: 'active',
          confidence: 'high',
          source: {
            type: 'official',
            url: 'https://assets.grenfelltowerinquiry.org.uk/CWJ00000114_National%20Operational%20Guidance%20and%20National%20Fire%20Chiefs%20Council%20%27Fireground%20Radios%20Guidance%27.pdf',
            title: 'NFCC Fireground Radios Guidance (Grenfell Inquiry exhibit CWJ00000114)',
            date: '2020-11-09',
            url2: 'https://www.ofcom.org.uk/siteassets/resources/documents/spectrum/spectrum-information/frequency-allocation-table/fat-emergency-services.pdf?v=322548',
          },
          notes:
            'NFCC lists this as a Home Office-licensed additional frequency used as a service-defined channel. Local meaning of the channel is not nationally fixed.',
        },
        {
          channelId: 'ch-8',
          name: 'UKFRS FG8',
          label: 'UK FRS Fireground 8 Incident defined',
          rxFrequencyHz: 464100000,
          txFrequencyHz: 464100000,
          modes: [
            {
              mode: 'dmr',
              isPrimary: true,
              colourCode: 8,
              timeslot: 1,
            },
            {
              mode: 'fm',
              isPrimary: false,
              bandwidthKHz: 12.5,
            },
          ],
          status: 'active',
          confidence: 'high',
          source: {
            type: 'official',
            url: 'https://assets.grenfelltowerinquiry.org.uk/CWJ00000114_National%20Operational%20Guidance%20and%20National%20Fire%20Chiefs%20Council%20%27Fireground%20Radios%20Guidance%27.pdf',
            title: 'NFCC Fireground Radios Guidance (Grenfell Inquiry exhibit CWJ00000114)',
            date: '2020-11-09',
            url2: 'https://www.ofcom.org.uk/siteassets/resources/documents/spectrum/spectrum-information/frequency-allocation-table/fat-emergency-services.pdf?v=322548',
          },
          notes:
            'NFCC lists this as a Home Office-licensed additional frequency used as an incident-defined channel. Local meaning of the channel is not nationally fixed.',
        },
      ],
    },
    {
      groupId: 'gb-hmcg-distress',
      label: 'HM Coastguard marine distress & safety',
      category: 'maritime',
      serviceOrg: 'Maritime and Coastguard Agency',
      entries: [
        {
          channelId: 'ch-16',
          name: 'HMCG Ch16',
          label: 'HM Coastguard / international distress safety and calling Ch 16',
          rxFrequencyHz: 156800000,
          txFrequencyHz: 156800000,
          modes: [
            {
              mode: 'fm',
              isPrimary: true,
              bandwidthKHz: 25,
            },
          ],
          status: 'active',
          confidence: 'high',
          source: {
            type: 'regulator',
            url: 'https://www.ofcom.org.uk/siteassets/resources/documents/spectrum/spectrum-information/frequency-allocation-table/fat-frequencies-distress-safety.pdf?v=322552',
            title:
              'Ofcom: Frequencies for distress and safety search and rescue and emergencies in the UK',
            date: '2022-08-19',
            url2: 'https://www.gov.uk/government/publications/mgn-324-mf-amendment-2-navigation-watchkeeping-safety-use-of-very-high-frequency-vhf-radio-and-automatic-identification-system-ais/mgn-324-mf-amendment-2',
          },
          notes:
            'ITU Appendix 18 / GMDSS voice distress safety and calling. MCA MGN 324 Amendment 2 states Channel 16 is 156.8 MHz. Analogue FM radiotelephony; unencrypted by design. Channel 70 DSC is not recorded (not FM voice).',
        },
        {
          channelId: 'ch-13',
          name: 'HMCG Ch13',
          label: 'GMDSS navigation-safety / bridge-to-bridge Ch 13',
          rxFrequencyHz: 156650000,
          txFrequencyHz: 156650000,
          modes: [
            {
              mode: 'fm',
              isPrimary: true,
              bandwidthKHz: 25,
            },
          ],
          status: 'active',
          confidence: 'high',
          source: {
            type: 'regulator',
            url: 'https://www.ofcom.org.uk/siteassets/resources/documents/spectrum/spectrum-information/frequency-allocation-table/fat-frequencies-distress-safety.pdf?v=322552',
            title:
              'Ofcom: Frequencies for distress and safety search and rescue and emergencies in the UK',
            date: '2022-08-19',
            url2: 'https://www.gov.uk/government/publications/mgn-324-mf-amendment-2-navigation-watchkeeping-safety-use-of-very-high-frequency-vhf-radio-and-automatic-identification-system-ais/mgn-324-mf-amendment-2',
          },
          notes:
            'Ofcom lists 156.65 MHz for GMDSS ship-to-ship safety-of-navigation. MCA MGN 324 designates Channel 13 worldwide as a navigation-safety channel.',
        },
      ],
    },
    {
      groupId: 'gb-hmcg-sar',
      label: 'HM Coastguard SAR working',
      category: 'maritime',
      serviceOrg: 'Maritime and Coastguard Agency',
      entries: [
        {
          channelId: 'ch-67',
          name: 'HMCG Ch67',
          label: 'HM Coastguard yacht safety / first-reserve SAR Ch 67',
          rxFrequencyHz: 156375000,
          txFrequencyHz: 156375000,
          modes: [
            {
              mode: 'fm',
              isPrimary: true,
              bandwidthKHz: 25,
            },
          ],
          status: 'active',
          confidence: 'high',
          source: {
            type: 'regulator',
            url: 'https://www.ofcom.org.uk/siteassets/resources/documents/spectrum/spectrum-information/frequency-allocation-table/fat-frequencies-distress-safety.pdf?v=322552',
            title:
              'Ofcom: Frequencies for distress and safety search and rescue and emergencies in the UK',
            date: '2022-08-19',
            url2: 'https://www.ofcom.org.uk/siteassets/resources/documents/about-ofcom/foi/2022/september/radio-frequencies-licensed-to-the-maritime-and-coastguard-agency.pdf?v=328453',
          },
          notes:
            'Ofcom: communication between ship aircraft and land stations in coordinated SAR and anti-pollution; also HMCG Yacht safety channel (1st reserve). MCA FOI 01497978 lists 156.375 MHz as International VHF Ch 67 licensed to the MCA.',
        },
        {
          channelId: 'ch-73',
          name: 'HMCG Ch73',
          label: 'HM Coastguard second-reserve SAR Ch 73',
          rxFrequencyHz: 156675000,
          txFrequencyHz: 156675000,
          modes: [
            {
              mode: 'fm',
              isPrimary: true,
              bandwidthKHz: 25,
            },
          ],
          status: 'active',
          confidence: 'high',
          source: {
            type: 'regulator',
            url: 'https://www.ofcom.org.uk/siteassets/resources/documents/spectrum/spectrum-information/frequency-allocation-table/fat-frequencies-distress-safety.pdf?v=322552',
            title:
              'Ofcom: Frequencies for distress and safety search and rescue and emergencies in the UK',
            date: '2022-08-19',
            url2: 'https://www.ofcom.org.uk/siteassets/resources/documents/about-ofcom/foi/2022/september/radio-frequencies-licensed-to-the-maritime-and-coastguard-agency.pdf?v=328453',
          },
          notes:
            'Ofcom: HMCG 2nd reserve channel for SAR. MCA FOI lists 156.675 MHz as International VHF Ch 73.',
        },
        {
          channelId: 'ch-10',
          name: 'HMCG Ch10',
          label: 'HM Coastguard coordinated SAR / anti-pollution Ch 10',
          rxFrequencyHz: 156500000,
          txFrequencyHz: 156500000,
          modes: [
            {
              mode: 'fm',
              isPrimary: true,
              bandwidthKHz: 25,
            },
          ],
          status: 'active',
          confidence: 'high',
          source: {
            type: 'regulator',
            url: 'https://www.ofcom.org.uk/siteassets/resources/documents/spectrum/spectrum-information/frequency-allocation-table/fat-frequencies-distress-safety.pdf?v=322552',
            title:
              'Ofcom: Frequencies for distress and safety search and rescue and emergencies in the UK',
            date: '2022-08-19',
            url2: 'https://www.gov.uk/government/publications/advice-note-1033-maritime-safety-information-msi-leaflet/advice-note-1033-maritime-safety-information-msi-leaflet',
          },
          notes:
            'Ofcom: ship/aircraft/land SAR and anti-pollution. MCA Advice Note 1033 also allows VHF Channel 10 for MSI broadcasts to reduce interference.',
        },
        {
          channelId: 'ch-06',
          name: 'HMCG Ch6',
          label: 'Ship-aircraft coordinated SAR Ch 6',
          rxFrequencyHz: 156300000,
          txFrequencyHz: 156300000,
          modes: [
            {
              mode: 'fm',
              isPrimary: true,
              bandwidthKHz: 25,
            },
          ],
          status: 'active',
          confidence: 'high',
          source: {
            type: 'regulator',
            url: 'https://www.ofcom.org.uk/siteassets/resources/documents/spectrum/spectrum-information/frequency-allocation-table/fat-frequencies-distress-safety.pdf?v=322552',
            title:
              'Ofcom: Frequencies for distress and safety search and rescue and emergencies in the UK',
            date: '2022-08-19',
            url2: 'https://www.ofcom.org.uk/siteassets/resources/documents/about-ofcom/foi/2022/september/radio-frequencies-licensed-to-the-maritime-and-coastguard-agency.pdf?v=328453',
          },
          notes:
            'Ofcom: communications between ship stations and aircraft stations engaged in coordinated SAR. MCA FOI lists 156.300 MHz as International VHF Ch 6.',
        },
        {
          channelId: 'uk-156',
          name: 'HMCG UK156',
          label: 'HM Coastguard UK-coast SAR 156.0 MHz',
          rxFrequencyHz: 156000000,
          txFrequencyHz: 156000000,
          modes: [
            {
              mode: 'fm',
              isPrimary: true,
              bandwidthKHz: 25,
            },
          ],
          status: 'active',
          confidence: 'high',
          source: {
            type: 'regulator',
            url: 'https://www.ofcom.org.uk/siteassets/resources/documents/spectrum/spectrum-information/frequency-allocation-table/fat-frequencies-distress-safety.pdf?v=322552',
            title:
              'Ofcom: Frequencies for distress and safety search and rescue and emergencies in the UK',
            date: '2022-08-19',
            url2: 'https://www.ofcom.org.uk/siteassets/resources/documents/about-ofcom/foi/2022/september/radio-frequencies-licensed-to-the-maritime-and-coastguard-agency.pdf?v=328453',
          },
          notes:
            'Ofcom: HMCG SAR on the UK coast. MCA FOI lists 156.000 MHz as a UK channel (centre of a 25 kHz channel). Not paired here with 160.600 MHz because the sources list them as separate simplex assignments.',
        },
        {
          channelId: 'uk-1606',
          name: 'HMCG UK1606',
          label: 'HM Coastguard UK-coast SAR 160.6 MHz',
          rxFrequencyHz: 160600000,
          txFrequencyHz: 160600000,
          modes: [
            {
              mode: 'fm',
              isPrimary: true,
              bandwidthKHz: 25,
            },
          ],
          status: 'active',
          confidence: 'high',
          source: {
            type: 'regulator',
            url: 'https://www.ofcom.org.uk/siteassets/resources/documents/spectrum/spectrum-information/frequency-allocation-table/fat-frequencies-distress-safety.pdf?v=322552',
            title:
              'Ofcom: Frequencies for distress and safety search and rescue and emergencies in the UK',
            date: '2022-08-19',
            url2: 'https://www.ofcom.org.uk/siteassets/resources/documents/about-ofcom/foi/2022/september/radio-frequencies-licensed-to-the-maritime-and-coastguard-agency.pdf?v=328453',
          },
          notes:
            'Ofcom: HMCG SAR on the UK coast. MCA FOI lists 160.600 MHz as a UK channel (centre of a 25 kHz channel). Not inferred as a duplex pair with 156.000 MHz.',
        },
      ],
    },
    {
      groupId: 'gb-hmcg-msi',
      label: 'HM Coastguard maritime safety information',
      category: 'maritime',
      serviceOrg: 'Maritime and Coastguard Agency',
      entries: [
        {
          channelId: 'ch-62',
          name: 'HMCG Ch62',
          label: 'HM Coastguard MSI / SAR working Ch 62 (coast transmit)',
          rxFrequencyHz: 160725000,
          txFrequencyHz: 156125000,
          modes: [
            {
              mode: 'fm',
              isPrimary: true,
              bandwidthKHz: 25,
            },
          ],
          status: 'active',
          confidence: 'high',
          source: {
            type: 'foi',
            url: 'https://www.ofcom.org.uk/siteassets/resources/documents/about-ofcom/foi/2022/september/radio-frequencies-licensed-to-the-maritime-and-coastguard-agency.pdf?v=328453',
            title:
              'Ofcom FOI 01497978: radio frequencies licensed to the Maritime and Coastguard Agency',
            date: '2022-09-20',
            url2: 'https://www.gov.uk/government/publications/advice-note-1033-maritime-safety-information-msi-leaflet/advice-note-1033-maritime-safety-information-msi-leaflet',
          },
          notes:
            'International VHF Ch 62 duplex. rx_frequency_hz is the coast-station / base transmit leg (what a ship or monitor hears for MSI); tx_frequency_hz is the mobile transmit leg. MCA Advice Note 1033: MSI broadcast on Ch 62 63 or 64 after an announcement on Ch 16.',
        },
        {
          channelId: 'ch-63',
          name: 'HMCG Ch63',
          label: 'HM Coastguard MSI / SAR working Ch 63 (coast transmit)',
          rxFrequencyHz: 160775000,
          txFrequencyHz: 156175000,
          modes: [
            {
              mode: 'fm',
              isPrimary: true,
              bandwidthKHz: 25,
            },
          ],
          status: 'active',
          confidence: 'high',
          source: {
            type: 'foi',
            url: 'https://www.ofcom.org.uk/siteassets/resources/documents/about-ofcom/foi/2022/september/radio-frequencies-licensed-to-the-maritime-and-coastguard-agency.pdf?v=328453',
            title:
              'Ofcom FOI 01497978: radio frequencies licensed to the Maritime and Coastguard Agency',
            date: '2022-09-20',
            url2: 'https://www.gov.uk/government/publications/advice-note-1033-maritime-safety-information-msi-leaflet/advice-note-1033-maritime-safety-information-msi-leaflet',
          },
          notes:
            'International VHF Ch 63 duplex. rx_frequency_hz is the coast-station transmit leg; tx_frequency_hz is the mobile transmit leg.',
        },
        {
          channelId: 'ch-64',
          name: 'HMCG Ch64',
          label: 'HM Coastguard MSI / SAR working Ch 64 (coast transmit)',
          rxFrequencyHz: 160825000,
          txFrequencyHz: 156225000,
          modes: [
            {
              mode: 'fm',
              isPrimary: true,
              bandwidthKHz: 25,
            },
          ],
          status: 'active',
          confidence: 'high',
          source: {
            type: 'foi',
            url: 'https://www.ofcom.org.uk/siteassets/resources/documents/about-ofcom/foi/2022/september/radio-frequencies-licensed-to-the-maritime-and-coastguard-agency.pdf?v=328453',
            title:
              'Ofcom FOI 01497978: radio frequencies licensed to the Maritime and Coastguard Agency',
            date: '2022-09-20',
            url2: 'https://www.gov.uk/government/publications/advice-note-1033-maritime-safety-information-msi-leaflet/advice-note-1033-maritime-safety-information-msi-leaflet',
          },
          notes:
            'International VHF Ch 64 duplex. rx_frequency_hz is the coast-station transmit leg; tx_frequency_hz is the mobile transmit leg.',
        },
      ],
    },
    {
      groupId: 'gb-rnli-working',
      label: 'RNLI launch and recovery',
      category: 'sar',
      serviceOrg: 'Royal National Lifeboat Institution',
      entries: [
        {
          channelId: 'ch-31',
          name: 'RNLI Ch31',
          label: 'RNLI Channel 31 lifeboat to shore crew',
          rxFrequencyHz: 157550000,
          txFrequencyHz: 157550000,
          modes: [
            {
              mode: 'fm',
              isPrimary: true,
              bandwidthKHz: 25,
            },
          ],
          status: 'active',
          confidence: 'medium',
          source: {
            type: 'regulator',
            url: 'https://www.ofcom.org.uk/siteassets/resources/documents/spectrum/spectrum-information/frequency-allocation-table/fat-frequencies-distress-safety.pdf?v=322552',
            title:
              'Ofcom: Frequencies for distress and safety search and rescue and emergencies in the UK',
            date: '2022-08-19',
          },
          notes:
            'Ofcom auxiliary SAR table: Channel 31 used for lifeboat to shore crew communications during launch and recovery (and may be used farther out to sea). Bandwidth not explicitly stated; 25 kHz recorded because Ofcom gives a 25 kHz-raster maritime centre frequency. CTCSS not documented. RNLI crew-alerting/paging on 153.075 MHz is not recorded (not documented as FM voice).',
        },
      ],
    },
  ],
  knownGaps: [
    {
      category: 'ambulance',
      summary:
        'UK ambulance operational voice is on the encrypted Airwave TETRA network and its Emergency Services Network successor. There is nothing unencrypted to monitor.',
      sourceUrl: 'https://www.ofcom.org.uk/spectrum/radio-equipment/emergency-services',
    },
    {
      category: 'other',
      summary:
        'UK police operational voice is on encrypted Airwave TETRA / Emergency Services Network. Fireground UHF is the exception: national incident-ground channels are required to be clear speech.',
      sourceUrl: 'https://www.ofcom.org.uk/spectrum/radio-equipment/emergency-services',
    },
  ],
};

export default country;
