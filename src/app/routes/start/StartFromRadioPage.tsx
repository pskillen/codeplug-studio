/**
 * Start from my radio (#1921): a guided first run for operators who arrive with a programmed radio. Pick the radio,
 * name the project, read it over the cable, then see what to do next. The read itself is the same pipeline as a
 * build's Read into library; this page only creates the project first.
 */
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ProgressUpdate, RadioSession } from '@integrations/radio-io/types.ts';
import { readNextSteps, type ReadNextStepId } from '@core/services/radioRead/readNextSteps.ts';
import {
  Button,
  CountTile,
  DesignSystemV2Provider,
  Panel,
  StatusBanner,
  Stepper,
  TextInput,
  type StepperStep,
} from '../../components/v2/index.ts';
import RadioIoProgressModal, {
  type RadioIoProgressPhase,
} from '../../components/builds/RadioIoProgressModal.tsx';
import { useUnsavedNavigationGuard } from '../../hooks/useUnsavedNavigationGuard.ts';
import { createProgressCoalescer, type ProgressCoalescer } from '../../lib/progressCoalescer.ts';
import {
  closeRadioSession,
  getRadioSerialUnsupportedMessage,
  isRadioSerialSupported,
  openRadioSessionForEgress,
} from '../../services/radioIoSession.ts';
import {
  applyRadioReadToLibrary,
  type RadioReadSummary,
} from '../../services/radioReadIntoLibrary.ts';
import {
  firmwareFlashOfferedForTarget,
  listReadableRadios,
  modFirmwareLabelForTarget,
  suggestedProjectName,
  type ReadableRadio,
} from '../../services/startFromRadio.ts';
import { persistence } from '../../state/persistence.ts';
import { ProjectContext } from '../../state/ProjectContext.ts';
import ReadIntoLibrarySummary from '../builds/ReadIntoLibrarySummary.tsx';
import classes from './StartFromRadioPage.module.css';

type WizardStep = 'radio' | 'name' | 'read' | 'next';

const STEPS: readonly { id: WizardStep; label: string }[] = [
  { id: 'radio', label: 'Radio' },
  { id: 'name', label: 'Name' },
  { id: 'read', label: 'Read' },
  { id: 'next', label: 'Next steps' },
];

