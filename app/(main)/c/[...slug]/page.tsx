import { notFound } from "next/navigation";
import { getChannelTree } from "@/lib/channels";
import { listUserServers } from "@/lib/db";
import { ChannelHeader } from "@/components/channel-header";
import { ChannelChat } from "@/components/channel-chat";
import { RightPanel } from "@/components/right-panel";
import { HomeChannel } from "@/components/channel-system/home-channel";
import { WarRoomDashboard } from "@/components/channel-system/war-room-dashboard";
import { ServicesChannel } from "@/components/channel-system/services-channel";
import { ActivityChannel } from "@/components/channel-system/activity-channel";
import { PlaceholderChannel } from "@/components/channel-system/placeholder-channel";
import { DecisionsChannel } from "@/components/channel-system/decisions-channel";
import { AnnouncementsChannel } from "@/components/channel-system/announcements-channel";
import { KnowledgeChannel } from "@/components/channel-system/knowledge-channel";

export const dynamic = "force-dynamic";

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const id = slug.join("/");

  // Search across every server's tree — channels aren't URL-scoped to a server.
  // Include hidden channels (those not shown in sidebar but still routable).
  const servers = listUserServers();
  let channel: Awaited<ReturnType<typeof getChannelTree>>["channels"][number] | undefined;
  for (const s of servers) {
    const { channels } = await getChannelTree(s.id, { includeHidden: true });
    const hit = channels.find((c) => c.id === id);
    if (hit) {
      channel = hit;
      break;
    }
  }
  if (!channel) notFound();

  return (
    <div className="flex flex-1 min-w-0 min-h-0">
      <div className="flex flex-col flex-1 min-w-0">
        <ChannelHeader channel={channel} />
        <ChannelBody
          channelId={channel.id}
          kind={channel.kind}
          name={channel.name}
          projectPath={channel.projectPath}
          description={channel.description}
        />
      </div>
      <RightPanel channel={channel} />
    </div>
  );
}

function ChannelBody({
  channelId,
  kind,
  name,
  projectPath,
  description,
}: {
  channelId: string;
  kind: string;
  name: string;
  projectPath?: string;
  description?: string;
}) {
  switch (kind) {
    case "home":
      return <WarRoomDashboard />;
    case "services":
      return <ServicesChannel />;
    case "activity":
      return <ActivityChannel />;
    case "approvals":
      return (
        <PlaceholderChannel
          kind="approvals"
          title="Approvals"
          hint="Pulls from the PC daemon /approvals endpoint and Discord 📌 reactions. Wiring next pass."
        />
      );
    case "sessions":
      return (
        <PlaceholderChannel
          kind="sessions"
          title="Sessions"
          hint="Live tail of Claude .jsonl files across all projects. Wiring next pass."
        />
      );
    case "decisions":
      return <DecisionsChannel channelId={channelId} />;
    case "announcements":
      return <AnnouncementsChannel channelId={channelId} />;
    case "knowledge":
      return (
        <KnowledgeChannel
          channelId={channelId}
          channelName={name}
          description={description}
        />
      );
    case "chat":
      if (!projectPath) return <div className="p-6 text-sm text-red-300">Missing projectPath for chat channel.</div>;
      return (
        <ChannelChat
          channelName={name}
          projectPath={projectPath}
          description={description}
          key={channelId}
        />
      );
    default:
      return <div className="p-6 text-sm text-neutral-500">Unknown channel kind.</div>;
  }
}
