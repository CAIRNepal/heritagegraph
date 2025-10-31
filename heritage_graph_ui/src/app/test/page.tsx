// 'use client';

// import { Button } from '@/components/ui/button';
// import { signIn, signOut, useSession } from 'next-auth/react';

// export default function Home() {
//   const { data: session } = useSession();

//   async function callDjango() {
//     const res = await fetch('http://127.0.0.1:8000/data/testme/', {
//       headers: {
//         Authorization: `Bearer ${session?.accessToken}`,
//       },
//     });
//     const data = await res.json();
//     console.log('Django says:', data);
//     console.log('Session: ', session.accessToken);
//   }

//   return (
//     <div>
//       {session ? (
//         <>
//           <p>Signed in as {session.user?.email}</p>
//           <Button onClick={() => signOut()}>Sign out</Button>
//           <Button onClick={callDjango}>Call Django API</Button>
//         </>
//       ) : (
//         <Button onClick={() => signIn('keycloak')}>Sign in with Keycloak</Button>
//       )}
//     </div>
//   );
// }

'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Page() {
  const handleClick = () => {
    alert('Hello World!');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="shadow-lg rounded-xl p-6">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Hello World!</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Welcome to your new Next.js page.
          </p>
          <Button onClick={handleClick}>Click Me</Button>
        </CardContent>
      </Card>
    </div>
  );
}
