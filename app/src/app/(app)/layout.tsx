import { AuthGate } from "@/components/auth-provider";
import { GlobalShortcuts } from "@/components/global-shortcuts";
import { MoveDialog } from "@/components/move-dialog";
import { SearchDialog } from "@/components/search-dialog";
import { SettingsHost } from "@/components/settings-host";
import { Sidebar } from "@/components/sidebar";
import { WorkspaceProvider } from "@/components/workspace-provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <WorkspaceProvider>
        <div className="flex h-screen w-screen overflow-hidden">
          <Sidebar />
          <GlobalShortcuts />
          <SearchDialog />
          <MoveDialog />
          <SettingsHost />
          <main className="flex min-w-0 flex-1 flex-col bg-bg">{children}</main>
        </div>
      </WorkspaceProvider>
    </AuthGate>
  );
}
