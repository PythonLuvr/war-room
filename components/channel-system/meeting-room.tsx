"use client";

// MeetingRoom is now a presentational wrapper around the shared MeetingProvider
// state. All actual call state (room, tracks, speakers) lives in the root-
// level context so the meeting survives route changes and can collapse into
// a FloatingMeeting window when the user navigates away from /c/home.

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  Camera,
  CameraOff,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  Monitor,
  PhoneOff,
  ScreenShare,
  ScreenShareOff,
  Signal,
  SignalLow,
  SignalMedium,
  Sparkles,
  Video,
  Volume2,
} from "lucide-react";
import { ConnectionQuality, type RemoteTrack } from "livekit-client";
import { useInFullscreenPanel } from "./panel-context";
import { useMeeting, type ScreenShareInfo } from "@/lib/meeting-context";
import { TEAM, agentIdFor, type TeamMember } from "@/lib/team";

type AgentMeta = { id: string; name: string; pair: string };
const AGENTS: AgentMeta[] = TEAM.map((m) => ({
  id: agentIdFor(m),
  name: `${m.name}-Agent`,
  pair: m.id,
}));

const HUMAN_LABEL: Record<string, string> = Object.fromEntries(
  TEAM.map((m) => [m.id, m.name]),
);

const COLOR_TABLE: Record<TeamMember["color"], { ring: string; text: string }> = {
  amber: { ring: "ring-amber-400/60", text: "text-amber-200" },
  sky: { ring: "ring-sky-400/60", text: "text-sky-200" },
  emerald: { ring: "ring-emerald-400/60", text: "text-emerald-200" },
  violet: { ring: "ring-violet-400/60", text: "text-violet-200" },
  fuchsia: { ring: "ring-fuchsia-400/60", text: "text-fuchsia-200" },
  rose: { ring: "ring-rose-400/60", text: "text-rose-200" },
};

const PAIR_COLOR: Record<string, { ring: string; text: string }> = Object.fromEntries(
  TEAM.map((m) => [m.id, COLOR_TABLE[m.color] ?? COLOR_TABLE.amber]),
);

type Tile =
  | { kind: "human"; identity: string; pair: string; name: string; isLocal: boolean }
  | { kind: "agent"; identity: string; pair: string; name: string };

