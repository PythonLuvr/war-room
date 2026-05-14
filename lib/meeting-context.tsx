"use client";

// Root-level meeting state. The LiveKit Room and all media tracks live here so
// they survive route changes — that's what lets the call collapse into a
// floating mini-window when the user navigates away from /c/home, instead of
// the call ending when the Boardroom panel unmounts.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ConnectionQuality,
  Room,
  RoomEvent,
  Track,
  createLocalTracks,
  type LocalTrack,
  type Participant,
  type RemoteParticipant,
  type RemoteTrack,
} from "livekit-client";
import { TEAM, localMember } from "./team";

const ME = localMember();
const ME_IDENTITY = ME.id;
const ME_NAME = ME.name;

const HUMAN_LABELS: Record<string, string> = Object.fromEntries(
  TEAM.map((m) => [m.id, m.name]),
);

type IPCBridge = {
  send(channel: string, payload?: unknown): void;
  on(channel: string, listener: (payload: unknown) => void): () => void;
};
function ipc(): IPCBridge | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & { warRoom?: { ipc: IPCBridge } };
  return w.warRoom?.ipc ?? null;
}

export type ScreenShareInfo = {
  participantIdentity: string;
  trackSid: string;
  track: RemoteTrack;
};

type JoinOpts = {
  audioDevice?: string;
  videoDevice?: string;
  startWithCamera: boolean;
};

type MeetingCtx = {
  // Phase
  phase: "pre-join" | "in-meeting";
  connecting: boolean;
  error: string | null;
  livekitConfigured: boolean | null;

  // Tracks
  videoTracks: Map<string, RemoteTrack | LocalTrack>;
  remoteHumans: Set<string>;
  screenShare: ScreenShareInfo | null;
  activeSpeakers: Set<string>;
  quality: Map<string, ConnectionQuality>;

  // Local state
  muted: boolean;
  cameraOn: boolean;
  sharing: boolean;

  // Devices
  audioDeviceId?: string;
  videoDeviceId?: string;
  setAudioDeviceId: (id: string | undefined) => void;
  setVideoDeviceId: (id: string | undefined) => void;

  // Actions
  join: (opts: JoinOpts) => Promise<void>;
  leave: () => Promise<void>;
  toggleMute: () => void;
  toggleCamera: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;

  // Identity (the local participant)
  localIdentity: string;
  localName: string;
};

const Ctx = createContext<MeetingCtx | null>(null);

