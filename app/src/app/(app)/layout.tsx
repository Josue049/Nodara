import { Sidebar } from "@/components/sidebar";
import { WorkspaceProvider } from "@/components/workspace-provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <div className="flex h-screen w-screen overflow-hidden">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col bg-bg">{children}</main>
      </div>
    </WorkspaceProvider>
  );
}
