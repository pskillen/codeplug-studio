import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listRadioTargets, type RadioTarget } from '@core/radio-targets/index.ts';
import { EgressPathwayPills } from '../../components/builds/EgressPathwayPills.tsx';
import { Button, TextInput } from '../../components/v2/index.ts';
import { Text } from '@mantine/core';
import { useFormatBuilds } from '../../state/useFormatBuilds.ts';
import classes from './NewBuildPage.module.css';

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
    <div className={classes.page}>
      <div className={classes.header}>
        <Link to="/builds" className={classes.back}>
          ← Back to builds
        </Link>
        <h1 className={classes.title}>New build</h1>
        <p className={classes.subtitle}>
          Choose a radio target, then give this build a name. Compatible export pathways are seeded
          automatically — pick the pathway on Export.
        </p>
      </div>

      {step === 'radio' ? (
        <div className={classes.section}>
          <h2 className={classes.sectionTitle}>Radio target</h2>
          <div className={classes.targetGroups}>
            {groups.map(({ group, targets }) => (
              <div key={group} className={classes.targetGroup}>
                <div className={classes.groupLabel}>{group}</div>
                <div className={classes.targetGrid}>
                  {targets.map((target) => (
                    <button
                      key={target.id}
                      type="button"
                      className={classes.targetCard}
                      onClick={() => {
                        setRadioTargetId(target.id);
                        setName(target.label);
                        setStep('name');
                      }}
                    >
                      <div className={classes.targetName}>{target.label}</div>
                      <EgressPathwayPills egress={target.compatibleEgress} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {step === 'name' && selectedTarget ? (
        <div className={classes.section}>
          <h2 className={classes.sectionTitle}>Build name</h2>
          <div className={classes.namePanel}>
            <Text size="sm" c="dimmed">
              Radio: {selectedTarget.label}
            </Text>
            <EgressPathwayPills egress={selectedTarget.compatibleEgress} />
            <TextInput
              label="Build name"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
            />
            <Text size="xs" c="dimmed">
              Defaults to the radio label — change when you run multiple builds for the same radio.
            </Text>
            {error ? (
              <Text c="red" size="sm">
                {error}
              </Text>
            ) : null}
            <div className={classes.actions}>
              <Button loading={creating} onClick={() => void handleCreate()}>
                Create build
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setStep('radio');
                  setRadioTargetId(null);
                }}
              >
                Change radio
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
