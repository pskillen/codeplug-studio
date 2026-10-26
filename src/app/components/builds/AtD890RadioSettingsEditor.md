# AtD890RadioSettingsEditor

## Purpose

The body of the AT-D890UV Radio settings page (`/builds/:id/export/radio-settings`): the "Read a radio" control, the read banner and read-only rows, the nudge, the sections of v1 fields with a Keep / Set control each, and the sticky changes footer. It renders from core field metadata (`radioSettings.ts`) and holds no wire detail. State lives in the per-build session store `atD890RadioSettingsSession`; nothing is saved in the project.

`AtD890RadioSettingsReadButton` (same folder) is the Read a radio control and is not reusable on its own: it reads only the settings through `readAtD890SettingsFromRadio`, shows progress, a Cancel (offered once the browser's port picker has closed, because the picker cannot be aborted) and errors in an alert, and stores the result as the page's Radio column. It sets no override.

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

- **States.** Not read (every Radio column says "not read", values can still be set); Read (banner "Read from <name> (<serial>) at <hh:mm> · range <range>", read-only rows for frequency range, firmware ("unknown") and serial (shown in full)); Changed (sticky footer; under 40 rem the interim "Write arrives later" note is visually hidden, kept for screen readers, so the footer is one short row).
- **Keep / Set.** Every field defaults to Keep radio's value. Setting a field adds a session override; **Clear** on the row returns it to Keep. A read never sets or clears an override.
- **Copy all from this radio** (after a read) turns every readable value into an override after a confirm; **Clear all** (footer) clears every override after a confirm.
- **Footer** (only with changes): "N changes", Clear all, **Write settings…** (sets a request in the session store and goes to the Export page, where the Write stepper opens with only Radio settings ticked), and a link to Back up a radio. The read-only range row gives name, code and transmit bands from `describeAtD890FrequencyRange`.
- **Start-up warning.** Power-on screen = Custom text with line 1 empty shows a warning in the Start-up section.
- **Show advanced settings** (toolbar switch, off by default, per tab in the session store): shows an Advanced panel with a warning banner and the advanced fields (language, power-on password, working mode, repeater mode, remote features, encryption type, auto repeater A/B). Turning it off while advanced changes are set asks first and discards them. Language is disabled before a read and offers only what the read radio's region lock keeps; the power-on password is [AtD890PowerOnPasswordRow](./AtD890PowerOnPasswordRow.md). Change counts count the password pair once.
- **Step-key nudge** (MM9PDY target): [Mm9pdyStepKeysNudge](./Mm9pdyStepKeysNudge.md) above the Keys section.
- **Read a radio ends the session with `END`**, so the radio restarts (about 20 s). The page says so after a read.

## Related

- [AtD890RadioSettingRow](./AtD890RadioSettingRow.md)
- [AtD890PowerOnPasswordRow](./AtD890PowerOnPasswordRow.md)
- [AT-D890UV radio settings](../../../../docs/features/radio-read-write/at-d890uv-radio-settings.md)
