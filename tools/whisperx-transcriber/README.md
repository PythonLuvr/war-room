# WhisperX meeting transcriber

Optional voice module for War Room. Records a boardroom call and saves a
speaker-labelled transcript back into the **Meeting transcripts** panel.

War Room runs fine without this. It's opt-in, nothing here loads unless
you run it yourself.

## How it works

1. Joins the boardroom LiveKit room as a **hidden, listen-only**
   participant (it never shows up as a seat).
2. Records each human's audio track to its own WAV. One track per
   person means speaker labels are exact, no diarization guessing.
3. When everyone leaves (or you press Ctrl+C), transcribes every track
   with WhisperX, merges the segments by timestamp, and POSTs one
   markdown transcript to War Room.

## Quick start

```bash
cd tools/whisperx-transcriber
python -m venv .venv
# Windows: .venv\Scripts\activate   |   macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # then fill in LiveKit creds + WAR_ROOM_URL
python main.py
```

Start it before (or during) a boardroom call. Leave it running for the
meeting. Stop it when the meeting ends, the transcript appears in the
boardroom panel a minute or two later.

Full walkthrough, including the self-hosted LiveKit setup, is in
[`docs/voice-setup.md`](../../docs/voice-setup.md).

## Notes

- CPU transcription works but is slow on long meetings. Set
  `WHISPER_DEVICE=cuda` with a CUDA-enabled torch build for real speed.
- The worker authenticates its POST with `LIVEKIT_API_SECRET` as a
  bearer token, so only a process holding the room credentials can write
  transcripts.
- `recordings/` holds the per-participant WAVs. Safe to delete after a
  transcript is saved.
