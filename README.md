# RatioCheck

> Will the internet cancel you? Find out before they do.

🔴 **Live at [ratiocheck-n5gqw3dld-dixitasurti01-8704s-projects.vercel.app](https://ratiocheck-n5gqw3dld-dixitasurti01-8704s-projects.vercel.app)**

RatioCheck analyzes any text, image, or tweet URL and tells you exactly how it'll play on the internet — who'll love it, who'll hate it, who'll try to cancel it, and gives you three safer rewrites that keep your intent intact.

## Features

- **Survival Score** (0–100): animated score ring showing how likely your content is to survive the internet
- **Who Will Love It**: the specific audience and exactly why
- **Who Will Hate It**: the specific audience and exactly why
- **Who Will Cancel It**: who and the exact angle/argument they'll use
- **3 Safer Rewrites**: same message, less drama — with one-click copy buttons
- **Share Card**: generates a 1080×1080 PNG of your score (Spotify Wrapped-style) ready to post
- **Score History**: last 5 analyses kept in-session as chips — click any to revisit
- **Tweet URL mode**: paste a Twitter/X post URL and it extracts the tweet text automatically

## Input modes

| Mode | How it works |
|---|---|
| ✏️ Paste Text | Type or paste any content directly |
| 🖼️ Upload Image | Drag & drop or browse — Claude describes the image first, then analyzes |
| 🔗 Tweet URL | Paste a `twitter.com` or `x.com` URL — text is extracted via oEmbed |

## Coming Soon

- 🎬 Video analysis — paste a YouTube/TikTok URL or upload a clip
- 🎵 Audio analysis — upload a podcast clip or voice memo
- 📊 Historical ratio tracker — see how your score changes over time

## Deployment

| Service | URL |
|---|---|
| Frontend | https://ratiocheck-n5gqw3dld-dixitasurti01-8704s-projects.vercel.app |
| Backend API | https://ratiocheck.onrender.com |

## Setup

### Prerequisites

- Python 3.9+
- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com) with credits

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Add your Anthropic API key to `.env`:
```
ANTHROPIC_API_KEY=sk-ant-...
```

Start the server:
```bash
uvicorn main:app --reload
```

Backend runs at `http://localhost:8000`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`

## API

### `POST /analyze`

Accepts either:
- `Content-Type: application/json` → `{ "content": "your text here" }`
- `Content-Type: multipart/form-data` → image file field named `file`

Returns:
```json
{
  "survival_score": 38,
  "survival_rationale": "one sentence explanation",
  "who_loves": { "audience": "...", "reason": "..." },
  "who_hates": { "audience": "...", "reason": "..." },
  "who_cancels": { "audience": "...", "angle": "..." },
  "rewrites": [
    { "title": "The Diplomatic Version", "content": "..." },
    { "title": "The Self-Aware Version", "content": "..." },
    { "title": "The Humorous Pivot", "content": "..." }
  ],
  "image_description": "..." // only present for image uploads
}
```

### `POST /fetch-url`

Accepts: `{ "url": "https://twitter.com/..." }`

Returns: `{ "content": "extracted tweet text", "author": "display name" }`

Currently supports Twitter/X URLs only via the public oEmbed API.

### `GET /health`

Returns `{ "status": "ok" }`

## Development workflow

### Running locally

Open two terminals:

**Terminal 1 — Backend:**
```bash
cd backend
source venv/bin/activate  # Windows: venv\Scripts\activate
uvicorn main:app --reload
# Runs at http://localhost:8000
# --reload auto-restarts on every file save
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
# Runs at http://localhost:5173
# Hot-reloads instantly on every file save
```

The frontend (at `localhost:5173`) automatically sends API requests to the backend at `localhost:8000` when running locally — no config needed. In production, it uses the `VITE_API_URL` environment variable set in Vercel to reach the Render backend.

### Deploying changes

After testing locally, push to GitHub and both services redeploy automatically:

```bash
git add .
git commit -m "describe your change"
git push
```

| Service | Redeploy time |
|---|---|
| Vercel (frontend) | ~1 minute |
| Render (backend) | ~2 minutes |

### Debugging

- **Backend logs:** Render dashboard → ratiocheck → Logs tab (live)
- **Frontend errors:** Browser DevTools → Console
- **API testing:** `curl http://localhost:8000/health` or open in browser

## Tech stack

| Layer | Stack |
|---|---|
| Frontend | React 18 · TypeScript · Vite |
| Backend | Python · FastAPI · Uvicorn |
| AI | Anthropic API (`claude-haiku-4-5`) |
| Image analysis | Claude Vision (base64) |
| Tweet extraction | Twitter oEmbed API |
| Share card | HTML5 Canvas API |
