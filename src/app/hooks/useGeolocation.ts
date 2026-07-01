import { useCallback, useState } from 'react';
import {
  GeolocationError,
  requestCurrentPosition,
  type GeolocationResult,
} from '../lib/geolocation.ts';

export function useGeolocation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accuracyMeters, setAccuracyMeters] = useState<number | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const requestLocation = useCallback(async (): Promise<GeolocationResult | null> => {
    setError(null);
    setAccuracyMeters(null);
    setLoading(true);
    try {
      const result = await requestCurrentPosition();
      setAccuracyMeters(result.accuracyMeters);
      return result;
    } catch (err) {
      const message = err instanceof GeolocationError ? err.message : 'Location request failed';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    requestLocation,
    loading,
    error,
    accuracyMeters,
    clearError,
  };
}
