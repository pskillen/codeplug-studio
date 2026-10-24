# CredentialSetupField

Settings block for one bring-your-own API key or token.

## Purpose

Tells the operator what the key unlocks, whether it is required, and how to get one, then takes the key and shows whether it is saved. See [api-keys.md](../../../../docs/features/app-shell/api-keys.md).

## Props

| Prop            | Type                      | Notes                                              |
| --------------- | ------------------------- | -------------------------------------------------- |
| `guide`         | `CredentialGuide`         | From `src/app/lib/credentialGuides.tsx`            |
| `value`         | `string`                  | Input draft                                        |
| `onChange`      | `(value: string) => void` |                                                    |
| `hasSavedValue` | `boolean`                 | A non-empty value is saved                         |
| `isDirty`       | `boolean`                 | Draft differs from the saved value                 |
| `onSave`        | `() => void`              | Called by **Save** and Enter, only while `isDirty` |
| `onClear`       | `() => void`              | Removes the saved value and the draft              |

## Usage

```tsx
const repeaterBook = useRepeaterBookSettings();

<CredentialSetupField
  guide={REPEATERBOOK_TOKEN_GUIDE}
  value={repeaterBook.repeaterBookTokenDraft}
  onChange={repeaterBook.setRepeaterBookToken}
  hasSavedValue={repeaterBook.hasToken}
  isDirty={repeaterBook.isDirty}
  onSave={repeaterBook.saveToken}
  onClear={repeaterBook.clearToken}
/>;
```

## Behaviour

- Root element carries `guide.sectionId` so `scrollToPageSection` deep links land on it.
- "How to get …" steps are a native `<details>`: open while nothing is saved, collapsed once saved.
- `guide.formatHint` shows a non-blocking warning under the input.
- Status line (`aria-live="polite"`): `Not set`, `Unsaved changes…`, or `Saved in this browser`.

## Related

- [CredentialMissingNotice](CredentialMissingNotice.md)
