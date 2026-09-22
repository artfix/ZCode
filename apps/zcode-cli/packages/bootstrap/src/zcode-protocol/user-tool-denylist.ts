import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { appSettingsSchema } from "@zcode/shared";

const SETTINGS_FILE = join(homedir(), ".zcode", "v2", "setting.json");

/**
 * 用户级工具禁用名单（setting.json 的 toolDenylist）：MCP 工具用全名 `mcp__<server>__<tool>`，
 * 内置工具用短名。任何读取/解析失败一律返回 []——失败模式必须是"全部可用"。
 */
export function readUserToolDenylist(): string[] {
  try {
    const raw = readFileSync(SETTINGS_FILE, "utf-8");
    const parsed = appSettingsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? (parsed.data.toolDenylist ?? []) : [];
  } catch {
    return [];
  }
}
