# Architectural Decisions Log (DECISIONS.md)

This document tracks all foundational architecture and technology choices made for ProjectPilot Web.

## Decision 1: Target Architecture — Installable Web App (PWA) with Offline-First IndexedDB
- **Context**: The user specified the revised implementation plan transitioning ProjectPilot into an installable website (PWA) that runs 100% locally in the browser with zero backend, zero AI API keys, and zero telemetry.
- **Choice**: Scaffolded Vite + React 18 + TypeScript + Tailwind CSS with `vite-plugin-pwa` generating full offline Workbox precaching and standalone app manifest.
- **Rationale**: Eliminates OS toolchain dependencies (Rust, MSVC C++ Build Tools), allows instant execution on Windows, macOS, Linux, and mobile devices, and guarantees data privacy.

## Decision 2: Local Storage Engine — Dexie.js (IndexedDB)
- **Context**: Need fast, reliable, relational-style queries, schema versioning, transaction support, and reactive live UI updates without a native SQLite binary.
- **Choice**: Dexie.js v4 with `dexie-react-hooks` (`useLiveQuery`).
- **Rationale**: Clean transactional cascades (project -> sections -> parts -> steps), reactive UI updates on data changes, zero native compiling risks, and full offline persistence.

## Decision 3: Routing — HashRouter
- **Context**: Static site deployment on GitHub Pages, Netlify, or local static files without requiring server rewrite / SPA fallback rules.
- **Choice**: React Router with `HashRouter` (`#/project/1`, `#/today`, etc.) and `base: './'`.
- **Rationale**: Zero 404 errors on page reloads across all static hosts and subdirectories.

## Decision 4: Dependency Alignment — Vite 6 + React 18
- **Context**: `vite-plugin-pwa` and `@dnd-kit` require tested peer dependency stability with Vite and React.
- **Choice**: Locked `vite@^6.2.0` with `@vitejs/plugin-react@^4.3.4` and `react@^18.3.1`.
- **Rationale**: Complete compatibility, zero dependency resolution conflicts (`npm ERESOLVE`), and high build speed.

## Decision 5: Atomic Cascading Deletion in Transactions
- **Context**: Deleting a project, section, or part should never leave orphaned records in `links`, `parts`, `partSteps`, `memory`, or `prompts`.
- **Choice**: Wrapped all deletion operations in multi-table Dexie transactions (`db.transaction('rw', ...)`).
- **Rationale**: Guarantees database integrity.

## Decision 6: Backup Schema Validation with Zod
- **Context**: Restoring corrupted or incompatible JSON files could brick browser storage.
- **Choice**: Strict Zod schema validation in `src/db/backup.ts` before clearing or updating any IndexedDB table.
- **Rationale**: Prevents data corruption.

## Decision 7: Drag-and-Drop Strategy with @dnd-kit
- **Context**: Reordering parts in the daily plan requires an accessible, touch-friendly library compatible with React 18.
- **Choice**: Used `@dnd-kit/core` and `@dnd-kit/sortable` with vertical list strategy and pointer activation distance threshold.
- **Rationale**: Smooth 60 FPS drag transitions, touch device support, zero React 18 conflicts, and instant order recalculation.

## Decision 8: Memory History Retention Window (Last 10)
- **Context**: Storing endless full memory snapshots could bloat browser IndexedDB storage over months of daily updates.
- **Choice**: Maintained a FIFO rolling window of exactly 10 past versions in `memoryHistory`.
- **Rationale**: Keeps database size negligible while providing ample disaster recovery rollback options.

