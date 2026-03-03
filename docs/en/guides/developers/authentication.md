# Authentication Guide (Developers)

This page summarizes how authentication works in HeritageGraph and provides quick patterns for frontend and backend developers.

## Two modes: Development vs Production

- Development: `DevSessionAuthentication` + SimpleJWT. Frontend uses a `CredentialsProvider` and `POST /api/token/` to obtain `{access, refresh}`.
- Production: `GoogleTokenAuthentication`. Frontend uses NextAuth with the Google provider; API calls send `Authorization: Bearer <google_id_token>`.

Detection is automatic: `GOOGLE_CLIENT_ID` env var present → production mode.

## Frontend patterns

- Client components: use `useSession()` to get `session.accessToken` and call backend with `Authorization: Bearer ${session.accessToken}`.
- Server components / API routes: use `getServerSession(authOptions)` and forward the `accessToken` to the backend when making server-side requests.

Example client fetch:

```tsx
const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/data/submissions/`, {
  headers: { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json' },
});
```

## Backend verification

- In production, `GoogleTokenAuthentication` validates the Google ID token with `google-auth` and auto-creates/syncs a Django `User` + `UserProfile`.
- In development, JWTs are verified via SimpleJWT.

## Quick checks

- Use `INTERNAL_BACKEND_URL` for server-side requests in Docker (`http://backend:8000`).
- Ensure `NEXTAUTH_SECRET` is set for NextAuth.

For full reference, see the repository `AUTH.md` and the `heritage_graph/apps/heritage_data/authentication.py` implementation.
