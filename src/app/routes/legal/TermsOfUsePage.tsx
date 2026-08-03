import { List, Text } from '@mantine/core';
import { ListPage, PageSection } from '../../components/ui/index.ts';

export default function TermsOfUsePage() {
  return (
    <ListPage title="Terms of use" description="Using Codeplug Studio as a hobby programming aid.">
      <PageSection title="As-is software">
        <Text size="sm">
          Codeplug Studio is provided as-is, without warranty. The same applies whether you use the
          website, a sideloaded Android APK, or a build from the Play Store. It helps you design
          codeplug layouts and export CPS-ready files for vendor programming software.
        </Text>
      </PageSection>

      <PageSection title="Direct radio programming">
        <Text size="sm">
          Where Studio can write a radio directly — over Web Serial in a supported desktop browser,
          or over USB (OTG) in the Android companion app — treat that path as experimental. Verify
          programming before you transmit. File export and your radio&apos;s vendor CPS remain
          supported paths, and Studio is not a substitute for vendor CPS where you still need it.
        </Text>
      </PageSection>

      <PageSection title="Your responsibility">
        <List spacing="sm" size="sm">
          <List.Item>
            You are responsible for verifying frequencies, tones, and programming before
            transmitting.
          </List.Item>
          <List.Item>
            Programming a radio over USB or Web Serial is at your own risk — the same care you would
            take with any programming cable and CPS.
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
          Your projects live in storage on this device (browser or phone app). Back up important
          work (native YAML export, Google Drive if you use it). We are not liable for data loss
          from clearing storage or device failure.
        </Text>
      </PageSection>

      <Text size="xs" c="dimmed" mt="lg">
        This page is informal guidance for a hobby tool — not legal advice.
      </Text>
    </ListPage>
  );
}
