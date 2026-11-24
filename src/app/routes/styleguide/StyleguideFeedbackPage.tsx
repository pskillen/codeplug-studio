import { Group, Stack } from '@mantine/core';
import { StyleguidePageShell, StyleguideSection } from './StyleguidePageShell.tsx';
import { WarningsList } from '../../components/egress/index.ts';
import {
  styleguideChannelLabel,
  styleguideWarningsListDemo,
} from '../../components/egress/WarningsList/warningsListDemo.ts';
import { DismissibleNotice, StatusBanner, StatusDot } from '../../components/v2/index.ts';

const DEMO_WARNINGS = styleguideWarningsListDemo();

export default function StyleguideFeedbackPage() {
  return (
    <StyleguidePageShell title="Feedback" description="Status surfaces and dismissible chrome.">
      <StyleguideSection title="StatusBanner" description="Success, warning, and info tones.">
        <Stack gap="sm">
          <StatusBanner tone="success">
            No dangling references — all relationships resolve.
          </StatusBanner>
          <StatusBanner tone="warning">3 channels reference a missing talk group.</StatusBanner>
          <StatusBanner tone="info">
            Export combines library + build via assemble — re-import may differ.
          </StatusBanner>
        </Stack>
      </StyleguideSection>

      <StyleguideSection
        title="StatusDot"
        description="Compact inline status — write/sync/verify state."
      >
        <Group gap="md">
          <StatusDot label="Verified" tone="success" />
          <StatusDot label="Pending" tone="neutral" />
          <StatusDot label="Overridden" tone="accent" />
          <StatusDot label="Drift detected" tone="warning" />
          <StatusDot label="Write failed" tone="destructive" />
        </Group>
      </StyleguideSection>

      <StyleguideSection
        title="DismissibleNotice"
        description="Chrome-level, single-line, no re-show once dismissed — distinct from StatusBanner."
      >
        <Stack gap="sm">
          <DismissibleNotice
            tone="warning"
            action={{ label: 'Reconnect', onClick: () => undefined }}
          >
            Drive session expired.
          </DismissibleNotice>
          <DismissibleNotice tone="info">
            Export combines library + build via assemble — re-import may differ.
          </DismissibleNotice>
        </Stack>
      </StyleguideSection>

      <StyleguideSection
        title="Warnings list"
        description="Export and write warnings — problems open, notes folded; same component in four modes."
      >
        <Stack gap="lg">
          <div>
            <strong>Full</strong> (build checks / file export)
            <WarningsList
              warnings={DEMO_WARNINGS}
              mode="full"
              channelLabel={styleguideChannelLabel}
            />
          </div>
          <div>
            <strong>Problems</strong> (Review)
            <WarningsList
              warnings={DEMO_WARNINGS}
              mode="problems"
              channelLabel={styleguideChannelLabel}
            />
          </div>
          <div>
            <strong>Chip</strong> (tight space)
            <WarningsList warnings={DEMO_WARNINGS} mode="chip" />
          </div>
          <div>
            <strong>Recap</strong> (Done)
            <WarningsList
              warnings={DEMO_WARNINGS}
              mode="recap"
              channelLabel={styleguideChannelLabel}
            />
          </div>
        </Stack>
      </StyleguideSection>
    </StyleguidePageShell>
  );
}
