import { useState } from 'react';
import { Anchor, Stack, Text } from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { GettingStartedModal } from '../components/onboarding/index.ts';
import { Button, DesignSystemV2Provider, Panel } from '../components/v2/index.ts';
import { GITHUB_ISSUES_URL, GITHUB_REPO_URL } from '../lib/githubLinks.ts';
import classes from './HelpPage.module.css';

const WORKFLOW_LINKS = [
  {
    label: 'Build a codeplug from scratch',
    to: '/library/channels',
    description: 'Create a project, fill the library, then export from a format build.',
  },
  {
    label: 'Import from a directory',
    to: '/library/channels',
    description: 'Use Add from… on Channels for repeaters, talk groups, and curated sets.',
  },
  {
    label: 'Configure APRS beaconing',
    to: '/library/aprs-configuration',
    description: 'Global APRS slots and per-channel digital bindings.',
  },
  {
    label: 'Export or write to radio',
    to: '/builds',
    description: 'Assemble a format build and export CPS-ready files.',
  },
] as const;

export default function HelpPage() {
  const [quickStartOpen, setQuickStartOpen] = useState(false);

  return (
    <DesignSystemV2Provider>
      <div className={classes.page}>
        <h1 className={classes.title}>Help</h1>
        <p className={classes.description}>
          Workflow overview, getting started, and where to send feedback.
        </p>

        <Stack gap="md">
          <Panel title="Getting started">
            <Text size="sm" className={classes.panelCopy}>
              The Quick start guide covers projects → library → builds → export, directories under{' '}
              <strong>Add from…</strong>, and how Studio differs from a typical CPS.
            </Text>
            <Button variant="primary" size="sm" onClick={() => setQuickStartOpen(true)}>
              Open quick start guide
            </Button>
          </Panel>

          <Panel title="Workflows">
            <ul className={classes.workflowList}>
              {WORKFLOW_LINKS.map((item) => (
                <li key={item.label}>
                  <Link to={item.to} className={classes.workflowLink}>
                    <span className={classes.workflowText}>
                      <span className={classes.workflowLabel}>{item.label}</span>
                      <span className={classes.workflowDescription}>{item.description}</span>
                    </span>
                    <IconChevronRight size={18} stroke={1.75} aria-hidden className={classes.chevron} />
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Feedback & issues">
            <Stack gap="xs">
              <Text size="sm">
                <Anchor href={GITHUB_ISSUES_URL} target="_blank" rel="noreferrer">
                  Report an issue
                </Anchor>{' '}
                — bug reports and feature requests on GitHub. Include steps to reproduce and which
                page you were on.
              </Text>
              <Text size="sm">
                <Anchor href={GITHUB_REPO_URL} target="_blank" rel="noreferrer">
                  Contact us / repository
                </Anchor>{' '}
                — source code, release notes, and contributor docs.
              </Text>
              <Text size="sm" c="dimmed">
                External data credits:{' '}
                <Anchor component={Link} to="/attributions" size="sm">
                  Attributions
                </Anchor>
              </Text>
            </Stack>
          </Panel>
        </Stack>

        <footer className={classes.footer}>
          <Anchor component={Link} to="/privacy" size="sm">
            Privacy
          </Anchor>
          <span aria-hidden>·</span>
          <Anchor component={Link} to="/terms" size="sm">
            Terms
          </Anchor>
        </footer>
      </div>

      <GettingStartedModal opened={quickStartOpen} onClose={() => setQuickStartOpen(false)} />
    </DesignSystemV2Provider>
  );
}
