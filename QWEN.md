# MyGRACE Project Context: MAGRA

MAGRA uses MyGRACE lazy navigation. The product target is MAGRA: a Reasonix
based coding/chat agent with first-class MyGRACE skills, RTK command
compression, and SNARC memory.

## Always Start Here

- Modules: `docs/graph-index.xml`
- Phases: `docs/plan-index.xml`
- Verification: `docs/verification-index.xml`
- Source analysis: `docs/source-analysis-index.xml`
- Proposals: `docs/proposals-index.xml`

Never use monolithic `knowledge-graph.xml`, `development-plan.xml`, or
`verification-plan.xml`.

## Required Flow

Requirements -> Technology -> Plan -> Verification -> Contracts -> Code.

All managed source files need `MODULE_CONTRACT`, `MODULE_MAP`,
`CHANGE_SUMMARY`, function contracts where applicable, and semantic
`START_BLOCK_*` / `END_BLOCK_*` anchors.

## Runtime Direction

DeepSeek-Reasonix is the base. MyGRACE, RTK, and SNARC must integrate into it
without reducing their core capabilities:

- MyGRACE skills are exposed through the chat/web slash namespace
  `/mygrace:*`.
- RTK is used as the command-output compression layer for shell/tool execution.
- SNARC is used as the salience-gated memory and retrieval layer.

## CLI Hints

Use index commands when available:

```bash
rtk mygrace module index
rtk mygrace phase index
rtk mygrace verification index
rtk mygrace lint --path .
```
