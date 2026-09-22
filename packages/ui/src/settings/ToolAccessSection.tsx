import { useEffect, useMemo, useState } from "react";
import { useServices } from "@/hooks/useServices.js";
import { useSettings } from "@/hooks/useSettingService.js";
import { useZCodeIntl } from "@/i18n/IntlProvider.js";
import { Checkbox } from "@/components/ui/checkbox.js";
import { SettingsGroupCard, SettingsRow } from "@/settings/SettingsPageParts.js";

const SESSIONS_TO_SCAN = 20;
const MESSAGE_LIMIT = 60;

function toolGroupLabel(name: string): string {
  if (!name.startsWith("mcp__")) return "built-in";
  const rest = name.slice("mcp__".length);
  const separatorIndex = rest.indexOf("__");
  return separatorIndex > 0 ? `mcp__${rest.slice(0, separatorIndex)}__` : "mcp";
}

function groupToolNames(names: readonly string[]): Array<{ group: string; tools: string[] }> {
  const builtIn: string[] = [];
  const byServer = new Map<string, string[]>();
  for (const name of names) {
    const group = toolGroupLabel(name);
    if (group === "built-in") {
      builtIn.push(name);
      continue;
    }
    const list = byServer.get(group) ?? [];
    list.push(name);
    byServer.set(group, list);
  }
  const groups = Array.from(byServer.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, tools]) => ({ group, tools }));
  return builtIn.length > 0 ? [...groups, { group: "built-in", tools: builtIn }] : groups;
}

export function ToolAccessSection({ workspacePath }: { workspacePath: string }) {
  const { intl } = useZCodeIntl();
  const { zcodeSessionService } = useServices();
  const { settings, update } = useSettings();
  const denylist = useMemo(() => new Set(settings.toolDenylist ?? []), [settings.toolDenylist]);
  const [toolNames, setToolNames] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        // 最近 session 的 user 消息 info.tools 携带运行时完整工具名单（MCP 工具为 mcp__ 全名）。
        const sessions = await zcodeSessionService.listSessions({
          workspacePath,
          limit: SESSIONS_TO_SCAN,
        });
        const mostRecent = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)[0];
        if (cancelled) return;
        if (!mostRecent) {
          setToolNames([]);
          return;
        }
        const snapshot = await zcodeSessionService.readSession({
          workspacePath,
          sessionId: mostRecent.sessionId,
          messageLimit: MESSAGE_LIMIT,
        });
        if (cancelled) return;
        const names = new Set<string>();
        for (const message of snapshot.messages) {
          if (message.info.role === "user" && message.info.tools) {
            for (const name of Object.keys(message.info.tools)) names.add(name);
          }
        }
        setToolNames([...names].sort((a, b) => a.localeCompare(b)));
      } catch {
        if (!cancelled) setToolNames([]);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [zcodeSessionService, workspacePath]);

  const groups = useMemo(() => groupToolNames(toolNames), [toolNames]);

  const toggleTool = (toolName: string, enabled: boolean) => {
    const next = new Set(settings.toolDenylist ?? []);
    if (enabled) next.delete(toolName);
    else next.add(toolName);
    void update({ toolDenylist: [...next].sort((a, b) => a.localeCompare(b)) });
  };

  return (
    <div className="space-y-4">
      <p className="text-ui-base text-foreground-subtle">
        {intl.formatMessage({ id: "settings.toolAccess.note" })}
      </p>
      {!ready ? (
        <p className="text-ui-base text-foreground-subtle">
          {intl.formatMessage({ id: "settings.toolAccess.loading" })}
        </p>
      ) : groups.length === 0 ? (
        <SettingsGroupCard>
          <SettingsRow label={intl.formatMessage({ id: "settings.toolAccess.empty" })} />
        </SettingsGroupCard>
      ) : (
        groups.map((group) => (
          <div key={group.group} className="space-y-2">
            <h3 className="text-ui-sm font-medium text-foreground-subtle">
              {group.group === "built-in"
                ? intl.formatMessage({ id: "settings.toolAccess.group.builtIn" })
                : group.group}
            </h3>
            <SettingsGroupCard>
              {group.tools.map((toolName) => (
                <SettingsRow
                  key={toolName}
                  label={<span className="font-mono text-ui-sm">{toolName}</span>}
                  control={
                    <Checkbox
                      checked={!denylist.has(toolName)}
                      onCheckedChange={(checked) => toggleTool(toolName, checked === true)}
                    />
                  }
                />
              ))}
            </SettingsGroupCard>
          </div>
        ))
      )}
    </div>
  );
}
