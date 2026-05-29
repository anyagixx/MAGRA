<!-- === MODULE_CONTRACT ===
FILE: README.zh-CN.md
VERSION: 1.0.0
PURPOSE: Present MAGRA release usage and installation in Simplified Chinese.
SCOPE: MAGRA overview, install commands, web workflow, MyGRACE skills, RTK, SNARC, compatibility aliases, and upstream attribution.
DEPENDS: M-MAGRA-LOCALIZED-READMES,M-MAGRA-RELEASE-SURFACE,M-MAGRA-INSTALL-DOCS
LINKS: docs/modules/M-MAGRA-LOCALIZED-READMES.xml
ROLE: RELEASE
MAP_MODE: DOCUMENT
START_MODULE_CONTRACT
END_MODULE_CONTRACT
=== END_MODULE_CONTRACT === -->

<!-- === MODULE_MAP ===
Sections: Overview, Install, Commands, Web workflow, Storage, Upstream attribution
=== END_MODULE_MAP === -->

<!-- === CHANGE_SUMMARY ===
v1.0.0 - Replaced upstream Reasonix README with MAGRA-first localized release documentation.
=== END_CHANGE_SUMMARY === -->

# MAGRA

MAGRA 是本地优先的 AI 编程代理，面向 pet projects、实验项目和需要长期上下文的日常开发。它把 Reasonix base runtime 作为兼容基础，并集成 MyGRACE 方法论、RTK shell 压缩、SNARC SQLite 记忆和 Web chat 工作流。

`magra` 是主命令。`reasonix` 和 `dsnix` 只作为 compatibility aliases 保留，方便旧脚本和迁移路径继续工作。

## 安装

需要 Node 22 或更新版本、git 和 npm。推荐直接从 MAGRA GitHub 仓库安装：

```bash
curl -fsSL https://raw.githubusercontent.com/anyagixx/MAGRA/main/scripts/install.sh | bash
```

安装固定版本：

```bash
MAGRA_REF=v0.1.2 curl -fsSL https://raw.githubusercontent.com/anyagixx/MAGRA/main/scripts/install.sh | bash
```

脚本会把仓库克隆或更新到 `~/.magra/repo`，构建项目，并在 `~/.local/bin` 创建 `magra` shim。脚本不使用 `sudo`。

如果 npm 包已经发布，也可以使用：

```bash
npm install -g magra
magra code my-project
```

或者不做全局安装：

```bash
cd my-project
npx magra@latest code
```

首次运行会要求 DeepSeek API Key。可以在 <https://platform.deepseek.com/api_keys> 创建。

## 常用命令

| 命令 | 用途 |
|---|---|
| `magra` / `magra code [dir]` | 编程代理，包含文件系统、shell、MCP、MyGRACE 和 SNARC 工具。 |
| `magra chat` | 轻量聊天模式。 |
| `magra run "task"` | 一次性任务执行，适合脚本和管道。 |
| `magra doctor` | 检查 Node、API key、dashboard、RTK 和 SNARC。 |
| `magra stats` | 查看 token、费用和用量统计。 |

兼容入口仍然存在：

```bash
reasonix code my-project  # compatibility alias
dsnix code my-project     # compatibility alias
```

## Web Chat 与 MyGRACE

启动 `magra code` 后，打开 CLI 打印出来的 dashboard URL。聊天框里可以直接调用 MyGRACE skill：

- `/mygrace:status` 只读取 MyGRACE index 文件，快速查看项目状态。
- `/mygrace:plan` 为需求生成模块、阶段和验证计划。
- `/mygrace:execute` 执行当前阶段。
- `/mygrace:reviewer` 检查 index、contract、verification 和 semantic block 是否漂移。
- `/mygrace:ask ...` 通过懒加载 index 回答架构问题。

MAGRA 还提供 `mygrace_*` 和 `snarc_*` native/MCP tools，用于模块导航、lint、SNARC 搜索、上下文和统计。

## RTK 与 SNARC

- RTK：合适的 shell、build、lint、test 命令会通过 `rtk` 执行，以减少工具输出 token，同时保持原始退出码语义。
- SNARC：项目记忆存储在 `<project>/.magra/snarc/memory.sqlite`，用于保存高显著性观察、模式和项目事实。

## 配置与存储

- 全局 compatibility settings path：`~/.reasonix/config.json`
- 项目 compatibility directory：`<project>/.reasonix/`
- MAGRA SNARC 记忆：`<project>/.magra/snarc/memory.sqlite`
- MyGRACE index：`docs/graph-index.xml`、`docs/plan-index.xml`、`docs/verification-index.xml`

## Upstream Attribution

MAGRA is built from and remains compatible with the upstream DeepSeek-Reasonix / Reasonix base runtime. Upstream attribution is preserved in [NOTICE.md](./NOTICE.md).

## 许可证

MIT。详见 [LICENSE](./LICENSE)。
