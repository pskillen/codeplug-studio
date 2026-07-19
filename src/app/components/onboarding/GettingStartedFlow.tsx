import { Box, Group, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconArrowDown } from '@tabler/icons-react';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';

export interface GettingStartedFlowStep {
  title: string;
  detail: string;
}

export interface GettingStartedFlowProps {
  steps: readonly GettingStartedFlowStep[];
  /** Accessible name for the step list */
  ariaLabel: string;
}

export default function GettingStartedFlow({ steps, ariaLabel }: GettingStartedFlowProps) {
  return (
    <Box
      component="ol"
      aria-label={ariaLabel}
      style={{ listStyle: 'none', margin: 0, padding: 0 }}
    >
      <Stack gap="xs">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          return (
            <Box component="li" key={step.title}>
              <Stack gap="xs">
                <Group
                  gap="sm"
                  wrap="nowrap"
                  align="flex-start"
                  p="sm"
                  style={{
                    border: '1px solid var(--mantine-color-default-border)',
                    borderRadius: 'var(--mantine-radius-md)',
                    background: 'var(--mantine-color-body)',
                  }}
                >
                  <ThemeIcon size={28} radius="xl" variant="light" color="brand" aria-hidden>
                    <Text size="sm" fw={700}>
                      {index + 1}
                    </Text>
                  </ThemeIcon>
                  <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                    <Text fw={600} size="sm">
                      {step.title}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {step.detail}
                    </Text>
                  </Stack>
                </Group>
                {!isLast ? (
                  <Group justify="center" aria-hidden>
                    <IconArrowDown size={ICON_SIZE_NAV} stroke={ICON_STROKE} opacity={0.55} />
                  </Group>
                ) : null}
              </Stack>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
