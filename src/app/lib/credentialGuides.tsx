import type { ReactNode } from 'react';
import {
  SETTINGS_MAPBOX_SECTION_ID,
  SETTINGS_OPENAIP_SECTION_ID,
  SETTINGS_REPEATERBOOK_SECTION_ID,
} from './settingsSections.ts';

/**
 * Operator-facing setup guide for one bring-your-own API key or token.
 * Rendered by `CredentialSetupField` (Settings) and `CredentialMissingNotice`
 * (point of use), so both say the same thing.
 */
export interface CredentialGuide {
  /** Settings section id — also the scroll target for deep links. */
  sectionId: string;
  /** Service name, e.g. "RepeaterBook". */
  service: string;
  /** What the operator calls this credential: "API token", "API key", "access token". */
  noun: string;
  /** Required for a feature, or an optional upgrade. */
  requirement: 'required' | 'optional';
  /** Short label for the requirement pill. */
  requirementLabel: string;
  /** One or two sentences: what this unlocks and where in Studio. */
  purpose: ReactNode;
  /** Cost / account note. */
  cost: string;
  /** Numbered steps for getting the credential. */
  steps: ReactNode[];
  /** Where the operator goes to create or copy the credential. */
  getUrl: string;
  /** Where the credential is sent when Studio uses it. */
  sentTo: string;
  placeholder: string;
  /** Non-blocking format hint for a draft value; null when it looks fine. */
  formatHint?: (value: string) => string | null;
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

export const REPEATERBOOK_TOKEN_GUIDE: CredentialGuide = {
  sectionId: SETTINGS_REPEATERBOOK_SECTION_ID,
  service: 'RepeaterBook',
  noun: 'API token',
  requirement: 'required',
  requirementLabel: 'Required for RepeaterBook',
  purpose:
    'Search RepeaterBook for repeaters in North America and the rest of the world, add them to your library, and use Check RepeaterBook on a channel.',
  cost: 'Free with a RepeaterBook account. Takes about a minute.',
  steps: [
    <>
      Sign in to <ExternalLink href="https://www.repeaterbook.com/">RepeaterBook</ExternalLink>, or
      create a free account.
    </>,
    <>
      Open{' '}
      <ExternalLink href="https://www.repeaterbook.com/user/api_apps.php">
        API Apps and Tokens
      </ExternalLink>
      .
    </>,
    <>
      Find <strong>Codeplug Studio</strong> (app ID 103) and generate a token.
    </>,
    <>
      Copy the token straight away. RepeaterBook shows it only once. It starts with{' '}
      <code>rbuapp_</code>.
    </>,
    <>Paste it below and press Save.</>,
  ],
  getUrl: 'https://www.repeaterbook.com/user/api_apps.php',
  sentTo:
    "RepeaterBook, via Studio's request proxy. The proxy forwards the token and does not keep it.",
  placeholder: 'rbuapp_…',
  formatHint: (value) =>
    value.startsWith('rbuapp_')
      ? null
      : 'RepeaterBook tokens start with rbuapp_. Check you copied the whole token.',
};

export const OPENAIP_API_KEY_GUIDE: CredentialGuide = {
  sectionId: SETTINGS_OPENAIP_SECTION_ID,
  service: 'OpenAIP',
  noun: 'API key',
  requirement: 'required',
  requirementLabel: 'Required for airband import',
  purpose:
    'Search OpenAIP for airports and import their tower, ATIS, approach and other frequencies as receive-only airband channels.',
  cost: 'Free with an OpenAIP account. Takes about a minute.',
  steps: [
    <>
      Sign in to <ExternalLink href="https://www.openaip.net/">openaip.net</ExternalLink>, or create
      a free account.
    </>,
    <>
      Open your user profile and go to <strong>API Clients</strong>.
    </>,
    <>Add a client with any name (for example &quot;Codeplug Studio&quot;) and copy its API key.</>,
    <>Paste it below and press Save.</>,
  ],
  getUrl: 'https://www.openaip.net/',
  sentTo: 'OpenAIP only, directly from your browser.',
  placeholder: 'Paste your OpenAIP API key',
};

export const MAPBOX_TOKEN_GUIDE: CredentialGuide = {
  sectionId: SETTINGS_MAPBOX_SECTION_ID,
  service: 'Mapbox',
  noun: 'access token',
  requirement: 'optional',
  requirementLabel: 'Optional',
  purpose: (
    <>
      Address and postcode search works without a token, using Photon (OpenStreetMap). Add a Mapbox
      token if you prefer Mapbox results. Studio uses it in zone from location, the Maidenhead and
      bearing tools, and location search in the repeater and airband directories.
    </>
  ),
  cost: 'Mapbox has a free usage tier. You need a Mapbox account.',
  steps: [
    <>
      Sign in to <ExternalLink href="https://account.mapbox.com/">Mapbox</ExternalLink>, or create
      an account.
    </>,
    <>
      Open{' '}
      <ExternalLink href="https://account.mapbox.com/access-tokens/">Access tokens</ExternalLink>.
    </>,
    <>
      Copy your <strong>Default public token</strong>. It starts with <code>pk.</code>
    </>,
    <>Paste it below and press Save.</>,
  ],
  getUrl: 'https://account.mapbox.com/access-tokens/',
  sentTo: 'Mapbox only, directly from your browser.',
  placeholder: 'pk.…',
  formatHint: (value) => {
    if (value.startsWith('sk.')) {
      return 'This is a secret token (sk.). Use a public token (pk.) instead. Secret tokens should never go in a browser.';
    }
    return value.startsWith('pk.') ? null : 'Mapbox public tokens start with pk.';
  },
};