export function MeetingProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<"pre-join" | "in-meeting">("pre-join");
  const [livekitConfigured, setLivekitConfigured] = useState<boolean | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roomRef = useRef<Room | null>(null);
  const audioContainerRef = useRef<HTMLDivElement>(null);

  const [remoteHumans, setRemoteHumans] = useState<Set<string>>(new Set());
  const [videoTracks, setVideoTracks] = useState<Map<string, RemoteTrack | LocalTrack>>(new Map());
  const [screenShare, setScreenShare] = useState<ScreenShareInfo | null>(null);
  const [activeSpeakers, setActiveSpeakers] = useState<Set<string>>(new Set());
  const [quality, setQuality] = useState<Map<string, ConnectionQuality>>(new Map());

  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [sharing, setSharing] = useState(false);

  const [audioDeviceId, setAudioDeviceId] = useState<string | undefined>(undefined);
  const [videoDeviceId, setVideoDeviceId] = useState<string | undefined>(undefined);

  useEffect(() => {
    fetch("/api/livekit/token")
      .then((r) => r.json())
      .then((d) => setLivekitConfigured(!!d.configured))
      .catch(() => setLivekitConfigured(false));
  }, []);

  const upsertVideo = useCallback((identity: string, track: RemoteTrack | LocalTrack) => {
    setVideoTracks((prev) => {
      const next = new Map(prev);
      next.set(identity, track);
      return next;
    });
  }, []);

  const removeVideo = useCallback((identity: string) => {
    setVideoTracks((prev) => {
      const next = new Map(prev);
      next.delete(identity);
      return next;
    });
  }, []);

  const teardown = useCallback(async () => {
    const room = roomRef.current;
    if (room) {
      room.disconnect();
      roomRef.current = null;
    }
    setRemoteHumans(new Set());
    setVideoTracks(new Map());
    setScreenShare(null);
    setActiveSpeakers(new Set());
    setQuality(new Map());
    setMuted(false);
    setCameraOn(false);
    setSharing(false);
  }, []);

  const join = useCallback(
    async (opts: JoinOpts) => {
      setError(null);
      setConnecting(true);
      try {
        if (!livekitConfigured) {
          setPhase("in-meeting");
          return;
        }

        const tokenRes = await fetch("/api/livekit/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identity: ME_IDENTITY, name: ME_NAME }),
        });
        if (!tokenRes.ok) throw new Error(`token endpoint ${tokenRes.status}`);
        const { token, url } = (await tokenRes.json()) as { token: string; url: string };

        const room = new Room({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;

        room.on(RoomEvent.ParticipantConnected, (p: RemoteParticipant) => {
          setRemoteHumans((prev) => new Set(prev).add(p.identity));
        });
        room.on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
          setRemoteHumans((prev) => {
            const next = new Set(prev);
            next.delete(p.identity);
            return next;
          });
          setActiveSpeakers((prev) => {
            const next = new Set(prev);
            next.delete(p.identity);
            return next;
          });
          setQuality((prev) => {
            const next = new Map(prev);
            next.delete(p.identity);
            return next;
          });
          setScreenShare((cur) => (cur?.participantIdentity === p.identity ? null : cur));
        });
        room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub, participant: Participant) => {
          if (track.kind === Track.Kind.Audio && audioContainerRef.current) {
            const el = track.attach();
            el.setAttribute("data-track-sid", track.sid ?? "");
            audioContainerRef.current.appendChild(el);
          }
          if (track.kind === Track.Kind.Video) {
            if (track.source === Track.Source.ScreenShare) {
              setScreenShare({
                participantIdentity: participant.identity,
                trackSid: track.sid ?? "",
                track,
              });
            } else if (track.source === Track.Source.Camera) {
              upsertVideo(participant.identity, track);
            }
          }
        });
        room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, _pub, participant: Participant) => {
          track.detach().forEach((el) => el.remove());
          if (track.kind === Track.Kind.Video) {
            if (track.source === Track.Source.ScreenShare) {
              setScreenShare((cur) => (cur?.trackSid === (track.sid ?? "") ? null : cur));
            } else if (track.source === Track.Source.Camera) {
              removeVideo(participant.identity);
            }
          }
        });
        room.on(RoomEvent.LocalTrackPublished, (pub) => {
          const t = pub.track;
          if (!t) return;
          if (t.kind === Track.Kind.Video && t.source === Track.Source.Camera) {
            upsertVideo(room.localParticipant.identity, t);
          }
        });
        room.on(RoomEvent.LocalTrackUnpublished, (pub) => {
          const t = pub.track;
          if (!t) return;
          if (t.kind === Track.Kind.Video && t.source === Track.Source.Camera) {
            removeVideo(room.localParticipant.identity);
          }
        });
        room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
          setActiveSpeakers(new Set(speakers.map((s) => s.identity)));
        });
        room.on(RoomEvent.ConnectionQualityChanged, (q, participant) => {
          setQuality((prev) => {
            const next = new Map(prev);
            next.set(participant.identity, q);
            return next;
          });
        });
        room.on(RoomEvent.Disconnected, () => {
          setRemoteHumans(new Set());
          setActiveSpeakers(new Set());
        });

        await room.connect(url, token);

        const starting = new Set<string>();
        room.remoteParticipants.forEach((p) => starting.add(p.identity));
        setRemoteHumans(starting);

        const tracks = await createLocalTracks({
          audio: opts.audioDevice ? { deviceId: opts.audioDevice } : true,
          video: opts.startWithCamera
            ? opts.videoDevice
              ? { deviceId: opts.videoDevice }
              : true
            : false,
        });
        for (const t of tracks) {
          await room.localParticipant.publishTrack(t);
        }
        if (opts.startWithCamera) setCameraOn(true);

        setPhase("in-meeting");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        await teardown();
      } finally {
        setConnecting(false);
      }
    },
    [livekitConfigured, upsertVideo, removeVideo, teardown],
  );

  const leave = useCallback(async () => {
    await teardown();
    setPhase("pre-join");
  }, [teardown]);

  const toggleMute = useCallback(() => {
    const room = roomRef.current;
    if (!room) {
      setMuted((v) => !v);
      return;
    }
    const next = !muted;
    setMuted(next);
    room.localParticipant.setMicrophoneEnabled(!next).catch(() => {});
  }, [muted]);

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room || !livekitConfigured) return;
    try {
      const next = !cameraOn;
      await room.localParticipant.setCameraEnabled(next);
      setCameraOn(next);
      if (!next) removeVideo(room.localParticipant.identity);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [cameraOn, livekitConfigured, removeVideo]);

  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room || !livekitConfigured) return;
    try {
      const next = !sharing;
      await room.localParticipant.setScreenShareEnabled(next);
      setSharing(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [sharing, livekitConfigured]);

  useEffect(() => {
    return () => {
      teardown();
    };
  }, [teardown]);

  // ─── IPC bridge to the mini window ───────────────────────────────────────
  // Tell the Electron main process whether we're in a meeting so it knows when
  // to surface the always-on-top mini bar (only when main window loses focus).
  useEffect(() => {
    const bridge = ipc();
    if (!bridge) return;
    bridge.send("main:set-in-meeting", phase === "in-meeting");
  }, [phase]);

  // Stream a compact state snapshot to the mini window whenever anything
  // visible there changes.
  useEffect(() => {
    const bridge = ipc();
    if (!bridge) return;
    let activeName: string | null = null;
    for (const id of activeSpeakers) {
      activeName = HUMAN_LABELS[id] ?? id;
      break;
    }
    bridge.send("meeting:state", {
      inMeeting: phase === "in-meeting",
      muted,
      cameraOn,
      sharing,
      activeSpeaker: activeName,
      participantCount: remoteHumans.size + (phase === "in-meeting" ? 1 : 0),
    });
  }, [phase, muted, cameraOn, sharing, activeSpeakers, remoteHumans]);

  // Mini → main: action events (toggle-mute, leave)
  useEffect(() => {
    const bridge = ipc();
    if (!bridge) return;
    return bridge.on("meeting:action", (payload) => {
      const action = (payload as { action?: string } | null)?.action;
      if (action === "toggle-mute") toggleMute();
      if (action === "leave") leave();
    });
  }, [toggleMute, leave]);

  const value = useMemo<MeetingCtx>(
    () => ({
      phase,
      connecting,
      error,
      livekitConfigured,
      videoTracks,
      remoteHumans,
      screenShare,
      activeSpeakers,
      quality,
      muted,
      cameraOn,
      sharing,
      audioDeviceId,
      videoDeviceId,
      setAudioDeviceId,
      setVideoDeviceId,
      join,
      leave,
      toggleMute,
      toggleCamera,
      toggleScreenShare,
      localIdentity: ME_IDENTITY,
      localName: ME_NAME,
    }),
    [
      phase,
      connecting,
      error,
      livekitConfigured,
      videoTracks,
      remoteHumans,
      screenShare,
      activeSpeakers,
      quality,
      muted,
      cameraOn,
      sharing,
      audioDeviceId,
      videoDeviceId,
      join,
      leave,
      toggleMute,
      toggleCamera,
      toggleScreenShare,
    ],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <div ref={audioContainerRef} className="hidden" />
    </Ctx.Provider>
  );
}

export function useMeeting(): MeetingCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useMeeting must be used inside MeetingProvider");
  return v;
}
