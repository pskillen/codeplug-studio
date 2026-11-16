import { fireEvent, screen } from '@testing-library/react';

/** Choose a Memory category in the shared dropdown (option labels may carry a "(count)" suffix). */
export function chooseCategory(name: string) {
  fireEvent.click(screen.getByRole('combobox', { name: 'Category' }));
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  fireEvent.click(screen.getByRole('option', { name: new RegExp(`^${escaped}( \\(\\d+\\))?$`) }));
}
