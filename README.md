# BolBindass — your ₹0 English speaking partner

BolBindass is a personal AI coach for spoken English. It starts the conversation, asks one
question at a time, listens to your whole answer, replies naturally, and gently corrects the
one or two mistakes that matter most. It remembers your recurring mistakes and picks future
topics to practise them.

**It costs ₹0 to use.** The AI runs on your own computer through [Ollama](https://ollama.com),
voice uses your browser's built-in speech features, and everything is stored in your browser.
There are no API keys, no paid services and no automatic fallback to any external AI.

---

## Quick start (Windows PowerShell)

Requirements: Windows 10/11, Node.js 20.9 or newer, Chrome or Edge, about 3 GB of free disk space.

```powershell
# 1. Install the app's dependencies (one time)
cd D:\bolbindass
npm install

# 2. Make sure Ollama is installed (skip if `ollama --version` works)
winget install --id Ollama.Ollama -e

# 3. Download a small local model (one time, about 2.0 GB; skip if already installed)
ollama pull llama3.2:3b

# 4. Start Ollama (or open "Ollama" from the Start menu; it runs in the system tray)
ollama serve
```

In a **second** PowerShell window:

```powershell
cd D:\bolbindass
npm run dev
```

Then open **http://127.0.0.1:3000** in Chrome or Edge.

For a faster production build instead of dev mode:

```powershell
npm run build
npm start
```

The server only listens on `127.0.0.1`, so it isn't reachable from other devices on your network.

> **Use one address.** Your history is stored per browser and per address. Always open
> `http://127.0.0.1:3000` (not sometimes `localhost:3000`) to see the same history.

---

## Features

| Area | What it does |
|---|---|
| **Coach** | Opens the conversation, asks one question at a time, follows up on what you actually said, and nudges you for longer answers. A **Say it simpler** button rephrases the question in simpler English, with an optional `Matlab: …` line in Hinglish. |
| **Voice** | Speak with the mic button (browser speech recognition). The reply is read aloud by your system voices. Hands-free mode, auto-send after a pause (3/5/8 s or manual), mute/resume, *Repeat question*, *Stop reading*, and an optional **review before sending** mode. |
| **Text fallback** | You can always type instead (Enter to send). This works in every browser and fully offline. |
| **Correction modes** | **Friendly**: natural reply, then 1–2 important corrections. **Instant**: corrections appear before the reply. **Immersion**: no interruptions; corrections appear in the end-of-session report. |
| **Corrections** | Each card shows your sentence, the corrected sentence, a short explanation and (when useful) a more natural alternative. They come from two sources: built-in grammar rules for common Hindi-English patterns (offline and deterministic) and the local AI, whose output is validated so it never quotes words you didn't say. |
| **Topics** | 27 topics across daily life, workplace, AI and software, explaining projects, opinions and stories, job interviews, and managers and colleagues. The topic is chosen automatically from your level, interests, goal, recurring mistakes and recent sessions (with the reason shown), or you can pick one yourself. |
| **Mistake memory** | Tracks the grammar area, your original sentence, the correction, the explanation, the count, the sessions and dates it appeared, the last time it was practised, and **improvement evidence** (correct uses). A mistake is never marked resolved after one correct answer. It needs 3 correct uses across 2+ sessions plus 2 clean sessions, or no repeats over 6 practice sessions. |
| **Session report** | Topic, duration, answers, words, corrections, recurring mistakes, better expressions, useful vocabulary, strengths (each quoting a sentence you actually said), one improvement goal, and a suggested next topic. Pronunciation is never claimed. |
| **Pages** | `/` home · `/practice` · `/history` (transcripts and reports, delete, export) · `/progress` (stats, charts, recurring mistakes) · `/settings` |
| **Basic practice mode** | If Ollama isn't running, you can *choose* Basic mode: scripted questions plus the built-in grammar rules. It is clearly labelled as **not AI**, and the app never switches to it without your click. |

---

## How voice works (and its limits)

BolBindass is **not a real-time voice AI**. It works in turns:

1. You speak, and **your browser** converts speech to text (Web Speech API).
2. The text goes to the **local** Ollama model on your PC.
3. The reply text is read aloud by **your browser's** speech synthesis.

Things to know:

- **Speech recognition in Chrome and Edge is an online service of the browser vendor.** It's
  free and needs internet, and your audio is processed by Google or Microsoft. BolBindass
  itself never records or stores audio. If you want to avoid this, type your answers instead.
- **Firefox doesn't support speech recognition.** Use Chrome or Edge to speak, or type.
- **Speech output** can use offline Windows voices (for example *Microsoft Ravi/Heera, English (India)*).
  Settings shows which voices are offline and which are online.
- **Speech recognition can change words** and usually removes "um/uh", so some mistakes may be
  missed and a few corrections may come from recognition errors. Turn on *Review before sending*
  to fix the text first.
- **Pronunciation is not measured.**
- **Microphone blocked?** Click the lock icon in the address bar → *Site settings* → *Microphone* →
  *Allow*, then press **Resume mic**.

---

## Zero-cost safety

- **No paid APIs.** Nothing in the app calls OpenAI, Anthropic, Sarvam or any other paid service,
  and there is no automatic fallback. If Ollama is down, you get an error with *Try again* or an
  explicit *Basic mode* button.
- **Local only.** The server-side proxy accepts only loopback Ollama URLs
  (`127.0.0.1`, `localhost`, `::1`) and only models installed on this PC. It rejects requests
  from other websites.
- **Ollama Cloud models are blocked.** Models whose names end in `-cloud`, or that have a
  `remote_host`, run on ollama.com servers rather than your PC. They're hidden and refused.
  This machine has one, `gemma4:31b-cloud`, and you can remove it with `ollama rm gemma4:31b-cloud`.
- **Sarvam AI stays off.** Sarvam's docs currently list a one-time ₹100 credit for new accounts,
  then pay-per-use pricing (for example ₹30 per hour of speech-to-text). There is no public way to
  check your remaining credit without making a billable request, so BolBindass never calls Sarvam.
  If `SARVAM_API_KEY` is set, Settings only says a key exists; it is never returned to the
  browser, logged or used.
- **Your data** (settings, transcripts, reports, mistake memory) lives in this browser
  (localStorage + IndexedDB). Use **Export my data (JSON)** or **Delete history** in Settings or History.

Optional configuration is described in [`.env.example`](.env.example). No variables are required.

---

## Choosing a model

`llama3.2:3b` (about 2.0 GB) is the default. On a laptop CPU it runs at roughly 15–17 tokens per
second: the first reply takes about 10–15 s while the model loads, and later replies take a few
seconds. Other small models also work. Pick one in **Settings → Local AI**.

| Model | Download | Notes |
|---|---|---|
| `llama3.2:3b` | ~2.0 GB | Default; good balance on 8 GB RAM |
| `qwen2.5:3b` | ~1.9 GB | Alternative of similar size |
| `gemma3:4b` | ~3.3 GB | Better language, slower on CPU |
| `llama3.2:1b` | ~1.3 GB | Fastest, weakest corrections |

Download a model with `ollama pull <name>`. Larger (7B+) models are slow on CPU and tight on 8 GB RAM.

---

## Development

```powershell
npm run dev         # dev server on http://127.0.0.1:3000
npm test            # unit tests (Vitest)
npm run typecheck   # TypeScript
npm run lint        # ESLint
npm run build       # production build
npm run check       # all of the above
```

Real local-model test (needs Ollama running with a local model; calls only `127.0.0.1`):

```powershell
$env:OLLAMA_INTEGRATION="1"; npx vitest run src/lib/ollama.integration.test.ts
```

### Project layout

```
src/app/                 pages (/, /practice, /history, /history/[id], /progress, /settings)
src/app/api/ai/*         local-only Ollama proxy: status, chat (streaming), complete (JSON)
src/app/api/sarvam/      reports whether a Sarvam key exists; never calls Sarvam
src/components/          UI (shadcn/ui based), practice screen, report, charts
src/hooks/               speech recognition, speech synthesis, practice session, settings
src/lib/                 grammar rules, correction validation, mistake memory, topic
                         selection, reports, prompts, storage, state machine
src/lib/server/          server-only Ollama + Sarvam guards
```

### Notes

- Built with Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS 4, shadcn/ui and `idb`.
- Vitest is pinned to 3.x because this machine runs Node 20.15. `npm audit` reports advisories
  only in dev tooling (Vitest 3 and eslint-config-next's glob dependencies). Production
  dependencies report 0 vulnerabilities. Upgrading to Node 22 LTS allows Vitest 5.
