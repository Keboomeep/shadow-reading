# Shadow Reading

A phone web app for English shadow reading. Paste text, or open an .epub, .md, or .txt file. A voice reads it. You speak along, about one second behind.

The home page is a library: a Continue card for the last text, a history list with progress per text, and an Import button. Every text remembers its own place.

## Hosted

Live at https://shadow-reading-henna.vercel.app, built by Vercel from the main branch on every push. On the iPhone: open it in Safari, Share, Add to Home Screen.

## Run it

```bash
npm install
npm run dev
```

Then on the iPhone (same Wi-Fi as the Mac) open `http://<mac-ip>:5173`. Find the Mac IP with:

```bash
ipconfig getifaddr en0
```

Recording your take needs the microphone, and iPhone Safari only allows the mic on https. For that use:

```bash
npm run dev:https
```

and open `https://<mac-ip>:5173`. Safari will warn about the certificate once. Tap "Show details", then "visit this website".

## Tests

```bash
npm test
```

## How it is built

- `src/text/` sentence splitter, markdown cleaner, and EPUB parser. Pure functions with tests. The splitter never cuts inside a sentence; when unsure it keeps two sentences together. The EPUB parser unzips the book, walks the reading order, and maps the table of contents onto paragraphs for the Sections list.
- `src/services/` storage interfaces and localStorage implementations. `index.ts` is the one place that picks the implementation. Swap in Supabase there later.
- `src/tts/` the voice. `TTSProvider` is the interface, `WebSpeechTTS` the placeholder. Swap in ElevenLabs in `index.ts` later. No API keys in the frontend, ever.
- `src/player/` the brain: which sentence, which mode, playing or paused, session counting.
- `src/screens/` paste screen, reader, sessions, settings sheet, chapters sheet.
- `src/components/` the text view and the bottom controls.

## iOS Safari notes

- The voice only starts after a tap. Play is that tap.
- Voices load late. The app waits for them before picking the most natural English voice.
- Word timing events may not arrive on iPhone. The word and range highlights then run on an estimate.
- Speech stops when the screen locks.
- Mic needs https. See above.

## Voice

Two voices, switched in the gear: Phone (the browser's own voice, free, works offline) and OpenAI (through the Supabase function `supabase/functions/tts`). The OpenAI key lives in that function's secrets, never in the app. Each sentence is made once, stored in the public `tts` bucket, and reused forever, so repeats and loops cost nothing. The app checks the stored link first and only calls the function for a new sentence. The next sentence is made while the current one plays.

Deploy or update the function with `npx supabase functions deploy tts` (after `npx supabase login` and `npx supabase link --project-ref guhqlwljyxvmhtrmgbji`). Set the key with `npx supabase secrets set OPENAI_API_KEY=...`. Deployed 2026-10-24.

## Storage

With `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`, everything lives in Supabase (see `supabase/schema.sql`, run it once in the SQL Editor; `supabase/migrations/` holds later additions, run each once). Until a migration runs, the app works without its columns and retries with fewer columns, which shows as 400 errors in the console. Without them, everything lives in the browser's localStorage under keys starting with `sr.`. The home page shows "cloud" or "this device" so you know which.

There is no login yet. Anyone with the project URL and anon key could read or change the data.

## Reader

The text is a book: whole pages, flipped left and right. Tap the right third of the page for the next page, the left third for the previous one, or swipe. Tap a sentence in the middle to jump to it. While the voice reads in Flow, the page holds still and flips only when the current sentence lands on the next page, and the bars hide; tap the center to bring them back. Only one chapter is laid out at a time, so books open fast.

Top bar: back, the Flow/Echo switch (headphones / mouth), settings. The title line opens Sections when the text has chapters.

Flow bar: speed (tap for 1.5x, 1.2x, 1.0x, 0.8x, 0.6x), back one sentence, play, forward one sentence, loop (cycles off, sentence, paragraph, all). The voice works sentence by sentence, so back and forward move one sentence, not a number of seconds.

Echo bar, three stages per sentence: listen (the pill fills as the voice reads), speak (the mic records until you tap Stop; Redo records again), compare (your take plays back). Tap the listen pill to pause while the voice reads, or to start when idle. Without a microphone (plain http on the phone) the speak stage is a timed pause and compare is skipped.

## Home and Library

Home shows the last text as a card with its cover, then the rest by last read. A "Continue reading" bar sits above the bottom nav (Home, Library, +). The + opens the import sheet: open an .epub, .md or .txt file, or paste text.

Library is a gallery like WeChat Read: folders first, then covers in a grid of three, filtered by All, Books (EPUB) or Articles (pasted, .md, .txt). The small ⋯ on a cover moves it into a folder (type a name), out of a folder (type -), or deletes it. Covers and authors come from the EPUB; pasted texts get a colored block. Books imported before 2026-10-23 have no cover; import them again to get one.

Design source: the Figma file "Shadow Reading" (file key Jiq8aKxCCqmd8EwbzejjfB). Icons in `public/icons/` are exported from it.

Reference apps for the layout: WeChat Read (text as the whole screen, chapter name small on top, position small at the bottom, left-right pages) and ElevenReader (home with Continue listening, percent and time left, Import always reachable).