## Decision 9: Resilient Multi-Stage Parsing for LLM Responses
- **Context**: Real-world LLM outputs frequently include conversational preambles ("Here is your JSON plan:"), code block markdown fences (` ```json `), unclosed curly brackets/square braces due to max token truncation, and trailing commas.
- **Choice**: Created a multi-stage parser in [`planImport.ts`](file:///c:/Users/deban/Desktop/vibe_coding_projects/src/core/planImport.ts) that strips fences, extracts balanced bracket spans, cleans invalid control characters, fixes smart punctuation, removes trailing commas, auto-closes missing brackets, and falls back to regex-based object extraction for partial array streams.
- **Rationale**: Ensures the user never encounters a hard crash or cryptic parse failure when copying and pasting responses from any LLM model.

## Decision 10: Pure-Function Scheduler and Dependency Graph Architecture
- **Context**: Missed-day recovery and section dependency validation must run deterministically, fast, and independently testable without database side-effects during planning.
- **Choice**: Structured [`dependencies.ts`](file:///c:/Users/deban/Desktop/vibe_coding_projects/src/core/dependencies.ts) and [`missedDays.ts`](file:///c:/Users/deban/Desktop/vibe_coding_projects/src/core/missedDays.ts) as pure functions that accept plain in-memory arrays and return transformed parts or dependency status objects.
- **Rationale**: Enables comprehensive unit testing in Vitest with zero mock databases, guarantees instantaneous calculation in UI render cycles, and separates core business rules from persistence layers.

## Decision 11: Priority-Ordered Prompt Trimming
- **Context**: When user contexts approach LLM token budget limits, naive truncation might cut off the task checklist, safety rules, or expected JSON schema.
- **Choice**: Enforced strict trimming order: `RELATED` is dropped first $\rightarrow$ `MEMORY` is truncated to fit $\rightarrow$ `PLAN_POSITION` is dropped $\rightarrow$ `TASK`, `RULES`, and `OUTPUT_FORMAT` are protected and never dropped.
- **Rationale**: Ensures the LLM always receives the critical instructions and required output structure needed to generate correct, executable code.

## Decision 12: Client-Side Fuzzy Search Engine with MiniSearch
- **Context**: Global search (`Ctrl+K`) needs instantaneous indexing and prefix/fuzzy search across five different entity types without hitting any backend API.
- **Choice**: Implemented `MiniSearch` in [`search.ts`](file:///c:/Users/deban/Desktop/vibe_coding_projects/src/core/search.ts) with custom weights (boosted on title and project name) and structured metadata stores.
- **Rationale**: Zero external network requests, sub-millisecond query execution, and seamless client-side navigation.

## Decision 13: Local Directory Auto-Backup via File System Access API
- **Context**: Relying exclusively on manual file download exports runs the risk of users forgetting to back up their data before browser cache evictions.
- **Choice**: Integrated `window.showDirectoryPicker()` to save timestamped `.json` snapshots directly to user's selected disk folder, combined with an automated 7-day overdue audit banner.
- **Rationale**: Eliminates download prompt friction while preserving offline-first privacy.

## Decision 14: Deduplicated Daily Reminders via Browser Notification API
- **Context**: Users need reminders to execute their daily part without running persistent background daemons or cloud cron jobs.
- **Choice**: Implemented proactive notification triggers in [`notifications.ts`](file:///c:/Users/deban/Desktop/vibe_coding_projects/src/core/notifications.ts) using the Web Notification API, storing `last_notified_date` in IndexedDB to prevent multiple alerts on the same day.
- **Rationale**: Clean, unobtrusive user experience that functions completely offline within the browser tab or PWA window.

## Decision 15: Client-Side Walkthrough Extraction without Web Scraping
- **Context**: Users want to convert YouTube tutorials, blog posts, and courses into daily parts, but browsers enforce CORS and privacy forbids backend proxies.
- **Choice**: Built pure client-side deterministic parsers ([`youtubeId.ts`](file:///c:/Users/deban/Desktop/vibe_coding_projects/src/core/youtubeId.ts), [`chapterParser.ts`](file:///c:/Users/deban/Desktop/vibe_coding_projects/src/core/chapterParser.ts), [`evenSplit.ts`](file:///c:/Users/deban/Desktop/vibe_coding_projects/src/core/evenSplit.ts), [`textSplitter.ts`](file:///c:/Users/deban/Desktop/vibe_coding_projects/src/core/textSplitter.ts)) that operate directly on user-pasted descriptions and transcripts with zero network calls.
- **Rationale**: 100% private, resilient against YouTube layout changes or scraping blocks, zero server infrastructure.

## Decision 16: Dexie Version 2 Upgrade with Storage Safeguards
- **Context**: Adding walkthrough metadata and part source links requires extending schema without breaking or migrating existing version 1 databases.
- **Choice**: Implemented `version(2)` with `walkthroughs` table and optional fields on `Part` (`walkthroughId`, `sourceStart`, `sourceEnd`, `sourceExcerpt`, `sourceLabel`, `stoppedAt`), backed by a 100,000-character ceiling on raw walkthrough text and 6,000-character cap on part excerpts.
- **Rationale**: Preserves zero-data-loss upgrades, backward compatibility with older v1 backups, and prevents IndexedDB quota bloat.

## Decision 17: Dexie Version 3 Upgrade for Add-on Pack 2
- **Context**: Pack 2 introduces 10 new tables (`tags`, `taggings`, `timeLogs`, `milestones`, `weeklyReviews`, `checklistTemplates`, `checklists`, `checklistItems`, `bugs`, `repoFiles`, `devLog`) plus soft-delete metadata (`deletedAt`, `deleteBatchId`) and priority ranking (`must` | `should` | `could`).
- **Choice**: Implemented `version(3)` with automated seeding for starter checklist templates (Code Quality, Pre-Flight Deploy, PR Review). Maintained backup restore backward compatibility via Zod `.default([])` on all newly added collections.
- **Rationale**: Clean, modular table structure with index keys for instant live querying via Dexie hooks, preserving historical database continuity.

## Decision 18: Soft-Delete with Batch Restoration & In-Memory Undo Stack
- **Context**: Accidental deletion of parts, checklists, or bugs needs instant recovery without complicating database schemas or requiring cloud audit logs.
- **Choice**: Combined an in-memory 20-action undo stack (`undo.ts`) with global `Ctrl+Z` and 8-second toast, paired with durable soft-delete fields (`deletedAt`, `deleteBatchId`) stored in Dexie and managed through a dedicated Trash Page (`TrashPage.tsx`).
- **Rationale**: Provides instant short-term undo (within 8 seconds) and durable long-term recovery (trash bin), protecting users against accidental data loss.

## Decision 19: Privacy-Safe Local Repository Context Reader
- **Context**: Developers want their codebase structure and key source files injected into LLM prompts without uploading repositories to cloud services or violating offline privacy.
- **Choice**: Used the browser File System Access API (`showDirectoryPicker`) to read files locally, paired with a strict exclusion list (`secretCheck.ts`) that ignores `.env*`, `.git`, `node_modules`, `dist`, private keys, certificates, credentials, and binary assets, capped at a 5,000,000 character safety meter.
- **Rationale**: Full codebase awareness in client-side prompt engineering with zero security exposure and zero data leakage.

## Decision 20: 5-Tier Token Budgeting and Trimming Hierarchy
- **Context**: As projects accumulate repo trees, file excerpts, walkthrough transcripts, reference docs, and long-term memory, prompts can easily exceed LLM token limits (e.g. 8k, 16k, 32k, 128k).
- **Choice**: Enforced a deterministic trimming sequence in `promptBuilder.ts`:
  1. `FILES` block dropped first.
  2. `SOURCE` block dropped second.
  3. `RELATED` reference documentation dropped third.
  4. `MEMORY` rolling summary truncated to fit fourth.
  5. `PLAN_POSITION` dropped fifth.
  6. `TASK`, `RULES`, and `OUTPUT_FORMAT` are protected and never dropped.
- **Rationale**: Guarantees that the LLM always receives actionable execution directives and schema rules, even under the tightest context budgets.


