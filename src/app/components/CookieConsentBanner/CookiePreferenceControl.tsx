import { Button, Radio, Stack, Text } from '@mantine/core';
import {
  clearAnalyticsConsent,
  setAnalyticsConsent,
  type AnalyticsConsentChoice,
} from '@integrations/preferences/analyticsConsent.ts';
import { useAnalyticsConsent } from '../../hooks/useAnalyticsConsent.ts';

export default function CookiePreferenceControl() {
  const { choice } = useAnalyticsConsent();

  const handleChange = (value: string) => {
    if (value === 'accepted' || value === 'declined') {
      setAnalyticsConsent(value as AnalyticsConsentChoice);
    }
  };

  return (
    <Stack gap="sm">
      <Radio.Group
        label="Analytics cookies"
        description="Change your choice at any time. Essential app storage is always enabled."
        value={choice ?? ''}
        onChange={handleChange}
      >
        <Stack gap="xs" mt="xs">
          <Radio value="accepted" label="Accept analytics — anonymous page usage only" />
          <Radio value="declined" label="Essential only — no analytics cookies" />
        </Stack>
      </Radio.Group>
      {choice !== null ? (
        <Text size="sm" c="dimmed">
          Your current choice is saved in this browser.
        </Text>
      ) : (
        <Text size="sm" c="dimmed">
          You have not chosen yet. The cookie banner will appear on your next visit to a page that
          shows it.
        </Text>
      )}
      <Button
        variant="subtle"
        size="compact-sm"
        w="fit-content"
        onClick={() => clearAnalyticsConsent()}
      >
        Reset choice (show banner again)
      </Button>
    </Stack>
  );
}
