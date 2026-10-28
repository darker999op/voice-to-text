# Voxscribe — Audio to Text

Audio-to-text web app with two modes:

- **High accuracy (default):** Whisper Large v3 via Groq's free API, called through a Vercel serverless function so your API key stays secret.
- **Private:** Whisper running fully inside the visitor's browser (Transformers.js). No upload at all.

## Files

```
index.html          the website
api/transcribe.js   serverless function (calls Groq)
vercel.json         function settings
```

## Deploy

1. Get a free API key at https://console.groq.com → **API Keys** → **Create API Key**.
2. Upload all files (keeping the `api/` folder) to a GitHub repository.
3. In Vercel: **Add New → Project** → import the repo. Framework Preset: **Other**.
4. Before deploying, open **Environment Variables** and add:
   - Name: `GROQ_API_KEY`
   - Value: your key
5. Click **Deploy**. If you added the key after deploying, redeploy once.

## Notes

- Long files are cut into ~110 second parts (at quiet moments) in the browser and sent one by one, which keeps each request under Vercel's request size limit.
- Groq's free tier has rate and daily limits (check your console's Limits page). If a visitor hits a limit the app waits and retries, then shows an error.
- Never put the API key inside `index.html`.
- Local testing: install the Vercel CLI, put `GROQ_API_KEY=...` in a `.env.local` file, and run `vercel dev`.
