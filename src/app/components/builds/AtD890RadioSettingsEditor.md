# AtD890RadioSettingsEditor

## Purpose

The body of the AT-D890UV Radio settings page (`/builds/:id/export/radio-settings`): the "Read a radio" control, the read banner and read-only rows, the nudge, the sections of v1 fields with a Keep / Set control each, and the sticky changes footer. It renders from core field metadata (`radioSettings.ts`) and holds no wire detail. State lives in the per-build session store `atD890RadioSettingsSession`; nothing is saved in the project.

`AtD890RadioSettingsReadButton` (same folder) is the Read a radio control and is not reusable on its own: it reads only the settings through `readAtD890SettingsFromRadio`, shows progress, a Cancel and errors in an alert, and stores the result as the page's Radio column. It sets no override.

## Props

| Prop      | Type                  | Notes                                                                |
| --------- | --------------------- | -------------------------------------------------------------------- |
| `buildId` | `string`              | Keys the session store                                               |
| `target`  | `'stock' \| 'mm9pdy'` | Key function names, the exposure tag and the nudge follow the target |
| `egress`  | `EgressPath`          | The build's AT-D890UV Web Serial egress; used to open the radio      |

## Usage

```tsx
<AtD890RadioSettingsEditor buildId={build.id} target="mm9pdy" egress={egress} />
```

## Behaviour

- **States.** Not read (every Radio column says "not read", values can still be set); Read (banner "Read from <name> (…<last 4>) at <hh:mm> · range <range>", read-only rows for frequency range, firmware ("unknown") and serial (last four only)); Changed (sticky footer).
- **Keep / Set.** Every field defaults to Keep radio's value. Setting a field adds a session override; **Clear** on the row returns it to Keep. A read never sets or clears an override.
- **Copy all from this radio** (after a read) turns every readable value into an override after a confirm; **Clear all** (footer) clears every override after a confirm.
- **Footer** (only with changes): "N changes", Clear all, "Writing these settings arrives with the next Write update." (until the Write step ships), and a link to Back up a radio.
- **Start-up warning.** Power-on screen = Custom text with line 1 empty shows a warning in the Start-up section.
- **Step-key nudge** (MM9PDY target): [Mm9pdyStepKeysNudge](./Mm9pdyStepKeysNudge.md) above the Keys section.
- **Read a radio ends the session with `END`**, so the radio restarts (about 20 s). The page says so after a read.

## Related

- [AtD890RadioSettingRow](./AtD890RadioSettingRow.md)
- [AT-D890UV radio settings](../../../../docs/features/radio-read-write/at-d890uv-radio-settings.md)
