/** True when an old `/reference/maidenhead` link asked for the Bearing view (`?mode=bearing` or `?tab=bearing`). */
export function wantsBearing(params: URLSearchParams): boolean {
  const view = (params.get('mode') ?? params.get('tab') ?? '').toLowerCase();
  return view === 'bearing';
}
