"use client"

import { useAuth } from "@clerk/nextjs"
import { useState } from "react"

export default function MyComponent() {
  const { getToken, isSignedIn } = useAuth()
  const [users, setUsers] = useState(null)
  const [error, setError] = useState(null)

  const fetchUsers = async () => {
    try {
      const token = await getToken()
      if (!token) throw new Error("No token available")

      const res = await fetch("http://localhost:8000/data/leaderboard", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Error ${res.status}: ${errorText}`)
      }

      const data = await res.json()
      setUsers(data)
      setError(null)
      console.log(data)
    } catch (err) {
      setError(err.message)
      setUsers(null)
      console.error(err)
    }
  }

  return (
    <>
      <button onClick={fetchUsers} disabled={!isSignedIn}>
        Call Django API
      </button>
      {error && <p style={{ color: "red" }}>Error: {error}</p>}
      {users && (
        <pre style={{ whiteSpace: "pre-wrap" }}>
          {JSON.stringify(users, null, 2)}
        </pre>
      )}
    </>
  )
}
