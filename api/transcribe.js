// Vercel Serverless Function — proxies audio to Groq's free Whisper API.
// The API key lives in the GROQ_API_KEY environment variable and is never sent to the browser.

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const ALLOWED_MODELS = ['whisper-large-v3', 'whisper-large-v3-turbo'];
const MAX_BYTES = 4 * 1024 * 1024; // stay under Vercel's ~4.5 MB request body limit

function readBody(req) {
  if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    const parts = [];
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > MAX_BYTES + 1024) { reject(new Error('too_large')); req.destroy(); return; }
      parts.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(parts)));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(500).json({ error: 'Server is missing GROQ_API_KEY. Add it in Vercel → Settings → Environment Variables, then redeploy.' });

  let audio;
  try {
    audio = await readBody(req);
  } catch (e) {
    return res.status(413).json({ error: 'Audio chunk is too large.' });
  }
  if (!audio || !audio.length) return res.status(400).json({ error: 'No audio received.' });
  if (audio.length > MAX_BYTES) return res.status(413).json({ error: 'Audio chunk is too large.' });

  const { model: m, language, prompt } = req.query || {};
  const model = ALLOWED_MODELS.includes(m) ? m : 'whisper-large-v3';

  const form = new FormData();
  form.append('file', new Blob([audio], { type: 'audio/wav' }), 'chunk.wav');
  form.append('model', model);
  form.append('response_format', 'verbose_json');
  form.append('temperature', '0');
  if (language && /^[a-z]{2,3}$/.test(language)) form.append('language', language);
  if (prompt) form.append('prompt', String(prompt).slice(0, 400));

  try {
    const r = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const retry = r.headers.get('retry-after');
      if (retry) res.setHeader('Retry-After', retry);
      return res.status(r.status).json({ error: (data.error && data.error.message) || 'Transcription failed.' });
    }
    return res.status(200).json({
      text: data.text || '',
      language: data.language || null,
      segments: (data.segments || []).map(s => ({ start: s.start, end: s.end, text: s.text }))
    });
  } catch (e) {
    return res.status(502).json({ error: 'Could not reach the transcription service.' });
  }
};
