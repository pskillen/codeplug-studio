import { Navigate, useLocation, useParams } from 'react-router-dom';
import { debugRadioPath, resolveLegacyDebugSlug } from './descriptors.ts';
import { RadioNotFound } from './RadioDebugPage.tsx';

export default function RadioDebugRedirect() {
  const { radio } = useParams();
  const { search, hash } = useLocation();
  const hit = radio ? resolveLegacyDebugSlug(radio) : undefined;
  if (!hit) return <RadioNotFound />;
  return <Navigate to={`${debugRadioPath(hit)}${search}${hash}`} replace />;
}
