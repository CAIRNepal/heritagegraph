// "use client"

// import { useSession, signIn, signOut } from "next-auth/react"
// import { useState } from "react"

// export default function MyComponent() {
//   const { data: session } = useSession()
//   const [users, setUsers] = useState(null)
//   const [error, setError] = useState(null)

//   const fetchUsers = async () => {
//     try {
//       if (!session?.accessToken) throw new Error("No token available")

//       const res = await fetch("http://127.0.0.1:8000/data/leaderboard", {
//         headers: {
//           Authorization: `Bearer ${session.accessToken}`,
//         },
//       })

//       if (!res.ok) {
//         throw new Error(`Error ${res.status}: ${await res.text()}`)
//       }

//       const data = await res.json()
//       setUsers(data)
//       setError(null)
//     } catch (err) {
//       setError(err.message)
//       setUsers(null)
//     }
//   }

//   return (
//     <>
//       {!session ? (
//         <button onClick={() => signIn("keycloak")}>Login with Keycloak</button>
//       ) : (
//         <>
//           <button onClick={fetchUsers}>Call Django API</button>
//           <button onClick={() => signOut()}>Logout</button>
//           {error && <p style={{ color: "red" }}>Error: {error}</p>}
//           {users && <pre>{JSON.stringify(users, null, 2)}</pre>}
//         </>
//       )}
//     </>
//   )
// }

'use client';
import { useSession } from 'next-auth/react';1
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Page() {
  const { data: session } = useSession();
            const token = (session as any)?.accessToken;
      console.log("=======================token here==================")
      console.log(token)
      console.log("=======================token end==================")

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
