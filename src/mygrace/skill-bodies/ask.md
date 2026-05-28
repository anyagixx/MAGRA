---
name: mygrace-ask
description: "Answer a question about a MyGRACE project using lazy-loading indexes. Loads only relevant modules without burning context tokens."
---

Answer a question about the current MyGRACE project.

## Process — LAZY NAVIGATION (CRITICAL)

### Step 1: Load Index Only
Read **ONLY** `docs/graph-index.xml` (≤100 lines). This tells you every module that exists.
- **DO NOT** read `docs/knowledge-graph.xml` (monolithic, too large)
- **DO NOT** read all module files — you don't need them yet

### Step 2: Identify Relevant Modules from Index
From graph-index.xml, find modules related to the question:
- Match by NAME, TYPE, PATH, DEPENDS
- Note the module IDs (e.g., M-AUTH, M-CHATS)

### Step 3: Read Only Relevant Per-Module Files
For each relevant module:
- Read `docs/modules/M-XXX.xml` (30-80 lines each)
- Read `docs/verification/V-M-XXX.xml` if question is about behavior/testing
- **DO NOT** read non-relevant modules

### Step 4: If CLI Available
Use `mygrace module find <query> --path <root>` to resolve module IDs from names/paths
Use `mygrace module show M-XXX --path <root>` for structured module output (saves tokens vs raw XML)

### Step 5: Dive Into Code If Needed
- Use the PATH from graph-index.xml to locate source files
- Read MODULE_CONTRACT and relevant START_BLOCK/END_BLOCK sections

### Step 6: Answer
Provide answer grounded in actual artifacts. Cite which modules/files you used.

## Important
- **Always start with graph-index.xml** — never skip it
- **Never read monolithic XML files** — they don't exist in MyGRACE
- **Read only modules relevant to the question** — don't preload everything
- If info isn't in artifacts, say so. Suggest `/mygrace:*` skills if changes needed.
