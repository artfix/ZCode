import { spawn } from "node:child_process";

import { withPinnedNodePath } from "./mise-toolchain-env.mjs";

const [requestedCommand, ...args] = process.argv.slice(2);
if (!requestedCommand) {
  console.error("Usage: node scripts/mise-run.mjs <command> [...args]");
  process.exit(1);
}

// Windows 上 pnpm shim 名称不固定（cmd/exe/mise shim）；保持原始命令名，由下方 shell:true 走 cmd 按 PATH 解析。
const command = requestedCommand;
const child = spawn(command, args, {
  cwd: process.cwd(),
  env: withPinnedNodePath(process.env, process.execPath),
  // Windows 的 .cmd 入口需要 shell 才能被 Node spawn。
  shell: process.platform === "win32",
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(`[mise-run] failed to start ${requestedCommand}: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
