<!-- === MODULE_CONTRACT ===
FILE: README.ja-JP.md
VERSION: 1.0.0
PURPOSE: Present MAGRA release usage and installation in Japanese.
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
v1.0.1 - Updated pinned install guidance for the MAGRA v0.1.3 release.
=== END_CHANGE_SUMMARY === -->

# MAGRA

MAGRA は、pet projects、実験的な開発、長い文脈を保った日常開発のためのローカルファースト AI コーディングエージェントです。Reasonix base runtime を compatibility layer として使いながら、MyGRACE 方法論、RTK shell compression、SNARC SQLite memory、Web chat workflow を統合しています。

主コマンドは `magra` です。`reasonix` と `dsnix` は compatibility aliases として残しており、既存の自動化や移行パスを壊さないためのものです。

## インストール

Node 22 以上、git、npm が必要です。推奨は MAGRA GitHub repository から直接インストールする方法です。

```bash
curl -fsSL https://raw.githubusercontent.com/anyagixx/MAGRA/main/scripts/install.sh | bash
```

固定バージョンを使う場合：

```bash
MAGRA_REF=v0.1.3 curl -fsSL https://raw.githubusercontent.com/anyagixx/MAGRA/main/scripts/install.sh | bash
```

インストーラーは `~/.magra/repo` に clone/update し、ビルドした上で `~/.local/bin` に `magra` shim を作成します。`sudo` は使いません。

npm package が公開済みの場合は次の形でも使えます。

```bash
npm install -g magra
magra code my-project
```

グローバルインストールなしで試す場合：

```bash
cd my-project
npx magra@latest code
```

初回起動時に DeepSeek API Key を求められます。キーは <https://platform.deepseek.com/api_keys> で作成できます。

## コマンド

| コマンド | 用途 |
|---|---|
| `magra` / `magra code [dir]` | ファイルシステム、shell、MCP、MyGRACE、SNARC tools を備えた coding agent。 |
| `magra chat` | 軽量な chat mode。 |
| `magra run "task"` | 一回だけ実行する task runner。 |
| `magra doctor` | Node、API key、dashboard、RTK、SNARC の health check。 |
| `magra stats` | token、cost、usage の確認。 |

互換性のための入口も残っています。

```bash
reasonix code my-project  # compatibility alias
dsnix code my-project     # compatibility alias
```

## Web Chat と MyGRACE

`magra code` を起動したら、CLI に表示される dashboard URL を開きます。チャット欄から MyGRACE skill を直接呼び出せます。

- `/mygrace:status` は MyGRACE index だけを読み、プロジェクト状態を素早く確認します。
- `/mygrace:plan` は requirements から module、phase、verification plan を作ります。
- `/mygrace:execute` は現在の phase を実行します。
- `/mygrace:reviewer` は index、contract、verification、semantic block の drift を確認します。
- `/mygrace:ask ...` は index-first navigation でアーキテクチャ質問に答えます。

MAGRA は `mygrace_*` と `snarc_*` native/MCP tools も公開します。module navigation、lint、SNARC search、context、stats に使えます。

## RTK と SNARC

- RTK: shell、build、lint、test の対象コマンドを `rtk` 経由で実行し、exit code semantics を保ちながら tool-output token を減らします。
- SNARC: project memory は `<project>/.magra/snarc/memory.sqlite` に保存され、重要な観測、パターン、project facts を再利用します。

## 設定と保存場所

- Global compatibility settings path: `~/.reasonix/config.json`
- Project compatibility directory: `<project>/.reasonix/`
- MAGRA SNARC memory: `<project>/.magra/snarc/memory.sqlite`
- MyGRACE indexes: `docs/graph-index.xml`、`docs/plan-index.xml`、`docs/verification-index.xml`

## Upstream Attribution

MAGRA is built from and remains compatible with the upstream DeepSeek-Reasonix / Reasonix base runtime. Upstream attribution is preserved in [NOTICE.md](./NOTICE.md).

## License

MIT。詳しくは [LICENSE](./LICENSE) を参照してください。
