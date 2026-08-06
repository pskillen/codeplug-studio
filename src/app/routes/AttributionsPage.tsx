import { Anchor } from '@mantine/core';
import LegalDocumentLayout from '../components/legal/LegalDocumentLayout.tsx';
import { ATTRIBUTIONS } from '../lib/attributions.ts';

export default function AttributionsPage() {
  return (
    <LegalDocumentLayout title="Attributions" backTo="/help" backLabel="Back to Help">
      <p>
        External data sources and services used by Codeplug Studio. Your API keys and tokens stay in
        browser storage — requests go directly from your browser where applicable.
      </p>

      {ATTRIBUTIONS.map((entry) => (
        <section key={entry.id}>
          <h2>{entry.name}</h2>
          <p>{entry.description}</p>
          <p>
            <Anchor href={entry.homeUrl} target="_blank" rel="noreferrer">
              {entry.homeUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            </Anchor>
            {entry.termsUrl && entry.termsUrl !== entry.homeUrl ? (
              <>
                {' '}
                ·{' '}
                <Anchor href={entry.termsUrl} target="_blank" rel="noreferrer">
                  Terms / API
                </Anchor>
              </>
            ) : null}
          </p>
          <ul>
            {entry.usedIn.map((use) => (
              <li key={use}>{use}</li>
            ))}
          </ul>
        </section>
      ))}

      <p>
        <em>
          Directory and aviation data are for amateur programming convenience — not authoritative
          for emergency or aviation operations.
        </em>
      </p>
    </LegalDocumentLayout>
  );
}
