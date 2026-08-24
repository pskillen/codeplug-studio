# Play Store listing assets

Creative and copy for the Play Console listing (#898), staged here so #890 (Play Console submission, Data Safety form, Closed Testing) doesn't have to wait on missing art. Regenerate the graphics from `assets/*.svg` at the repo root if the brand mark changes — see [Regenerating](#regenerating) below.

## Graphics

| File                                                                                 | Dimensions                     | Play Console slot                                                                          |
| ------------------------------------------------------------------------------------ | ------------------------------ | ------------------------------------------------------------------------------------------ |
| [hi-res-icon-512.png](hi-res-icon-512.png)                                           | 512×512, 32-bit PNG with alpha | High-res icon                                                                              |
| [feature-graphic-1024x500.png](feature-graphic-1024x500.png)                         | 1024×500, no alpha             | Feature graphic                                                                            |
| [screenshot-1-home.png](screenshot-1-home.png)                                       | 1236×2676                      | Phone screenshot — home / what Studio does                                                 |
| [screenshot-2-add-from-directories.png](screenshot-2-add-from-directories.png)       | 1236×2676                      | Phone screenshot — importing from directories                                              |
| [screenshot-3-nearby-repeaters.png](screenshot-3-nearby-repeaters.png)               | 1236×2676                      | Phone screenshot — ukrepeater.net search + map                                             |
| [screenshot-4-channel-set-import.png](screenshot-4-channel-set-import.png)           | 1236×2676                      | Phone screenshot — built-in frequency grid (PMR446) preview                                |
| [screenshot-5-directory-comparison.png](screenshot-5-directory-comparison.png)       | 1236×2676                      | Phone screenshot — ukrepeater.net directory-comparison diff for a manually-entered channel |
| [screenshot-6-brandmeister-talkgroups.png](screenshot-6-brandmeister-talkgroups.png) | 1236×2676                      | Phone screenshot — BrandMeister talk-group / RX group list sync                            |
| [screenshot-7-new-build-choose-radio.png](screenshot-7-new-build-choose-radio.png)   | 1236×2676                      | Phone screenshot — New build, choose-radio step                                            |

All screenshots are real app UI captured from the dev server at a phone viewport (412×892 CSS px, 3x device scale) — not mockups. Screenshots 5 and 6 use a real repeater (GB7GL, a 70cm DMR repeater in Glasgow): the channel was hand-entered with deliberately wrong 2m frequencies so the directory-comparison diff has something real to show, and the talk-group sync pulled GB7GL's actual BrandMeister static talk groups. `feature-graphic.svg` is the editable source for the feature graphic (reuses the `public/branding/studio-hero.svg` composition, height-fit to 1024×500).

Play Store requirements this satisfies: high-res icon ≥512×512 with alpha; feature graphic exactly 1024×500 with no alpha; ≥2 phone screenshots (short side ≥320px, long side ≤3840px) — see [Google's spec](https://support.google.com/googleplay/android-developer/answer/9866151).

## Listing copy

**App name:** Codeplug Studio

**Short description** (68/80 chars):

> Build your ham radio channel library once. Export to any CPS format.

**Category:** Tools (not Communication — Studio doesn't send or receive traffic itself)

**Full description** (2,246/4,000 chars):

> Codeplug Studio is a library-first tool for building amateur radio channel libraries — no more retyping the same channels, talk groups, and contacts for every radio you own.
>
> **WHY CODEPLUG STUDIO**
>
> Most vendor programming software (CPS) makes you build a codeplug from scratch, per radio. Codeplug Studio flips that: curate one shared library of channels, talk groups, contacts, and lists, then assemble a format-specific build for each radio. Export CPS-ready files whenever your library changes — no manual re-entry.
>
> **KEY FEATURES**
>
> - One library, many radios: keep a single master inventory of channels, talk groups, and contacts, then organise it per radio with format builds (zones, scan lists, or flat memory, depending on what your CPS expects).
> - Pull in real data: search public repeater directories (UK repeater directory, RepeaterBook, BrandMeister) and import listings straight into your library instead of typing frequencies by hand.
> - Built-in frequency grids: add curated channel sets like PMR446, UK CB, and UK simplex calling channels in one step.
> - Export for your CPS: generate CPS-ready files for supported formats (OpenGD77, DM32, CHIRP, native YAML, and more) from the same library.
> - USB-OTG programming: on supported Android devices, connect a compatible radio over a USB-OTG cable and program it directly from your phone, alongside file export.
> - Optional Google Drive backup: connect Drive to save and reopen your projects across devices. Studio only ever touches its own "Codeplug Studio" folder in your Drive — never the rest of your files.
> - Your data stays yours: your library lives in this device's storage unless you export a file or connect Drive yourself. No ads, no data sold to third parties. Anonymous usage analytics are opt-in.
>
> **WHO IT'S FOR**
>
> Amateur (ham) radio operators who own more than one radio, or who are tired of hand-typing the same repeaters and talk groups into every vendor's CPS. Codeplug Studio is a companion to your vendor CPS, not a replacement — some radios still require your vendor's software as the final programming step.
>
> Frequency and site data imported from public directories is provided for amateur programming convenience and is not authoritative for emergency operations.

**Policy URLs** (already hosted, confirm they still resolve before submitting in #890):

- Privacy policy — `https://codeplug.mm9pdy.net/privacy`
- Terms — `https://codeplug.mm9pdy.net/terms`

### A note on the USB-OTG claim

The listing copy above describes USB-OTG programming as a feature. Per [android-app/README.md](../README.md#implementation-status), the USB-serial path has unit/mock coverage but **hardware OTG read/write is still outstanding**. Re-verify this claim against real hardware before #890 actually submits the listing — soften or cut the bullet if hardware verification hasn't landed by then.

## Regenerating

The in-app icon and splash screen are generated by `@capacitor/assets` from SVG sources at the repo root (`assets/icon-foreground.svg`, `assets/icon-background.svg`, `assets/icon-only.svg`, `assets/splash.svg`). Re-run after editing those:

```bash
npx capacitor-assets generate --android
```

The feature graphic and hi-res icon are rendered directly from SVG here via `sharp` (no CLI wrapper — small enough to do by hand):

```js
import sharp from 'sharp';
await sharp('assets/icon-only.svg')
  .resize(512, 512)
  .ensureAlpha()
  .png()
  .toFile('docs/features/android-app/store-assets/hi-res-icon-512.png');
await sharp('docs/features/android-app/store-assets/feature-graphic.svg')
  .resize(1024, 500)
  .flatten({ background: '#0f172a' })
  .png()
  .toFile('docs/features/android-app/store-assets/feature-graphic-1024x500.png');
```

Screenshots were captured with Playwright against `npm run dev` at a 412×892 viewport (3x device scale), dark colour scheme. Re-run similar flows if the UI changes enough to make these stale:

- Screenshots 1–4: Home → New project → Library → Channels → Add from…
- Screenshot 5–6: Library → Channels → New channel (callsign `GB7GL`, add a DMR mode profile) → Save → open the channel → **Identity** → Check ukrepeater.net (screenshot the "Directory comparison" dialog) → **Mode settings → DMR** → Check BrandMeister talk groups & RX list (screenshot the "RX group list sync" dialog). The BrandMeister repeater button only appears once the channel has a DMR mode profile.
- Screenshot 7: Export for radio → New build (`/builds/new`).
