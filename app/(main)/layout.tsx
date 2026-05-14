// Layout for the main app shell — the dashboard window in Electron, or the
// normal browser experience. The mini Electron window loads /mini directly
// and does NOT inherit this layout, so it stays a clean standalone strip.

import { Rail } from "@/components/rail";
import { ChannelList } from "@/components/channel-list";
import { CommandPalette } from "@/components/command-palette";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { FloatingMeeting } from "@/components/channel-system/floating-meeting";
import { UpdateBanner } from "@/components/update-banner";

export default function MainLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <div className="flex h-full">
        <Rail />
        <ChannelList />
        <main className="flex-1 flex min-w-0 bg-neutral-950">{children}</main>
      </div>
      <CommandPalette />
      <OnboardingWizard />
      <FloatingMeeting />
      <UpdateBanner />
    </>
  );
}
