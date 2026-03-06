// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";

// -------------------------------------------------------------------
// Provider selection:
//   - Dev:  Credentials (username/password → SimpleJWT)
//   - Prod: Google OAuth + GitHub OAuth (auto-detected via env vars)
// -------------------------------------------------------------------
// If GOOGLE_CLIENT_ID is set, Google provider is enabled.
// If GITHUB_ID is set, GitHub provider is enabled.
// If neither is set, Credentials (dev) provider is used.
// -------------------------------------------------------------------

const isGoogleAuthEnabled =
  !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

const isGitHubAuthEnabled =
  !!process.env.GITHUB_ID && !!process.env.GITHUB_SECRET;

const hasOAuthProvider = isGoogleAuthEnabled || isGitHubAuthEnabled;

const providers = [];

if (isGoogleAuthEnabled) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    })
  );
}

if (isGitHubAuthEnabled) {
  providers.push(
    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    })
  );
}

if (!hasOAuthProvider) {
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

  // Custom login page path — only used in dev/credentials mode
  ...(!hasOAuthProvider ? { pages: { signIn: "/auth/login" } } : {}),

  callbacks: {
    // Called on every sign-in
    async signIn({ user, account }) {
      // For OAuth providers, ping the backend to auto-create the Django user
      if (account?.provider === "google" || account?.provider === "github") {
        try {
          const token =
            account.provider === "google"
              ? account.id_token
              : account.access_token;
          if (token) {
            const backendUrl =
              process.env.INTERNAL_BACKEND_URL || "http://backend:8000";
            const response = await fetch(`${backendUrl}/data/testme/`, {
              method: "GET",
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
              },
            });
            if (!response.ok) {
              console.error(
                `Django sync call failed for ${account.provider}:`,
                await response.text()
              );
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
        // Store Google's id_token — Django verifies via google-auth library
        token.accessToken = account.id_token;
        token.authProvider = "google";
      } else if (account?.provider === "github") {
        // Store GitHub's access_token — Django verifies by calling GitHub API
        token.accessToken = account.access_token;
        token.authProvider = "github";
      } else if (user && "accessToken" in user) {
        // Store SimpleJWT access token from credentials auth (dev)
        token.accessToken = (user as any).accessToken;
        token.authProvider = "credentials";
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
