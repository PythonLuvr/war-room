"""
WhisperX transcription + transcript formatting for the War Room
meeting transcriber.

Kept separate from main.py so the realtime LiveKit audio capture and the
heavy ML import are decoupled, main.py can start recording immediately
while WhisperX/torch only load once a meeting actually ends.
"""

import datetime
import os
from pathlib import Path

import requests

WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "small")
WHISPER_DEVICE = os.environ.get("WHISPER_DEVICE", "cpu")
WHISPER_LANGUAGE = os.environ.get("WHISPER_LANGUAGE") or None
# float16 needs a GPU; CPU runs must use int8.
COMPUTE_TYPE = "float16" if WHISPER_DEVICE == "cuda" else "int8"

# Lazily populated module globals so the model loads once per process.
_model = None


def _load_model():
    global _model
    if _model is None:
        import whisperx

        _model = whisperx.load_model(
            WHISPER_MODEL, WHISPER_DEVICE, compute_type=COMPUTE_TYPE
        )
    return _model


def _transcribe_one(wav_path: Path) -> list[dict]:
    """Transcribe + word-align a single participant's WAV.

    Returns a list of {start, end, text} segments.
    """
    import whisperx

    audio = whisperx.load_audio(str(wav_path))
    model = _load_model()
    result = model.transcribe(audio, language=WHISPER_LANGUAGE, batch_size=8)

    segments = result.get("segments", [])
    lang = result.get("language")
    if segments and lang:
        # Word-level alignment tightens the segment timestamps so the
        # merged multi-speaker transcript orders cleanly.
        try:
            align_model, meta = whisperx.load_align_model(
                language_code=lang, device=WHISPER_DEVICE
            )
            aligned = whisperx.align(
                segments, align_model, meta, audio, WHISPER_DEVICE
            )
            segments = aligned.get("segments", segments)
        except Exception as e:  # alignment is best-effort
            print(f"  · alignment skipped for {wav_path.name}: {e}")

    out = []
    for s in segments:
        text = (s.get("text") or "").strip()
        if text:
            out.append(
                {"start": s.get("start", 0.0), "end": s.get("end", 0.0), "text": text}
            )
    return out


def _fmt_ts(seconds: float) -> str:
    return str(datetime.timedelta(seconds=int(seconds)))


def transcribe_meeting(tracks: list[tuple[str, Path]]) -> tuple[str, list[str]]:
    """Transcribe every participant track and merge into one markdown
    transcript ordered by timestamp.

    `tracks` is a list of (speaker_name, wav_path).
    Returns (markdown_body, participant_names).
    """
    rows: list[dict] = []
    participants: list[str] = []

    for name, path in tracks:
        if name not in participants:
            participants.append(name)
        print(f"  · {name}: {path.name}")
        for seg in _transcribe_one(path):
            rows.append({**seg, "speaker": name})

    rows.sort(key=lambda r: r["start"])

    lines = ["# Meeting transcript", ""]
    if participants:
        lines.append("**Participants:** " + ", ".join(participants))
        lines.append("")

    # Collapse consecutive segments from the same speaker into one block.
    last_speaker = None
    for r in rows:
        if r["speaker"] != last_speaker:
            lines.append("")
            lines.append(f"**{r['speaker']}**  `{_fmt_ts(r['start'])}`")
            last_speaker = r["speaker"]
        lines.append(r["text"])

    if not rows:
        lines.append("_No speech detected._")

    return "\n".join(lines).strip() + "\n", participants


def post_transcript(
    *,
    war_room_url: str,
    api_secret: str,
    room: str,
    body: str,
    participants: list[str],
    started_at: int,
    ended_at: int,
) -> bool:
    """POST the finished transcript to the War Room app."""
    title = "Meeting · " + datetime.datetime.fromtimestamp(started_at).strftime(
        "%b %d, %Y %H:%M"
    )
    try:
        resp = requests.post(
            f"{war_room_url}/api/livekit/transcript",
            headers={"Authorization": f"Bearer {api_secret}"},
            json={
                "room": room,
                "title": title,
                "body": body,
                "participants": participants,
                "startedAt": started_at * 1000,
                "endedAt": ended_at * 1000,
                "durationSeconds": max(0, ended_at - started_at),
            },
            timeout=30,
        )
        if resp.status_code in (200, 201):
            return True
        print(f"  · server replied {resp.status_code}: {resp.text[:200]}")
        return False
    except requests.RequestException as e:
        print(f"  · POST failed: {e}")
        return False
