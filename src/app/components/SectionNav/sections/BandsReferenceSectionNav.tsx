import { NavLink, Stack } from '@mantine/core';
import { Link } from 'react-router-dom';

export default function BandsReferenceSectionNav() {
  return (
    <Stack gap="xs">
      <NavLink component={Link} to="/reference" label="Back to reference" />
    </Stack>
  );
}
