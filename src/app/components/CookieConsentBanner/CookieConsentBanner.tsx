import { Anchor, Button, Group, Paper, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { setAnalyticsConsent } from '@integrations/preferences/analyticsConsent.ts';
import { useAnalyticsConsent } from '../../hooks/useAnalyticsConsent.ts';

export default function CookieConsentBanner() {
  const { choice } = useAnalyticsConsent();

  if (choice !== null) {
    return null;
  }

  return (
    <Paper
      component="div"
      role="dialog"
      aria-label="Cookie consent"
      shadow="md"
      p="md"
      radius="md"
      withBorder
      style={{
        position: 'fixed',
        bottom: '1rem',
        left: '1rem',
        right: '1rem',
        zIndex: 200,
        maxWidth: '48rem',
        marginInline: 'auto',
      }}
    >
      <Text size="sm" mb="sm">
        We use essential browser storage for your projects and preferences. With your permission we
        also load Google Analytics to measure anonymous page usage — never your codeplug data. See
        our{' '}
        <Anchor component={Link} to="/privacy" size="sm">
          Privacy policy
        </Anchor>{' '}
        and{' '}
        <Anchor component={Link} to="/cookies" size="sm">
          Cookies
        </Anchor>{' '}
        pages.
      </Text>
      <Group gap="sm">
        <Button size="compact-sm" onClick={() => setAnalyticsConsent('accepted')}>
          Accept analytics
        </Button>
        <Button size="compact-sm" variant="default" onClick={() => setAnalyticsConsent('declined')}>
          Essential only
        </Button>
      </Group>
    </Paper>
  );
}
