// Supabase Edge Function: text to speech through OpenAI, with a cache.
//
// POST { text, voice? } -> { url }
// The audio for a sentence is made once, stored in the public "tts" bucket,
// and the same link comes back every time after. Repeats and loops cost nothing.
// The OpenAI key lives in this function's secrets, never in the app.

import { createClient } from 'npm:@supabase/supabase-js@2'

const MODEL = 'gpt-4o-mini-tts'
const VOICES = new Set(['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse'])
const MAX_CHARS = 800
const BUCKET = 'tts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  let body: { text?: unknown; voice?: unknown }
  try { body = await req.json() } catch { return json({ error: 'bad json' }, 400) }
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  const voice = typeof body.voice === 'string' && VOICES.has(body.voice) ? body.voice : 'nova'
  if (!text) return json({ error: 'text is required' }, 400)
  if (text.length > MAX_CHARS) return json({ error: `text over ${MAX_CHARS} characters` }, 400)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const key = await sha256(`${MODEL}|${voice}|${text}`)
  const path = `${voice}/${key}.mp3`
  const url = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${path}`

  // Already made? Then it is free.
  const head = await fetch(url, { method: 'HEAD' })
  if (head.ok) return json({ url, cached: true })

  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) return json({ error: 'OPENAI_API_KEY is not set in the function secrets' }, 500)

  const r = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      voice,
      input: text,
      response_format: 'mp3',
      // Speed is handled by the app at playback, so one file serves every speed.
      instructions: 'Read this aloud naturally, like a good audiobook narrator. Clear, warm, unhurried.',
    }),
  })
  if (!r.ok) return json({ error: `openai ${r.status}: ${(await r.text()).slice(0, 300)}` }, 502)
  const audio = new Uint8Array(await r.arrayBuffer())

  const { error } = await supabase.storage.from(BUCKET).upload(path, audio, { contentType: 'audio/mpeg', upsert: true })
  if (error) return json({ error: `storage: ${error.message}` }, 500)
  return json({ url, cached: false })
})
