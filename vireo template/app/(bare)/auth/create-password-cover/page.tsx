/*
 * Route: /auth/create-password-cover
 * The screen reads ?token= via useSearchParams (next/navigation), which Next
 * requires to sit inside a <Suspense> boundary at build time — provided here.
 */
import { Suspense } from 'react';
import { CreatePasswordCover } from '../../../../src/screens/auth/CreatePasswordCover';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CreatePasswordCover />
    </Suspense>
  );
}
