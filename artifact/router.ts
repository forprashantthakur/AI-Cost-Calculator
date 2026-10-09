import { useSyncExternalStore } from 'react';

/**
 * In-memory router for the single-file build (no server, no real URLs).
 * The current section is mirrored to a bare `#token` so a link can open a
 * specific section; all other state stays in the page.
 */
export const ROUTES = ['/', '/estimate/', '/dashboard/', '/compare/', '/simulator/', '/library/', '/settings/', '/methodology/'] as const;

const tokenOf = (path: string) => (path === '/' ? 'home' : path.replace(/\//g, ''));

function initialPath(): string {
  try {
    const t = window.location.hash.replace(/^#/, '');
    const hit = ROUTES.find((r) => tokenOf(r) === t);
    if (hit) return hit;
  } catch {
    /* ignore */
  }
  return '/';
}

let current = typeof window === 'undefined' ? '/' : initialPath();
const listeners = new Set<() => void>();

export function normalise(href: string): { path: string; query: string } {
  const [rawPath, query = ''] = href.split('?');
  let path = rawPath || '/';
  if (!path.startsWith('/')) path = `/${path}`;
  if (!path.endsWith('/')) path = `${path}/`;
  if (!(ROUTES as readonly string[]).includes(path)) path = '/';
  return { path, query: query ? `?${query}` : '' };
}

export function navigate(href: string) {
  const { path, query } = normalise(href);
  (window as unknown as { __APP_QUERY__?: string }).__APP_QUERY__ = query;
  current = path;
  try {
    history.replaceState(null, '', `#${tokenOf(path)}`);
  } catch {
    /* sandboxed: ignore */
  }
  window.scrollTo({ top: 0 });
  listeners.forEach((l) => l());
}

export const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const getPath = () => current;

export const usePath = () => useSyncExternalStore(subscribe, getPath, getPath);

export const linkHref = (href: string) => `#${tokenOf(normalise(href).path)}`;
