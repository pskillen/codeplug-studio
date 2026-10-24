# CredentialMissingNotice

Point-of-use prompt for a missing bring-your-own API key or token.

## Purpose

Replaces terse "token required" lines. Says which credential the action needs and what it costs, then links to the Settings section (with scroll) and the provider page. See [api-keys.md](../../../../docs/features/app-shell/api-keys.md).

## Props

| Prop      | Type                   | Notes                                                                    |
| --------- | ---------------------- | ------------------------------------------------------------------------ |
| `guide`   | `CredentialGuide`      | From `src/app/lib/credentialGuides.tsx`                                  |
| `action`  | `string`               | What the operator is doing, e.g. "Searching RepeaterBook"                |
| `variant` | `'banner' \| 'inline'` | Default `banner` (warning `StatusBanner`); `inline` is a quiet paragraph |

## Usage

```tsx
{
  !search.hasApiKey ? (
    <CredentialMissingNotice guide={OPENAIP_API_KEY_GUIDE} action="Searching OpenAIP" />
  ) : null;
}
```

Must render inside a router (uses `Link`).

## Related

- [CredentialSetupField](CredentialSetupField.md)
