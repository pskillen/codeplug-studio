import { IconFileCheck, IconUpload, IconX } from '@tabler/icons-react';
import { useRef, useState, type DragEvent } from 'react';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../lib/iconSizes.ts';
import classes from './FileDropzone.module.css';
import RowActionIcon from './RowActionIcon.tsx';

export interface FileDropzoneProps {
  label?: string;
  hint?: string;
  accept?: string;
  multiple?: boolean;
  onFilesSelected: (files: File[]) => void;
  /** When set, the dropzone collapses to a selected-file row showing this name. */
  fileName?: string;
  onClear?: () => void;
  error?: string;
  disabled?: boolean;
}

/**
 * Generic drag/drop + click-to-browse file input, generalized from
 * `import-export/YamlFileDropzone.tsx`'s mechanics (that component stays
 * untouched). Collapses to a selected-file row once `fileName` is set.
 */
export default function FileDropzone({
  label = 'Drop a file here, or click to browse',
  hint,
  accept,
  multiple,
  onFilesSelected,
  fileName,
  onClear,
  error,
  disabled = false,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const openBrowse = () => {
    if (!disabled) inputRef.current?.click();
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0 || disabled) return;
    onFilesSelected(Array.from(files));
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    handleFiles(event.dataTransfer.files);
  };

  if (fileName) {
    return (
      <div className={classes.selectedRow}>
        <IconFileCheck
          size={ICON_SIZE_ACTION}
          stroke={ICON_STROKE}
          className={classes.successIcon}
        />
        <span className={classes.fileName}>{fileName}</span>
        {onClear ? (
          <RowActionIcon
            icon={<IconX size={ICON_SIZE_ACTION} />}
            onClick={onClear}
            label="Remove file"
          />
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        className={[classes.root, dragOver ? classes.dragOver : ''].filter(Boolean).join(' ')}
        data-disabled={disabled || undefined}
        onClick={openBrowse}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openBrowse();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <IconUpload size={20} stroke={ICON_STROKE} className={classes.uploadIcon} aria-hidden />
        <div className={classes.label}>
          {label} — <span className={classes.browseLink}>browse</span>
        </div>
        {hint ? <div className={classes.hint}>{hint}</div> : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        disabled={disabled}
        onChange={(event) => {
          handleFiles(event.currentTarget.files);
          event.currentTarget.value = '';
        }}
      />
      {error ? <div className={classes.error}>{error}</div> : null}
    </div>
  );
}
