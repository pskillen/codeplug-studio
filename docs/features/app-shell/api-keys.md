# API keys and tokens

Some Studio features call third-party services that need the operator's own credential. Studio never ships a shared key ([AGENTS.md — Privacy](../../../AGENTS.md#working-principles)). Each key is stored in browser `localStorage` only and sent only to the service it belongs to.

Issue: [#1390](https://github.com/pskillen/codeplug-studio/issues/1390).

## Credentials

| Credential           | Required?                        | Unlocks                                                                                       | Reference                                                                 |
| -------------------- | -------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| RepeaterBook token   | Required for RepeaterBook        | RepeaterBook search (NA + rest of world) and **Check RepeaterBook** on a channel              | [repeaterbook](../../reference/remote-directories/repeaterbook/README.md) |
| OpenAIP API key      | Required for airband import      | **Add airband from OpenAIP**                                                                  | [openaip](../../reference/remote-directories/openaip/README.md)           |
| Mapbox access token  | Optional (Photon is the default) | Mapbox geocoding in zone from location, Maidenhead / bearing tools, directory location search | [maidenhead.md](../maidenhead.md)                                         |
| Google Drive (OAuth) | Optional                         | Open / save project YAML in Drive                                                             | [google-drive.md](../import-export/google-drive.md)                       |

## Settings: one block per credential

`/settings` → **API keys and tokens** renders one [`CredentialSetupField`](../../../src/app/components/settings/CredentialSetupField.md) per key. Each block shows:

- **Requirement pill**: "Required for …" or "Optional".
- **Purpose**: what the key unlocks and where it is used in Studio.
- **How to get one**: numbered steps with direct links. The steps start expanded while nothing is saved and collapse once a key is saved.
- **Input**: masked, with a privacy note naming where the key is sent.
- **Format hint**: non-blocking. Examples: a RepeaterBook token not starting `rbuapp_`, or a Mapbox secret `sk.` token instead of a public `pk.` one.
- **Status**: `Not set`, `Unsaved changes`, or `Saved in this browser`. **Save** is enabled only while there are unsaved changes; Enter in the field saves.

Guide content lives in `src/app/lib/credentialGuides.tsx`. Both Settings and the point-of-use notices read from it, so they say the same thing. Save state comes from `useStoredCredential`. Feature hooks (`useRepeaterBookSettings`, `useOpenAipSettings`, `useMapSettings`) expose the **saved** value to features and the **draft** to Settings. An unsaved draft therefore never affects a search.

## Point of use

When a required key is missing, the feature shows [`CredentialMissingNotice`](../../../src/app/components/settings/CredentialMissingNotice.md). It says what is needed and that it is free, then links to the Settings section (scrolls via `location.state.scrollTo`) and to the provider page.

| Surface                               | Variant |
| ------------------------------------- | ------- |
| RepeaterBook directory search         | banner  |
| OpenAIP airband search                | banner  |
| Channel editor **Check RepeaterBook** | inline  |

Optional Mapbox hints (geocode centre field, Maidenhead address lookup, bearing look-up) say that Photon works with no setup. They link to the Mapbox section of Settings.

## Adding a credential

1. Load/save helpers in `src/integrations/preferences/`.
2. A hook in `src/app/hooks/` built on `useStoredCredential`. Expose the saved value to features.
3. A `CredentialGuide` in `credentialGuides.tsx` and a section id in `settingsSections.ts`.
4. A `CredentialSetupField` in `SettingsPage`, and a `CredentialMissingNotice` where the feature needs it.
5. A row in the table above.
