import { CloseButton, Modal, ScrollArea } from '@mantine/core';
import type { ReactNode } from 'react';
import { ICON_SIZE_ACTION } from '../../lib/iconSizes.ts';
import { DSV2_SCOPE_SELECTOR } from '../../theme-v2.ts';
import classes from './ModalShell.module.css';

export type ModalShellSize = 'sm' | 'md' | 'lg' | 'xl';
export type ModalShellIconTone = 'accent' | 'warning' | 'destructive';

export interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Header icon, e.g. a Tabler icon element sized to `ICON_SIZE_ACTION`. */
  icon?: ReactNode;
  iconTone?: ModalShellIconTone;
  size?: ModalShellSize;
  /** Whether escape/backdrop-click/close-button dismiss the modal. Default true. */
  dismissible?: boolean;
  footer?: ReactNode;
  children: ReactNode;
  /** Renders the panel markup only, without the Modal overlay/portal — for embedding. */
  inline?: boolean;
  /** Fill the viewport (phones): no width cap, the body scrolls in the space between header and footer. */
  fullScreen?: boolean;
  className?: string;
}

const SIZE_PX: Record<ModalShellSize, number> = { sm: 400, md: 520, lg: 720, xl: 960 };

const ICON_TONE_CLASS: Record<ModalShellIconTone, string> = {
  accent: classes.iconAccent,
  warning: classes.iconWarning,
  destructive: classes.iconDestructive,
};

interface ModalShellPanelProps {
  title: ReactNode;
  icon?: ReactNode;
  iconTone: ModalShellIconTone;
  dismissible: boolean;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  fullScreen?: boolean;
}

function ModalShellPanel({
  title,
  icon,
  iconTone,
  dismissible,
  onClose,
  footer,
  children,
  className,
  fullScreen,
}: ModalShellPanelProps) {
  return (
    <div
      className={[classes.panel, fullScreen ? classes.panelFull : null, className]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={classes.header}>
        {icon ? (
          <span className={[classes.iconBadge, ICON_TONE_CLASS[iconTone]].join(' ')} aria-hidden>
            {icon}
          </span>
        ) : null}
        <div className={classes.title}>{title}</div>
        {dismissible ? (
          <CloseButton
            aria-label="Close"
            size={ICON_SIZE_ACTION}
            className={classes.close}
            onClick={onClose}
          />
        ) : null}
      </div>
      {fullScreen ? (
        <ScrollArea className={classes.bodyFull}>
          <div className={classes.body}>{children}</div>
        </ScrollArea>
      ) : (
        <ScrollArea.Autosize mah={480} className={classes.body}>
          {children}
        </ScrollArea.Autosize>
      )}
      {footer ? <div className={classes.footer}>{footer}</div> : null}
    </div>
  );
}

/**
 * Base overlay shell (header/body/footer/close) that {@link ConfirmModal} and
 * {@link ProgressModal} build on. `inline` renders the panel markup without the
 * Modal portal/overlay, for embedding in a page or panel instead of as a dialog.
 */
export default function ModalShell({
  open,
  onClose,
  title,
  icon,
  iconTone = 'accent',
  size = 'md',
  dismissible = true,
  footer,
  children,
  inline,
  className,
  fullScreen = false,
}: ModalShellProps) {
  const panel = (
    <ModalShellPanel
      title={title}
      icon={icon}
      iconTone={iconTone}
      dismissible={dismissible}
      onClose={onClose}
      footer={footer}
      className={className}
      fullScreen={fullScreen && !inline}
    >
      {children}
    </ModalShellPanel>
  );

  if (inline) {
    return open ? panel : null;
  }

  return (
    <Modal
      opened={open}
      onClose={dismissible ? onClose : () => undefined}
      withCloseButton={false}
      closeOnClickOutside={dismissible}
      closeOnEscape={dismissible}
      size={SIZE_PX[size]}
      fullScreen={fullScreen}
      radius={fullScreen ? 0 : 'panel'}
      padding={0}
      centered
      className={[classes.modalRoot, fullScreen ? classes.modalFull : null]
        .filter(Boolean)
        .join(' ')}
      portalProps={{ target: DSV2_SCOPE_SELECTOR }}
    >
      {panel}
    </Modal>
  );
}
