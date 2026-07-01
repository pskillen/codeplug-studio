export interface GeolocationResult {
  lat: number;
  lon: number;
  accuracyMeters: number | null;
}

export class GeolocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeolocationError';
  }
}

const DEFAULT_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15_000,
  maximumAge: 0,
};

export function isGeolocationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator && window.isSecureContext;
}

function messageForGeolocationError(code: number): string {
  switch (code) {
    case 1:
      return 'Location permission denied';
    case 2:
      return 'Position unavailable';
    case 3:
      return 'Location request timed out';
    default:
      return 'Location request failed';
  }
}

export function requestCurrentPosition(opts?: PositionOptions): Promise<GeolocationResult> {
  if (!isGeolocationSupported()) {
    return Promise.reject(
      new GeolocationError('Location not available in this browser or context'),
    );
  }

  const options = { ...DEFAULT_OPTIONS, ...opts };

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        resolve({
          lat: latitude,
          lon: longitude,
          accuracyMeters: Number.isFinite(accuracy) ? accuracy : null,
        });
      },
      (error) => {
        reject(new GeolocationError(messageForGeolocationError(error.code)));
      },
      options,
    );
  });
}
