import { Anchor } from '@mantine/core';
import { Link } from 'react-router-dom';
import LegalDocumentLayout from '../../components/legal/LegalDocumentLayout.tsx';
import { GITHUB_ISSUES_URL, GITHUB_REPO_URL } from '../../lib/githubLinks.ts';

export default function PrivacyPolicyPage() {
  return (
    <LegalDocumentLayout title="Privacy policy" lastUpdated="March 2026">
      <p>
        Codeplug Studio keeps your library on this device — in the browser or in the Android
        companion app. Programming a radio over USB does not upload your codeplug. Nothing is sent
        off the device unless you start it (for example Google Drive, a remote directory lookup, or
        analytics you accepted). We do not operate a server that stores your codeplug contents.
      </p>

      <h2>Android companion</h2>
      <p>
        The Android phone app is the same Codeplug Studio product you use in a browser, wrapped so
        you can carry your library and program a radio over USB. It is not a separate service with
        different data rules. What you store on the phone stays on the phone unless you choose to
        send it elsewhere.
      </p>

      <h2>What stays on your device</h2>
      <ul>
        <li>Project and library data in on-device storage (browser or phone app)</li>
        <li>
          UI preferences (active project, map settings, list filters, optional Google Drive tokens
          if you connect)
        </li>
        <li>Cookie consent choice (see the Cookies page)</li>
      </ul>

      <h2>Programming the radio over USB</h2>
      <p>
        When you read or write a radio from the Android app over a USB cable (with an OTG adapter
        where needed), the codeplug bytes stay between the phone and the radio. That exchange does
        not upload your codeplug to Codeplug Studio servers.
      </p>

      <h2>When something does leave your device</h2>
      <p>Data leaves this device only when you ask for it. Typical cases:</p>
      <ul>
        <li>Looking up a remote repeater or RadioID-style directory — you start the search</li>
        <li>Saving or loading with Google Drive — you connect and choose to sync</li>
        <li>Anonymous page-view analytics — only if you accepted analytics cookies</li>
      </ul>

      <h2>Google Drive access</h2>
      <p>
        If you connect Google Drive (Settings, or Open/Save from Drive), Studio requests
        Google&apos;s <code>drive.file</code> OAuth scope — access limited to files Studio itself
        creates, not your whole Drive. On first connect, Studio creates a &quot;Codeplug
        Studio&quot; folder in your Drive and keeps all browsing, opening, and saving inside that
        one folder; it cannot see or list anything else in your Drive.
      </p>
      <p>
        Drive data is never shared with any third party, sold, or used for anything beyond the
        open/save you asked for. The OAuth access token (and, on Android, a refresh token) stay in
        this device&apos;s storage only. Disconnecting from Settings revokes the token immediately;
        tokens also expire on their own and are cleared automatically.
      </p>

      <h2>Optional analytics</h2>
      <p>
        If you accept analytics cookies, we load Google Analytics 4 to measure anonymous page
        navigation (which routes are visited, rough session counts). This applies on the website and
        in the Android companion app. We do not send project names, channel data, callsigns, API
        tokens, or storage keys to Google. Analytics only runs after you opt in. See the{' '}
        <Anchor component={Link} to="/cookies" size="sm">
          Cookies
        </Anchor>{' '}
        page to change your choice.
      </p>

      <h2>Contact</h2>
      <p>
        Questions or concerns: open an issue on{' '}
        <Anchor href={GITHUB_ISSUES_URL} target="_blank" rel="noreferrer">
          GitHub
        </Anchor>{' '}
        or see the{' '}
        <Anchor href={GITHUB_REPO_URL} target="_blank" rel="noreferrer">
          repository
        </Anchor>
        .
      </p>

      <p>
        <em>This page is informal guidance for a hobby tool — not legal advice.</em>
      </p>
    </LegalDocumentLayout>
  );
}
