# Authentication Architecture

This document explains how auth works across the ICC Rankings stack — Google OAuth,
JWTs, the service-to-service token, and the admin guard.

---

## High-level overview

```mermaid
graph TD
    Browser["Browser (React)"]
    Next["Next.js Server\n(apps/web)"]
    Google["Google OAuth 2.0"]
    Chatbot["Python Chatbot\n(FastAPI / apps/chatbot)"]
    Mongo[("MongoDB\nusers collection")]
    PG[("PostgreSQL\n(read-only)")]

    Browser -- "1  sign-in click" --> Next
    Next -- "2  redirect" --> Google
    Google -- "3  auth code" --> Next
    Next -- "4  X-Service-Token + profile headers\n(server → server, never browser)" --> Chatbot
    Chatbot -- "5  upsert user" --> Mongo
    Chatbot -- "6  UserProfile (is_admin, prefs)" --> Next
    Next -- "7  JWT cookie (7 days)" --> Browser
    Browser -- "8  API calls with session cookie" --> Next
    Next -- "9  proxies with X-Service-Token" --> Chatbot
    Chatbot -- "10 read-only queries" --> PG
```

---

## Sign-in sequence (step by step)

```mermaid
sequenceDiagram
    actor User
    participant Browser
    participant Next as Next.js Server<br/>(auth.ts / NextAuth)
    participant Google as Google OAuth
    participant Chatbot as Python Chatbot<br/>(FastAPI)
    participant MongoDB

    User->>Browser: clicks "Sign in with Google"
    Browser->>Next: GET /api/auth/signin/google
    Next->>Google: redirect → OAuth consent screen
    Google-->>Next: authorization code (callback)
    Next->>Google: exchange code → access_token + id_token
    Google-->>Next: access_token, id_token (contains profile)

    Note over Next: jwt() callback fires on initial sign-in

    Next->>Chatbot: GET /api/users/me<br/>X-Service-Token: <shared PSK><br/>X-User-Sub / Email / Name / Picture
    Chatbot->>Chatbot: verify_service_token()
    Chatbot->>MongoDB: find_one_and_update (upsert by google_sub)
    MongoDB-->>Chatbot: UserProfile doc
    Chatbot-->>Next: { is_admin, preferences, ... }

    Note over Next: Embeds google_sub + is_admin into JWT

    Next-->>Browser: Set-Cookie: next-auth.session-token (JWT, 7 days, HttpOnly)
    Browser-->>User: signed in ✓
```

---

## Authenticated request sequence

```mermaid
sequenceDiagram
    actor User
    participant Browser
    participant Next as Next.js Server
    participant Chatbot as Python Chatbot

    User->>Browser: visits a protected page or calls API route
    Browser->>Next: request + session cookie (JWT)

    Note over Next: auth() decodes & validates JWT

    alt JWT missing or expired
        Next-->>Browser: 401 / redirect to sign-in
    else JWT valid
        Next->>Chatbot: request + X-Service-Token + X-User-Sub
        Chatbot->>Chatbot: verify_service_token()
        Chatbot-->>Next: response
        Next-->>Browser: response
    end
```

---

## Route guards (middleware.ts)

The middleware protects two route groups:

```mermaid
sequenceDiagram
    actor User
    participant Browser
    participant Middleware as Next.js Middleware<br/>(middleware.ts)
    participant Page as Protected Page

    User->>Browser: navigates to /admin/... or /chat/...
    Browser->>Middleware: GET /... + session cookie

    Note over Middleware: matcher: ["/admin/:path*", "/chat/:path*"]

    alt /admin/* — is_admin === false (or no session)
        Middleware-->>Browser: redirect → /
    else /admin/* — is_admin === true
        Middleware->>Page: forward request
        Page-->>Browser: admin UI
    end

    alt /chat/* — no session
        Middleware-->>Browser: redirect → /api/auth/signin?callbackUrl=...
    else /chat/* — authenticated
        Middleware->>Page: forward request
        Page-->>Browser: chat UI
    end
```

---

## Key concepts explained

### JWT session (not a database session)

NextAuth is configured with `strategy: "jwt"`. This means:

