import LegalDocumentLayout from '../../components/legal/LegalDocumentLayout.tsx';

export default function TermsOfUsePage() {
  return (
    <LegalDocumentLayout title="Terms of use" lastUpdated="March 2026">
      <h2>As-is software</h2>
      <p>
        Codeplug Studio is provided as-is, without warranty. The same applies whether you use the
        website, a sideloaded Android APK, or a build from the Play Store. It helps you design
        codeplug layouts and export CPS-ready files for vendor programming software.
      </p>

      <h2>Direct radio programming</h2>
      <p>
        Where Studio can write a radio directly — over Web Serial in a supported desktop browser,
        or over USB (OTG) in the Android companion app — treat that path as experimental. Verify
        programming before you transmit. File export and your radio&apos;s vendor CPS remain
        supported paths, and Studio is not a substitute for vendor CPS where you still need it.
      </p>

      <h2>Your responsibility</h2>
      <ul>
        <li>
          You are responsible for verifying frequencies, tones, and programming before transmitting.
        </li>
        <li>
          Programming a radio over USB or Web Serial is at your own risk — the same care you would
          take with any programming cable and CPS.
        </li>
        <li>
          Frequency and repeater data loaded from third-party sources is for amateur programming
          convenience — not authoritative for emergency or safety-critical operations.
        </li>
        <li>
          Comply with your licence conditions and local regulations when operating amateur radio
          equipment.
        </li>
      </ul>

      <h2>Data</h2>
      <p>
        Your projects live in storage on this device (browser or phone app). Back up important work
        (native YAML export, Google Drive if you use it). We are not liable for data loss from
        clearing storage or device failure.
      </p>

      <p>
        <em>This page is informal guidance for a hobby tool — not legal advice.</em>
      </p>
    </LegalDocumentLayout>
  );
}