export default function StartFromRadioPage() {
  const projects = useContext(ProjectContext);
  const radios = useMemo(() => listReadableRadios(), []);
  const [step, setStep] = useState<WizardStep>('radio');
  const [radioId, setRadioId] = useState<string | null>(
    radios.length === 1 ? radios[0]!.modelId : null,
  );
  const radio = radios.find((r) => r.modelId === radioId) ?? null;
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const projectName = nameTouched ? name : radio ? suggestedProjectName(radio) : '';

  /** Set once the project exists, so trying again after a failed read reuses it. */
  const [projectId, setProjectId] = useState<string | null>(null);
  const [summary, setSummary] = useState<RadioReadSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<RadioIoProgressPhase>('connecting');
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [transferStages, setTransferStages] = useState<string[]>([]);
  const sessionRef = useRef<RadioSession | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const coalescerRef = useRef<ProgressCoalescer | null>(null);
  const serialOk = isRadioSerialSupported();

  const { modalOpen: leaveAttempted, stay } = useUnsavedNavigationGuard(busy);
  useEffect(() => {
    if (leaveAttempted) stay();
  }, [leaveAttempted, stay]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      coalescerRef.current?.cancel();
      const session = sessionRef.current;
      sessionRef.current = null;
      if (session) void closeRadioSession(session);
    },
    [],
  );

  const currentIndex = STEPS.findIndex((s) => s.id === step);
  const stepperSteps: StepperStep[] = STEPS.map((s, i) => ({
    id: s.id,
    label: s.label,
    status:
      i < currentIndex || step === 'next' ? 'done' : i === currentIndex ? 'current' : 'pending',
  }));

  function onProgress(p: ProgressUpdate) {
    setPhase('transfer');
    coalescerRef.current ??= createProgressCoalescer(setProgress);
    coalescerRef.current.push(p);
    if (p.stage) {
      setTransferStages((prev) => (prev.includes(p.stage!) ? prev : [...prev, p.stage!]));
    }
  }

  async function releaseSession(): Promise<void> {
    const session = sessionRef.current;
    sessionRef.current = null;
    if (session) await closeRadioSession(session);
  }

  function closeProgress(): void {
    setBusy(false);
    coalescerRef.current?.cancel();
    setProgress(null);
    abortRef.current = null;
  }

  async function ensureProject(): Promise<string> {
    const trimmed = projectName.trim();
    if (projectId) {
      const existing = projects?.projects.find((p) => p.projectId === projectId);
      if (existing && existing.name !== trimmed) await projects?.renameProject(projectId, trimmed);
      projects?.switchProject(projectId);
      return projectId;
    }
    if (!projects)
      throw new Error('Projects are not available yet. Reload the page and try again.');
    const id = await projects.createProject(trimmed);
    setProjectId(id);
    return id;
  }

  async function handleConnectAndRead() {
    if (!radio || busy || !serialOk || !projectName.trim()) return;
    setError(null);
    setSummary(null);
    setBusy(true);
    setPhase('connecting');
    setProgress(null);
    setTransferStages([]);
    const abort = new AbortController();
    abortRef.current = abort;
    const { signal } = abort;
    try {
      // The port picker needs this click, so the radio is connected before anything is saved.
      const { session, descriptor } = await openRadioSessionForEgress(radio.egress, {
        forcePortSelection: true,
        purpose: 'read',
        signal,
      });
      sessionRef.current = session;
      const hook = descriptor.readIntoLibrary;
      if (!hook) throw new Error(`${descriptor.label} can't be read into a library yet.`);
      signal.throwIfAborted();
      const id = await ensureProject();
      setPhase('transfer');
      const read = await hook.read(session, { onProgress, signal });
      await releaseSession();
      signal.throwIfAborted();
      setPhase('saving');
      const outcome = await applyRadioReadToLibrary({ persistence, projectId: id, read });
      if (outcome.ok) {
        setSummary(outcome.summary);
        setPhase('done');
      } else {
        setError(outcome.message);
        closeProgress();
      }
    } catch (err) {
      await releaseSession().catch(() => undefined);
      if (!signal.aborted) setError(err instanceof Error ? err.message : String(err));
      closeProgress();
    }
  }

  function handleCancel(): void {
    abortRef.current?.abort();
  }

  function finish(): void {
    closeProgress();
    if (summary) setStep('next');
  }

  let body;
  if (step === 'radio') {
    body = <RadioStep radios={radios} radioId={radioId} onSelect={setRadioId} />;
  } else if (step === 'name') {
    body = (
      <Panel title="Name your project" sub="You can rename it later.">
        <div className={classes.stack}>
          <p className={classes.copy}>
            A <strong>project</strong> keeps everything for your radios in this browser: a{' '}
            <strong>library</strong> of channels, and a <strong>build</strong> for each radio that
            says how they’re laid out on it.
          </p>
          <TextInput
            label="Project name"
            value={projectName}
            onChange={(e) => {
              setNameTouched(true);
              setName(e.currentTarget.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && projectName.trim()) setStep('read');
            }}
          />
        </div>
      </Panel>
    );
  } else if (step === 'read') {
    body = (
      <Panel title="Connect your radio" sub={radio?.label}>
        <div className={classes.stack}>
          <ul className={classes.list}>
            <li>Plug the programming cable into your computer and the radio.</li>
            <li>Switch the radio on.</li>
            <li>
              Click <strong>Connect and read</strong>, then choose the cable’s port when your
              browser asks.
            </li>
          </ul>
          {serialOk ? (
            <StatusBanner tone="info">
              Nothing is sent to the radio. Reading only copies what’s on it into your project.
            </StatusBanner>
          ) : (
            <StatusBanner tone="warning">{getRadioSerialUnsupportedMessage()}</StatusBanner>
          )}
          {error ? (
            <StatusBanner tone="warning">
              Couldn’t read the radio: {error}{' '}
              {projectId
                ? 'Check the cable and that the radio is on, then try again. Your project was kept, so trying again won’t make a copy.'
                : 'Check the cable and that the radio is on, then try again.'}
            </StatusBanner>
          ) : null}
          <div className={classes.row}>
            <Button
              onClick={() => void handleConnectAndRead()}
              disabled={busy || !serialOk || !radio}
            >
              {error ? 'Try again' : 'Connect and read'}
            </Button>
          </div>
        </div>
      </Panel>
    );
  } else if (summary) {
    body = <NextSteps summary={summary} />;
  }

  return (
    <DesignSystemV2Provider>
      <div className={classes.page}>
        <h1 className={classes.title}>Start from my radio</h1>
        <p className={classes.description}>
          Read the channels already on your radio into a new project. Then you can change them, add
          zones, and write them back.
        </p>
        <Stepper
          className={classes.stepper}
          ariaLabel="Start from my radio steps"
          steps={stepperSteps}
        />
        {body}
        {step !== 'next' ? (
          <div className={classes.actions}>
            {step === 'radio' ? (
              <Link to="/" className={classes.textLink}>
                Cancel
              </Link>
            ) : (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => setStep(STEPS[currentIndex - 1]!.id)}
              >
                Back
              </Button>
            )}
            {step === 'radio' || step === 'name' ? (
              <Button
                onClick={() => setStep(STEPS[currentIndex + 1]!.id)}
                disabled={step === 'radio' ? !radio : !projectName.trim()}
              >
                Continue
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      <RadioIoProgressModal
        opened={busy}
        operation="library-read"
        phase={phase}
        progress={progress}
        transferStages={transferStages}
        navigationBlocked={leaveAttempted}
        onCancel={handleCancel}
        onClose={finish}
        finishAction={{ label: 'See next steps', onClick: finish }}
      />
    </DesignSystemV2Provider>
  );
}

function RadioStep({
  radios,
  radioId,
  onSelect,
}: {
  radios: readonly ReadableRadio[];
  radioId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <Panel title="Your radio" sub="Which radio are you reading?">
      <div className={classes.stack}>
        <div className={classes.cards} role="radiogroup" aria-label="Radio">
          {radios.map((r) => {
            const selected = r.modelId === radioId;
            return (
              <button
                key={r.modelId}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`${classes.card} ${selected ? classes.cardSelected : ''}`}
                onClick={() => onSelect(r.modelId)}
              >
                <span className={classes.cardTitle}>{r.label}</span>
                <span className={classes.cardMeta}>{r.firmwareLabels.join(' or ')} firmware</span>
              </button>
            );
          })}
        </div>
        <p className={classes.muted}>
          Don’t see your radio? Reading is coming to more radios. Meanwhile you can{' '}
          <Link to="/" className={classes.textLink}>
            start from scratch
          </Link>{' '}
          and export a file for your radio’s programming software.
        </p>
      </div>
    </Panel>
  );
}

interface NextStepCopy {
  title: string;
  body: string;
  to: string;
  action: string;
}

function nextStepCopy(id: ReadNextStepId, summary: RadioReadSummary): NextStepCopy {
  const buildId = summary.build.id;
  switch (id) {
    case 'arrange-zones':
      return {
        title: 'Arrange your zones',
        body: 'Group your channels into zones, put them in order, and choose which ones scan.',
        to: `/builds/${buildId}/zones`,
        action: 'Arrange zones',
      };
    case 'update-firmware': {
      const mod = modFirmwareLabelForTarget(summary.build.radioTargetId);
      return {
        title: 'Update your radio’s firmware',
        body: `Your radio runs its stock firmware, which has no zones. ${mod ? `The ${mod} firmware` : 'Modded firmware'} adds them. Your channels stay safe here while you update. Afterwards, read the radio again from its build’s Backup / Restore tab.`,
        to: '/firmware',
        action: 'Update firmware',
      };
    }
    case 'browse-channels':
      return {
        title: 'Browse your channels',
        body: 'Check names, tones and frequencies, or add channels from repeater lists and maps.',
        to: '/library/channels',
        action: 'Open library',
      };
    case 'open-build':
      return {
        title: `Open your ${summary.modelLabel} build`,
        body: 'See the channels as your radio will show them. Write to the radio from here when you’re ready.',
        to: `/builds/${buildId}/overview`,
        action: 'Open build',
      };
  }
}

function NextSteps({ summary }: { summary: RadioReadSummary }) {
  const navigate = useNavigate();
  const steps = readNextSteps({
    radioTargetId: summary.build.radioTargetId,
    firmwareFlashOffered: firmwareFlashOfferedForTarget(summary.build.radioTargetId),
  });
  const channelCount =
    summary.channels.created + summary.channels.updated + summary.channels.unchanged;
  const zoneCount = summary.zones.created + summary.zones.updated + summary.zones.unchanged;
  return (
    <div className={classes.stack}>
      <Panel
        title="Your radio is in Studio"
        sub={`${summary.modelLabel} · ${summary.firmwareLabel}`}
      >
        <div className={classes.tiles}>
          <CountTile value={channelCount} label="Channels" />
          {zoneCount > 0 ? <CountTile value={zoneCount} label="Zones" /> : null}
          <CountTile value={summary.firmwareLabel} label="Firmware" />
        </div>
      </Panel>
      <Panel title="What next?">
        <ol className={classes.nextList} aria-label="Next steps">
          {steps.map((id, i) => {
            const copy = nextStepCopy(id, summary);
            return (
              <li key={id} className={classes.nextItem}>
                <div className={classes.nextText}>
                  <strong>{copy.title}</strong>
                  <span className={classes.muted}>{copy.body}</span>
                </div>
                <Button
                  size="sm"
                  variant={i === 0 ? 'primary' : 'secondary'}
                  onClick={() => navigate(copy.to)}
                >
                  {copy.action}
                </Button>
              </li>
            );
          })}
        </ol>
      </Panel>
      <Panel title="Read details" collapsible defaultCollapsed>
        <ReadIntoLibrarySummary summary={summary} />
      </Panel>
    </div>
  );
}