export function MeetingRoom({
  chatOpen,
  onToggleChat,
}: {
  chatOpen: boolean;
  onToggleChat: () => void;
}) {
  const fullscreen = useInFullscreenPanel();
  const meeting = useMeeting();

  return (
    <div className={`relative flex flex-col bg-neutral-950 ${fullscreen ? "h-full min-h-[600px]" : "h-[28rem]"}`}>
      {meeting.phase === "pre-join" ? (
        <PreJoin />
      ) : (
        <>
          <div className="flex-1 min-h-0 overflow-hidden p-4">
            <MeetingStage />
          </div>
          <ControlBar chatOpen={chatOpen} onToggleChat={onToggleChat} />
          {meeting.error && (
            <div className="absolute top-2 right-2 text-[10px] text-red-300 bg-red-950/60 border border-red-900 rounded px-2 py-1 max-w-[260px] truncate" title={meeting.error}>
              {meeting.error}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Pre-join screen ─────────────────────────────────────────────────────────

function PreJoin() {
  const meeting = useMeeting();
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [startWithCamera, setStartWithCamera] = useState(false);
  const previewRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const tmp = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        tmp.getTracks().forEach((t) => t.stop());
        const devices = await navigator.mediaDevices.enumerateDevices();
        setCameras(devices.filter((d) => d.kind === "videoinput"));
        setMics(devices.filter((d) => d.kind === "audioinput"));
      } catch {}
    };
    init();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: meeting.videoDeviceId ? { deviceId: { exact: meeting.videoDeviceId } } : true,
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        setPreviewStream(stream);
      } catch {}
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [meeting.videoDeviceId]);

  useEffect(() => {
    if (previewRef.current && previewStream) previewRef.current.srcObject = previewStream;
  }, [previewStream]);

  useEffect(() => {
    let cancelled = false;
    let ctx: AudioContext | null = null;
    let stream: MediaStream | null = null;
    let raf: number | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: meeting.audioDeviceId ? { deviceId: { exact: meeting.audioDeviceId } } : true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        ctx = new AudioContext();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        src.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteTimeDomainData(data);
          let max = 0;
          for (const v of data) max = Math.max(max, Math.abs(v - 128));
          setMicLevel(Math.min(1, max / 64));
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {}
    })();
    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      ctx?.close().catch(() => {});
    };
  }, [meeting.audioDeviceId]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
      <div className="w-full max-w-2xl">
        <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Boardroom · pre-flight</div>
        <h2 className="text-xl font-semibold text-neutral-100 mb-5">Ready to join the call?</h2>
        <div className="flex flex-col md:flex-row gap-4 mb-5">
          <div className="md:w-64 shrink-0">
            <div className="aspect-video bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden flex items-center justify-center">
              {previewStream ? (
                <video
                  ref={previewRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ transform: "scaleX(-1)" }}
                  className="w-full h-full object-cover"
                />
              ) : (
                <CameraOff className="w-8 h-8 text-neutral-700" />
              )}
            </div>
            <label className="flex items-center gap-2 mt-2 text-xs text-neutral-400 cursor-pointer">
              <input
                type="checkbox"
                checked={startWithCamera}
                onChange={(e) => setStartWithCamera(e.target.checked)}
                className="accent-amber-500"
              />
              Join with camera on
            </label>
          </div>
          <div className="flex-1 space-y-3">
            <DevicePicker icon={<Camera className="w-3.5 h-3.5" />} label="Camera" value={meeting.videoDeviceId} options={cameras} onChange={meeting.setVideoDeviceId} />
            <DevicePicker icon={<Mic className="w-3.5 h-3.5" />} label="Microphone" value={meeting.audioDeviceId} options={mics} onChange={meeting.setAudioDeviceId} />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1.5 flex items-center gap-1">
                <Volume2 className="w-3 h-3" />
                Mic level
              </div>
              <div className="h-2 bg-neutral-900 border border-neutral-800 rounded overflow-hidden">
                <div className="h-full bg-emerald-500/70 transition-[width] duration-75" style={{ width: `${Math.round(micLevel * 100)}%` }} />
              </div>
            </div>
          </div>
        </div>
        {meeting.livekitConfigured === false && (
          <div className="text-[11px] text-amber-300 bg-amber-950/40 border border-amber-900/50 rounded p-2 mb-3">
            <strong className="text-amber-200">Voice + video not enabled.</strong> You can still join visually.
            To turn on real audio, set <code className="text-amber-200">LIVEKIT_URL</code>,
            <code className="ml-1 text-amber-200">LIVEKIT_API_KEY</code>, and
            <code className="ml-1 text-amber-200">LIVEKIT_API_SECRET</code> in your{" "}
            <code className="text-amber-200">.env.local</code> (point them at any LiveKit server — self-hosted or LiveKit Cloud).
          </div>
        )}
        {meeting.error && (
          <div className="text-[11px] text-red-300 bg-red-950/40 border border-red-900/50 rounded p-2 mb-3">
            {meeting.error}
          </div>
        )}
        <div className="flex items-center justify-end gap-2">
          <button
            disabled={meeting.connecting}
            onClick={() =>
              meeting.join({
                audioDevice: meeting.audioDeviceId,
                videoDevice: meeting.videoDeviceId,
                startWithCamera,
              })
            }
            className="flex items-center gap-1.5 px-5 h-12 text-sm font-medium rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-40"
          >
            {meeting.connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
            {meeting.connecting ? "Connecting…" : "Join meeting"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DevicePicker({
  icon,
  label,
  value,
  options,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  options: MediaDeviceInfo[];
  onChange: (id: string | undefined) => void;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1.5 flex items-center gap-1">
        {icon}
        {label}
      </div>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-neutral-700"
      >
        <option value="">System default</option>
        {options.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || `${label} (${d.deviceId.slice(0, 6)})`}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── Stage / Grid ────────────────────────────────────────────────────────────

function MeetingStage() {
  const meeting = useMeeting();

  const tiles = useMemo<Tile[]>(() => {
    const out: Tile[] = [];
    out.push({ kind: "human", identity: meeting.localIdentity, pair: meeting.localIdentity, name: meeting.localName, isLocal: true });
    for (const id of meeting.remoteHumans) {
      if (id === meeting.localIdentity) continue;
      const pair = id in HUMAN_LABEL ? id : meeting.localIdentity;
      out.push({ kind: "human", identity: id, pair, name: HUMAN_LABEL[pair] ?? id, isLocal: false });
    }
    for (const a of AGENTS) {
      out.push({ kind: "agent", identity: a.id, pair: a.pair, name: a.name });
    }
    return out;
  }, [meeting.localIdentity, meeting.localName, meeting.remoteHumans]);

  return meeting.screenShare ? (
    <StageView share={meeting.screenShare} tiles={tiles} />
  ) : (
    <Grid tiles={tiles} />
  );
}

function Grid({ tiles }: { tiles: Tile[] }) {
  const cols = tiles.length <= 1 ? 1 : tiles.length <= 4 ? 2 : tiles.length <= 9 ? 3 : 4;
  const style: CSSProperties = { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` };
  return (
    <div className="grid gap-3 h-full content-start" style={style}>
      {tiles.map((t) => (
        <ParticipantTile key={t.identity} tile={t} />
      ))}
    </div>
  );
}

function StageView({ share, tiles }: { share: ScreenShareInfo; tiles: Tile[] }) {
  return (
    <div className="flex flex-col md:flex-row gap-3 h-full">
      <div className="flex-1 min-w-0 bg-neutral-900 border border-violet-500/40 rounded-lg overflow-hidden flex flex-col">
        <div className="px-3 py-1.5 text-[10px] text-violet-300 uppercase tracking-wider border-b border-violet-500/20 flex items-center gap-2">
          <Monitor className="w-3 h-3" />
          {share.participantIdentity} sharing screen
        </div>
        <ScreenShareView track={share.track} />
      </div>
      <div className="md:w-44 shrink-0 flex md:flex-col flex-row gap-2 md:overflow-y-auto overflow-x-auto">
        {tiles.map((t) => (
          <div key={t.identity} className="md:w-full w-32 shrink-0">
            <ParticipantTile tile={t} compact />
          </div>
        ))}
      </div>
    </div>
  );
}

function ScreenShareView({ track }: { track: RemoteTrack }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const el = track.attach() as HTMLVideoElement;
    el.muted = true;
    el.playsInline = true;
    host.innerHTML = "";
    host.appendChild(el);
    return () => {
      track.detach().forEach((e) => e.remove());
    };
  }, [track]);
  return <div ref={ref} className="flex-1 bg-black [&>video]:w-full [&>video]:h-full [&>video]:object-contain" />;
}

function ParticipantTile({ tile, compact }: { tile: Tile; compact?: boolean }) {
  const meeting = useMeeting();
  const palette = PAIR_COLOR[tile.pair] ?? PAIR_COLOR.ej;
  const isAgent = tile.kind === "agent";
  const isLocal = tile.kind === "human" && (tile as Extract<Tile, { kind: "human" }>).isLocal;
  const track = meeting.videoTracks.get(tile.identity);
  const speaking = meeting.activeSpeakers.has(tile.identity);
  const quality = meeting.quality.get(tile.identity) ?? null;
  const showCameraOff = isLocal && !meeting.cameraOn;
  const showMuted = isLocal && meeting.muted;

  const videoRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = videoRef.current;
    if (!host || !track) return;
    const el = track.attach() as HTMLVideoElement;
    el.muted = true;
    el.playsInline = true;
    if (isLocal) el.style.transform = "scaleX(-1)";
    host.innerHTML = "";
    host.appendChild(el);
    return () => {
      track.detach().forEach((e) => e.remove());
    };
  }, [track, isLocal]);

  return (
    <div className={`relative aspect-video bg-neutral-900 border rounded-lg overflow-hidden transition-all ${speaking ? `border-current ring-2 ring-offset-1 ring-offset-neutral-950 ${palette.ring} ${palette.text}` : "border-neutral-800"}`}>
      {track && !showCameraOff ? (
        <div ref={videoRef} className="absolute inset-0 [&>video]:w-full [&>video]:h-full [&>video]:object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          {isAgent ? (
            <div className="flex flex-col items-center gap-2">
              <div className={`w-14 h-14 rounded-full border-2 ${palette.ring.replace("ring-", "border-").replace("/60", "/40")} flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900`}>
                <Sparkles className={`w-6 h-6 ${palette.text}`} />
              </div>
              <span className={`text-[10px] uppercase tracking-wider ${palette.text} flex items-center gap-1`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                listening
              </span>
            </div>
          ) : (
            <div className={`w-14 h-14 rounded-full border bg-gradient-to-br from-neutral-700 to-neutral-900 flex items-center justify-center text-xl font-semibold ${palette.text}`}>
              {tile.name[0]}
            </div>
          )}
        </div>
      )}
      <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5 pointer-events-none">
        <span className="text-xs font-medium text-neutral-100 bg-black/50 backdrop-blur-sm rounded px-1.5 py-0.5 truncate max-w-full">
          {tile.name}{isLocal ? " (you)" : ""}
        </span>
        {showMuted && (
          <span className="bg-red-500/80 rounded p-0.5 text-white">
            <MicOff className="w-3 h-3" />
          </span>
        )}
      </div>
      {quality !== null && !isAgent && !compact && (
        <div className="absolute top-2 right-2 pointer-events-none">
          <QualityDot quality={quality} />
        </div>
      )}
    </div>
  );
}

function QualityDot({ quality }: { quality: ConnectionQuality }) {
  const map = {
    [ConnectionQuality.Excellent]: { Icon: Signal, color: "text-emerald-400", title: "Excellent" },
    [ConnectionQuality.Good]: { Icon: SignalMedium, color: "text-emerald-300", title: "Good" },
    [ConnectionQuality.Poor]: { Icon: SignalLow, color: "text-amber-400", title: "Poor" },
    [ConnectionQuality.Lost]: { Icon: SignalLow, color: "text-red-400", title: "Lost" },
    [ConnectionQuality.Unknown]: { Icon: Signal, color: "text-neutral-500", title: "Unknown" },
  } as const;
  const m = map[quality] ?? map[ConnectionQuality.Unknown];
  return (
    <div className={`bg-black/50 backdrop-blur-sm rounded p-0.5 ${m.color}`} title={m.title}>
      <m.Icon className="w-3 h-3" />
    </div>
  );
}

// ─── Control bar ─────────────────────────────────────────────────────────────

function ControlBar({ chatOpen, onToggleChat }: { chatOpen: boolean; onToggleChat: () => void }) {
  const meeting = useMeeting();
  return (
    <div className="border-t border-neutral-900 bg-neutral-950 px-4 py-3 flex items-center justify-center gap-3">
      <CallButton title={meeting.muted ? "Unmute" : "Mute"} active={!meeting.muted} danger={meeting.muted} onClick={meeting.toggleMute} disabled={!meeting.livekitConfigured && false}>
        {meeting.muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
      </CallButton>
      <CallButton title={meeting.cameraOn ? "Stop camera" : "Start camera"} active={meeting.cameraOn} onClick={meeting.toggleCamera} disabled={!meeting.livekitConfigured}>
        {meeting.cameraOn ? <Camera className="w-5 h-5" /> : <CameraOff className="w-5 h-5" />}
      </CallButton>
      <CallButton title={meeting.sharing ? "Stop sharing" : "Share screen"} active={meeting.sharing} onClick={meeting.toggleScreenShare} disabled={!meeting.livekitConfigured}>
        {meeting.sharing ? <ScreenShareOff className="w-5 h-5" /> : <ScreenShare className="w-5 h-5" />}
      </CallButton>
      <CallButton title={chatOpen ? "Hide chat" : "Show chat"} active={chatOpen} onClick={onToggleChat}>
        <MessageSquare className="w-5 h-5" />
      </CallButton>
      <div className="w-px h-8 bg-neutral-800 mx-1" />
      <CallButton title="Leave" danger onClick={meeting.leave}>
        <PhoneOff className="w-5 h-5" />
      </CallButton>
    </div>
  );
}

function CallButton({
  title,
  children,
  active,
  danger,
  disabled,
  onClick,
}: {
  title: string;
  children: React.ReactNode;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const base = "h-14 w-14 rounded-full flex items-center justify-center transition-colors border";
  let look = "bg-neutral-900 border-neutral-800 text-neutral-200 hover:bg-neutral-800";
  if (active) look = "bg-emerald-500/20 border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/30";
  if (danger) look = "bg-red-500/20 border-red-500/40 text-red-200 hover:bg-red-500/30";
  return (
    <button title={title} onClick={onClick} disabled={disabled} className={`${base} ${look} ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}>
      {children}
    </button>
  );
}
