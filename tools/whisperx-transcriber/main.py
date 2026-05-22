#!/usr/bin/env python3
"""
War Room: WhisperX meeting transcriber (optional voice module).

Joins a War Room boardroom LiveKit room as a hidden, listen-only
participant. While the meeting runs it records each human participant's
audio track to its own WAV file. When everyone leaves (or the worker is
stopped), it transcribes every track with WhisperX, merges the segments
into one speaker-labelled transcript, and POSTs that transcript back to
War Room so it shows up in the boardroom "Meeting transcripts" panel.

Per-track recording means we get speaker separation for free: each
LiveKit track is exactly one participant, so the participant identity
*is* the speaker label. WhisperX gives accurate word-level timing on top
of that. No HuggingFace diarization token needed.

This is an OPT-IN module. War Room runs fine without it. See
docs/voice-setup.md for the full setup.

Run:
    python main.py

Env (see .env.example):
    LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET: same values
        War Room itself uses, from install-livekit.sh
    WAR_ROOM_URL: base URL of the War Room app
                            (default http://127.0.0.1:3000)
    ROOM_NAME: LiveKit room to join (default warroom-main)
    WHISPER_MODEL: WhisperX model size (default small)
    WHISPER_DEVICE: cpu | cuda (default cpu)
    WHISPER_LANGUAGE: force a language code, or leave unset to
                            auto-detect
"""

import asyncio
import os
import signal
import sys
import time
import wave
from pathlib import Path

from dotenv import load_dotenv
from livekit import api, rtc

import transcribe

load_dotenv()

LIVEKIT_URL = os.environ.get("LIVEKIT_URL", "")
LIVEKIT_API_KEY = os.environ.get("LIVEKIT_API_KEY", "")
LIVEKIT_API_SECRET = os.environ.get("LIVEKIT_API_SECRET", "")
WAR_ROOM_URL = os.environ.get("WAR_ROOM_URL", "http://127.0.0.1:3000").rstrip("/")
ROOM_NAME = os.environ.get("ROOM_NAME", "warroom-main")

# Whisper writes mono 16 kHz; LiveKit hands us whatever the publisher
# sends, so AudioResampler normalises every track to this before the WAV.
TARGET_RATE = 16000
TARGET_CHANNELS = 1

WORK_DIR = Path(os.environ.get("WORK_DIR", "./recordings")).resolve()


class TrackRecorder:
    """Streams one participant's audio track straight to a WAV file."""

    def __init__(self, identity: str, name: str):
        self.identity = identity
        self.name = name or identity
        self.path = WORK_DIR / f"{identity}-{int(time.time())}.wav"
        self._wav: wave.Wave_write | None = None
        self._resampler: rtc.AudioResampler | None = None
        self.frames_written = 0

    def _ensure_wav(self):
        if self._wav is None:
            self._wav = wave.open(str(self.path), "wb")
            self._wav.setnchannels(TARGET_CHANNELS)
            self._wav.setsampwidth(2)  # 16-bit PCM
            self._wav.setframerate(TARGET_RATE)

    async def run(self, track: rtc.Track):
        stream = rtc.AudioStream(track)
        try:
            async for event in stream:
                frame = event.frame
                if self._resampler is None:
                    self._resampler = rtc.AudioResampler(
                        input_rate=frame.sample_rate,
                        output_rate=TARGET_RATE,
                        num_channels=TARGET_CHANNELS,
                    )
                self._ensure_wav()
                for out in self._resampler.push(frame):
                    self._wav.writeframes(out.data.tobytes())
                    self.frames_written += out.samples_per_channel
        finally:
            await stream.aclose()

    def close(self):
        if self._resampler is not None:
            for out in self._resampler.flush():
                self._ensure_wav()
                self._wav.writeframes(out.data.tobytes())
        if self._wav is not None:
            self._wav.close()
            self._wav = None

    @property
    def has_audio(self) -> bool:
        return self.frames_written > TARGET_RATE  # at least ~1s


def build_token() -> str:
    """Mint a hidden, listen-only token for the transcriber."""
    grant = api.VideoGrants(
        room_join=True,
        room=ROOM_NAME,
        can_publish=False,
        can_subscribe=True,
        # `hidden` keeps the transcriber out of the boardroom seat grid,
        # it observes the call without showing up as a participant.
        hidden=True,
    )
    token = (
        api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        .with_identity("whisperx-transcriber")
        .with_name("Transcriber")
        .with_grants(grant)
        .to_jwt()
    )
    return token


async def main() -> int:
    missing = [
        k
        for k in ("LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET")
        if not os.environ.get(k)
    ]
    if missing:
        print(f"✗ missing env: {', '.join(missing)}, see .env.example", file=sys.stderr)
        return 1

    WORK_DIR.mkdir(parents=True, exist_ok=True)
    room = rtc.Room()
    recorders: dict[str, TrackRecorder] = {}
    tasks: set[asyncio.Task] = set()
    started_at = int(time.time())
    stop = asyncio.Event()

    @room.on("track_subscribed")
    def on_track(track: rtc.Track, _pub, participant: rtc.RemoteParticipant):
        if track.kind != rtc.TrackKind.KIND_AUDIO:
            return
        rec = recorders.get(participant.identity)
        if rec is None:
            rec = TrackRecorder(participant.identity, participant.name)
            recorders[participant.identity] = rec
            print(f"● recording {rec.name} ({participant.identity})")
        t = asyncio.create_task(rec.run(track))
        tasks.add(t)
        t.add_done_callback(tasks.discard)

    @room.on("participant_disconnected")
    def on_left(participant: rtc.RemoteParticipant):
        print(f"○ {participant.identity} left")
        # When the last human leaves, the meeting is over.
        humans = [p for p in room.remote_participants.values()]
        if not humans:
            print("· room empty, wrapping up")
            stop.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, stop.set)
        except NotImplementedError:
            pass  # Windows: Ctrl+C still raises KeyboardInterrupt below

    print(f"→ connecting to {LIVEKIT_URL} room={ROOM_NAME}")
    await room.connect(LIVEKIT_URL, build_token())
    print("✓ connected, waiting for meeting audio (Ctrl+C to stop + transcribe)")

    try:
        await stop.wait()
    except KeyboardInterrupt:
        pass

    print("· stopping recorders…")
    for t in list(tasks):
        t.cancel()
    for rec in recorders.values():
        rec.close()
    await room.disconnect()

    ended_at = int(time.time())
    active = [r for r in recorders.values() if r.has_audio]
    if not active:
        print("· no audio captured, nothing to transcribe")
        return 0

    print(f"· transcribing {len(active)} track(s) with WhisperX…")
    transcript_md, participants = transcribe.transcribe_meeting(
        [(r.name, r.path) for r in active]
    )

    ok = transcribe.post_transcript(
        war_room_url=WAR_ROOM_URL,
        api_secret=LIVEKIT_API_SECRET,
        room=ROOM_NAME,
        body=transcript_md,
        participants=participants,
        started_at=started_at,
        ended_at=ended_at,
    )
    if ok:
        print("✓ transcript saved to War Room boardroom")
        return 0
    print("✗ failed to POST transcript to War Room", file=sys.stderr)
    return 1


if __name__ == "__main__":
    try:
        sys.exit(asyncio.run(main()))
    except KeyboardInterrupt:
        sys.exit(0)
