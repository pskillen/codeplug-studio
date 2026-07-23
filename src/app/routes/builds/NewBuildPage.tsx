import { Button, Card, Group, Stack, Text, TextInput, Anchor } from '@mantine/core';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listRadioTargets, type RadioTarget } from '@core/radio-targets/index.ts';
import { FormPage, PageSection } from '../../components/ui/index.ts';
import { useFormatBuilds } from '../../state/useFormatBuilds.ts';

type Step = 'radio' | 'name';

function targetsByGroup(
  targets: readonly RadioTarget[],
): { group: string; targets: RadioTarget[] }[] {
  const map = new Map<string, RadioTarget[]>();
  for (const target of targets) {
    const list = map.get(target.group) ?? [];
    list.push(target);
    map.set(target.group, list);
  }
  return [...map.entries()].map(([group, groupTargets]) => ({ group, targets: groupTargets }));
}

function egressSummary(target: RadioTarget): string {
  return target.compatibleEgress.map((entry) => entry.label).join(' · ');
}

export default function NewBuildPage() {
  const navigate = useNavigate();
  const { createBuild } = useFormatBuilds();
  const [step, setStep] = useState<Step>('radio');
  const [radioTargetId, setRadioTargetId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groups = useMemo(() => targetsByGroup(listRadioTargets()), []);
  const selectedTarget = radioTargetId
    ? listRadioTargets().find((target) => target.id === radioTargetId)
    : undefined;

  async function handleCreate() {
    if (!radioTargetId) return;
    setCreating(true);
    setError(null);
    const outcome = await createBuild(radioTargetId, name.trim() || undefined);
    setCreating(false);
    if (!outcome.ok) {
      setError(outcome.reason);
      return;
    }
    navigate(`/builds/${outcome.build.id}/export`);
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
          Pick the handheld or mobile you are programming. Compatible export pathways (Web Serial,
          NeonPlug, CPS CSV, …) are seeded automatically — choose which pathway to use on Export.
          You can create more than one build for the same radio type (for example Team A and Team
          B).
        </Text>

        {step === 'radio' ? (
          <PageSection title="Choose radio">
            <Stack gap="lg">
              {groups.map(({ group, targets }) => (
                <Stack key={group} gap="sm">
                  <Text fw={600} size="sm">
                    {group}
                  </Text>
                  {targets.map((target) => (
                    <Card
                      key={target.id}
                      withBorder
                      padding="md"
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        setRadioTargetId(target.id);
                        setName(target.label);
                        setStep('name');
                      }}
                    >
                      <Group justify="space-between" align="flex-start" wrap="nowrap">
                        <div>
                          <Text fw={600} mb={4}>
                            {target.label}
                          </Text>
                          <Text size="sm" c="dimmed">
                            {egressSummary(target)}
                          </Text>
                        </div>
                        <Button variant="light" size="compact-sm">
                          Select
                        </Button>
                      </Group>
                    </Card>
                  ))}
                </Stack>
              ))}
            </Stack>
          </PageSection>
        ) : null}

        {step === 'name' && selectedTarget ? (
          <PageSection title="Name build">
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                Radio: {selectedTarget.label}
                <br />
                Pathways: {egressSummary(selectedTarget)}
              </Text>
              <TextInput
                label="Build name"
                description="Defaults to the radio label — change it when you run multiple builds for the same radio (Team A / Team B)."
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
                <Button
                  variant="subtle"
                  onClick={() => {
                    setStep('radio');
                    setRadioTargetId(null);
                  }}
                >
                  ← Change radio
                </Button>
              </Group>
            </Stack>
          </PageSection>
        ) : null}
      </Stack>
    </FormPage>
  );
}
