import type { ReactNode } from 'react';
import { IconBrandGoogleDrive, IconFileImport, IconPlus, IconRadio } from '@tabler/icons-react';
import classes from './landing.module.css';

export interface LandingPathChooserProps {
  /** Opens the Start from my radio wizard. */
  onStartFromRadio: () => void;
  /** Opens the New project dialog. */
  onStartProject: () => void;
  /** Opens the Google Drive file browser (connecting first if needed). */
  onOpenDrive: () => void;
  /** Takes the operator to the project file drop zone. */
  onImportFile: () => void;
}

interface PathCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  primary?: boolean;
  onClick: () => void;
}

function PathCard({ icon, title, description, primary = false, onClick }: PathCardProps) {
  return (
    <button
      type="button"
      className={`${classes.pathCard} ${primary ? classes.pathCardPrimary : ''}`}
      onClick={onClick}
    >
      <span className={`${classes.pathIcon} ${primary ? classes.pathIconPrimary : ''}`} aria-hidden>
        {icon}
      </span>
      <span className={classes.pathText}>
        <span className={classes.pathTitle}>{title}</span>
        <span className={classes.pathDescription}>{description}</span>
      </span>
    </button>
  );
}

/** Landing "What would you like to do?" cards: the ways into Studio, radio first. */
export default function LandingPathChooser({
  onStartFromRadio,
  onStartProject,
  onOpenDrive,
  onImportFile,
}: LandingPathChooserProps) {
  const size = 22;
  const stroke = 1.75;
  return (
    <nav className={classes.paths} aria-label="Get started">
      <PathCard
        primary
        icon={<IconRadio size={size} stroke={stroke} />}
        title="Start from my radio"
        description="Read the channels already on your radio, change them, then write them back."
        onClick={onStartFromRadio}
      />
      <PathCard
        icon={<IconPlus size={size} stroke={stroke} />}
        title="Start from scratch"
        description="Build a library of channels from repeater lists and maps, then program any radio."
        onClick={onStartProject}
      />
      <PathCard
        icon={<IconBrandGoogleDrive size={size} stroke={stroke} />}
        title="Open from Google Drive"
        description="Carry on with a project you saved to your Drive."
        onClick={onOpenDrive}
      />
      <PathCard
        icon={<IconFileImport size={size} stroke={stroke} />}
        title="Import a project file"
        description="Open a project file saved from Codeplug Studio."
        onClick={onImportFile}
      />
    </nav>
  );
}
