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
          title="No approvals yet"
          hint="When an agent asks for permission to do something — call an API, write a file, run a command — it shows up here for you to accept or reject. Quiet for now."
        />
      );
    case "sessions":
      return (
        <PlaceholderChannel
          kind="sessions"
          title="No active sessions"
          hint="Open chats across your channels show up here as a live tail. Start a conversation in any chat channel to populate this view."
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
      if (!projectPath) {
        return (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mb-4">
              <span className="text-2xl">📁</span>
            </div>
            <h2 className="text-xl font-semibold mb-1">Set a working directory</h2>
            <p className="text-sm text-neutral-500 max-w-md">
              This channel doesn&apos;t have a working directory yet. Click the gear in the channel header
              (top-right) and pick the folder your agent should run from.
            </p>
          </div>
        );
      }
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
