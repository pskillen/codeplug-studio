import { List, Text } from '@mantine/core';
import { ListPage, PageSection } from '../../components/ui/index.ts';

export default function TermsOfUsePage() {
  return (
    <ListPage title="Terms of use" description="Using Codeplug Studio as a hobby programming aid.">
      <PageSection title="As-is software">
        <Text size="sm">
          Codeplug Studio is provided as-is, without warranty. It helps you design codeplug layouts
          and export CPS-ready files for vendor programming software. Where browser radio write
          (Web Serial) is implemented for a radio, treat it as experimental and verify programming
          before transmitting — file export and third-party tools remain supported paths.
        </Text>
      </PageSection>

      <PageSection title="Your responsibility">
        <List spacing="sm" size="sm">
          <List.Item>
            You are responsible for verifying frequencies, tones, and programming before
            transmitting.
          </List.Item>
          <List.Item>
            Frequency and repeater data loaded from third-party sources is for amateur programming
            convenience — not authoritative for emergency or safety-critical operations.
          </List.Item>
          <List.Item>
            Comply with your licence conditions and local regulations when operating amateur radio
            equipment.
          </List.Item>
        </List>
      </PageSection>

      <PageSection title="Data">
        <Text size="sm">
          Your projects live in browser storage on your device. Back up important work (native YAML
          export, cloud storage if configured). We are not liable for data loss from clearing
          browser storage or device failure.
        </Text>
      </PageSection>

      <Text size="xs" c="dimmed" mt="lg">
        This page is informal guidance for a hobby tool — not legal advice.
      </Text>
    </ListPage>
  );
}
