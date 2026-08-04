import { Button as MantineButton, type ButtonProps as MantineButtonProps } from '@mantine/core';
import type { ReactNode } from 'react';
import classes from './Button.module.css';

export type ButtonVariant =
  'primary' | 'secondary' | 'outline' | 'dashed' | 'ghost' | 'destructive';

export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<
  MantineButtonProps,
  'variant' | 'size' | 'color' | 'children'
> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: classes.primary,
  secondary: classes.secondary,
  outline: classes.outline,
  dashed: classes.dashed,
  ghost: classes.ghost,
  destructive: classes.destructive,
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: classes.sm,
  md: classes.md,
  lg: classes.lg,
};

/**
 * Design-system v2 button. Wraps Mantine Button for a11y/keyboard behaviour;
 * visual variants (including dashed) come from the CSS module.
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonProps) {
  const classNames = [classes.root, VARIANT_CLASS[variant], SIZE_CLASS[size], className]
    .filter(Boolean)
    .join(' ');

  return (
    <MantineButton
      {...rest}
      unstyled
      className={classNames}
      data-variant={variant}
      data-size={size}
    >
      {children}
    </MantineButton>
  );
}
