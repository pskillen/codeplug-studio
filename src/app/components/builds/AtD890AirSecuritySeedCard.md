# AtD890AirSecuritySeedCard

## Purpose

Brandmeister AirSecurity on the MM9PDY AT-D890UV radio settings page. The operator pastes a seed, checks whether the radio has one, writes it, or clears it. Studio then only says whether a seed is set. The paste and the parsed bytes stay in this component until they are wiped.

## Props

| Prop     | Type         | Notes                                                                                                   |
| -------- | ------------ | ------------------------------------------------------------------------------------------------------- |
| `egress` | `EgressPath` | The build's Web Serial egress. The radio settings page renders this card only for the MM9PDY AT-D890UV. |

## Usage

```tsx
<AtD890AirSecuritySeedCard egress={egress} />
```

## Behaviour

- **Field.** Label **AirSecurity seed**. Placeholder _Paste the Selfcare text or the otpauth:// link_. `type="password"`, `autoComplete="new-password"`, no reveal control.
- **State.** **Not checked** until Check radio. Then **Seed set** or **No seed**. After Write seed the state is **Seed set** without reading the radio again. After Clear seed it is **No seed**.
- **Buttons.** **Check radio**, **Write seed**, **Clear seed**. Each opens its own session (port grant first, then open, close in `finally`) and closes it. Write seed stays off until the paste is accepted. A bad paste shows the refusal and does not repeat the text. A radio error shows that error's message.
- **Warning.** Always: _Backups contain the seed. Clearing the seed does not remove it from backups you have already taken._ After a write: _Seed written. The radio restarts; wait about 20 seconds._ After a clear: _Seed cleared. The radio restarts; wait about 20 seconds._
- **DMR ID.** When the paste is accepted and it is an `otpauth://totp/` link whose label starts with `BrandMeister:` (any case) plus a DMR ID, and that ID is not one of this library's DMR IDs, the card says _The link is for DMR ID {id}, which is not one of this library's DMR IDs._ Write seed stays available. A refused paste does not show it. Self-care text does not show it.
- **Turning it on in Brandmeister.** Under the buttons, a numbered list _Turn on AirSecurity in Brandmeister_: write the seed and wait for **Seed set**; on a DMR channel that transmits with this DMR ID, press the BM AirSecurity key, then PTT briefly; the radio shows the number it calls, 9 and six digits; enter those six digits (without the 9) as the code in Brandmeister Selfcare straight away, because the code changes every 30 seconds.
- **Wiped.** The field is cleared and the parsed bytes are zeroed after Write seed, after Clear seed, and when the card unmounts. Nothing is written to browser storage, the project, a build override, the settings session, a URL, the console, or an error message.

## Related

- [Brandmeister AirSecurity seed](../../../../docs/features/modded-firmware/airsecurity-seed.md)
