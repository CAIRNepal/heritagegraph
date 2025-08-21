'use client';

import { Button } from '@/components/ui/button';
import { signIn, signOut, useSession } from 'next-auth/react';

export default function Home() {
  const { data: session } = useSession();

  async function callDjango() {
    const res = await fetch('http://localhost:8000/data/testme/', {
      headers: {
        Authorization: `Bearer ${session?.accessToken}`,
      },
    });
    const data = await res.json();
    console.log('Django says:', data);
    console.log('Session: ', session.accessToken);
  }

  return (
    <div>
      {session ? (
        <>
          <p>Signed in as {session.user?.email}</p>
          <Button onClick={() => signOut()}>Sign out</Button>
          <Button onClick={callDjango}>Call Django API</Button>
        </>
      ) : (
        <Button onClick={() => signIn('keycloak')}>Sign in with Keycloak</Button>
      )}
    </div>
  );
}
