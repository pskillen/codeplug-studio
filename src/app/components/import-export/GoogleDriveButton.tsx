import { Button, type ButtonProps } from '@mantine/core';
import { GoogleDriveIcon } from './GoogleDriveIcon.tsx';

export type GoogleDriveButtonProps = Omit<ButtonProps, 'variant' | 'leftSection' | 'color'>;

/**
 * White bordered button with the Google Drive icon — matches Google’s third-party CTA styling.
 */
export default function GoogleDriveButton({ children, styles, ...props }: GoogleDriveButtonProps) {
  return (
    <Button
      variant="default"
      leftSection={<GoogleDriveIcon size={18} />}
      styles={{
        root: {
          backgroundColor: '#fff',
          border: '1px solid #dadce0',
          color: '#3c4043',
          fontWeight: 500,
          '&:hover': {
            backgroundColor: '#f8f9fa',
            borderColor: '#dadce0',
          },
        },
        ...styles,
      }}
      {...props}
    >
      {children}
    </Button>
  );
}
