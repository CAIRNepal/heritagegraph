'use client';

import { signIn, signOut, useSession } from 'next-auth/react';

export default function AuthButtons() {
  const { data: session } = useSession();

  if (session) {
    return (
      <div className="flex items-center gap-4">
        <span className="text-sm">Hi, {session.user?.email}</span>
        <button
          onClick={() => signOut()}
          className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => signIn('keycloak')}
      className="bg-primary text-white rounded-full font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 transition hover:bg-primary/90"
    >
      Sign In
    </button>
  );
}
