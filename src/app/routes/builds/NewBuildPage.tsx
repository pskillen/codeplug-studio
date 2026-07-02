import { Button, Card, Group, Stack, Text, TextInput, Anchor } from '@mantine/core';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatCatalog } from '@core/import-export/registry.ts';
import type { FormatId } from '@core/import-export/types.ts';
import { traitProfileFor } from '@core/models/traits.ts';
import ProfilePicker from '../../components/builds/ProfilePicker.tsx';
import { FormPage, PageSection } from '../../components/ui/index.ts';
import { useFormatBuilds } from '../../state/useFormatBuilds.ts';

const CPS_FORMATS = formatCatalog.filter((f) => f.id !== 'native-yaml');

type Step = 'format' | 'profile' | 'name';

export default function NewBuildPage() {
  const navigate = useNavigate();
  const { createBuild } = useFormatBuilds();
  const [step, setStep] = useState<Step>('format');
  const [formatId, setFormatId] = useState<FormatId | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!profileId) return;
    setCreating(true);
    setError(null);
    const outcome = await createBuild(profileId, name.trim() || undefined);
    setCreating(false);
    if (!outcome.ok) {
      setError(outcome.reason);
      return;
    }
    navigate(`/builds/${outcome.build.id}/overview`);
  }

  return (
    <FormPage
      title="New build"
      description={
        <Anchor component={Link} to="/builds" size="sm">
          ← Back to builds
        </Anchor>
      }
    >
      <Stack gap="lg">
        <Text size="sm" c="dimmed">
          Native YAML is project interchange — not a format build. Pick a CPS target workflow below.
        </Text>

        {step === 'format' ? (
          <PageSection title="Choose format">
            <Stack gap="sm">
              {CPS_FORMATS.map((format) => (
                <Card
                  key={format.id}
                  withBorder
                  padding="md"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setFormatId(format.id);
                    setProfileId(null);
                    setStep('profile');
                  }}
                >
                  <Group justify="space-between">
                    <div>
                      <Text fw={600}>{format.label}</Text>
                      <Text size="sm" c="dimmed">
                        Import: {format.importStatus} · Export: {format.exportStatus}
                      </Text>
                    </div>
                    <Button variant="light" size="compact-sm">
                      Select
                    </Button>
                  </Group>
                </Card>
              ))}
            </Stack>
          </PageSection>
        ) : null}

        {step === 'profile' && formatId ? (
          <PageSection
            title="Choose profile"
            description={`Format: ${formatCatalog.find((f) => f.id === formatId)?.label ?? formatId}`}
          >
            <Stack gap="sm">
              <ProfilePicker
                formatId={formatId}
                onChange={(id) => {
                  setProfileId(id);
                  setName(traitProfileFor(id)?.label ?? id);
                  setStep('name');
                }}
              />
              <Button variant="subtle" onClick={() => setStep('format')}>
                ← Change format
              </Button>
            </Stack>
          </PageSection>
        ) : null}

        {step === 'name' && profileId ? (
          <PageSection title="Name build">
            <Stack gap="md">
              <TextInput
                label="Build name"
                description="Defaults to the profile label — change if you run multiple builds for the same radio."
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
              />
              {error ? (
                <Text c="red" size="sm">
                  {error}
                </Text>
              ) : null}
              <Group>
                <Button loading={creating} onClick={() => void handleCreate()}>
                  Create build
                </Button>
                <Button variant="subtle" onClick={() => setStep('profile')}>
                  ← Change profile
                </Button>
              </Group>
            </Stack>
          </PageSection>
        ) : null}
      </Stack>
    </FormPage>
  );
}
