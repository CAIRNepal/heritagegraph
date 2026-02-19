// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";

// -------------------------------------------------------------------
// Provider selection: Google OAuth (prod) vs Credentials (dev)
// -------------------------------------------------------------------
// In dev mode, we use Django's username/password auth via /api/token/.
// In prod mode, we use Google OAuth — the id_token is sent to Django.
// Detection: if GOOGLE_CLIENT_ID is set, use Google; otherwise Credentials.
// -------------------------------------------------------------------

const isGoogleAuthEnabled =
  !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

const providers = [];

if (isGoogleAuthEnabled) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    })
  );
} else {
  providers.push(
    CredentialsProvider({
      name: "Django Login",
      credentials: {
        username: { label: "Username", type: "text", placeholder: "admin" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        try {
          const backendUrl =
            process.env.INTERNAL_BACKEND_URL || "http://localhost:8000";
          const res = await fetch(`${backendUrl}/api/token/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username: credentials.username,
              password: credentials.password,
            }),
          });

          if (!res.ok) return null;

          const data = await res.json();
          // SimpleJWT returns { access, refresh }
          return {
            id: credentials.username,
            email: credentials.username,
            name: credentials.username,
            accessToken: data.access,
            refreshToken: data.refresh,
          };
        } catch (err) {
          console.error("Dev auth error:", err);
          return null;
        }
      },
    })
  );
}

const handler = NextAuth({
  providers,

  // Credentials provider requires "jwt" strategy (no database session)
  session: {
    strategy: "jwt",
  },

  // Custom login page path (optional — only used in dev/credentials mode)
  ...(isGoogleAuthEnabled ? {} : { pages: { signIn: "/auth/login" } }),

  callbacks: {
    // Called on every sign-in
    async signIn({ user, account }) {
      // Only run Django init for Google OAuth (prod)
      if (account?.provider === "google") {
        try {
          const idToken = account.id_token;
          if (idToken) {
            const backendUrl =
              process.env.INTERNAL_BACKEND_URL || "http://backend:8000";
            const response = await fetch(`${backendUrl}/data/testme/`, {
              method: "GET",
              headers: {
                Authorization: `Bearer ${idToken}`,
                Accept: "application/json",
              },
            });
            if (!response.ok) {
              console.error("Django API call failed:", await response.text());
            }
          }
        } catch (err) {
          console.error("Error during signIn callback:", err);
        }
      }
      return true;
    },

    // Called whenever a JWT is created or updated
    async jwt({ token, user, account }) {
      if (user) {
        token.email = user.email;
        token.name = user.name;
        token.username = user.email;
      }
      if (account?.provider === "google") {
        // Store Google's id_token — Django verifies this in prod
        token.accessToken = account.id_token;
      } else if (user && "accessToken" in user) {
        // Store SimpleJWT access token from credentials auth (dev)
        token.accessToken = (user as any).accessToken;
      }
      return token;
    },

    // Called whenever session data is returned to the client
    async session({ session, token }) {
      session.user = session.user || {};
      session.user.email = token.email;
      session.user.name = token.name;
      session.user.username = token.username;
      session.accessToken = token.accessToken;
      return session;
    },
  },

  debug: process.env.NODE_ENV === "development",
});

export { handler as GET, handler as POST };
