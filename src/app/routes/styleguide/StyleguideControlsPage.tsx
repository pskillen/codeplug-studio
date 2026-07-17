import {
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  NavLink,
  Stack,
  Text,
  TextInput,
  Select,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconTrash } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { UK_BANDS } from '../../lib/bands.ts';
import { BandPill, BandPillForChannel, ModePill } from '../../components/pills/index.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import {
  EmptyState,
  FormSection,
  Page,
  PageHeader,
  PageSection,
  SoftWarning,
} from '../../components/ui/index.ts';
import { sampleChannel } from './fixtures.ts';
import {
  ForbidTransmitSegmentDemo,
  GradientSegmentedControlDemo,
  ImageCheckboxDemo,
  PercentLevelSliderDemo,
  PillTabsDemo,
  ScanInclusionSegmentDemo,
  SplitButtonDemo,
} from './controlDemos.tsx';

export default function StyleguideControlsPage() {
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);

  return (
    <Page width="default">
      <PageHeader
        title="Styleguide — controls"
        description={
          <>
            <Link to="/styleguide">← Styleguide</Link> · Buttons, segments, pills, feedback
          </>
        }
      />

      <PageSection title="Form fields & buttons">
        <Stack gap="lg">
          <Group>
            <Button>Primary</Button>
            <Button variant="light">Light</Button>
            <Button variant="subtle">Subtle</Button>
            <Button variant="outline">Outline</Button>
            <Button
              color="red"
              leftSection={<IconTrash size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
            >
              Delete
            </Button>
          </Group>
          <FormSection
            title="Sample fields"
            description="Native Mantine inputs — canonical variants."
          >
            <TextInput label="Name" placeholder="Channel name" />
            <Select label="Mode" data={['FM', 'DMR', 'P25']} defaultValue="FM" />
          </FormSection>
        </Stack>
      </PageSection>

      <PageSection
        title="GradientSegmentedControl"
        description="Default track; indicator colour fades to match the active segment."
      >
        <Stack gap="lg" maw={480}>
          <GradientSegmentedControlDemo
            label="On / Off"
            scheme="onOff"
            initial="on"
            options={[
              { value: 'on', label: 'On' },
              { value: 'off', label: 'Off' },
            ]}
          />
          <ForbidTransmitSegmentDemo />
          <ScanInclusionSegmentDemo />
          <GradientSegmentedControlDemo
            label="Three segments"
            scheme="three"
            initial="a"
            options={[
              { value: 'a', label: 'A' },
              { value: 'b', label: 'B' },
              { value: 'c', label: 'C' },
            ]}
          />
          <GradientSegmentedControlDemo
            label="Four segments"
            scheme="four"
            initial="1"
            options={[
              { value: '1', label: '1' },
              { value: '2', label: '2' },
              { value: '3', label: '3' },
              { value: '4', label: '4' },
            ]}
          />
          <GradientSegmentedControlDemo
            label="Five segments"
            scheme="five"
            initial="low"
            options={[
              { value: 'low', label: 'Low' },
              { value: 'med-low', label: 'Med−' },
              { value: 'med', label: 'Med' },
              { value: 'med-high', label: 'Med+' },
              { value: 'high', label: 'High' },
            ]}
          />
        </Stack>
      </PageSection>

      <PageSection
        title="SplitButton"
        description="Primary action with a chevron menu for secondary actions — from Mantine UI buttons gallery."
      >
        <SplitButtonDemo />
      </PageSection>

      <PageSection
        title="ImageCheckbox"
        description="Card checkboxes with optional image or custom media — from Mantine UI inputs gallery."
      >
        <ImageCheckboxDemo />
      </PageSection>

      <PageSection
        title="PillTabs"
        description="Tabs with optional leading pill or badge — channel mode profiles use this pattern."
      >
        <Stack maw={560}>
          <PillTabsDemo />
        </Stack>
      </PageSection>

      <PageSection
        title="PercentLevelSlider"
        description="5% step slider with marks — power and squelch on channel edit."
      >
        <Stack gap="lg" maw={480}>
          <PercentLevelSliderDemo label="Power" initial={10} />
          <PercentLevelSliderDemo label="Squelch" initial={null} zeroLabel="Open (0%)" />
        </Stack>
      </PageSection>

      <PageSection title="Pills & badges">
        <Group>
          <ModePill mode="dmr" />
          <ModePill mode="fm" />
          <ModePill mode="dstar" />
          <ModePill mode="ysf" />
          <ModePill mode="m17" />
          <ModePill mode="tetra" />
          <BandPill band={UK_BANDS.find((b) => b.id === '2m') ?? null} />
          <BandPill band={UK_BANDS.find((b) => b.id === '70cm') ?? null} />
          <BandPillForChannel channel={sampleChannel} />
          <Badge variant="outline">Outline badge</Badge>
        </Group>
      </PageSection>

      <PageSection
        title="SoftWarning"
        description="Theme-aware compact warning panels for sidebar chrome — see SoftWarning.md"
      >
        <Stack gap="sm" maw={280}>
          <SoftWarning title="Browser-only backup" onDismiss={() => undefined}>
            This project is only stored in this browser — export YAML to back up.
          </SoftWarning>
          <SoftWarning tone="danger">
            Session expired — click Save or Check to reconnect. You can keep working locally.
          </SoftWarning>
        </Stack>
      </PageSection>

      <PageSection
        title="Alerts"
        description="Mantine Alert colour conventions — see docs/features/app-shell/alerts.md"
      >
        <Stack gap="sm">
          <Alert color="blue">Informational alert.</Alert>
          <Alert color="yellow">Warning alert — map token missing pattern.</Alert>
          <Alert color="red">Error alert — validation failure pattern.</Alert>
        </Stack>
      </PageSection>

      <PageSection title="EmptyState">
        <EmptyState
          message="No projects yet"
          action={
            <Button variant="light" component={Link} to="/">
              Go home
            </Button>
          }
        />
      </PageSection>

      <PageSection title="Nav samples">
        <Stack gap="xs" maw={280}>
          <Text size="sm" c="dimmed">
            NavLink styling (inactive / active)
          </Text>
          <NavLink label="Channels" active />
          <NavLink label="Settings" />
        </Stack>
      </PageSection>

      <PageSection title="Modal">
        <Button onClick={openModal}>Open sample modal</Button>
        <Modal opened={modalOpened} onClose={closeModal} title="Sample modal" size="sm">
          <Text size="sm">Mantine modal — used for column picker and confirm flows.</Text>
        </Modal>
      </PageSection>
    </Page>
  );
}
