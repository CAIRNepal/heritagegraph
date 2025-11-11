// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import KeycloakProvider from "next-auth/providers/keycloak";

const handler = NextAuth({
  providers: [
    KeycloakProvider({
      clientId: "HeritageGraph",
      clientSecret: "sHNjcASWSVCSE7LSsJXibvut576zcbRo",
      issuer: "http://keycloak.localhost/realms/HeritageRealm",
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name ?? profile.preferred_username,
          email: profile.email,
          image: profile.picture,
          username: profile.preferred_username,
        };
      },
    }),
  ],

  session: {
    strategy: "jwt", // stateless JWT session
  },

  callbacks: {
    // Called on every sign-in
    async signIn({ user, account }) {
      try {
        // console.log("User info from Keycloak:", user);
        // console.log("Account info:", account);

        const accessToken = account?.access_token;

        if (accessToken) {
          // Example API call to Django backend
          const response = await fetch("http://127.0.0.1:8000/data/testme/", {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "Accept": "application/json",
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
        token.username = user.username; // now included
      }
      if (account) {
        token.accessToken = account.access_token;
        token.idToken = account.id_token;
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
      session.idToken = token.idToken;
      return session;
    },
  },

  debug: true, // helpful during development
});

export { handler as GET, handler as POST };
