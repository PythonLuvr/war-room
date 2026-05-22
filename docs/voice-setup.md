# Voice setup (optional)

War Room's boardroom has a voice + video call surface and an optional
meeting transcriber. **Both are opt-in.** A fresh clone runs fully
without either, the boardroom just shows seats and an amber "voice not
configured" note until you wire up LiveKit.

This guide covers the two pieces, in order:

1. **Self-hosted LiveKit**, the realtime server that carries the
   audio/video. Required for the boardroom call to work.
2. **WhisperX transcriber**, records a call and saves a transcript.
   Optional on top of (1).

Nothing here touches the default app build. If you skip this page, War
Room behaves exactly as before.

---

## 1. Self-hosted LiveKit

The boardroom uses [LiveKit](https://livekit.io) for voice/video. You
run your own server, there is no shared War Room infrastructure.

### Install on a Linux VPS

`tools/install-livekit.sh` is a one-shot installer. On the server, **as
root**:

```bash
# optional: a real hostname gets you WSS/TLS instead of plain ws://
LIVEKIT_DOMAIN=livekit.example.com bash install-livekit.sh
```

It installs the LiveKit binary, generates an API key + secret, writes
`/etc/livekit.yaml`, opens the firewall (UDP 50000-50100 for WebRTC
media, TCP 7880/7881), adds an nginx vhost, and registers LiveKit under
PM2. At the end it prints three values:

```
LIVEKIT_URL=...
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
```

Re-run `bash install-livekit.sh --print-creds` any time to print them
again (e.g. for a teammate joining later).

### Point War Room at it

Add the three values to your local War Room env file
(`~/.war-room/.env`, or `.env.local` in the repo):

```
LIVEKIT_URL=wss://livekit.example.com
LIVEKIT_API_KEY=APIwr...
LIVEKIT_API_SECRET=...
```

Restart War Room. The boardroom's amber warning disappears and the
mute / camera / screen-share controls go live. Every teammate uses the
**same three values**.

### Security notes

- `LIVEKIT_API_SECRET` signs room-join tokens. Keep it server-side
  only, it must never reach a client bundle. War Room mints tokens in
  `app/api/livekit/token/route.ts` (a server route) and the transcriber
  uses the secret directly. Don't paste it anywhere a browser sees.
- Without `LIVEKIT_DOMAIN` the installer falls back to plain `ws://` on
  the bare IP. Fine for a quick trial; use a domain + `certbot` for
  anything real so media negotiation runs over TLS.
- The open UDP range is a real network surface. Keep the VPS firewall
  otherwise tight.

---

## 2. WhisperX meeting transcriber

Once LiveKit works, you can optionally run the transcriber. It joins a
boardroom call as a hidden listener, records each participant, and after
the call saves a speaker-labelled transcript into the boardroom
**Meeting transcripts** panel.

It lives in `tools/whisperx-transcriber/`. It's a separate Python
process, it does **not** ship in the War Room app build.

### Install

```bash
cd tools/whisperx-transcriber
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

WhisperX pulls in PyTorch. For CPU that's all you need. For real speed
on long meetings, install a CUDA-enabled torch build and set
`WHISPER_DEVICE=cuda`.

### Configure

Edit `.env`:

- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, the **same**
  three values from step 1.
- `WAR_ROOM_URL`, where War Room is running (`http://127.0.0.1:3000`
  if the worker is on the same machine).
- `ROOM_NAME`, leave as `warroom-main` (the boardroom's room).
- `WHISPER_MODEL` / `WHISPER_DEVICE`, accuracy vs speed.

### Run

```bash
python main.py
```

Start it before or during a boardroom call and leave it running. When
the last person leaves the call, or you press Ctrl+C, it transcribes
every track and POSTs the result. A minute or two later the transcript
shows up in the boardroom panel.

To keep it always-on, run it under PM2 or a systemd service the same
way you'd run any worker. It idles cheaply between meetings; the heavy
WhisperX/torch load only happens when a call actually ends.

### How speaker labels work

LiveKit gives each participant their own audio track. The transcriber
records one WAV per track, so the speaker label is just the
participant's name, no diarization guesswork. WhisperX handles the
transcription and word-level timing.

### Auth

The transcriber's POST to War Room is authenticated with
`LIVEKIT_API_SECRET` as a bearer token. Only a process that already
holds the LiveKit credentials can write transcripts, so there's no
extra secret to manage.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Boardroom still shows the amber "voice not enabled" note | The three `LIVEKIT_*` vars aren't set, or War Room wasn't restarted after setting them. |
| Call connects but no audio across the network | You're on plain `ws://`. Set `LIVEKIT_DOMAIN` + run `certbot` for WSS. |
| Transcriber prints `missing env` | Copy `.env.example` to `.env` and fill it in. |
| `POST failed` / `server replied 401` | `LIVEKIT_API_SECRET` in the transcriber's `.env` doesn't match War Room's. |
| `POST failed` / `server replied 503` | War Room itself has no `LIVEKIT_API_SECRET` set, finish step 1 first. |
| Transcription is very slow | Use a smaller `WHISPER_MODEL`, or `WHISPER_DEVICE=cuda` with a GPU. |
