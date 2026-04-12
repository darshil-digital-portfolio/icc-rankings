# Google OAuth Setup Guide

Step-by-step guide to enable Google OAuth login for the ICC Rankings app.

---

## 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Click **Select a project** → **New Project**.
3. Name it `icc-rankings` (or anything you like) and click **Create**.

---

## 2. Configure the OAuth Consent Screen

1. In the left sidebar, navigate to **APIs & Services → OAuth consent screen**.
2. Choose **External** and click **Create**.
3. Fill in the required fields:
   - **App name**: ICC Rankings
   - **User support email**: your email
   - **Developer contact email**: your email
4. Click **Save and Continue** through the Scopes and Test Users screens (defaults are fine for development).
5. Return to the dashboard.

---

## 3. Create OAuth 2.0 Credentials

1. Go to **APIs & Services → Credentials**.
2. Click **Create Credentials → OAuth 2.0 Client ID**.
3. Choose **Web application** as the application type.
4. Under **Authorised redirect URIs**, add:
   ```
   http://localhost:5237/api/auth/callback/google
   ```
   For production, also add your production URL, e.g.:
   ```
   https://yourdomain.com/api/auth/callback/google
   ```
5. Click **Create**.
6. Copy the **Client ID** and **Client Secret** — you'll need them in the next step.

---

## 4. Generate Secret Tokens

Run these commands to generate cryptographically secure random secrets:

```bash
# NEXTAUTH_SECRET — signs and encrypts session JWTs
openssl rand -hex 32

# SERVICE_API_TOKEN — PSK between Next.js server and the Python chatbot
openssl rand -hex 32
```

Use **different values** for each.

---

## 5. Configure Environment Variables

### Local development

Copy the example file and fill it in:

```bash
cp apps/web/.env.local.example apps/web/.env.local
```

Edit `apps/web/.env.local`:

```env
GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<your-client-secret>

NEXTAUTH_SECRET=<output of openssl rand -hex 32>
NEXTAUTH_URL=http://localhost:5237

SERVICE_API_TOKEN=<output of openssl rand -hex 32>
INTERNAL_CHATBOT_URL=http://localhost:8100

NEXT_PUBLIC_API_URL=http://localhost:7429
NEXT_PUBLIC_CHATBOT_URL=http://localhost:8100
```

Edit `apps/chatbot/.env` and add:

```env
SERVICE_API_TOKEN=<same value as above>
```

### Docker

Create a `.env` file at the project root (next to `docker/`):

```env
ANTHROPIC_API_KEY=sk-ant-...

GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<your-client-secret>

NEXTAUTH_SECRET=<output of openssl rand -hex 32>
NEXTAUTH_URL=http://localhost:5237

SERVICE_API_TOKEN=<output of openssl rand -hex 32>
```

Then run:

```bash
cd docker && docker compose up
```

---

## 6. Granting Admin Access

Admin status is stored in the MongoDB `users` collection. To grant admin access to a user:

1. The user must sign in at least once (this creates their document in MongoDB).
2. Connect to MongoDB:
   ```bash
   # Docker
   docker exec -it icc_mongo mongosh icc_ranking

   # Local
   mongosh mongodb://localhost:47017/icc_ranking
   ```
3. Find the user and set `is_admin: true`:
   ```javascript
   db.users.updateOne(
     { email: "admin@example.com" },
     { $set: { is_admin: true } }
   )
   ```
4. The user will see the **Admin** badge in the header on their next page load (the JWT is refreshed on the next sign-in; to take effect immediately, the user can sign out and back in).

---

## 7. Verification Checklist

- [ ] Start all services: `npm run docker:up && npm run dev:api && npm run dev:web && npm run dev:chatbot`
- [ ] Visit `http://localhost:5237` — "Sign in" button appears in the header
- [ ] Click "Sign in" → Google OAuth flow completes → name and avatar appear
- [ ] Toggle dark mode while logged in → reload page → theme persists
- [ ] Select event filters on rankings page → reload → filters restored
- [ ] Manually set `is_admin: true` in MongoDB → sign out and back in → **Admin** badge appears
- [ ] Visit `/admin/anything` as non-admin → redirects to `/`
- [ ] Open chat while logged in → chat history persists after reload (keyed to `google_sub`)
