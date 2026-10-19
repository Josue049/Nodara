import { AuthGate } from "@/components/auth-provider";
import { GlobalShortcuts } from "@/components/global-shortcuts";
import { MoveDialog } from "@/components/move-dialog";
import { SearchDialog } from "@/components/search-dialog";
import { SettingsHost } from "@/components/settings-host";
import { AppShell } from "@/components/app-shell";
import { WorkspaceProvider } from "@/components/workspace-provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <WorkspaceProvider>
        <AppShell
          extras={
            <>
              <GlobalShortcuts />
              <SearchDialog />
              <MoveDialog />
              <SettingsHost />
            </>
          }
        >
          {children}
        </AppShell>
      </WorkspaceProvider>
    </AuthGate>
  );
}
