"use client"

import { useSession, signIn, signOut } from "next-auth/react"
import { useState } from "react"

export default function MyComponent() {
  const { data: session } = useSession()
  const [users, setUsers] = useState(null)
  const [error, setError] = useState(null)

  const fetchUsers = async () => {
    try {
      if (!session?.accessToken) throw new Error("No token available")

      const res = await fetch("http://127.0.0.1:8000/data/leaderboard", {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      })

      if (!res.ok) {
        throw new Error(`Error ${res.status}: ${await res.text()}`)
      }

      const data = await res.json()
      setUsers(data)
      setError(null)
    } catch (err) {
      setError(err.message)
      setUsers(null)
    }
  }

  return (
    <>
      {!session ? (
        <button onClick={() => signIn("keycloak")}>Login with Keycloak</button>
      ) : (
        <>
          <button onClick={fetchUsers}>Call Django API</button>
          <button onClick={() => signOut()}>Logout</button>
          {error && <p style={{ color: "red" }}>Error: {error}</p>}
          {users && <pre>{JSON.stringify(users, null, 2)}</pre>}
        </>
      )}
    </>
  )
}
