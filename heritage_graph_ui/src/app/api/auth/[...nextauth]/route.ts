// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  session: {
    strategy: "jwt", // stateless JWT session
  },

  callbacks: {
    // Called on every sign-in
    async signIn({ user, account }) {
      try {
        // Use Google's id_token to initialize user in Django
        const idToken = account?.id_token;

        if (idToken) {
          // Use Docker service name for inter-container communication
          const backendUrl = process.env.INTERNAL_BACKEND_URL || "http://backend:8000";
          const response = await fetch(`${backendUrl}/data/testme/`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${idToken}`,
              Accept: "application/json",
            },
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error("Django API call failed:", errorText);
          } else {
            console.log("Django API call successful");
          }
        }
      } catch (err) {
        console.error("Error during signIn callback:", err);
      }

      return true; // allow login to continue
    },

    // Called whenever a JWT is created or updated
    async jwt({ token, user, account }) {
      if (user) {
        token.email = user.email;
        token.name = user.name;
        token.username = user.email; // Google doesn't have usernames, use email
      }
      if (account) {
        // Store Google's id_token — Django will verify this
        token.accessToken = account.id_token;
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
