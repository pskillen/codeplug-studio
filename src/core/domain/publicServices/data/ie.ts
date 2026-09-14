/**
 * Generated from scripts/public-services/research/ie/channels.csv.
 * Do not edit by hand; run `node scripts/public-services/csv-to-dataset.mjs`.
 */
import type { PublicServiceCountry } from '../types.ts';

const country: PublicServiceCountry = {
  countryCode: 'IE',
  countryLabel: 'Ireland',
  datasetVersion: '2026-09-11',
  groups: [
    {
      groupId: 'ie-marine-distress',
      label: 'Irish Coast Guard — distress and safety',
      category: 'maritime',
      serviceOrg: 'Irish Coast Guard',
      entries: [
        {
          channelId: 'ch-16',
          name: 'IRCG Ch16',
          label: 'Irish Coast Guard Channel 16 Distress Safety and Calling',
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
            type: 'official',
            url: 'https://www.gov.ie/en/department-of-transport/publications/maritime-radio-operating-procedures-for-small-craft/',
            title: 'Department of Transport: Maritime Radio Operating procedures for small craft',
            date: '2023-03-07',
            url2: 'https://www.itu.int/en/ITU-R/seminars/rrs/RRS-23-Africa/Presentations/ITU-R%20Regulatory%20Documents/1.Radio%20Regulations%20and%20Rules%20of%20Procedure/Radio%20Regulations%20Ed%202020_WRC-19/Radio%20Regulations%20Ed%202020-English/RR-2020-Vol%202_E.pdf',
          },
          notes:
            'Department of Transport states Channel 16 is 156.800 MHz. ITU-R Appendix 18 lists the same simplex pair. Irish Coast Guard stations maintain a watch on this channel per Marine Notice 61 of 2020. Analogue FM; no CTCSS documented. DSC Channel 70 is digital-only and is not recorded.',
        },
        {
          channelId: 'ch-67',
          name: 'IRCG Ch67',
          label: 'Irish Coast Guard Channel 67 SAR coordination',
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
            type: 'official',
            url: 'https://assets.gov.ie/109132/48e95fd9-cd9a-4b13-bdca-597f3f8643e3.pdf',
            title:
              'Marine Notice No. 61 of 2020: Changes to Irish Coast Guard VHF working channels',
            date: '2020',
            url2: 'https://www.itu.int/en/ITU-R/seminars/rrs/RRS-23-Africa/Presentations/ITU-R%20Regulatory%20Documents/1.Radio%20Regulations%20and%20Rules%20of%20Procedure/Radio%20Regulations%20Ed%202020_WRC-19/Radio%20Regulations%20Ed%202020-English/RR-2020-Vol%202_E.pdf',
          },
          notes:
            'Marine Notice 61 of 2020 lists Channel 67 at Coast Guard stations and states it is also available when required but may not be actively monitored at all times. Frequency from ITU-R Appendix 18 simplex 156.375/156.375 MHz. No CTCSS documented.',
        },
      ],
    },
    {
      groupId: 'ie-ircg-working',
      label: 'Irish Coast Guard — VHF working channels',
      category: 'maritime',
      serviceOrg: 'Irish Coast Guard',
      region: 'Lough Swilly and Lough Foyle',
      entries: [
        {
          channelId: 'ch-01',
          name: 'IRCG Ch01',
          label: 'Irish Coast Guard Channel 01',
          rxFrequencyHz: 160650000,
          txFrequencyHz: 156050000,
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
            type: 'official',
            url: 'https://assets.gov.ie/109132/48e95fd9-cd9a-4b13-bdca-597f3f8643e3.pdf',
            title:
              'Marine Notice No. 61 of 2020: Changes to Irish Coast Guard VHF working channels',
            date: '2020',
            url2: 'https://www.itu.int/en/ITU-R/seminars/rrs/RRS-23-Africa/Presentations/ITU-R%20Regulatory%20Documents/1.Radio%20Regulations%20and%20Rules%20of%20Procedure/Radio%20Regulations%20Ed%202020_WRC-19/Radio%20Regulations%20Ed%202020-English/RR-2020-Vol%202_E.pdf',
          },
          notes:
            'Malin Head Coast Guard Radio local working channel for Lough Swilly and Lough Foyle (Marine Notice 61 of 2020). Duplex: coast transmit 160.650 MHz recorded as rx_frequency_hz; ship transmit 156.050 MHz in tx_frequency_hz. Frequency pair from ITU-R Appendix 18. This is an Irish Coast Guard assignment; Northern Ireland allocations are out of scope.',
        },
        {
          channelId: 'ch-02',
          name: 'IRCG Ch02',
          label: 'Irish Coast Guard Channel 02',
          rxFrequencyHz: 160700000,
          txFrequencyHz: 156100000,
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
            type: 'official',
            url: 'https://assets.gov.ie/109132/48e95fd9-cd9a-4b13-bdca-597f3f8643e3.pdf',
            title:
              'Marine Notice No. 61 of 2020: Changes to Irish Coast Guard VHF working channels',
            date: '2020',
            url2: 'https://www.itu.int/en/ITU-R/seminars/rrs/RRS-23-Africa/Presentations/ITU-R%20Regulatory%20Documents/1.Radio%20Regulations%20and%20Rules%20of%20Procedure/Radio%20Regulations%20Ed%202020_WRC-19/Radio%20Regulations%20Ed%202020-English/RR-2020-Vol%202_E.pdf',
          },
          notes:
            'Working channel used by Cork, Donegal Bay and Wicklow Head Coast Guard Radio (Marine Notice 61 of 2020). Duplex: coast transmit 160.700 MHz; ship transmit 156.100 MHz.',
        },
        {
          channelId: 'ch-03',
          name: 'IRCG Ch03',
          label: 'Irish Coast Guard Channel 03',
          rxFrequencyHz: 160750000,
          txFrequencyHz: 156150000,
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
            type: 'official',
            url: 'https://assets.gov.ie/109132/48e95fd9-cd9a-4b13-bdca-597f3f8643e3.pdf',
            title:
              'Marine Notice No. 61 of 2020: Changes to Irish Coast Guard VHF working channels',
            date: '2020',
            url2: 'https://www.itu.int/en/ITU-R/seminars/rrs/RRS-23-Africa/Presentations/ITU-R%20Regulatory%20Documents/1.Radio%20Regulations%20and%20Rules%20of%20Procedure/Radio%20Regulations%20Ed%202020_WRC-19/Radio%20Regulations%20Ed%202020-English/RR-2020-Vol%202_E.pdf',
          },
          notes:
            'Working channel used by Dublin, Glen Head, Clifden and Mine Head Coast Guard Radio (Marine Notice 61 of 2020). Duplex: coast transmit 160.750 MHz; ship transmit 156.150 MHz.',
        },
        {
          channelId: 'ch-04',
          name: 'IRCG Ch04',
          label: 'Irish Coast Guard Channel 04',
          rxFrequencyHz: 160800000,
          txFrequencyHz: 156200000,
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
            type: 'official',
            url: 'https://assets.gov.ie/109132/48e95fd9-cd9a-4b13-bdca-597f3f8643e3.pdf',
            title:
              'Marine Notice No. 61 of 2020: Changes to Irish Coast Guard VHF working channels',
            date: '2020',
            url2: 'https://www.itu.int/en/ITU-R/seminars/rrs/RRS-23-Africa/Presentations/ITU-R%20Regulatory%20Documents/1.Radio%20Regulations%20and%20Rules%20of%20Procedure/Radio%20Regulations%20Ed%202020_WRC-19/Radio%20Regulations%20Ed%202020-English/RR-2020-Vol%202_E.pdf',
          },
          notes:
            'Working channel used by Galway, Carlingford and Mizen Head Coast Guard Radio (Marine Notice 61 of 2020). Duplex: coast transmit 160.800 MHz; ship transmit 156.200 MHz.',
        },
        {
          channelId: 'ch-05',
          name: 'IRCG Ch05',
          label: 'Irish Coast Guard Channel 05',
          rxFrequencyHz: 160850000,
          txFrequencyHz: 156250000,
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
            type: 'official',
            url: 'https://assets.gov.ie/109132/48e95fd9-cd9a-4b13-bdca-597f3f8643e3.pdf',
            title:
              'Marine Notice No. 61 of 2020: Changes to Irish Coast Guard VHF working channels',
            date: '2020',
            url2: 'https://www.itu.int/en/ITU-R/seminars/rrs/RRS-23-Africa/Presentations/ITU-R%20Regulatory%20Documents/1.Radio%20Regulations%20and%20Rules%20of%20Procedure/Radio%20Regulations%20Ed%202020_WRC-19/Radio%20Regulations%20Ed%202020-English/RR-2020-Vol%202_E.pdf',
          },
          notes:
            'Working channel used by Malin Head, Bantry, Rosslare and Clew Bay Coast Guard Radio (Marine Notice 61 of 2020). Duplex: coast transmit 160.850 MHz; ship transmit 156.250 MHz.',
        },
        {
          channelId: 'ch-61',
          name: 'IRCG Ch61',
          label: 'Irish Coast Guard Channel 61',
          rxFrequencyHz: 160675000,
          txFrequencyHz: 156075000,
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
            type: 'official',
            url: 'https://assets.gov.ie/109132/48e95fd9-cd9a-4b13-bdca-597f3f8643e3.pdf',
            title:
              'Marine Notice No. 61 of 2020: Changes to Irish Coast Guard VHF working channels',
            date: '2020',
            url2: 'https://www.itu.int/en/ITU-R/seminars/rrs/RRS-23-Africa/Presentations/ITU-R%20Regulatory%20Documents/1.Radio%20Regulations%20and%20Rules%20of%20Procedure/Radio%20Regulations%20Ed%202020_WRC-19/Radio%20Regulations%20Ed%202020-English/RR-2020-Vol%202_E.pdf',
          },
          notes:
            'Working channel for Lough Derg Coast Guard Radio (Marine Notice 61 of 2020 lists VHF Channel 16 and 61). Duplex: coast transmit 160.675 MHz; ship transmit 156.075 MHz.',
        },
        {
          channelId: 'ch-62',
          name: 'IRCG Ch62',
          label: 'Irish Coast Guard Channel 62',
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
            type: 'official',
            url: 'https://assets.gov.ie/109132/48e95fd9-cd9a-4b13-bdca-597f3f8643e3.pdf',
            title:
              'Marine Notice No. 61 of 2020: Changes to Irish Coast Guard VHF working channels',
            date: '2020',
            url2: 'https://www.itu.int/en/ITU-R/seminars/rrs/RRS-23-Africa/Presentations/ITU-R%20Regulatory%20Documents/1.Radio%20Regulations%20and%20Rules%20of%20Procedure/Radio%20Regulations%20Ed%202020_WRC-19/Radio%20Regulations%20Ed%202020-English/RR-2020-Vol%202_E.pdf',
          },
          notes:
            'Working channel used by Valentia Coast Guard Radio and Lough Ree Coast Guard Radio (Marine Notice 61 of 2020). Duplex: coast transmit 160.725 MHz; ship transmit 156.125 MHz.',
        },
        {
          channelId: 'ch-63',
          name: 'IRCG Ch63',
          label: 'Irish Coast Guard Channel 63',
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
            type: 'official',
            url: 'https://assets.gov.ie/109132/48e95fd9-cd9a-4b13-bdca-597f3f8643e3.pdf',
            title:
              'Marine Notice No. 61 of 2020: Changes to Irish Coast Guard VHF working channels',
            date: '2020',
            url2: 'https://www.itu.int/en/ITU-R/seminars/rrs/RRS-23-Africa/Presentations/ITU-R%20Regulatory%20Documents/1.Radio%20Regulations%20and%20Rules%20of%20Procedure/Radio%20Regulations%20Ed%202020_WRC-19/Radio%20Regulations%20Ed%202020-English/RR-2020-Vol%202_E.pdf',
          },
          notes:
            'Working channel for Belmullet Coast Guard Radio (Marine Notice 61 of 2020). Duplex: coast transmit 160.775 MHz; ship transmit 156.175 MHz.',
        },
        {
          channelId: 'ch-64',
          name: 'IRCG Ch64',
          label: 'Irish Coast Guard Channel 64',
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
            type: 'official',
            url: 'https://assets.gov.ie/109132/48e95fd9-cd9a-4b13-bdca-597f3f8643e3.pdf',
            title:
              'Marine Notice No. 61 of 2020: Changes to Irish Coast Guard VHF working channels',
            date: '2020',
            url2: 'https://www.itu.int/en/ITU-R/seminars/rrs/RRS-23-Africa/Presentations/ITU-R%20Regulatory%20Documents/1.Radio%20Regulations%20and%20Rules%20of%20Procedure/Radio%20Regulations%20Ed%202020_WRC-19/Radio%20Regulations%20Ed%202020-English/RR-2020-Vol%202_E.pdf',
          },
          notes:
            'Working channel for Shannon Coast Guard Radio (Marine Notice 61 of 2020). Duplex: coast transmit 160.825 MHz; ship transmit 156.225 MHz. Do not use older Shannon Coast Guard Channel 24/28 listings in pre-2020 port guides.',
        },
      ],
    },
    {
      groupId: 'ie-dublin-port-vts',
      label: 'Dublin Port — Vessel Traffic Service',
      category: 'transport',
      serviceOrg: 'Dublin Port Company',
      region: 'Dublin',
      entries: [
        {
          channelId: 'ch-12',
          name: 'Dublin VTS12',
          label: 'Dublin Port VTS Channel 12 working',
          rxFrequencyHz: 156600000,
          txFrequencyHz: 156600000,
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
            type: 'official',
            url: 'https://www.dublinport.ie/wp-content/uploads/2025/12/03-2026-VTS.pdf',
            title: 'Dublin Port Notice to Mariners 03 of 2026: Vessel Traffic Service',
            date: '2026-01-01',
            url2: 'https://www.itu.int/en/ITU-R/seminars/rrs/RRS-23-Africa/Presentations/ITU-R%20Regulatory%20Documents/1.Radio%20Regulations%20and%20Rules%20of%20Procedure/Radio%20Regulations%20Ed%202020_WRC-19/Radio%20Regulations%20Ed%202020-English/RR-2020-Vol%202_E.pdf',
          },
          notes:
            'Dublin Port Notice to Mariners 03 of 2026: VHF Channel 12 is the working channel call sign VTS DUBLIN for VTS operations, pilotage and bridge-to-bridge. Simplex frequency from ITU-R Appendix 18 (156.600 MHz). No CTCSS documented.',
        },
        {
          channelId: 'ch-13',
          name: 'Dublin VTS13',
          label: 'Dublin Port VTS Channel 13 secondary',
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
            type: 'official',
            url: 'https://www.dublinport.ie/wp-content/uploads/2025/12/03-2026-VTS.pdf',
            title: 'Dublin Port Notice to Mariners 03 of 2026: Vessel Traffic Service',
            date: '2026-01-01',
            url2: 'https://www.itu.int/en/ITU-R/seminars/rrs/RRS-23-Africa/Presentations/ITU-R%20Regulatory%20Documents/1.Radio%20Regulations%20and%20Rules%20of%20Procedure/Radio%20Regulations%20Ed%202020_WRC-19/Radio%20Regulations%20Ed%202020-English/RR-2020-Vol%202_E.pdf',
          },
          notes:
            'Dublin Port Notice to Mariners 03 of 2026 lists VHF Channel 13 as the secondary channel. Simplex frequency from ITU-R Appendix 18 (156.650 MHz). No CTCSS documented.',
        },
        {
          channelId: 'ch-09',
          name: 'Dublin Tow09',
          label: 'Dublin Port Channel 09 towage operations',
          rxFrequencyHz: 156450000,
          txFrequencyHz: 156450000,
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
            type: 'official',
            url: 'https://www.dublinport.ie/wp-content/uploads/2025/12/03-2026-VTS.pdf',
            title: 'Dublin Port Notice to Mariners 03 of 2026: Vessel Traffic Service',
            date: '2026-01-01',
            url2: 'https://www.itu.int/en/ITU-R/seminars/rrs/RRS-23-Africa/Presentations/ITU-R%20Regulatory%20Documents/1.Radio%20Regulations%20and%20Rules%20of%20Procedure/Radio%20Regulations%20Ed%202020_WRC-19/Radio%20Regulations%20Ed%202020-English/RR-2020-Vol%202_E.pdf',
          },
          notes:
            'Dublin Port Notice to Mariners 03 of 2026 lists VHF Channel 09 for towage operations. Simplex frequency from ITU-R Appendix 18 (156.450 MHz). No CTCSS documented.',
        },
      ],
    },
    {
      groupId: 'ie-cork-harbour',
      label: 'Port of Cork — Harbour Radio',
      category: 'transport',
      serviceOrg: 'Port of Cork Company',
      region: 'Cork',
      entries: [
        {
          channelId: 'ch-12',
          name: 'Cork Hbr Ch12',
          label: 'Cork Harbour Radio Channel 12 primary working',
          rxFrequencyHz: 156600000,
          txFrequencyHz: 156600000,
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
            type: 'official',
            url: 'https://www.portofcork.ie/wp-content/uploads/2025/12/Notice-1-of-2026-REPORTING-PROCEDURES-PILOTAGE-INFORMATION-AND-PORT-INFORMATION-FOR-ALL-VESSELS.pdf',
            title: 'Port of Cork Notice to Mariners No. 1 of 2026: Reporting procedures',
            date: '2025-12-31',
            url2: 'https://www.itu.int/en/ITU-R/seminars/rrs/RRS-23-Africa/Presentations/ITU-R%20Regulatory%20Documents/1.Radio%20Regulations%20and%20Rules%20of%20Procedure/Radio%20Regulations%20Ed%202020_WRC-19/Radio%20Regulations%20Ed%202020-English/RR-2020-Vol%202_E.pdf',
          },
          notes:
            'Port of Cork Notice to Mariners No. 1 of 2026: Cork Harbour Radio maintains a 24-hour watch on Channels 16, 14 and 12; Channel 12 is the primary working channel. Simplex frequency from ITU-R Appendix 18 (156.600 MHz). Channel 16 is already recorded nationally.',
        },
        {
          channelId: 'ch-14',
          name: 'Cork Hbr Ch14',
          label: 'Cork Harbour Radio Channel 14',
          rxFrequencyHz: 156700000,
          txFrequencyHz: 156700000,
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
            type: 'official',
            url: 'https://www.portofcork.ie/wp-content/uploads/2025/12/Notice-1-of-2026-REPORTING-PROCEDURES-PILOTAGE-INFORMATION-AND-PORT-INFORMATION-FOR-ALL-VESSELS.pdf',
            title: 'Port of Cork Notice to Mariners No. 1 of 2026: Reporting procedures',
            date: '2025-12-31',
            url2: 'https://www.itu.int/en/ITU-R/seminars/rrs/RRS-23-Africa/Presentations/ITU-R%20Regulatory%20Documents/1.Radio%20Regulations%20and%20Rules%20of%20Procedure/Radio%20Regulations%20Ed%202020_WRC-19/Radio%20Regulations%20Ed%202020-English/RR-2020-Vol%202_E.pdf',
          },
          notes:
            'Port of Cork Notice to Mariners No. 1 of 2026: Cork Harbour Radio watches Channel 14 in addition to 12 and 16; ETAs may be confirmed on Channel 12 or 14. Simplex frequency from ITU-R Appendix 18 (156.700 MHz).',
        },
      ],
    },
    {
      groupId: 'ie-shannon-foynes',
      label: 'Shannon Foynes — port working channels',
      category: 'transport',
      serviceOrg: 'Shannon Foynes Port Company',
      region: 'Shannon Estuary',
      entries: [
        {
          channelId: 'ch-11',
          name: 'Shannon Ch11',
          label: 'Shannon Foynes Channel 11 pilot and transit',
          rxFrequencyHz: 156550000,
          txFrequencyHz: 156550000,
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
            type: 'official',
            url: 'https://www.sfpc.ie/wp-content/uploads/2020/06/Shannon-Estuary-Port-Information-Guide-2021-4.pdf',
            title: 'Shannon Estuary Port Information Guide Q1 2021 update 3',
            date: '2021',
            url2: 'https://www.itu.int/en/ITU-R/seminars/rrs/RRS-23-Africa/Presentations/ITU-R%20Regulatory%20Documents/1.Radio%20Regulations%20and%20Rules%20of%20Procedure/Radio%20Regulations%20Ed%202020_WRC-19/Radio%20Regulations%20Ed%202020-English/RR-2020-Vol%202_E.pdf',
          },
          notes:
            "Shannon Estuary Port Information Guide Q1 2021: Channel 11 is dedicated for the Pilot Station and vessels transiting the Shannon Estuary; Shannon Ports Radio / Shannon Pilots Radio listed as Ch 16/11. Simplex frequency from ITU-R Appendix 18 (156.550 MHz). Guide is 2021; no later public channel-plan change found. Ignore the guide's Shannon Coastguard Ch 16/24 listing — that working channel was changed to Channel 64 by Marine Notice 61 of 2020.",
        },
        {
          channelId: 'ch-14',
          name: 'Shannon Ch14',
          label: 'Shannon Foynes Channel 14 berthing',
          rxFrequencyHz: 156700000,
          txFrequencyHz: 156700000,
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
            type: 'official',
            url: 'https://www.sfpc.ie/wp-content/uploads/2020/06/Shannon-Estuary-Port-Information-Guide-2021-4.pdf',
            title: 'Shannon Estuary Port Information Guide Q1 2021 update 3',
            date: '2021',
            url2: 'https://www.itu.int/en/ITU-R/seminars/rrs/RRS-23-Africa/Presentations/ITU-R%20Regulatory%20Documents/1.Radio%20Regulations%20and%20Rules%20of%20Procedure/Radio%20Regulations%20Ed%202020_WRC-19/Radio%20Regulations%20Ed%202020-English/RR-2020-Vol%202_E.pdf',
          },
          notes:
            'Shannon Estuary Port Information Guide Q1 2021 section 12.2: Channel 14 is dedicated for berthing/unberthing operations. Simplex frequency from ITU-R Appendix 18 (156.700 MHz). Source date 2021.',
        },
      ],
    },
  ],
  knownGaps: [
    {
      category: 'fire',
      summary:
        'Irish fire services are run by local authorities with no published national channel plan, and operational radio has moved to an encrypted national digital service. There is nothing unencrypted to monitor.',
      sourceUrl:
        'https://www.comreg.ie/industry/radio-spectrum/licensing/search-licence-type/emergency-service-digital-radio/',
    },
    {
      category: 'ambulance',
      summary:
        'HSE National Ambulance Service operates on the encrypted TETRA Managed National Digital Radio Service. No unencrypted voice channel is published.',
      sourceUrl:
        'https://www.comreg.ie/industry/radio-spectrum/licensing/search-licence-type/emergency-service-digital-radio/',
    },
    {
      category: 'other',
      summary:
        'An Garda Síochána uses the encrypted national TETRA network. There is nothing unencrypted to monitor.',
      sourceUrl: 'https://www.irishstatutebook.ie/eli/2008/si/324/made/en/html',
    },
  ],
};

export default country;
