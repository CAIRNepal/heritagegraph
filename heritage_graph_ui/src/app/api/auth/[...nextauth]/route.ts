import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";


const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Email",
      credentials: {
        username: { label: "Username", type: "text", placeholder: "nabinoli2004@gmail.com"},
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, req) {
        const username = credentials?.username;
        const password = credentials?.password;

        const user = {
          name: "nabin",
          id: 1, 
          username: "nabinoli2004@gmail.com"
        }

        if (user) {
          return user;
        } else {
          return null;
        }
      }
    }),
      GoogleProvider({
    clientId: "asas",
    clientSecret: "sasas"
  }),
    GitHubProvider({
    clientId: "asas",
    clientSecret: "asas"
  })


  ]
})

export { handler as GET, handler as POST }

function CredentialProvider(arg0: { name: string; credentials: { username: { label: string; type: string; placeholder: string; }; password: { label: string; type: string; }; }; authorize(credentials: any, req: any): Promise<{ name: string; id: number; username: string; } | null>; }): import("next-auth/providers/index").Provider {
  throw new Error("Function not implemented.");
}

