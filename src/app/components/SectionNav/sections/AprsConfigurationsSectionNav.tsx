import { Link } from 'react-router-dom';
import type { SectionNavProps } from '../../../nav/sectionNavTypes.ts';
import { secondaryButtonStyle } from '../../fields/styles.ts';

export default function AprsConfigurationsSectionNav(props: SectionNavProps) {
  void props;
  return (
    <Link to="/library/aprs-configuration" style={secondaryButtonStyle}>
      Open APRS configuration
    </Link>
  );
}
