import { Anchor } from '@mantine/core';
import { Link } from 'react-router-dom';
import CookiePreferenceControl from '../../components/CookieConsentBanner/CookiePreferenceControl.tsx';
import LegalDocumentLayout from '../../components/legal/LegalDocumentLayout.tsx';

export default function CookiesPage() {
  return (
    <LegalDocumentLayout title="Cookies & storage" lastUpdated="March 2026">
      <h2>Essential storage</h2>
      <p>
        These are required for the app to work — in the browser and in the Android companion app.
        They are not used for advertising or cross-site tracking.
      </p>
      <ul>
        <li>
          <strong>On-device project storage</strong> — your projects, library entities, and format
          builds
        </li>
        <li>
          <strong>Preferences</strong> — active project, map token, list filters, optional Google
          Drive session if you connect
        </li>
        <li>
          <strong>Cookie consent record</strong> — remembers whether you accepted or declined
          analytics
        </li>
      </ul>

      <h2>Optional analytics cookies</h2>
      <p>
        If you accept analytics, Google Analytics 4 may set cookies to measure anonymous page views.
        The same choice applies on the website and inside the phone app. No codeplug data is
        included. You can decline and use the app fully — only usage statistics are withheld. See
        the{' '}
        <Anchor component={Link} to="/privacy" size="sm">
          Privacy policy
        </Anchor>{' '}
        for more detail.
      </p>

      <h2>Your preference</h2>
      <div id="cookie-preference">
        <CookiePreferenceControl />
      </div>
    </LegalDocumentLayout>
  );
}
