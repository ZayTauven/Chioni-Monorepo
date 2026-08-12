/*
 * Route: /auth/create-password-basic
 * The screen reads ?token= via useSearchParams (next/navigation), which Next
 * requires to sit inside a <Suspense> boundary at build time — provided here.
 */
import { Suspense } from 'react';
import { CreatePasswordBasic } from '../../../../src/screens/auth/CreatePasswordBasic';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CreatePasswordBasic />
    </Suspense>
  );
}