- **No session table** — the entire session lives in a signed, encrypted cookie.
- The cookie is `HttpOnly` (JS cannot read it) and lasts **7 days**.
- `is_admin` and `is_new_user` are baked into the JWT at sign-in time. If you promote
  someone to admin in MongoDB, they need to sign out and sign back in for it to take effect.
- `is_new_user` is `true` only on the very first sign-in (detected via `$setOnInsert._is_new`
  in MongoDB). Subsequent sign-ins will have `is_new_user: false`.

### Service-to-service token (`X-Service-Token`)

The Python chatbot's `/api/users/*` routes are **not** meant to be called by the
browser. They are only called by the Next.js server process. The shared secret
(`SERVICE_API_TOKEN` env var) acts as a PSK (pre-shared key) to prove "this request
came from our Next.js server, not from an untrusted client."

```
Browser  →  Next.js server  →  (adds X-Service-Token)  →  Python chatbot
   ↑                                                              |
   |__________________ response flows back ______________________|
```

The chatbot uses `secrets.compare_digest` (constant-time comparison) to check the
token, which prevents timing attacks.

### `google_sub` as the user identity

Google's `sub` claim is a stable, unique identifier for a Google account. It never
changes, even if the user changes their email. It is used as the primary key in the
MongoDB `users` collection and is embedded in the JWT so every server-side call can
identify the user without a DB lookup.

### What the browser never sees

| Secret | Where it lives |
|---|---|
| `GOOGLE_CLIENT_SECRET` | Next.js server env only |
| `SERVICE_API_TOKEN` | Next.js server env + Chatbot env |
| MongoDB credentials | Chatbot env only |
| Raw JWT signing key | Next.js server env (`NEXTAUTH_SECRET`) |

The browser only ever holds the **encrypted session cookie**. It cannot read the JWT
payload or any of the secrets above.

---

## Environment variables required

### `apps/web/.env.local`

| Variable | Purpose |
|---|---|
| `GOOGLE_CLIENT_ID` | OAuth app client ID from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | OAuth app client secret |
| `NEXTAUTH_SECRET` | Random secret used to sign/encrypt JWTs (generate with `openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Public URL of the Next.js app (e.g. `http://localhost:5237`) |
| `INTERNAL_CHATBOT_URL` | Internal URL of the chatbot service (e.g. `http://localhost:8100`) |
| `SERVICE_API_TOKEN` | Shared PSK — must match the chatbot's value |

### `apps/chatbot/.env`

| Variable | Purpose |
|---|---|
| `SERVICE_API_TOKEN` | Shared PSK — must match the web app's value |
| `ANTHROPIC_API_KEY` | Claude API key for LangGraph agents |
| `MONGODB_URL` | Connection string for MongoDB |

See `docs/google-oauth-setup.md` for how to create the Google OAuth credentials.

---

## Sign-in flow and welcome banner

After a successful sign-in via the header "Sign in" button, the user is redirected to
`/?welcome=1`. The `WelcomeBanner` component (`components/home/welcome-banner.tsx`) detects
this param and shows a personalised greeting:

- **New user** (`is_new_user: true`): gold banner — "Welcome to ICC Rankings, [name]!"
- **Returning user** (`is_new_user: false`): purple banner — "Welcome back, [name]!"

The banner auto-dismisses after 6 seconds and strips `?welcome=1` from the URL.

> Note: if a user is redirected to `/chat` via the middleware (e.g. they visited `/chat` while
> logged out), after sign-in they return to `/chat` — not to `/?welcome=1`. The `callbackUrl`
> set by the middleware takes precedence.

---

## Multi-session chat history

Conversations in MongoDB are tagged with `user_id` (the user's `google_sub`) when
the request includes a `user_id` in the `ChatRequest` body. The `/api/users/sessions`
endpoint (service-token protected) returns a user's past sessions, newest first.

The Next.js proxy at `/api/chat/sessions` calls this endpoint server-side using the
authenticated user's `google_sub` from the session.

Session IDs are always UUIDs (not the google_sub itself). The active session ID is
stored in `localStorage` under `twelfth_man_active_session`.
