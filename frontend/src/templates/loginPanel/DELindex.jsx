// import './index.css'
// import { useState, useEffect } from 'react'
// import { createClient } from '@supabase/supabase-js'
// import { Auth } from '@supabase/auth-ui-react'
// import { ThemeSupa } from '@supabase/auth-ui-shared'
// import { Layout } from 'antd'

// const supabase = createClient(
//   'https://erpcdrammanhvtvjsbrm.supabase.co',
//   'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVycGNkcmFtbWFuaHZ0dmpzYnJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwMDc1MTUsImV4cCI6MjA1ODU4MzUxNX0.IG1loQJMDDxEftohIk1IKqlHmhW3TcmIjecujNMm9mo'
// )

// export default function App() {
//   const [session, setSession] = useState(null)

//   useEffect(() => {
//     supabase.auth.getSession().then(({ data: { session } }) => {
//       setSession(session)
//     })

//     const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
//       setSession(session)
//     })

//     return () => subscription.unsubscribe()
//   }, [])

//   const handleLogout = async () => {
//     await supabase.auth.signOut()
//     setSession(null)
//   }

//   if (!session) {
//     return (
//       <div className="auth-container">
//         <h2 className="auth-title">Login</h2>
//         <Auth supabaseClient={supabase} appearance={{ theme: ThemeSupa }} />
//       </div>
//     )
//   } else {
//     return (
//       <Layout>
//       <div className="logged-in-container">
//         <h2>Welcome!</h2>
//         <button className="logout-button" onClick={handleLogout}>Logout</button>
//       </div>
//       </Layout>
//     )
//   }
// }
