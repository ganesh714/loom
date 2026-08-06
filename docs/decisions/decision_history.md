# Architecture & Design Decision History

This document tracks key decisions and guidelines established during development to maintain consistency and provide historical context.

---

## 2026-08-06: AI Agent Diagram Layout & Styling

*   **Database Shape Enforcement:** AI was occasionally rendering databases as rectangles because it was defaulting to 'box' for processing nodes. Added explicit `Database/Storage nodes MUST use type 'database'` to `AIAgentPrompts.java` to enforce the cylinder shape.
*   **Proximity Placement for Cross-cutting Nodes:** Nodes like 'Network' or 'Security' that connect to multiple vertical layers (Frontend & Backend) were being placed at the very bottom of diagrams, causing long intersecting lines. Added a `PROXIMITY RULE` to position them horizontally on the sides (`col 1` or `col -1`) to minimize line crossing and improve visual flow.
*   **Connector Color Uniformity (with Subtle Shades):** Standardized connectors to a uniform Blue Grey family (`#37474F`, `#455A64`, `#546E7A`, `#607D8B`). A subtle palette of different shades of the exact same base color maintains a professional, uniform aesthetic while providing visual distinction for intersecting lines.
*   **Properties Panel Syncing:** Cleaned up the `SidePanel.tsx` shape dropdown. Removed duplicate alias options (`rectangle`, `terminator`) to prevent user confusion, consolidating them into their native `box` and `pill` counterparts. Updated the backend mapper `mapNodeTypeAlias` to handle these aliases.
*   **Shape Dimension Sizing:** The backend `VirtualCanvasApplicator` was overriding smaller shapes (`pill`, `rectangle`) to a forced 60px minimum height due to a hardcoded 40px vertical padding. Replaced with dynamic padding based on the shape's base height so they correctly default down to 130x40/130x50.

---

## 2026-08-07: Semantic Shape Diversity for AI Agent

*   **Rich Shape Vocabulary:** The 3-pass AI agent was defaulting every node to a boring `box` shape because the prompts only guided it to use 4 types (diamond, pill, database, box). Expanded the SHAPE RULES in both `SEMANTIC_PROMPT` and `EXECUTE_PROMPT` to include the full library of 12+ shapes: `box`, `pill`, `diamond`, `database`, `cloud`, `server`, `browser`, `cylinder`, `component`, `queue`, `document`, `mobile`, `rounded-rect`. Each shape is now mapped to a semantic category (e.g., Cloud/Internet → `cloud`, Server/Infrastructure → `server`, Client/Browser → `browser`, Queue/Buffer → `cylinder`, Service/Microservice → `component`, API/Gateway → `rounded-rect`).
*   **Expanded Node Type Alias Mapper:** Updated `mapNodeTypeAlias` in both backend (`VirtualCanvasApplicator.java`) and extension (`nodeTypeMapper.ts`) to handle ~40 aliases (e.g., `internet` → `cloud`, `host` → `server`, `webapp` → `browser`, `broker` → `cylinder`, `microservice` → `component`). This ensures LLM-hallucinated type names gracefully resolve to valid frontend shape renderers.
*   **Key Principle:** Diagrams should be visually informative — the shape itself should communicate the entity's purpose at a glance without reading the label. A database should look like a cylinder, a server should have rack lines, a browser should have a chrome bar, etc.

---

## 2026-08-07: First File Empty on Reopen Bug Fix

*   **Root Cause:** When the app loads, it fetches project metadata from `/api/projects` (which returns `nodes: []`), then only called `setActiveFileId(...)` but never fetched the actual file content. The first file's canvas appeared empty until the user manually switched away and back.
*   **Fix:** Added an explicit fetch of `/api/files/{firstFileId}` during the initial project load in `DiagramContext.tsx` to load the first file's nodes immediately.

---

## 2026-08-07: Connector Offset Percentage Sync

*   **Root Cause:** Two systems managed connector anchor positions independently: (1) the backend's `spreadOverlappingAnchors` computed absolute pixel offsets for spread lines, but never wrote the percentage back into `startConnection.offset` / `endConnection.offset`; (2) the Properties Panel read `offset ?? 50`, always showing 50% despite the line being visually offset.
*   **Fix:** After computing spread positions, the backend now converts pixel offsets back to percentages and writes them into the connection's `offset` field, keeping the panel perfectly in sync with the visual position on canvas.

---

## 2026-08-07: Web & Extension Sync — Shape Parity Across AI Modes

*   **Discovery:** The web app has TWO separate AI paths: (1) **"Generate" mode** (2-step, `AIPrompts.java`) uses `PASS1_SLD_PROMPT` + `PASS2_STYLE_PROMPT` — this already had a full shape vocabulary (cloud, server, browser, etc.) from day one. (2) **"Agent" mode** (3-pass, `AIAgentPrompts.java`) uses `SEMANTIC_PROMPT` + `LAYOUT_PROMPT` + `EXECUTE_PROMPT` — this was missing most shapes and defaulted to `box`.
*   **Fix:** Updated `AIAgentPrompts.java` EXECUTE_PROMPT shape rules to include the same 12+ shapes as the 2-step mode. Both modes now produce equally rich, visually diverse diagrams.
*   **Extension Sync:** All prompt, mapper, and applicator changes are mirrored between `AIAgentPrompts.java` (backend) ↔ `prompts.ts` (extension), `VirtualCanvasApplicator.java` ↔ `canvasApplicator.ts`, `mapNodeTypeAlias` (Java) ↔ `nodeTypeMapper.ts`. After every backend change, the extension must be updated to match.
*   **VS Code Extension Sidebar Prompts:** Discovered that the extension's chat participant (Sidebar) had its own hardcoded prompts (`_buildArchitectureInstruction` and `_buildDiagramInstruction` in `sidebarProvider.ts`) that were being sent to external agents like Copilot. These prompts only knew about `box`, `database`, `pill`, and `diamond`. Updated them to use the full 12+ shape vocabulary to ensure diagrams generated via Copilot/Gemini in VS Code are just as rich as those generated by the agent.
*   **Key Principle:** Any time AI prompts or canvas compilation logic changes in the backend, it MUST also be synced to the extension. The two codebases share the same 3-pass architecture and must produce identical output.
*   **Decision History Location:** Moved from `backend/docs/decisions/` to `arc/docs/decisions/` since decisions affect the entire Arc project (frontend + backend + extension), not just the backend.

