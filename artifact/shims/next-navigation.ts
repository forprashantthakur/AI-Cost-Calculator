import { navigate, usePath } from '../router';

/** Drop-in replacements for next/navigation hooks in the single-file build. */
export const usePathname = () => usePath();

const router = {
  push: (href: string) => navigate(href),
  replace: (href: string) => navigate(href),
  back: () => navigate('/'),
  forward: () => undefined,
  refresh: () => undefined,
  prefetch: () => undefined,
};

export const useRouter = () => router;
