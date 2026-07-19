import { Anchor, List, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';
import GettingStartedFlow from './GettingStartedFlow.tsx';

const MAIN_STEPS = [
  {
    title: 'Create a project',
    detail: 'Use New project above, or Import from YAML below if you already have a Studio backup.',
  },
  {
    title: 'Fill your library',
    detail:
      'Pull channels from directories and curated sets under Channels → Add from… — you often will not need to type every frequency by hand.',
  },
  {
    title: 'Add a format build',
    detail: 'Assemble a build for the radio and CPS you will flash.',
  },
  {
    title: 'Export for your CPS',
    detail: 'Download the files your vendor software expects, then program the radio there.',
  },
] as const;

const DMR_STEPS = [
  {
    title: 'Import a repeater',
    detail:
      'Open Channels → Add from… and pick a directory such as RepeaterBook or BrandMeister, then add the site as a channel.',
  },
  {
    title: 'Open the channel',
    detail: 'Open that repeater under Channels to finish any details you care about.',
  },
  {
    title: 'Pull talk groups from BrandMeister',
    detail:
      'Import talk groups (and an RX group list when offered) instead of typing IDs — one site, one list, not a grid of duplicate rows.',
  },
] as const;

export default function GettingStartedContent() {
  return (
    <Stack gap="lg">
      <Stack gap="xs">
        <Title order={3}>Getting started</Title>
        <Text size="sm">
          A <strong>project</strong> holds your <strong>library</strong> — the master inventory of
          channels, talk groups, contacts, and lists — and one or more{' '}
          <strong>format builds</strong> that organise that library for a specific radio workflow.
          You curate once, then export into your CPS to flash.
        </Text>
        <Text size="sm" c="dimmed">
          Your projects stay in this browser unless you save a YAML backup or use Google Drive.
        </Text>
      </Stack>

      <Stack gap="sm">
        <Title order={4}>From blank to export</Title>
        <GettingStartedFlow steps={MAIN_STEPS} ariaLabel="Main getting-started steps" />
      </Stack>

      <Stack gap="sm">
        <Title order={4}>Fill your library without typing everything</Title>
        <Text size="sm">
          After you create a project, open <strong>Channels</strong> → <strong>Add from…</strong>.
          Search, tick what you need, and add. That saves you from retyping frequencies, tones, and
          talk-group IDs from a spreadsheet.
        </Text>
        <List size="sm" spacing="xs">
          <List.Item>
            <strong>ukrepeater.net</strong> — UK repeater directory
          </List.Item>
          <List.Item>
            <strong>RepeaterBook</strong> — wider geographic coverage (add a token in{' '}
            <strong>Settings</strong> when needed)
          </List.Item>
          <List.Item>
            <strong>BrandMeister</strong> — DMR repeaters, and talk groups when you want them
          </List.Item>
          <List.Item>
            <strong>Curated sets</strong> — built-in grids such as UK simplex channels
          </List.Item>
        </List>
        <Text size="sm" c="dimmed">
          You can still add or edit channels by hand when a directory does not cover what you need.
        </Text>
      </Stack>

      <Stack gap="sm">
        <Title order={4}>Optional DMR shortcut</Title>
        <Text size="sm">Useful when you run DMR. Skip this if you only need FM or analogue.</Text>
        <GettingStartedFlow steps={DMR_STEPS} ariaLabel="Optional DMR shortcut steps" />
      </Stack>

      <Stack gap="sm">
        <Title order={4}>How Studio differs from a typical CPS</Title>
        <List size="sm" spacing="sm">
          <List.Item>
            <strong>One channel, several modes</strong> — A single library channel can carry more
            than one mode (for example FM and DMR on the same site). On export, Studio splits into
            the rows your radio needs — unless that radio can keep a dual-mode channel as one row.
          </List.Item>
          <List.Item>
            <strong>No hand-multiplying repeaters by talk group</strong> — Attach an{' '}
            <strong>RX group list</strong> to the channel. At export, Studio can create the
            per–talk-group copies your CPS expects. You curate the site once and the talk-group set
            once.
          </List.Item>
          <List.Item>
            <strong>Scan lists from zones</strong> — If your radio keeps <strong>zones</strong> and{' '}
            <strong>scan lists</strong> separate, you can drive scan membership from zone membership
            on the format build instead of maintaining two unrelated lists. If the radio treats the
            zone as the scan list, you do not need a second structure.
          </List.Item>
        </List>
      </Stack>

      <Stack gap="xs">
        <Title order={4} c="dimmed">
          Also useful
        </Title>
        <Text size="sm" c="dimmed">
          These tools sit under <strong>Reference</strong>. They are not required to build a
          codeplug.
        </Text>
        <List size="sm" spacing="xs">
          <List.Item>
            <Anchor component={Link} to="/reference/bands" size="sm">
              Band plan
            </Anchor>{' '}
            — band edges and common services at a glance
          </List.Item>
          <List.Item>
            <Anchor component={Link} to="/reference/maidenhead" size="sm">
              Maidenhead locator
            </Anchor>{' '}
            — convert between locator, map, and coordinates
          </List.Item>
        </List>
      </Stack>
    </Stack>
  );
}
