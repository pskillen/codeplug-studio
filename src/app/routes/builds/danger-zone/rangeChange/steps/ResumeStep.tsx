import { FileButton } from '@mantine/core';
import { Button } from '../../../../../components/v2/index.ts';
import classes from '../RangeChange.module.css';
import { clock, COPY, rangeLabel, tail4 } from '../rangeChangeCopy.ts';
import NoticeBlock from './NoticeBlock.tsx';
import type { StepProps } from './stepTypes.ts';

/** Resume: with the journal, or "from a backup file" without it. */
export default function ResumeStep({ view, actions }: StepProps) {
  const { resume } = view;
  const entry = resume.entry;
  const needsChoice = !entry && resume.choices.length > 1;
  return (
    <div className={classes.stack}>
      <h2 className={classes.heading}>{COPY.resume.title}</h2>
      {needsChoice ? (
        <>
          <p className={classes.text}>{COPY.resume.choose}</p>
          <ul className={classes.list}>
            {resume.choices.map((c) => (
              <li key={c.serial}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => actions.onChooseResume(c.serial)}
                >
                  {tail4(c.serial)} · {rangeLabel(c.toCode)} · {clock(c.updatedAt)}
                </Button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <p className={classes.text}>
            {entry
              ? COPY.resume.pick(clock(entry.backup.savedAt), entry.backup.fileName)
              : COPY.resume.pickNoJournal}
          </p>
          {view.notice ? <NoticeBlock notice={view.notice} actions={actions} /> : null}
          <div className={classes.actions}>
            <FileButton onChange={actions.onResumeFile} accept=".zip">
              {(props) => (
                <Button variant="secondary" size="sm" {...props} disabled={view.busy}>
                  {resume.fileOk
                    ? (resume.fileName ?? COPY.resume.pickButton)
                    : COPY.resume.pickButton}
                </Button>
              )}
            </FileButton>
          </div>
          {resume.fileOk && resume.next === 'connect' ? (
            <>
              <p className={classes.muted}>{COPY.resume.vitalHelp}</p>
              <div className={classes.actions}>
                <FileButton onChange={actions.onResumeVital} accept=".zip">
                  {(props) => (
                    <Button variant="ghost" size="sm" {...props} disabled={view.busy}>
                      {resume.vitalName ?? COPY.resume.pickVital}
                    </Button>
                  )}
                </FileButton>
              </div>
            </>
          ) : null}
          <div className={classes.actions}>
            <Button variant="secondary" size="sm" onClick={actions.onBackToExport}>
              Back
            </Button>
            {resume.fileOk && resume.next === 'check' ? (
              <Button size="sm" onClick={actions.onResumeToCheck}>
                {COPY.resume.toCheck}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={actions.onResumeConnect}
                disabled={!resume.fileOk || view.busy || !view.supported}
              >
                {COPY.resume.connect}
              </Button>
            )}
          </div>
        </>
      )}
      {!entry && resume.choices.length === 0 && !resume.fileOk && !view.notice ? (
        <p className={classes.muted}>{COPY.resume.none}</p>
      ) : null}
    </div>
  );
}
