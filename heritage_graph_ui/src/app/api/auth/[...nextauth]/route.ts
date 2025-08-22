import NextAuth from 'next-auth';
import KeycloakProvider from 'next-auth/providers/keycloak';

export const authOptions = {
  providers: [
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_CLIENT_ID!,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
      issuer: process.env.KEYCLOAK_ISSUER!,
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, account, user, profile }) {
      if (account) {
        console.log('🔹 JWT Callback:');
        console.log('token:', token);
        console.log('account:', account);
        console.log('user:', user.username);
        console.log('profile:', profile);

        token.accessToken = account.access_token;
        // if (user?.name) token.username = user.preferred_username;
        if (user?.name) token.username = profile.preferred_username;
        else if (user?.preferred_username) token.username = profile.preferred_username;
        else if (profile?.preferred_username)
          token.username = profile.preferred_username;
      }
      return token;
    },

    async session({ session, token }) {
      console.log('🔹 Session Callback:');
      console.log('session before:', session);
      console.log('token:', token);

      session.accessToken = token.accessToken;
      session.user = session.user || {};
      session.user.username = token.username || null;

      console.log('session after:', session);
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
