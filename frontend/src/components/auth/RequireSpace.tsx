'use client';
/*
 * Chioni — client-side space guard (ADR 0011: no server middleware, tokens
 * live in localStorage and every screen is a client component).
 *
 * Wraps a space layout: while the session loads → spinner ; anonymous →
 * /auth/sign-in ; authenticated without this hat → /espaces.
 */

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { spacesOf, useAuth, type Space } from '@/context/AuthContext';

function GuardLoader() {
  return (
    <div className="ax-center" style={{ minHeight: '100dvh' }} role="status" aria-live="polite" aria-label="Chargement">
      <span className="ax-spinner ax-spinner--lg" aria-hidden="true">
        <span className="ax-spinner__glyph"></span>
      </span>
    </div>
  );
}

export function RequireSpace({ space, children }: { space: Space; children: ReactNode }) {
  const { me, status } = useAuth();
  const router = useRouter();
  const allowed = status === 'authenticated' && spacesOf(me).includes(space);

  useEffect(() => {
    if (status === 'anonymous') {
      router.replace('/auth/sign-in');
    } else if (status === 'authenticated' && !allowed) {
      router.replace('/espaces');
    }
  }, [status, allowed, router]);

  if (!allowed) return <GuardLoader />;
  return <>{children}</>;
}

export default RequireSpace;
