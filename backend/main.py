from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import anthropic
import base64
import httpx
import json
import os
import re
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="RatioCheck API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

_origins_env = os.getenv("ALLOWED_ORIGINS", "*")
ALLOWED_ORIGINS = ["*"] if _origins_env == "*" else [o.strip() for o in _origins_env.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

MODEL = "claude-haiku-4-5"

ANALYSIS_SYSTEM = (
    "You are RatioCheck AI. You analyze internet content for survival potential. "
    "You always respond with valid JSON only — no markdown fences, no extra text."
)

ANALYSIS_INSTRUCTIONS = """Analyze this content for internet survival potential.

Respond with ONLY this JSON (no markdown, no extra text):

{
  "survival_score": <integer 0-100, where 0=instant ratio/cancel, 100=universally loved>,
  "survival_rationale": "<one sentence explaining the score>",
  "who_loves": {
    "audience": "<specific group who will love this>",
    "reason": "<exactly why they will love it>"
  },
  "who_hates": {
    "audience": "<specific group who will hate this>",
    "reason": "<exactly why they will hate it>"
  },
  "who_cancels": {
    "audience": "<specific group who will try to cancel this>",
    "angle": "<the exact argument or framing they will use>"
  },
  "rewrites": [
    {
      "title": "<descriptive approach name, e.g. 'The Diplomatic Version'>",
      "content": "<fully rewritten version preserving intent but reducing backlash risk>"
    },
    {
      "title": "<descriptive approach name>",
      "content": "<fully rewritten version>"
    },
    {
      "title": "<descriptive approach name>",
      "content": "<fully rewritten version>"
    }
  ]
}

Score guide: 0-20=will definitely get ratio'd, 21-40=high risk, 41-60=controversial but survivable, 61-80=mostly safe, 81-100=will be loved.

Content to analyze:
"""


def parse_json_response(text: str) -> dict:
    text = text.strip()
    # Strip markdown fences if Claude added them anyway
    text = re.sub(r'^```(?:json)?\s*', '', text)
    text = re.sub(r'\s*```$', '', text.strip())
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            return json.loads(match.group())
        raise ValueError("Could not parse JSON from AI response")


def analyze_text_content(content: str) -> dict:
    prompt = ANALYSIS_INSTRUCTIONS + content
    response = client.messages.create(
        model=MODEL,
        max_tokens=2048,
        system=ANALYSIS_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
    )
    return parse_json_response(response.content[0].text)


@app.post("/analyze")
@limiter.limit("15/hour")
async def analyze(request: Request, file: Optional[UploadFile] = File(None)):
    content_type = request.headers.get("content-type", "")

    if "multipart/form-data" in content_type:
        if not file:
            raise HTTPException(status_code=400, detail="No file uploaded")
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="File must be an image")

        try:
            image_data = await file.read()
            image_b64 = base64.standard_b64encode(image_data).decode("utf-8")
            media_type = file.content_type

            # Step 1: describe the image
            desc_response = client.messages.create(
                model=MODEL,
                max_tokens=1024,
                messages=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": image_b64,
                            },
                        },
                        {
                            "type": "text",
                            "text": (
                                "Describe this image in detail for content analysis. "
                                "Focus on: any visible text or captions, the visual content and context, "
                                "the apparent platform or format (tweet, Instagram post, meme, screenshot, etc.), "
                                "the tone and intended message, and anything that could be controversial or go viral."
                            ),
                        },
                    ],
                }],
            )
            description = desc_response.content[0].text

            # Step 2: analyze the described content
            content_for_analysis = (
                "[Image content from social media / internet post]\n\n"
                f"Image description: {description}"
            )
            result = analyze_text_content(content_for_analysis)
            result["image_description"] = description
            return result

        except ValueError as e:
            raise HTTPException(status_code=500, detail=str(e))
        except anthropic.APIError as e:
            raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")

    else:
        # JSON text body
        try:
            body = await request.json()
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid JSON body")

        text_content = body.get("content", "").strip()
        if not text_content:
            raise HTTPException(status_code=400, detail="No content provided")

        try:
            return analyze_text_content(text_content)
        except ValueError as e:
            raise HTTPException(status_code=500, detail=str(e))
        except anthropic.APIError as e:
            raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")


@app.post("/fetch-url")
@limiter.limit("30/hour")
async def fetch_url(request: Request):
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    url = body.get("url", "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="No URL provided")

    if "twitter.com" not in url and "x.com" not in url:
        raise HTTPException(status_code=400, detail="Only Twitter/X URLs are supported right now")

    # Normalize x.com → twitter.com for oEmbed
    oembed_url = re.sub(r'https?://(www\.)?x\.com', 'https://twitter.com', url)

    try:
        async with httpx.AsyncClient() as client_http:
            resp = await client_http.get(
                "https://publish.twitter.com/oembed",
                params={"url": oembed_url, "omit_script": "true"},
                timeout=10.0,
                follow_redirects=True,
            )
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=400, detail=f"Could not fetch tweet (HTTP {e.response.status_code})")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not fetch tweet: {str(e)}")

    html = data.get("html", "")
    author = data.get("author_name", "")

    # Extract text from the <p> inside the blockquote
    p_match = re.search(r'<p[^>]*>(.*?)</p>', html, re.DOTALL)
    if not p_match:
        raise HTTPException(status_code=500, detail="Could not extract tweet text from oEmbed response")

    raw = p_match.group(1)
    raw = re.sub(r'<a[^>]*>.*?</a>', '', raw, flags=re.DOTALL)  # strip links
    raw = re.sub(r'<[^>]+>', '', raw)                            # strip remaining tags
    raw = (raw
           .replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
           .replace('&#39;', "'").replace('&quot;', '"').replace('&nbsp;', ' '))
    text = raw.strip()

    if not text:
        raise HTTPException(status_code=500, detail="Tweet text appears to be empty")

    return {"content": text, "author": author}


@app.get("/health")
async def health():
    return {"status": "ok"}
