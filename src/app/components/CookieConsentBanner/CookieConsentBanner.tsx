import { Anchor, Switch, Text } from '@mantine/core';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  setAnalyticsConsent,
  type AnalyticsConsentChoice,
} from '@integrations/preferences/analyticsConsent.ts';
import { useAnalyticsConsent } from '../../hooks/useAnalyticsConsent.ts';
import { Button, DesignSystemV2Provider } from '../v2/index.ts';
import classes from './CookieConsentBanner.module.css';

export default function CookieConsentBanner() {
  const { choice } = useAnalyticsConsent();
  const [expanded, setExpanded] = useState(false);
  const [analyticsDraft, setAnalyticsDraft] = useState(false);

  if (choice !== null) {
    return null;
  }

  function openManage() {
    setAnalyticsDraft(false);
    setExpanded(true);
  }

  function acceptAll() {
    setAnalyticsConsent('accepted');
  }

  function rejectNonEssential() {
    setAnalyticsConsent('declined');
  }

  function savePreferences() {
    const next: AnalyticsConsentChoice = analyticsDraft ? 'accepted' : 'declined';
    setAnalyticsConsent(next);
  }

  return (
    <DesignSystemV2Provider>
      <div
        className={[classes.ribbon, expanded ? classes.expanded : ''].filter(Boolean).join(' ')}
        role="dialog"
        aria-label="Cookie consent"
      >
      <div className={classes.inner}>
        <Text size="sm" className={classes.copy}>
          We use essential browser storage for your projects and preferences. With your permission
          we also load Google Analytics to measure anonymous page usage — never your codeplug data.
          See our{' '}
          <Anchor component={Link} to="/privacy" size="sm">
            Privacy policy
          </Anchor>{' '}
          and{' '}
          <Anchor component={Link} to="/cookies" size="sm">
            Cookies
          </Anchor>{' '}
          pages.
        </Text>

        {expanded ? (
          <div className={classes.prefs}>
            <div className={classes.prefRow}>
              <div>
                <Text size="sm" fw={600}>
                  Necessary
                </Text>
                <Text size="xs" c="dimmed">
                  Required for projects, builds, and preferences on this device.
                </Text>
              </div>
              <Switch checked disabled label="Always on" labelPosition="left" />
            </div>
            <div className={classes.prefRow}>
              <div>
                <Text size="sm" fw={600}>
                  Analytics
                </Text>
                <Text size="xs" c="dimmed">
                  Anonymous page views only — no codeplug content.
                </Text>
              </div>
              <Switch
                checked={analyticsDraft}
                onChange={(event) => setAnalyticsDraft(event.currentTarget.checked)}
                aria-label="Analytics cookies"
              />
            </div>
          </div>
        ) : null}

        <div className={classes.actions}>
          {expanded ? (
            <>
              <Button variant="secondary" size="sm" onClick={rejectNonEssential}>
                Reject non-essential
              </Button>
              <Button variant="primary" size="sm" onClick={savePreferences}>
                Save preferences
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" size="sm" onClick={openManage}>
                Manage
              </Button>
              <Button variant="primary" size="sm" onClick={acceptAll}>
                Accept
              </Button>
            </>
          )}
        </div>
      </div>
      </div>
    </DesignSystemV2Provider>
  );
}
