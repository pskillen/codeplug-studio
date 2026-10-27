# AT-D890UV — stock CPS Optional Settings coverage

Every input on the stock CPS 1.05 **Optional Settings** form (plus the text boxes and the key tabs), with where it lives on the radio, whether Studio models it, and whether a frequency-range change wipes it. It answers two questions a maintainer asks before touching the settings feature or the range change:

1. _Can the radio-settings page edit what the CPS edits?_ Partly: see the **Studio** column. The firmware, not the CPS, decides what is offered ([optional-settings.md](optional-settings.md)).
2. _What does a range change cost, and does a Backup bring it back?_ Everything on this form lives in the settings unit, which the boot after a range change erases and re-defaults. A Studio backup holds the unit as raw bytes and **Restore replays them whether or not the field is modelled**, so the registry is an editing limit, not a restore limit ([backup-restore.md](backup-restore.md#what-a-range-change-wipes-and-what-a-restore-brings-back)).

How to read it:

- Addresses are the settings unit (`0x3500000` plus the offset); layout and spans in [memory-layout.md](memory-layout.md#settings-unit-map-0x3500000-both-halves). `0x3500900..` is the power-on block (the "ext" span). `..+N` after an address means the field runs N further bytes.
- **Studio** is "Yes: `id`" when a registry field (`settingsFields.ts`, targets stock and MM9PDY) edits it. Combined controls (the display-extras bits, the key lock bits) share a byte, so several rows can point at one address.
- **No (radio state, never patched)** rows are bytes the radio rewrites in use (work zone, VF/MR, FM channel and so on); a patch would race the radio, so they are on the never-patch list. **No (firmware never reads it)** rows are CPS fields the stock firmware ignores; Studio does not offer them ([optional-settings.md](optional-settings.md#not-offered)).
- **Backed up and restored** is the Studio zip: `main` is the `+0x000..+0x1FF` span, `ext` the power-on span.
- **Wiped** is the boot after a range change. "Unknown" is a CPS control that is bound outside the settings record; its wire byte was not traced.
- The rows were taken from the CPS form table and the registry at the end of the CPS-parity delivery (2026-10-27). Counts: about 80 registry fields (the ten advanced ones included) against about 200 CPS inputs; roughly 120 inputs are not modelled.

## Optional Settings inputs

| Tab              | CPS label                                             | Address          | Studio                                                                       | Backed up and restored | Wiped   |
| ---------------- | ----------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------- | ---------------------- | ------- |
| 0 Work Mode      | Display mode                                          | `0x3500001`      | Yes: `displayMode`                                                           | Yes (main)             | Yes     |
| 0 Work Mode      | VF/MR(A)                                              | `0x3500015`      | No (radio state, never patched)                                              | Yes (main)             | Yes     |
| 0 Work Mode      | MEM Zone(A)                                           | `0x350001F`      | No (radio state, never patched)                                              | Yes (main)             | Yes     |
| 0 Work Mode      | Main Channel Set                                      | `0x350002C`      | No (radio state, never patched)                                              | Yes (main)             | Yes     |
| 0 Work Mode      | Sub-Channel Mode                                      | `0x350002D`      | No                                                                           | Yes (main)             | Yes     |
| 0 Work Mode      | VF/MR(B)                                              | `0x3500016`      | No (radio state, never patched)                                              | Yes (main)             | Yes     |
| 0 Work Mode      | MEM Zone(B)                                           | `0x3500020`      | No (radio state, never patched)                                              | Yes (main)             | Yes     |
| 0 Work Mode      | choose working mode                                   | `0x3500034`      | Yes: `professionalMode`                                                      | Yes (main)             | Yes     |
| 1 Vox/BT         | VOX On/Off                                            | `0x350000C`      | No                                                                           | Yes (main)             | Yes     |
| 1 Vox/BT         | VOX Delay                                             | `0x350000D`      | No                                                                           | Yes (main)             | Yes     |
| 1 Vox/BT         | VOX Detection                                         | `0x3500033`      | No                                                                           | Yes (main)             | Yes     |
| 1 Vox/BT         | BT On/Off                                             | `0x35000B1`      | No                                                                           | Yes (main)             | Yes     |
| 1 Vox/BT         | BT + int spk                                          | `0x35000B3`      | No                                                                           | Yes (main)             | Yes     |
| 1 Vox/BT         | BT MIC Gain                                           | `0x35000B6`      | No                                                                           | Yes (main)             | Yes     |
| 1 Vox/BT         | BT Spk Gain                                           | `0x35000B7`      | No                                                                           | Yes (main)             | Yes     |
| 1 Vox/BT         | BT Hold Time                                          | `0x35000EB`      | No                                                                           | Yes (main)             | Yes     |
| 1 Vox/BT         | BT RX Delay                                           | `0x35000EC`      | No                                                                           | Yes (main)             | Yes     |
| 1 Vox/BT         | BT PTT HOLD                                           | `0x35000F0`      | No                                                                           | Yes (main)             | Yes     |
| 1 Vox/BT         | Ptt Sleep Time                                        | `0x3500104`      | No                                                                           | Yes (main)             | Yes     |
| 1 Vox/BT         | Bt Nr Before                                          | `0x350014B`      | No                                                                           | Yes (main)             | Yes     |
| 1 Vox/BT         | Bt Nr After                                           | `0x350014C`      | No                                                                           | Yes (main)             | Yes     |
| 1 Vox/BT         | BT + int mic (always written 0)                       | `0x35000B2`      | No (firmware never reads it)                                                 | Yes (main)             | Yes     |
| 2 STE            | STE Type Of CTCSS                                     | `0x3500017`      | No                                                                           | Yes (main)             | Yes     |
| 2 STE            | STE When No Signal                                    | `0x3500018`      | No                                                                           | Yes (main)             | Yes     |
| 2 STE            | Ste Time                                              | `0x3500106`      | No                                                                           | Yes (main)             | Yes     |
| 2 STE            | Dcs Site                                              | `0x350014A`      | No                                                                           | Yes (main)             | Yes     |
| 3 AM/FM          | AM/FM Function                                        | `0x3500021`      | No (radio state, never patched)                                              | Yes (main)             | Yes     |
| 3 AM/FM          | FM VFO/MEM                                            | `0x350001E`      | No (radio state, never patched)                                              | Yes (main)             | Yes     |
| 3 AM/FM          | FM Work Channel                                       | `0x350001D`      | No (radio state, never patched)                                              | Yes (main)             | Yes     |
| 3 AM/FM          | FM Monitor                                            | `0x350002B`      | No                                                                           | Yes (main)             | Yes     |
| 3 AM/FM          | AM VFO/MEM                                            | `0x350013F`      | No (radio state, never patched)                                              | Yes (main)             | Yes     |
| 3 AM/FM          | AM Work Zone                                          | `0x3500140`      | No (radio state, never patched)                                              | Yes (main)             | Yes     |
| 3 AM/FM          | AM Offset                                             | `0x3500141`      | No                                                                           | Yes (main)             | Yes     |
| 3 AM/FM          | Am SqlLevel                                           | `0x3500142`      | No                                                                           | Yes (main)             | Yes     |
| 3 AM/FM          | Freq Step                                             | `0x3500159`      | No                                                                           | Yes (main)             | Yes     |
| 4 Power Save     | Auto Shutdown                                         | `0x3500003`      | Yes: `autoPowerOff`                                                          | Yes (main)             | Yes     |
| 4 Power Save     | Power save                                            | `0x350000B`      | Yes: `powerSave`                                                             | Yes (main)             | Yes     |
| 4 Power Save     | Auto Shutdown Type                                    | `0x350010F`      | Yes: `autoPowerOffType`                                                      | Yes (main)             | Yes     |
| 5 Key Function   | Key Lock                                              | `0x3500002`      | No                                                                           | Yes (main)             | Yes     |
| 5 Key Function   | Long Key Time[s]                                      | `0x3500046`      | Yes: `longPressTime`                                                         | Yes (main)             | Yes     |
| 5 Key Function   | Knob Lock                                             | `0x35000BD`      | No                                                                           | Yes (main)             | Yes     |
| 5 Key Function   | Keyboard Lock                                         | `0x35000BD`      | No                                                                           | Yes (main)             | Yes     |
| 5 Key Function   | Side Key Lock                                         | `0x35000BD`      | No                                                                           | Yes (main)             | Yes     |
| 5 Key Function   | Forced Lock Key                                       | `0x35000BD`      | No                                                                           | Yes (main)             | Yes     |
| 5 Key Function   | PF1/PF2/PF3/P1/P2 short key                           | `0x3500010..+5`  | Yes: `keyShortPF1`, `keyShortPF2`, `keyShortPF3`, `keyShortP1`, `keyShortP2` | Yes (main)             | Yes     |
| 5 Key Function   | PF1/PF2/PF3/P1/P2 long key                            | `0x3500041..+5`  | Yes: `keyLongPF1`, `keyLongPF2`, `keyLongPF3`, `keyLongP1`, `keyLongP2`      | Yes (main)             | Yes     |
| 6 Other          | TOT                                                   | `0x3500004`      | Yes: `txTimeout`                                                             | Yes (main)             | Yes     |
| 6 Other          | Language                                              | `0x3500005`      | Yes: `language`                                                              | Yes (main)             | Yes     |
| 6 Other          | Frequency Step                                        | `0x3500008`      | No                                                                           | Yes (main)             | Yes     |
| 6 Other          | SQL Level(A)                                          | `0x3500009`      | No                                                                           | Yes (main)             | Yes     |
| 6 Other          | TBST                                                  | `0x350002E`      | No                                                                           | Yes (main)             | Yes     |
| 6 Other          | SQL Level(B)                                          | `0x350000A`      | No                                                                           | Yes (main)             | Yes     |
| 6 Other          | Analog Call Hold Time[s]                              | `0x3500050`      | Yes: `analogueCallHold`                                                      | Yes (main)             | Yes     |
| 6 Other          | call channel is maintained                            | `0x350006E`      | No (firmware never reads it)                                                 | Yes (main)             | Yes     |
| 6 Other          | Priority Zone A                                       | `0x350006F`      | No (radio state, never patched)                                              | Yes (main)             | Yes     |
| 6 Other          | Priority Zone B                                       | `0x3500070`      | No (radio state, never patched)                                              | Yes (main)             | Yes     |
| 6 Other          | Address Book Is Sent With Its Own Code                | `0x35000D5`      | No                                                                           | Yes (main)             | Yes     |
| 6 Other          | Mute timing                                           | `0x35000E8`      | No                                                                           | Yes (main)             | Yes     |
| 6 Other          | NOAA Alert                                            | `0x35000EF`      | No                                                                           | Yes (main)             | Yes     |
| 6 Other          | Encryption Type                                       | `0x350010A`      | Yes: `encryptionType`                                                        | Yes (main)             | Yes     |
| 6 Other          | TOT Predict                                           | `0x350010B`      | Yes: `txTimeoutPreAlert`                                                     | Yes (main)             | Yes     |
| 6 Other          | TxPow Agc                                             | `0x350010C`      | No                                                                           | Yes (main)             | Yes     |
| 6 Other          | Tone Dec Path                                         | not located      | No                                                                           | Unknown                | Unknown |
| 6 Other          | NOAA Channel                                          | `0x350013E`      | No (radio state, never patched)                                              | Yes (main)             | Yes     |
| 6 Other          | NOAA Moni                                             | `0x3500157`      | No                                                                           | Yes (main)             | Yes     |
| 6 Other          | NOAA Scan                                             | `0x3500158`      | No                                                                           | Yes (main)             | Yes     |
| 7 Digital Func   | Group Call Hold Time                                  | `0x3500019`      | Yes: `groupCallHangTime`                                                     | Yes (main)             | Yes     |
| 7 Digital Func   | TX preamble duration                                  | `0x350001C`      | Yes: `txPreamble`                                                            | Yes (main)             | Yes     |
| 7 Digital Func   | Voice header repetitions                              | `0x350001B`      | Yes: `voiceHeaderRepeats`                                                    | Yes (main)             | Yes     |
| 7 Digital Func   | Private Call Hold Time                                | `0x350001A`      | Yes: `privateCallHangTime`                                                   | Yes (main)             | Yes     |
| 7 Digital Func   | Filter Own ID In MissCall                             | `0x3500038`      | Yes: `missedCallFilterOwnId`                                                 | Yes (main)             | Yes     |
| 7 Digital Func   | Digital Remote Kill                                   | `0x350003C`      | Yes: `acceptRemoteKill`                                                      | Yes (main)             | Yes     |
| 7 Digital Func   | Remote Monitor                                        | `0x350003E`      | Yes: `acceptRemoteMonitor`                                                   | Yes (main)             | Yes     |
| 7 Digital Func   | Digital Monitor                                       | `0x3500049`      | No                                                                           | Yes (main)             | Yes     |
| 7 Digital Func   | Digital Monitor CC                                    | `0x350004A`      | No                                                                           | Yes (main)             | Yes     |
| 7 Digital Func   | Digital Monitor ID                                    | `0x350004B`      | No                                                                           | Yes (main)             | Yes     |
| 7 Digital Func   | Monitor Slot Hold                                     | `0x350004C`      | No                                                                           | Yes (main)             | Yes     |
| 7 Digital Func   | SMS Format                                            | `0x35000C3`      | Yes: `smsFormat`                                                             | Yes (main)             | Yes     |
| 7 Digital Func   | Manual Dial - Group TG Hold Time                      | `0x3500107`      | Yes: `manualDialGroupHangTime`                                               | Yes (main)             | Yes     |
| 7 Digital Func   | Manual Dial - Private TG Hold Time                    | `0x3500108`      | Yes: `manualDialPrivateHangTime`                                             | Yes (main)             | Yes     |
| 7 Digital Func   | DMR CRC Ignore                                        | not located      | No                                                                           | Unknown                | Unknown |
| 7 Digital Func   | Digital Protocol                                      | `0x3500152`      | No: left as read (the protocol is switched on the radio; [nxdn.md](nxdn.md)) | Yes (main)             | Yes     |
| 7 Digital Func   | Reset Digital Protocol                                | `0x3500154`      | No (firmware never reads it)                                                 | Yes (main)             | Yes     |
| 8 Power-on       | Power-on Interface                                    | `0x3500006`      | Yes: `powerOnScreen`                                                         | Yes (main)             | Yes     |
| 8 Power-on       | Power-on Password                                     | `0x3500007`      | Yes: `powerOnPasswordEnabled`                                                | Yes (main)             | Yes     |
| 8 Power-on       | Startup Zone A                                        | `0x35000D7`      | No                                                                           | Yes (main)             | Yes     |
| 8 Power-on       | Startup Zone B                                        | `0x35000D8`      | No                                                                           | Yes (main)             | Yes     |
| 8 Power-on       | Startup GPS test                                      | not located      | No                                                                           | Unknown                | Unknown |
| 8 Power-on       | Startup Reset                                         | `0x35000EA`      | No                                                                           | Yes (main)             | Yes     |
| 8 Power-on       | Default startup channel enable / channel A / B (idx1) | `0x35000D6..+5`  | No (start-up channel; not offered)                                           | Yes (main)             | Yes     |
| 8 Power-on       | Power-on line 1 / 2                                   | `0x3500900`      | Yes: `powerOnLine1`, `powerOnLine2`                                          | Yes (ext)              | Yes     |
| 8 Power-on       | Power-on password (8 ASCII)                           | `0x3500940`      | Yes: `powerOnPasswordDigits`                                                 | Yes (ext)              | Yes     |
| 9 Alert Tone     | Key Tone                                              | `0x3500000`      | Yes: `keyTone`                                                               | Yes (main)             | Yes     |
| 9 Alert Tone     | SMS Alert                                             | `0x3500029`      | Yes: `smsAlert`                                                              | Yes (main)             | Yes     |
| 9 Alert Tone     | Call Alert                                            | `0x350002F`      | Yes: `callAlert`                                                             | Yes (main)             | Yes     |
| 9 Alert Tone     | Talk Permit                                           | `0x3500031`      | Yes: `talkPermitTone`                                                        | Yes (main)             | Yes     |
| 9 Alert Tone     | Digi Call ResetTone                                   | `0x3500032`      | Yes: `callResetTone`                                                         | Yes (main)             | Yes     |
| 9 Alert Tone     | Digi Idle Channel Tone                                | `0x3500036`      | Yes: `digitalIdleTone`                                                       | Yes (main)             | Yes     |
| 9 Alert Tone     | Startup Sound                                         | `0x3500039`      | Yes: `startupTone`                                                           | Yes (main)             | Yes     |
| 9 Alert Tone     | plug-in recording tone                                | `0x35000B4`      | No (firmware never reads it)                                                 | Yes (main)             | Yes     |
| 9 Alert Tone     | Tone/Key Sound Adjustable                             | `0x35000BB`      | No (firmware never reads it)                                                 | Yes (main)             | Yes     |
| 9 Alert Tone     | Ana Idle Channel Tone                                 | `0x3500111`      | Yes: `analogueIdleTone`                                                      | Yes (main)             | Yes     |
| 10 Display       | Brightness                                            | `0x3500026`      | Yes: `backlightLevel`                                                        | Yes (main)             | Yes     |
| 10 Display       | Auto Backlight Duration                               | `0x3500027`      | Yes: `backlightTimeout`                                                      | Yes (main)             | Yes     |
| 10 Display       | Menu Exit Time[s]                                     | `0x3500037`      | Yes: `menuExitTime`                                                          | Yes (main)             | Yes     |
| 10 Display       | Call End Prompt Box                                   | `0x350003A`      | No (firmware never reads it)                                                 | Yes (main)             | Yes     |
| 10 Display       | Volume Bar                                            | `0x3500047`      | Yes: `volumeBar`                                                             | Yes (main)             | Yes     |
| 10 Display       | Time Display                                          | `0x3500051`      | Yes: `clockOnStandby`                                                        | Yes (main)             | Yes     |
| 10 Display       | Last Caller                                           | `0x350004D`      | Yes: `lastCaller`                                                            | Yes (main)             | Yes     |
| 10 Display       | Call Display Mode                                     | `0x35000AF`      | Yes: `callDisplayMode`                                                       | Yes (main)             | Yes     |
| 10 Display       | Display Channel Number                                | `0x35000B8`      | Yes: `channelNumberStyle`                                                    | Yes (main)             | Yes     |
| 10 Display       | Display Current Contact                               | `0x35000B9`      | Yes: `showCurrentContact`                                                    | Yes (main)             | Yes     |
| 10 Display       | Call Sign Display Color                               | `0x35000BC`      | Yes: `callSignColour`                                                        | Yes (main)             | Yes     |
| 10 Display       | Standby Char Color                                    | `0x35000C0`      | Yes: `standbyTextColour`                                                     | Yes (main)             | Yes     |
| 10 Display       | Standby BK Picture                                    | `0x35000C1`      | Yes: `standbyBackground`                                                     | Yes (main)             | Yes     |
| 10 Display       | Show Last Call On Launch                              | `0x35000BB`      | No (firmware never reads it)                                                 | Yes (main)             | Yes     |
| 10 Display       | Backlight Delay Of TX[s]                              | `0x35000E0`      | No                                                                           | Yes (main)             | Yes     |
| 10 Display       | Separate display                                      | `0x35000E1`      | No                                                                           | Yes (main)             | Yes     |
| 10 Display       | CH Switching Keeps Last Caller                        | `0x35000E2`      | No                                                                           | Yes (main)             | Yes     |
| 10 Display       | A Channel Name Color                                  | `0x35000E3`      | Yes: `channelNameColourA`                                                    | Yes (main)             | Yes     |
| 10 Display       | Receive Backlight Delay[s]                            | `0x35000E5`      | No (firmware never reads it)                                                 | Yes (main)             | Yes     |
| 10 Display       | B Channel Name Color                                  | `0x3500109`      | Yes: `channelNameColourB`                                                    | Yes (main)             | Yes     |
| 10 Display       | Zone Name Colour A                                    | `0x350010D`      | Yes: `zoneNameColourA`                                                       | Yes (main)             | Yes     |
| 10 Display       | Zone Name Colour B                                    | `0x350010E`      | Yes: `zoneNameColourB`                                                       | Yes (main)             | Yes     |
| 10 Display       | Display Channel Type                                  | `0x3500110`      | Yes: `showChannelType&0x01`, `showTimeSlot&0x02`, `showColourCode&0x04`      | Yes (main)             | Yes     |
| 10 Display       | Display Time Slot                                     | `0x3500110`      | Yes: `showChannelType&0x01`, `showTimeSlot&0x02`, `showColourCode&0x04`      | Yes (main)             | Yes     |
| 10 Display       | Display Color Code                                    | `0x3500110`      | Yes: `showChannelType&0x01`, `showTimeSlot&0x02`, `showColourCode&0x04`      | Yes (main)             | Yes     |
| 10 Display       | Date Display Format                                   | `0x3500112`      | Yes: `dateFormat`                                                            | Yes (main)             | Yes     |
| 10 Display       | Night Mode                                            | `0x350014D`      | Yes: `nightMode`                                                             | Yes (main)             | Yes     |
| 11 GPS/Ranging   | GPS                                                   | `0x3500028`      | No                                                                           | Yes (main)             | Yes     |
| 11 GPS/Ranging   | Time Zone                                             | `0x3500030`      | Yes: `timeZone`                                                              | Yes (main)             | Yes     |
| 11 GPS/Ranging   | Get GPS Positioning                                   | `0x350003F`      | Yes: `answerGpsRequests`                                                     | Yes (main)             | Yes     |
| 11 GPS/Ranging   | GPS Template Information                              | `0x3500053`      | No                                                                           | Yes (main)             | Yes     |
| 11 GPS/Ranging   | Ranging Interval[s]                                   | `0x35000B5`      | No                                                                           | Yes (main)             | Yes     |
| 11 GPS/Ranging   | Gps Mode                                              | `0x3500105`      | No                                                                           | Yes (main)             | Yes     |
| 11 GPS/Ranging   | GPS Roaming                                           | `0x3500114`      | No                                                                           | Yes (main)             | Yes     |
| 11 GPS/Ranging   | Distance Unit                                         | `0x35000BD`      | No                                                                           | Yes (main)             | Yes     |
| 12 VFO Scan      | VFO Scan Type                                         | `0x350000E`      | No                                                                           | Yes (main)             | Yes     |
| 12 VFO Scan      | VFO scan UHF/VHF start/end (f10Hz)                    | `0x3500058..+16` | No                                                                           | Yes (main)             | Yes     |
| 13 Auto repeater | Auto Repeater A                                       | `0x3500048`      | Yes: `autoRepeaterA`                                                         | Yes (main)             | Yes     |
| 13 Auto repeater | Auto Roaming at Fixed Time[m]                         | `0x35000BA`      | No                                                                           | Yes (main)             | Yes     |
| 13 Auto repeater | Roaming Effect Wait Time[s]                           | `0x35000BF`      | No                                                                           | Yes (main)             | Yes     |
| 13 Auto repeater | Auto Repeater B                                       | `0x35000D4`      | Yes: `autoRepeaterB`                                                         | Yes (main)             | Yes     |
| 13 Auto repeater | Repeater Check                                        | `0x35000DC`      | No                                                                           | Yes (main)             | Yes     |
| 13 Auto repeater | Repeater Check Interval[s]                            | `0x35000DD`      | No                                                                           | Yes (main)             | Yes     |
| 13 Auto repeater | Repeater Check Reconnections                          | `0x35000DE`      | No                                                                           | Yes (main)             | Yes     |
| 13 Auto repeater | Auto Roaming start condition                          | `0x35000DF`      | No                                                                           | Yes (main)             | Yes     |
| 13 Auto repeater | Repeater Out of Range Notify                          | `0x35000E4`      | No                                                                           | Yes (main)             | Yes     |
| 13 Auto repeater | Auto Roaming                                          | `0x35000E6`      | No                                                                           | Yes (main)             | Yes     |
| 13 Auto repeater | Roaming Zone                                          | `0x35000DB`      | No (radio state, never patched)                                              | Yes (main)             | Yes     |
| 13 Auto repeater | Roaming Return Channel                                | `0x35000E7`      | No (firmware never reads it)                                                 | Yes (main)             | Yes     |
| 13 Auto repeater | Out of Range Notify(times)                            | `0x35000E9`      | No                                                                           | Yes (main)             | Yes     |
| 13 Auto repeater | Current AutoRep(UHF)                                  | not located      | No                                                                           | Unknown                | Unknown |
| 13 Auto repeater | Current AutoRep(VHF)                                  | not located      | No                                                                           | Unknown                | Unknown |
| 13 Auto repeater | Repeater Mode                                         | `0x3500143`      | Yes: `repeaterMode`                                                          | Yes (main)             | Yes     |
| 13 Auto repeater | Rep Cc Limit                                          | `0x3500144`      | No                                                                           | Yes (main)             | Yes     |
| 13 Auto repeater | Rep Slot PathA                                        | `0x3500145`      | No                                                                           | Yes (main)             | Yes     |
| 13 Auto repeater | Rep Slot PathB                                        | `0x3500146`      | No                                                                           | Yes (main)             | Yes     |
| 13 Auto repeater | Repeater Whitelist                                    | `0x350015A`      | No                                                                           | Yes (main)             | Yes     |
| 13 Auto repeater | Auto Repeater1 UHF/VHF offset (idx1)                  | `0x3500068..+2`  | No (offset index; not offered)                                               | Yes (main)             | Yes     |
| 13 Auto repeater | Auto Repeater2 UHF/VHF offset (idx1)                  | `0x35000F1..+2`  | No (offset index; not offered)                                               | Yes (main)             | Yes     |
| 13 Auto repeater | Auto repeater 1 limits (f10Hz)                        | `0x35000C4..+16` | No (limits depend on the range; not offered)                                 | Yes (main)             | Yes     |
| 13 Auto repeater | Auto repeater 2 limits (f10Hz)                        | `0x35000F4..+16` | No (limits depend on the range; not offered)                                 | Yes (main)             | Yes     |
| 14 Record        | Record Function                                       | `0x3500022`      | No                                                                           | Yes (main)             | Yes     |
| 14 Record        | Record Delay                                          | `0x35000AE`      | No                                                                           | Yes (main)             | Yes     |
| 15 Volume/Audio  | DMR Mic Gain                                          | `0x350000F`      | Yes: `dmrMicGain`                                                            | Yes (main)             | Yes     |
| 15 Volume/Audio  | MON Key Function                                      | `0x3500025`      | No (firmware never reads it)                                                 | Yes (main)             | Yes     |
| 15 Volume/Audio  | Frequency Display                                     | `0x350002A`      | No (firmware never reads it)                                                 | Yes (main)             | Yes     |
| 15 Volume/Audio  | Voice Broadcast                                       | `0x3500035`      | No (firmware never reads it)                                                 | Yes (main)             | Yes     |
| 15 Volume/Audio  | Maximum Volume                                        | `0x350003B`      | Yes: `maxVolume`                                                             | Yes (main)             | Yes     |
| 15 Volume/Audio  | Digital Remote Kill                                   | not located      | No                                                                           | Unknown                | Unknown |
| 15 Volume/Audio  | Select TX-Contact                                     | `0x3500040`      | No (firmware never reads it)                                                 | Yes (main)             | Yes     |
| 15 Volume/Audio  | APRS Report                                           | not located      | No                                                                           | Unknown                | Unknown |
| 15 Volume/Audio  | Enhanced Sound Quality                                | `0x3500057`      | Yes: `audioProfile`                                                          | Yes (main)             | Yes     |
| 15 Volume/Audio  | SMS Confirmation                                      | `0x3500071`      | No (firmware never reads it)                                                 | Yes (main)             | Yes     |
| 15 Volume/Audio  | Max Headphone Volume                                  | `0x3500052`      | Yes: `maxHeadphoneVolume`                                                    | Yes (main)             | Yes     |
| 15 Volume/Audio  | APRS Ranging                                          | not located      | No                                                                           | Unknown                | Unknown |
| 15 Volume/Audio  | Very Low power                                        | not located      | No                                                                           | Unknown                | Unknown |
| 15 Volume/Audio  | Ana Mic Gain                                          | `0x3500113`      | Yes: `analogueMicGain`                                                       | Yes (main)             | Yes     |
| 15 Volume/Audio  | DRC Dynamic Ranagle Control(Rx AGC)                   | `0x3500147`      | Yes: `rxDrc`                                                                 | Yes (main)             | Yes     |
| 15 Volume/Audio  | RX Noise Reduction                                    | `0x3500148`      | Yes: `rxNoiseReduction`                                                      | Yes (main)             | Yes     |
| 15 Volume/Audio  | TX Noise Reduction                                    | `0x3500149`      | Yes: `txNoiseReduction`                                                      | Yes (main)             | Yes     |
| 15 Volume/Audio  | NX Mic Gain                                           | `0x3500153`      | No                                                                           | Yes (main)             | Yes     |
| 15 Volume/Audio  | Power On Volume Type                                  | `0x3500155`      | Yes: `powerOnVolumeType`                                                     | Yes (main)             | Yes     |
| 15 Volume/Audio  | Power On Volume                                       | `0x3500156`      | Yes: `powerOnVolumeLevel`                                                    | Yes (main)             | Yes     |
| 15 Volume/Audio  | Sub SpkInTx                                           | `0x350015B`      | No                                                                           | Yes (main)             | Yes     |
| 15 Volume/Audio  | Man Down                                              | `0x3500024`      | No                                                                           | Yes (main)             | Yes     |
| 15 Volume/Audio  | Man Down Delay                                        | `0x350004F`      | No                                                                           | Yes (main)             | Yes     |
| 16 Alert Tone1   | Alert-tone rows 1-3                                   | `0x3500072..+60` | No                                                                           | Yes (main)             | Yes     |
| 16 Alert Tone1   | Alert-tone rows 4-5                                   | `0x3500116..+40` | No                                                                           | Yes (main)             | Yes     |
| 17 Satellite     | Sate Location                                         | `0x350014E`      | No (radio state, never patched)                                              | Yes (main)             | Yes     |
| 17 Satellite     | Sate TX Power                                         | `0x350014F`      | No (radio state, never patched)                                              | Yes (main)             | Yes     |
| 17 Satellite     | Sate ANA Sql                                          | `0x3500150`      | No (radio state, never patched)                                              | Yes (main)             | Yes     |
| 17 Satellite     | Sate Aos Limit                                        | `0x3500151`      | No                                                                           | Yes (main)             | Yes     |
| fw only          | DTMF speed (radio menu)                               | `0x3500023`      | No                                                                           | Yes (main)             | Yes     |

## Other settings-type data the CPS writes

Families outside the Optional Settings form. "Wiped" is the same boot-time reset; "Kept" families are in units the reset does not touch, so a range change leaves them alone and a restore does not need them.

| Family                                                                                           | Address                      | Studio models it                             | Range change |
| ------------------------------------------------------------------------------------------------ | ---------------------------- | -------------------------------------------- | ------------ |
| Optional settings main (incl. `+0x160..+0x1FF`, which the CPS writes as `00`)                    | `0x3500000` `+0x000..+0x1FF` | 71 fields                                    | Wiped        |
| MM9PDY settings store (stock never reads it)                                                     | `+0x200..+0x21F`             | Backup span only                             | Wiped        |
| Zone A/B channel position                                                                        | `+0x400..+0x7FF`             | Yes (codeplug Write)                         | Wiped        |
| DTMF list                                                                                        | `+0x800..+0x8FF`             | Backup span only                             | Wiped        |
| Power-on lines and password                                                                      | `+0x900..+0x947`             | Lines and password                           | Wiped        |
| APRS config, APRS text, GPS text, receive filters                                                | `+0x1000..+0x13FF`           | APRS partly (`aprsCodec.ts`)                 | Wiped        |
| GPS zone-switch records (32 x `0x20`)                                                            | `+0x2000..+0x23FF`           | Backup span only                             | Wiped        |
| APRS fixed-beacon names (8 x `0x22`)                                                             | `+0x2400..+0x250F`           | Backup span only                             | Wiped        |
| Zone names                                                                                       | `0x3600000`                  | Yes                                          | Wiped        |
| VFO A/B channels (slots 4000/4001)                                                               | `0x1F81000`, `0x1F81080`     | Backup span only; Write never stages them    | Wiped        |
| Master ID                                                                                        | `0x3684000`                  | Yes                                          | Kept         |
| DTMF settings, 2-tone, 5-tone, alarm, auto-repeater offsets, channel/zone/scan bitmaps           | unit `0x3480000`             | Bitmaps yes; alarm inspect-only; the rest no | Kept         |
| MDC1200, one-touch                                                                               | `0x3700000..`                | No                                           | Kept         |
| Broadcast FM                                                                                     | `0x3400000..`                | No                                           | Kept         |
| Roaming channels and zones, prefab SMS, analogue address book, encryption keys, NXDN roam bitmap | various                      | No                                           | Kept         |

"Backup span only" means Studio copies the bytes on Backup and puts them back on Restore but has no field or codec for them. Kept families are not in the zip (a general backup-coverage gap, separate from the range change).

## Related

- [optional-settings.md](optional-settings.md): offered fields, encodings, firmware clamps, what is not offered and why.
- [memory-layout.md](memory-layout.md): the settings-unit map, the range-dependent bytes, usage-volatile bytes.
- [band-code.md](band-code.md): the range change that causes the wipe. [Radio settings feature](../../../../features/radio-read-write/at-d890uv-radio-settings.md).
- The firmware repo's `docs/reference/cps/records/optional-settings.md` has the same form with the firmware's meanings.
