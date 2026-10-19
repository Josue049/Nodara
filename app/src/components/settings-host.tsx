"use client";

import { SettingsDialog } from "./settings-dialog";
import { useWorkspace } from "./workspace-provider";

export function SettingsHost() {
  const { settings, setSettings } = useWorkspace();
  if (!settings) return null;
  return <SettingsDialog tab={settings} onTab={setSettings} onClose={() => setSettings(null)} />;
}
