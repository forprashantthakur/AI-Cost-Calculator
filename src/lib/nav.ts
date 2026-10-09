/**
 * Navigation helpers shared by the Next.js build and the single-file build.
 * The single-file build has no real URLs, so its router publishes the current
 * query string on `window.__APP_QUERY__`.
 */
export function getQueryParam(name: string): string | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { __APP_QUERY__?: string };
  const search = w.__APP_QUERY__ ?? window.location.search;
  try {
    return new URLSearchParams(search).get(name);
  } catch {
    return null;
  }
}
