import { useMemo, useState } from 'react';

import { FirmwareError } from '@core/firmware/errors.ts';

import { FileDropzone, Panel, StatusBanner } from '../../../components/v2/index.ts';
import { filesToNamedBytes, verifyStockFiles } from '../../../services/firmwareFlash.ts';
import classes from '../FirmwareFlasherPage.module.css';
import { shortHash, type WizardStepProps } from './stepTypes.ts';

function extensionOf(fileName: string): string | null {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(dot).toLowerCase() : null;
}

/** The operator supplies the vendor's stock firmware; Studio checks it against the pinned hashes, in memory only. */
export default function StockStep({ state, dispatch, updater }: WizardStepProps) {
  const stock = updater.stock;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileNames, setFileNames] = useState<string[]>([]);

  const accept = useMemo(() => {
    const exts = new Set(['.zip']);
    for (const m of stock.members) {
      const ext = extensionOf(m.fileName);
      if (ext) exts.add(ext);
    }
    return [...exts].join(',');
  }, [stock.members]);

  async function onFiles(files: File[]) {
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    setFileNames(files.map((f) => f.name));
    try {
      const named = await filesToNamedBytes(files);
      const verified = await verifyStockFiles(stock.radioId, named);
      dispatch({ type: 'stockVerified', stock: verified });
    } catch (err) {
      dispatch({ type: 'stockCleared' });
      setError(
        err instanceof FirmwareError
          ? err.message
          : 'These files could not be read. Try downloading them again.',
      );
    } finally {
      setBusy(false);
    }
  }

  const verified = state.stock;

  return (
    <Panel title="Stock firmware" sub={`${stock.label} ${stock.version}`}>
      <div className={classes.stack}>
        <p className={classes.copy}>
          Studio does not ship vendor firmware. Download it from the vendor, then drop the zip (or
          the files inside it) here. The files stay in this browser tab and are dropped when you
          leave the page.
        </p>
        <div>
          <span className={classes.muted}>Where to get it:</span>
          <ul className={classes.list} aria-label="Where to get the stock firmware">
            {stock.stockSources.map((src) => (
              <li key={src.label}>
                {src.kind === 'download' ? (
                  <>
                    <strong>{src.label}:</strong>{' '}
                    <a href={src.url} target="_blank" rel="noopener noreferrer">
                      {stock.zip.fileName}
                    </a>{' '}
                    <span className={classes.muted}>
                      from {src.host}
                      {src.note ? `. ${src.note}` : ''}
                    </span>
                    {!src.official ? (
                      <div className={classes.muted}>
                        Unofficial mirror, not run by the vendor. Studio checks every file against
                        the pinned hashes before using it.
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <strong>{src.label}:</strong> {src.instructions}
                    {src.contact ? (
                      <>
                        {' '}
                        <a
                          href={src.contact.href}
                          {...(src.contact.href.startsWith('https:')
                            ? { target: '_blank', rel: 'noopener noreferrer' }
                            : {})}
                        >
                          {src.contact.text}
                        </a>
                      </>
                    ) : null}
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <span className={classes.muted}>Files Studio needs from the zip:</span>
          <ul className={classes.list}>
            {stock.members.map((m) => (
              <li key={m.role}>
                <span className={classes.mono}>{m.fileName}</span> ({m.size.toLocaleString()} bytes)
              </li>
            ))}
          </ul>
        </div>
        <FileDropzone
          label="Stock firmware"
          hint={`Drop ${stock.zip.fileName}, or the files listed above`}
          accept={accept}
          multiple
          disabled={busy}
          fileName={fileNames.length > 0 ? fileNames.join(', ') : undefined}
          onFilesSelected={(files) => void onFiles(files)}
          onClear={() => {
            setFileNames([]);
            setError(null);
            dispatch({ type: 'stockCleared' });
          }}
        />
        {busy ? <p className={classes.muted}>Checking…</p> : null}
        {error ? <StatusBanner tone="warning">{error}</StatusBanner> : null}
        {verified && !error ? (
          <StatusBanner tone="success">
            Stock {stock.version} verified.{' '}
            {Object.entries(verified.sha256)
              .map(([role, sha]) => `${role} ${shortHash(sha)}`)
              .join(', ')}
            {verified.zipMismatchNoted
              ? '. The zip itself differs from the vendor download, but every file inside it matches.'
              : ''}
          </StatusBanner>
        ) : null}
      </div>
    </Panel>
  );
}
