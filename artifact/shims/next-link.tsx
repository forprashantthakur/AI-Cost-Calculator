import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { linkHref, navigate } from '../router';

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { href: string; children?: ReactNode; prefetch?: boolean };

/** Drop-in replacement for next/link in the single-file build. */
export default function Link({ href, children, onClick, prefetch: _prefetch, ...rest }: Props) {
  return (
    <a
      {...rest}
      href={linkHref(href)}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        navigate(href);
      }}
    >
      {children}
    </a>
  );
}
