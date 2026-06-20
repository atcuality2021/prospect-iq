# Deploying ProspectIQ

**Total cost: ~$14/month** (two Render Starter services) + free tiers for everything else.

| Service | Provider | Cost |
|---------|----------|------|
| Frontend | Vercel | Free |
| MongoDB | Atlas M0 | Free |
| Redis | Upstash | Free |
| API server | Render Starter | $7/mo |
| BullMQ worker | Render Starter | $7/mo |

---

## Step 1 — External services (free tiers)

### MongoDB Atlas
1. Create account at https://cloud.mongodb.com
2. Create a free M0 cluster (512MB)
3. Under **Database Access** → add a user with password
4. Under **Network Access** → allow `0.0.0.0/0` (all IPs, for Render)
5. Click **Connect** → copy the connection string:
   ```
   mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/prospectiq?retryWrites=true&w=majority
   ```

### Upstash Redis
1. Create account at https://upstash.com
2. Create a Redis database (free tier)
3. Copy the **Redis URL** (starts with `rediss://`)

---

## Step 2 — Deploy backend on Render

1. Go to https://render.com → **New** → **Blueprint**
2. Connect your GitHub repo (`atcuality2021/prospect-iq`)
3. Render will detect `render.yaml` and show 2 services: `prospect-iq-api` + `prospect-iq-worker`
4. Before deploying, go to **Environment Groups** in the dashboard and create a group called `prospect-iq-secrets` with these variables:

   | Key | Value |
   |-----|-------|
   | `OPENAI_API_KEY` | `sk-...` |
   | `ANTHROPIC_API_KEY` | `sk-ant-...` (optional) |
   | `MONGODB_URI` | your Atlas connection string |
   | `REDIS_URL` | your Upstash Redis URL |
   | `FRONTEND_URL` | `https://your-app.vercel.app` (fill in after Vercel deploy) |

5. Click **Apply** — both services build and start (~3 min)
6. Note the API URL: `https://prospect-iq-api.onrender.com`

---

## Step 3 — Deploy frontend on Vercel

1. Go to https://vercel.com → **Add New Project**
2. Import `atcuality2021/prospect-iq` from GitHub
3. Vercel detects `vercel.json` and sets **Root Directory** to `frontend` automatically
4. Add environment variable:
   | Key | Value |
   |-----|-------|
   | `NEXT_PUBLIC_API_URL` | `https://prospect-iq-api.onrender.com` |
5. Click **Deploy** (~2 min)
6. Note your Vercel URL: `https://prospect-iq-xxxx.vercel.app`

---

## Step 4 — Wire them together

1. Go back to Render → **prospect-iq-secrets** environment group
2. Update `FRONTEND_URL` to your Vercel URL
3. Trigger a manual redeploy on both Render services (so CORS is updated)

---

## Step 5 — Verify

```bash
# API health check
curl https://prospect-iq-api.onrender.com/api/health
# → {"ok":true}

# Submit a test lead
curl -X POST https://prospect-iq-api.onrender.com/api/runs \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","company":"Test","channel":"email","tone":"professional"}'
# → {"runId":"..."}
```

Then open your Vercel URL and confirm the dashboard loads runs.

---

## Environment Variables Reference

### Backend (Render)

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes (or Anthropic) | OpenAI API key |
| `ANTHROPIC_API_KEY` | Optional | Anthropic API key |
| `MONGODB_URI` | Yes | MongoDB Atlas connection string |
| `REDIS_URL` | Yes | Upstash Redis URL (`rediss://`) |
| `LLM_PROVIDER` | Yes | `openai` or `anthropic` |
| `OPENAI_MODEL` | No | Default: `gpt-4o` |
| `ANTHROPIC_MODEL` | No | Default: `claude-sonnet-4-6` |
| `FRONTEND_URL` | Yes | Your Vercel URL (for CORS) |
| `PORT` | Auto | Render sets this to `10000` |
| `NODE_ENV` | Yes | `production` |

### Frontend (Vercel)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Your Render API URL (no trailing slash) |

---

## Custom Domain

- **Vercel**: Settings → Domains → add your domain
- **Render**: Settings → Custom Domain → add your domain + point DNS

Both provide free TLS certificates automatically.

---

## Updating

Every push to `main` triggers automatic redeploys on both Vercel and Render.
