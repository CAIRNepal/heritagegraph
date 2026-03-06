# AUTH_GUIDE.md — How to Add a New Authentication Provider

> **Audience:** Developers who want to add a new OAuth provider (e.g., Facebook, Discord, Microsoft) to HeritageGraph.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Current Auth Modes](#current-auth-modes)
3. [Quick Start — Switching Auth Modes](#quick-start--switching-auth-modes)
4. [Step-by-Step: Adding a New OAuth Provider](#step-by-step-adding-a-new-oauth-provider)
   - [Step 1: Get OAuth Credentials](#step-1-get-oauth-credentials)
   - [Step 2: Add to Frontend (NextAuth)](#step-2-add-to-frontend-nextauth)
   - [Step 3: Add to Backend (Django DRF)](#step-3-add-to-backend-django-drf)
   - [Step 4: Register in Django Settings](#step-4-register-in-django-settings)
   - [Step 5: Add Environment Variables](#step-5-add-environment-variables)
   - [Step 6: Add Makefile Command](#step-6-add-makefile-command)
   - [Step 7: Test End-to-End](#step-7-test-end-to-end)
5. [Reference: Existing Providers](#reference-existing-providers)
6. [Token Flow Diagrams](#token-flow-diagrams)
7. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

HeritageGraph auth has **two layers** — a **frontend** (NextAuth v4) and a **backend** (Django REST Framework). Every authenticaton flow follows the same pattern:

```
                  ┌──────────────────┐
                  │  OAuth Provider  │
   ┌─────────────►│  (Google/GitHub) │
   │              └────────┬─────────┘
   │                       │ Returns token (id_token / access_token)
   │                       ▼
┌──┴───────────┐   ┌──────────────┐   ┌──────────────────┐
│   Browser    │   │  NextAuth    │   │  Django Backend   │
│              │◄──┤  (Next.js)   ├──►│  (DRF)            │
│              │   │              │   │                    │
│              │   │  Stores      │   │  Verifies token,  │
│              │   │  token in    │   │  creates/syncs     │
│              │   │  JWT cookie  │   │  User + Profile    │
└──────────────┘   └──────────────┘   └──────────────────┘
```

**Key principle:** The frontend (NextAuth) handles the OAuth dance and stores the provider's token. The backend (Django) verifies that token on every API request. Each provider needs implementation on **both** sides.

### Token Types by Provider

| Provider | Token sent to Django | Django verification method |
|----------|---------------------|---------------------------|
| **Credentials (dev)** | SimpleJWT `access` token | `JWTAuthentication` (built-in) |
| **Google** | Google `id_token` (JWT) | `google.oauth2.id_token.verify_oauth2_token()` |
| **GitHub** | GitHub `access_token` (opaque) | Call `https://api.github.com/user` |

---

## Current Auth Modes

| Mode | Providers | Detection | Use Case |
|------|-----------|-----------|----------|
| **Dev (default)** | Credentials (username/password → JWT) | No `GOOGLE_CLIENT_ID` or `GITHUB_ID` set | Local development |
| **Google** | Google OAuth | `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` set | Production |
| **GitHub** | GitHub OAuth | `GITHUB_ID` + `GITHUB_SECRET` set | Production |
| **All** | Google + GitHub | Both sets of vars configured | Production (multiple sign-in options) |

**Detection is automatic.** The frontend checks which env vars are set and enables the corresponding providers at startup.

---

## Quick Start — Switching Auth Modes

### JWT Only (Default Dev)

No setup needed. Just create a user and go:

```bash
make auth-dev       # Reset to JWT mode (clears OAuth env vars)
make superuser      # Create admin user
make backend        # Terminal 1
make frontend       # Terminal 2
# → Login at http://localhost:3000/auth/login
```

### Google OAuth

```bash
# 1. Get credentials from https://console.cloud.google.com/apis/credentials
# 2. Set callback URL: http://localhost:3000/api/auth/callback/google

make auth-google \
  GOOGLE_CLIENT_ID=123456.apps.googleusercontent.com \
  GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx

# 3. Also set the backend env var:
echo "GOOGLE_CLIENT_ID=123456.apps.googleusercontent.com" > heritage_graph/.env

# 4. Restart both servers
make kill-ports && make backend  # Terminal 1
make frontend                    # Terminal 2
```

### GitHub OAuth

```bash
# 1. Get credentials from https://github.com/settings/developers → OAuth Apps
# 2. Set callback URL:     http://localhost:3000/api/auth/callback/github
# 3. Set homepage URL:     http://localhost:3000

make auth-github \
  GITHUB_ID=Ov23lixxxxxxxxxx \
  GITHUB_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 4. Also set the backend env vars:
cat >> heritage_graph/.env << 'EOF'
GITHUB_CLIENT_ID=Ov23lixxxxxxxxxx
GITHUB_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
EOF

# 5. Restart both servers
```

### Both Google + GitHub

```bash
make auth-all \
  GOOGLE_CLIENT_ID=123456.apps.googleusercontent.com \
  GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx \
  GITHUB_ID=Ov23lixxxxxxxxxx \
  GITHUB_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Check Current Status

```bash
make auth-status
```

---

## Step-by-Step: Adding a New OAuth Provider

Use this guide when you want to add a provider that isn't currently supported (e.g., Facebook, Discord, Microsoft, Twitter/X, GitLab).

### Step 1: Get OAuth Credentials

Every OAuth provider requires you to register an "app" or "client" in their developer console:

1. Go to the provider's developer settings
2. Create a new OAuth application
3. Note the **Client ID** and **Client Secret**
4. Set the **callback/redirect URL** to:
   ```
   http://localhost:3000/api/auth/callback/<provider_id>
   ```
   For production:
   ```
   https://yourdomain.com/api/auth/callback/<provider_id>
   ```

Common provider developer consoles:

| Provider | Developer Console URL |
|----------|----------------------|
| Google | https://console.cloud.google.com/apis/credentials |
| GitHub | https://github.com/settings/developers |
| Facebook | https://developers.facebook.com/apps/ |
| Discord | https://discord.com/developers/applications |
| Microsoft | https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps |
| GitLab | https://gitlab.com/-/profile/applications |
| Twitter/X | https://developer.twitter.com/en/portal/projects-and-apps |

### Step 2: Add to Frontend (NextAuth)

NextAuth has 60+ built-in providers. See the full list at:
https://next-auth.js.org/providers/

**File to edit:** `heritage_graph_ui/src/app/api/auth/[...nextauth]/route.ts`

#### 2a. Import the provider

```typescript
import MyProvider from "next-auth/providers/<provider_id>";
```

#### 2b. Add provider detection

```typescript
const isMyProviderEnabled =
  !!process.env.MY_PROVIDER_CLIENT_ID && !!process.env.MY_PROVIDER_CLIENT_SECRET;
```

Update `hasOAuthProvider`:
```typescript
const hasOAuthProvider = isGoogleAuthEnabled || isGitHubAuthEnabled || isMyProviderEnabled;
```

#### 2c. Push the provider

```typescript
if (isMyProviderEnabled) {
  providers.push(
    MyProvider({
      clientId: process.env.MY_PROVIDER_CLIENT_ID!,
      clientSecret: process.env.MY_PROVIDER_CLIENT_SECRET!,
    })
  );
}
```

#### 2d. Handle the token in the `jwt` callback

Different providers return different token types:
- **ID token providers** (Google, Microsoft): Use `account.id_token`
- **Access token providers** (GitHub, Facebook, Discord): Use `account.access_token`

```typescript
async jwt({ token, user, account }) {
  // ... existing code ...
  } else if (account?.provider === "<provider_id>") {
    // Use id_token or access_token depending on the provider
    token.accessToken = account.access_token; // or account.id_token
    token.authProvider = "<provider_id>";
  }
  // ...
}
```

#### 2e. Also update `heritage_graph_ui/src/lib/auth.ts`

This file mirrors the route handler and is used for `getServerSession()`. Apply the same changes there.

### Step 3: Add to Backend (Django DRF)

**File to edit:** `heritage_graph/apps/heritage_data/authentication.py`

Create a new authentication class that:
1. Reads the `Authorization: Bearer <token>` header
2. Verifies the token with the provider's API
3. Extracts user info (email, name)
4. Creates or syncs a Django `User` + `UserProfile`
5. Returns `(user, None)` if valid, or `None` if the token isn't for this provider

#### Template for a new auth backend:

```python
# ====================================================================
# Production Authentication — <ProviderName> OAuth
# ====================================================================

MY_PROVIDER_CLIENT_ID = os.environ.get("MY_PROVIDER_CLIENT_ID", "")


class MyProviderTokenAuthentication(authentication.BaseAuthentication):
    """
    Authenticate requests using <ProviderName> OAuth tokens.
    """

    def authenticate(self, request):
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return None

        # Skip if provider is not configured
        if not MY_PROVIDER_CLIENT_ID:
            return None

        token = auth_header.split(" ")[1]

        # ── Verify the token with the provider ──
        # Option A: For access tokens — call the provider's user info API
        try:
            resp = http_requests.get(
                "https://provider.example.com/api/userinfo",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10,
            )
        except http_requests.RequestException:
            return None

        if resp.status_code != 200:
            return None  # Not a token for this provider — let next auth class try

        user_data = resp.json()

        # Option B: For ID tokens (JWT) — verify the signature
        # import jwt
        # payload = jwt.decode(token, options={"verify_signature": True}, ...)

        # ── Extract user info ──
        email = user_data.get("email")
        if not email:
            raise exceptions.AuthenticationFailed("Token missing email.")

        first_name = user_data.get("first_name", "")
        last_name = user_data.get("last_name", "")

        # ── Map to Django user ──
        username = email

        user, created = User.objects.get_or_create(
            username=username,
            defaults={"email": email},
        )

        user.email = email
        user.first_name = first_name
        user.last_name = last_name
        user.save()

        if created:
            logger.info("Created new user from <Provider> sign-in: %s", email)

        # ── Sync UserProfile ──
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.first_name = first_name
        profile.last_name = last_name
        profile.email = email
        profile.save()

        return (user, None)
```

#### Key rules for the backend class:

| Rule | Why |
|------|-----|
| Return `None` if `MY_PROVIDER_CLIENT_ID` is not set | Skip gracefully when provider isn't configured |
| Return `None` if the provider rejects the token | Let the next auth class in the chain try |
| **Raise** `AuthenticationFailed` only for verified-but-invalid tokens | E.g., email missing, email not verified |
| Use `get_or_create` for Users | Auto-create on first login |
| Always sync `UserProfile` | Downstream code expects it to exist |
| Use `username = email` | Consistent with Google/GitHub backends |

### Step 4: Register in Django Settings

Add your new class to the DRF authentication chain in **both** settings files:

**`heritage_graph/settings/development.py`:**
```python
REST_FRAMEWORK["DEFAULT_AUTHENTICATION_CLASSES"] = (
    "apps.heritage_data.authentication.DevSessionAuthentication",
    "apps.heritage_data.authentication.GoogleTokenAuthentication",
    "apps.heritage_data.authentication.GitHubTokenAuthentication",
    "apps.heritage_data.authentication.MyProviderTokenAuthentication",  # ← ADD
    "rest_framework_simplejwt.authentication.JWTAuthentication",
)
```

**`heritage_graph/settings/production.py`:**
```python
REST_FRAMEWORK["DEFAULT_AUTHENTICATION_CLASSES"] = (
    "apps.heritage_data.authentication.GoogleTokenAuthentication",
    "apps.heritage_data.authentication.GitHubTokenAuthentication",
    "apps.heritage_data.authentication.MyProviderTokenAuthentication",  # ← ADD
    "rest_framework_simplejwt.authentication.JWTAuthentication",
)
```

> **Order matters:** Put custom providers BEFORE `JWTAuthentication` because SimpleJWT raises `AuthenticationFailed` for any invalid JWT, which stops the chain. Custom providers return `None` to pass through.

### Step 5: Add Environment Variables

Update **three** files:

1. **Root** `.env.example` — Add the backend env vars
2. **Frontend** `heritage_graph_ui/.env.example` — Add the NextAuth env vars
3. **Backend** `heritage_graph/.env.example` — Add the verification env vars

Example:
```dotenv
# .env.example (root)
MY_PROVIDER_CLIENT_ID=your-client-id
MY_PROVIDER_CLIENT_SECRET=your-client-secret

# heritage_graph_ui/.env.example
MY_PROVIDER_CLIENT_ID=your-client-id
MY_PROVIDER_CLIENT_SECRET=your-client-secret

# heritage_graph/.env.example
MY_PROVIDER_CLIENT_ID=your-client-id
```

> **Naming convention:** NextAuth uses specific env var names for some providers. Check the [NextAuth provider docs](https://next-auth.js.org/providers/) for the expected names. For example, GitHub uses `GITHUB_ID` and `GITHUB_SECRET`.

### Step 6: Add Makefile Command

Add a new target in the `Makefile` under the `AUTHENTICATION` section:

```makefile
auth-myprovider: ## Enable MyProvider OAuth
	@echo "==> Configuring MyProvider OAuth..."
	@if [ -z "$(MY_PROVIDER_CLIENT_ID)" ] || [ -z "$(MY_PROVIDER_CLIENT_SECRET)" ]; then \
		echo ""; \
		echo "  Usage: make auth-myprovider MY_PROVIDER_CLIENT_ID=xxx MY_PROVIDER_CLIENT_SECRET=yyy"; \
		echo ""; \
		echo "  Get credentials from: https://provider.example.com/developers"; \
		echo "  Set callback URL to:  http://localhost:3000/api/auth/callback/myprovider"; \
		echo ""; \
		exit 1; \
	fi
	@rm -f $(FRONTEND_ENV)
	@echo '# Auth mode: MyProvider OAuth' > $(FRONTEND_ENV)
	@echo 'NEXTAUTH_URL=http://localhost:3000' >> $(FRONTEND_ENV)
	@echo "NEXTAUTH_SECRET=$$(openssl rand -base64 32)" >> $(FRONTEND_ENV)
	@echo 'NEXT_PUBLIC_API_URL=http://localhost:8000' >> $(FRONTEND_ENV)
	@echo "MY_PROVIDER_CLIENT_ID=$(MY_PROVIDER_CLIENT_ID)" >> $(FRONTEND_ENV)
	@echo "MY_PROVIDER_CLIENT_SECRET=$(MY_PROVIDER_CLIENT_SECRET)" >> $(FRONTEND_ENV)
	@echo ""
	@echo "  ✓ Auth mode: MyProvider OAuth"
	@echo ""
```

Also update:
- The `.PHONY` list at the top
- The `help` target to show the new command
- The `auth-status` target to check for the new env var
- The `auth-all` target if it should also include the new provider

### Step 7: Test End-to-End

```bash
# 1. Set up the provider
make auth-myprovider MY_PROVIDER_CLIENT_ID=xxx MY_PROVIDER_CLIENT_SECRET=yyy

# 2. Set backend env
echo "MY_PROVIDER_CLIENT_ID=xxx" >> heritage_graph/.env

# 3. Start servers
make backend   # Terminal 1
make frontend  # Terminal 2

# 4. Open http://localhost:3000
#    → Click "Sign in with MyProvider"
#    → Should redirect to provider → back to app

# 5. Verify Django user was created
make shell
>>> from django.contrib.auth.models import User
>>> User.objects.last()

# 6. Verify API call works
# From the browser console or another component, check that
# fetch() with the Bearer token returns 200, not 401.

# 7. Check auth status
make auth-status
```

---

## Reference: Existing Providers

### Credentials (Dev)

- **Frontend:** `CredentialsProvider` in NextAuth — calls `POST /api/token/` with username/password
- **Backend:** `DevSessionAuthentication` + `JWTAuthentication`
- **Token:** SimpleJWT access token
- **Login page:** `/auth/login`
- **No external setup needed**

### Google OAuth

- **Frontend:** `GoogleProvider` in NextAuth
- **Backend:** `GoogleTokenAuthentication` — verifies with `google.oauth2.id_token.verify_oauth2_token()`
- **Token type:** Google ID token (JWT signed by Google)
- **Env vars (frontend):** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- **Env vars (backend):** `GOOGLE_CLIENT_ID`
- **Callback URL:** `/api/auth/callback/google`
- **Console:** https://console.cloud.google.com/apis/credentials

### GitHub OAuth

- **Frontend:** `GitHubProvider` in NextAuth
- **Backend:** `GitHubTokenAuthentication` — verifies by calling `https://api.github.com/user`
- **Token type:** GitHub access token (opaque string)
- **Env vars (frontend):** `GITHUB_ID`, `GITHUB_SECRET`
- **Env vars (backend):** `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
- **Callback URL:** `/api/auth/callback/github`
- **Console:** https://github.com/settings/developers → OAuth Apps

---

## Token Flow Diagrams

### Google OAuth Flow

```
Browser → NextAuth → Google OAuth consent screen
                     ↓
              Google returns: { id_token, access_token }
                     ↓
              NextAuth stores id_token in JWT cookie
                     ↓
Browser → fetch("/data/api/...", { Authorization: "Bearer <id_token>" })
                     ↓
Django → GoogleTokenAuthentication
         → google.oauth2.id_token.verify_oauth2_token(id_token, GOOGLE_CLIENT_ID)
         → Extracts email, name from JWT claims
         → User.objects.get_or_create(username=email)
         → Returns (user, None)
```

### GitHub OAuth Flow

```
Browser → NextAuth → GitHub OAuth authorization page
                     ↓
              GitHub returns: { access_token }
                     ↓
              NextAuth stores access_token in JWT cookie
                     ↓
Browser → fetch("/data/api/...", { Authorization: "Bearer <access_token>" })
                     ↓
Django → GitHubTokenAuthentication
         → GET https://api.github.com/user  (with Bearer token)
         → Extracts login, email, name from response
         → User.objects.get_or_create(username=email)
         → Returns (user, None)
```

### JWT Dev Flow

```
Browser → /auth/login → POST /api/token/ { username, password }
                         ↓
                  SimpleJWT returns { access, refresh }
                         ↓
                  NextAuth stores access in JWT cookie
                         ↓
Browser → fetch("/data/api/...", { Authorization: "Bearer <jwt_access>" })
                         ↓
Django → JWTAuthentication (SimpleJWT)
         → Verifies JWT signature with Django SECRET_KEY
         → Extracts user_id from token payload
         → Returns (user, None)
```

---

## Troubleshooting

### "Invalid character" or "Unexpected token" after setting env vars

The `.env.local` file may have special characters. Make sure env values don't have quotes:
```dotenv
# ✅ Correct
GITHUB_ID=Ov23lixxx

# ❌ Wrong
GITHUB_ID="Ov23lixxx"
```

### "CSRF check failed" / "Callback URL mismatch"

Your OAuth app's callback URL must **exactly** match what NextAuth expects:
```
http://localhost:3000/api/auth/callback/<provider_id>
```

For production:
```
https://yourdomain.com/api/auth/callback/<provider_id>
```

### "401 Unauthorized" on API calls after successful OAuth login

Check that:
1. The **backend** env var for the provider is set (e.g., `GITHUB_CLIENT_ID` in `heritage_graph/.env`)
2. The auth class is listed in `REST_FRAMEWORK["DEFAULT_AUTHENTICATION_CLASSES"]` in your settings file
3. The auth class is listed **before** `JWTAuthentication` in the chain

### Next.js "SERVER_ERROR" on sign-in

Check the Next.js server logs (terminal running `make frontend`). Common causes:
- Missing `NEXTAUTH_SECRET` — generate one: `openssl rand -base64 32`
- Missing `NEXTAUTH_URL` — should be `http://localhost:3000`

### "Could not retrieve email" from GitHub

Some GitHub users have private emails. The `GitHubTokenAuthentication` backend already handles this by calling `/user/emails`, but the GitHub OAuth app must request the `user:email` scope. NextAuth's GitHub provider does this by default.

### Django user created with wrong username

All OAuth backends use `username = email` for consistency. If a user signs in with Google first and GitHub second (with the same email), they'll map to the same Django user — this is intentional.

### How to switch back to JWT dev mode

```bash
make auth-dev
```
This clears the OAuth env vars and switches back to username/password login.

---

## File Reference

| File | Role |
|------|------|
| `heritage_graph_ui/src/app/api/auth/[...nextauth]/route.ts` | NextAuth route handler — provider selection + callbacks |
| `heritage_graph_ui/src/lib/auth.ts` | NextAuth config for `getServerSession()` |
| `heritage_graph_ui/src/app/auth/login/page.tsx` | Dev-only login page (username/password) |
| `heritage_graph_ui/types/next-auth.d.ts` | TypeScript type augmentations |
| `heritage_graph/apps/heritage_data/authentication.py` | Django DRF auth backends (all providers) |
| `heritage_graph/settings/development.py` | Dev DRF auth class chain |
| `heritage_graph/settings/production.py` | Prod DRF auth class chain |
| `Makefile` | `make auth-*` commands for switching providers |
| `.env.example` (root) | Full env var template |
| `heritage_graph_ui/.env.example` | Frontend env var template |
| `heritage_graph/.env.example` | Backend env var template |
