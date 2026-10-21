# Changelog (CHANGELOG.md)

All notable changes to Progress Den will be documented in this file.

## [Add-on Pack 2: Productivity, Developer Tools & Quality of Life] - 2026-10-20

### Added
- **Sub-phase B1: Productivity Core (Undo, Tags, Command Palette)**:
  - In-memory 20-action undo stack (`src/core/undo.ts`) with global `Ctrl+Z` listener and 8-second animated toast (`UndoToast.tsx`) with 1-click restore.
  - Multi-entity tagging system (`tags`, `taggings` Dexie tables, `tagRepo.ts`) with color palettes, entity picker (`TagPicker.tsx`), and multi-tag filtering (`TagFilterBar.tsx`).
  - Unified command and search palette (`SearchModal.tsx`) with fuzzy matching (`commandMatch.ts`), recency scoring, and `?` keyboard shortcuts reference modal.
  - Pomodoro focus timer (`FocusTimer.tsx`) with crash recovery in `localStorage`, 25m/50m/custom blocks, and auto-logging to `timeLogs` Dexie table.
  - Soft-delete Trash Bin (`trashRepo.ts`, `TrashPage.tsx`) with 30-day auto-purge warning, batch restoration, permanent deletion, and empty trash.
- **Sub-phase B2: Analytics & Stats**:
  - Time metrics dashboard (`StatsPage.tsx`, `timeStats.ts`): estimated vs. actual time tracking, accuracy ratio, 30-day SVG bar chart, and automatic estimate correction factor.
  - 52-week activity heatmap (`streak.ts`): 364-day GitHub-style SVG grid with streak calculation, rest day forgiveness, and freeze day support.
- **Sub-phase B3: Deadline & Planning Tools**:
  - Deadline slack calculator (`deadlineMath.ts`): comfortable/tight/overdue classification, priority triage view (`must`/`should`/`could`), and plan compressor engine.
  - Weekly review wizard (`WeeklyReviewPage.tsx`, `weeklyStats.ts`): aggregated facts (parts completed, focus time, streak, bugs closed, decisions logged, dev log snippets), 1-click review prompt generation, schedule adjustment preview, and memory update.
- **Sub-phase B4: Developer Tools**:
  - Reusable checklist templates and instances (`checklists`, `checklistTemplates`, `checklistItems` tables, `checklistRepo.ts`, `ChecklistsSection.tsx`). Pre-seeded with Code Quality, Pre-Flight Deploy, and PR Review templates.
  - Bug tracking system (`bugs` table, `bugRepo.ts`, `BugsSection.tsx`): severity, reproduction steps, debug prompt generator, attempt history, and 1-click schedule as daily part.
  - Quick Dev Log (`devLog` table, `devLogRepo.ts`): timestamps, snippet attachments, and export to markdown.
- **Sub-phase B5: Repo Context & Code Tools**:
  - Local repository folder context reader (`RepoContextModal.tsx`, `repoFilesRepo.ts`, `repoTree.ts`, `secretCheck.ts`): directory import, indented tree visualizer, security guard excluding `.env`, private keys, and binaries, with 5M character budget meter.
  - Clean line diff viewer (`diff.ts`).
  - 10 new prompt templates (`templates.ts`): `walkthrough`, `triage`, `weekly_review`, `checklist_review`, `adr`, `readme`, `commit`, `release_notes`, `report`, `standup`.
  - Upgraded prompt builder (`promptBuilder.ts`) with `# SOURCE`, `# TREE`, `# FILES`, `# TAGS` blocks, and strict 5-tier token trimming hierarchy.

## [Add-on 1: Walkthrough Import - Sub-phases A1, A2, A3 Complete] - 2026-10-20

### Added
- **Walkthrough Import Modal (`WalkthroughImportModal.tsx`)**:
  - 3 tabs: YouTube Chapters (description timestamp parser & even-slice fallback), Paste Text (5-rule deterministic transcript & notes splitter), and LLM Prompt (structured JSON generator).
  - Editable preview table with multi-row selection, merge, split, reorder, rename, and duration editing.
  - Direct transactional scheduling into active plan with rest day rules.
- **Today View Walkthrough Integration (`TodayPage.tsx`)**:
  - Dedicated Walkthrough Card with title, time range, "Open at this time" YouTube deep-link, and "Where I stopped" bookmarking field.
  - Privacy-conscious inline video player (`youtube-nocookie.com/embed` strictly off by default).
  - Collapsible transcript source excerpt and prompt auto-injection badge.
- **Prompt Builder `# SOURCE` Block (`promptBuilder.ts`)**:
  - Injects walkthrough title, URL, timestamp interval, and cleaned transcript excerpt directly into LLM prompts.
- **YouTube ID Parser (`youtubeId.ts`)**:
  - Full support for extracting 11-character video IDs across `watch?v=`, `youtu.be/`, `shorts/`, `embed/`, `live/`, raw IDs, and complex query parameters.
  - Safe on junk input, empty strings, and non-YouTube URLs without throwing.
- **Chapter Parser (`chapterParser.ts`)**:
  - Robust parser for YouTube descriptions handling `0:00 Intro`, `00:00 - Intro`, `1:02:15 Deploying`, `- 12:30 | Testing`, `1. 05:10 Setup`, `(3:45) Styling`, and trailing timestamps.
  - Automatic time calculation in seconds, hours > 59 minutes, sorting out-of-order timestamps with warnings, deduplication, and non-zero start warnings.
  - Computes `sourceStart` and `sourceEnd` for each chapter.
- **Even Time Slicer (`evenSplit.ts`)**:
  - Deterministic fallback when no chapters are present to slice video into equal parts titled `Part N (mm:ss to mm:ss)` covering 100% of duration with no gaps and no overlaps.
- **Deterministic Text Splitter (`textSplitter.ts`)**:
  - Prioritized 5-rule splitter for transcripts, web pages, and notes:
    1. Markdown headings (`#`, `##`, `###`)
    2. Step / Part / Lesson / Chapter lines
    3. Numbered/lettered lists ($\ge 3$ items)
    4. Transcript timestamps grouped into $N$-minute buckets
    5. Sentence boundary size splitting
  - Automatic transcript text cleaning for excerpts (removes inline timestamps and whitespace while preserving start time).
  - High performance: processes 100,000 characters in $< 100\text{ms}$.
- **Dexie Version 2 Upgrade & Schema Migration**:
  - Added `walkthroughs` table (`++id, projectId`) storing `type`, `url`, `videoId`, `title`, `description`, `rawText`, `importedAt`.
  - Extended `Part` with `walkthroughId`, `sourceStart`, `sourceEnd`, `sourceExcerpt`, `sourceLabel`, and `stoppedAt`.
  - Upgraded database seamlessly while preserving all existing version 1 data.
- **Walkthrough Repository (`walkthroughRepo.ts`)**:
  - Full CRUD operations with 100,000 character capping for `rawText` and cascade unlinking.
  - Integrated into `projectRepo.deleteCascade`.
- **Backup & Export Coverage**:
  - Included `walkthroughs` in whole-database backup JSON and restore (`backup.ts`).
  - Added walkthrough and part source time range metadata to Markdown export and JSON export (`exporter.ts`).
  - Updated `planImport.ts` schema to support `source_start`, `source_end`, `source_excerpt`, and `source_label`.
- **Test Coverage**:
  - Added 35 new tests across `youtubeId.test.ts`, `chapterParser.test.ts`, `evenSplit.test.ts`, `textSplitter.test.ts`, and `walkthroughData.test.ts`. Total: **70 unit tests passing**.

## [Phase 4: Polish, Search, Backups & Release] - 2026-10-20

### Added
- **Global Search Palette (`Ctrl+K` / `Cmd+K`)**:
  - Integrated client-side fuzzy search engine ([`search.ts`](file:///c:/Users/deban/Desktop/vibe_coding_projects/src/core/search.ts)) powered by `MiniSearch`.
  - Indexes all project entities: projects, sections, parts, decisions, and reference links/docs.
  - Interactive command palette modal ([`SearchModal.tsx`](file:///c:/Users/deban/Desktop/vibe_coding_projects/src/components/SearchModal.tsx)) with keyboard navigation (up/down arrows, Enter to jump, Escape to close).
  - Quick-search trigger buttons added to both the desktop sidebar and mobile header.

- **Project Reference Links & Pasted Documentation Tab**:
  - Dedicated "Links & Docs" tab in project workspace with full CRUD support ([`linkRepo.ts`](file:///c:/Users/deban/Desktop/vibe_coding_projects/src/db/repos/linkRepo.ts)).
  - Enforced 20,000-character ceiling per item for pasted documentation with live character counting.
  - Automatic prompt injection: saved reference links and pasted specifications are cleanly formatted into daily prompts under `# RELATED`.

- **Native Folder Auto-Backup (File System Access API)**:
  - Added folder-based backup mechanism ([`autoBackup.ts`](file:///c:/Users/deban/Desktop/vibe_coding_projects/src/core/autoBackup.ts)) using `window.showDirectoryPicker()`.
  - One-click "Save Backup to Folder Now" writes timestamped `.json` database files directly to user's chosen local directory.
  - Built-in weekly backup audit: automatically triggers reminder notices if no backup has occurred within 7 days.

- **Daily Check-In Reminders & Browser Notifications**:
  - Native Web Notification API integration ([`notifications.ts`](file:///c:/Users/deban/Desktop/vibe_coding_projects/src/core/notifications.ts)).
  - Configurable reminder time (e.g. 09:00 AM) with automatic morning checks when the app or tab is open.
  - In-app test notification trigger and permission status indicator.

- **PWA Installation & Mobile Polish**:
  - Standalone PWA install banner and sidebar button hooked into the browser's `beforeinstallprompt` event.
  - Touch-friendly navigation targets ($\ge 44\text{px}$) across all screens and bottom mobile navigation bar.
  - 4 additional unit tests in `src/tests/phase4.test.ts` (35 unit tests passing across 7 suites).

## [Phase 3: Scheduling Intelligence and Import] - 2026-10-20

### Added
- **Intelligent Missed-Day Recovery Flow**:
  - Pure scheduler logic ([`missedDays.ts`](file:///c:/Users/deban/Desktop/vibe_coding_projects/src/core/missedDays.ts)) for resolving overdue work via 4 strategies:
    1. **Shift Schedule**: Pushes all remaining unfinished parts forward to start tomorrow, strictly respecting rest cadence rules.
    2. **Merge into Today**: Absorbs the missed part's steps and estMinutes directly into today's active part, marking the missed part skipped.
    3. **Skip & Log**: Marks the missed part as skipped with a note and appends a skipped milestone note into project memory.
    4. **Re-plan with AI**: Generates a re-plan prompt with remaining parts, deadline, and user feedback; imports revised plan JSON.
  - Automatic detection banner and [`MissedDayModal`](file:///c:/Users/deban/Desktop/vibe_coding_projects/src/components/MissedDayModal.tsx) wired globally into [`Layout.tsx`](file:///c:/Users/deban/Desktop/vibe_coding_projects/src/components/Layout.tsx).

- **Resilient AI Plan Import & Messy LLM Auto-Fix**:
  - LLM response JSON importer ([`planImport.ts`](file:///c:/Users/deban/Desktop/vibe_coding_projects/src/core/planImport.ts)) with robust parsing:
    - Strips markdown code fences (` ```json `), extracts balanced JSON structures, cleans control characters, fixes smart quotes (`“`, `”`, `‘`, `’`), removes trailing commas, auto-closes unclosed brackets/braces, and extracts object array elements even from partially truncated text.
  - Modal UI ([`PlanImportModal.tsx`](file:///c:/Users/deban/Desktop/vibe_coding_projects/src/components/PlanImportModal.tsx)) with live validation preview table showing detected sections or parts before committing to Dexie IndexedDB.
  - Direct integration into Sections tab ("Generate Breakdown Prompt" + "Paste AI Breakdown") and Daily Plan tab ("Generate AI Plan Prompt" + "Paste AI Plan").

- **Section Dependency DAG & Scheduling Conflict Warnings**:
  - Section dependency tracking via `sectionDeps` table with multi-dependency selection in section create and edit dialogs.
  - Pure dependency checker ([`dependencies.ts`](file:///c:/Users/deban/Desktop/vibe_coding_projects/src/core/dependencies.ts)) identifying uncompleted prerequisite sections.
  - Visual lock badges and prerequisite tags on section cards in both List and Kanban views.
  - Conflict warning badges with lock icon on scheduled parts (`SortablePartItem`) when a part is scheduled before its section's prerequisite sections are completed.
  - Dependency conflict alert banner in Today's Part screen.

- **Plan Modes & Schedule Revision**:
  - Plan Mode switcher (`Plan by me` | `AI Plan` | `Hybrid`) in the Daily Plan tab toolbar with live Dexie persistence.
  - "Revise Plan" button in Daily Plan toolbar that opens a feedback prompt generator powered by the `revise_plan` template to get revised JSON from an LLM.

- **Prompt Templates Enhancement**:
  - Clickable variable chips (`{{project_name}}`, `{{part_title}}`, `{{rolling_summary}}`, etc.) in [`TemplatesPage.tsx`](file:///c:/Users/deban/Desktop/vibe_coding_projects/src/pages/TemplatesPage.tsx) that insert directly at the cursor position in the template textarea.

- **Token Budget Trimming Guarantee**:
  - Deterministic trimming priority order: drops `RELATED` first $\rightarrow$ truncates `MEMORY` preserving recent characters $\rightarrow$ drops `PLAN_POSITION` $\rightarrow$ preserves essential `TASK`, `RULES`, and `OUTPUT_FORMAT`.
  - Comprehensive unit test suite (`src/tests/phase3.test.ts`) covering all 4 missed-day strategies, dependency conflict logic, messy LLM import auto-fix, and token trimming. All 31 tests passing!

### Added
- **Interactive Daily Plan Drag-and-Drop Reordering**:
  - Integrated `@dnd-kit/core` and `@dnd-kit/sortable` with vertical list strategy for reordering scheduled parts.
  - Live date recalculation immediately computes updated calendar dates around rest rules upon drag drop.
  - Plan cadence configuration drawer (start date, deadline, parts per day, hours per day, every-N rest days, specific weekdays, difficulty ramp).
  - Live schedule slack calculator with warning badge when slack turns negative against target deadline.
  - "Split Section into Parts" modal: breaks any section into $N$ sequential day-sized parts with automatic date scheduling.

- **Response Handling & Code Block Extraction**:
  - Pure function markdown code fence extractor ([`codeExtractor.ts`](file:///c:/Users/deban/Desktop/vibe_coding_projects/src/core/codeExtractor.ts)) extracting language, title, and code blocks with one-click copy.
  - Response review system with verdicts (`accepted`, `rejected`, `needs_revision`), 1-to-5 star rating, and feedback notes.
  - Dedicated storage in `responses` and `snippets` tables.

- **The Rolling Memory Loop & Decisions Integration**:
  - End-of-day summarizer flow: generates LLM summarization prompt (`# ROLLING SUMMARY` + today's part + accepted response) to compress daily output into at most 8 bullets.
  - One-click copy for the summarize prompt; paste back updates `memory` table and archives the previous version in `memoryHistory` (retains last 10 versions).
  - Version history drawer in Memory & Decisions tab allowing inspection and one-click rollback to any of the last 10 versions.
  - Active architectural decisions log automatically formatted into prompts under `# DECISIONS: Do not contradict these`.

- **Context Loop Enhancements**:
  - Mid-part Handoff prompt generator ("Continue from here" for fresh chats mid-part).
  - Follow-up / revision prompt generator incorporating previous prompt, response, and critique feedback.
  - Unit tests verifying 30-day plan with every-3rd-day rest calculation, multi-snippet code extraction, and prompt memory inclusion.

## [Phase 1: Foundation and Manual Workflow] - 2026-10-20

### Added
- **Foundational Architecture**:
  - Vite + React 18 + TypeScript + Tailwind CSS setup.
  - Class-based dark mode toggle (Dark / Light) with system preference detection and localStorage persistence.
  - React Router configuration with `HashRouter` for zero-configuration static hosting.
  - PWA configuration with `vite-plugin-pwa`, standalone app manifest, 192px/512px icons, and Workbox offline precaching.
  - Automated GitHub Actions deployment pipeline (`.github/workflows/deploy.yml`).

- **Local Database (Dexie IndexedDB Schema v1)**:
  - Tables for `projects`, `links`, `sections`, `sectionDeps`, `plans`, `parts`, `partSteps`, `memory`, `memoryHistory`, `decisions`, `templates`, `prompts`, `responses`, `snippets`, and `settings`.
  - Transactional cascade delete logic across project, section, and part hierarchies.
  - Automatic template seeding with 12 default prompt templates.

- **Core Pure Logic Modules (`src/core/`) & Vitest Unit Tests**:
  - `scheduler.ts`: Date scheduling around rest rules (every-n days, weekdays, custom dates, 2 parts per day, leap year, month boundaries, and rescheduling).
  - `promptBuilder.ts`: Modular markdown prompt blocks (ROLE, PROJECT, RULES, MEMORY, DECISIONS, PLAN_POSITION, RELATED, TASK, OUTPUT_FORMAT, END_INSTRUCTION), minimal/standard/full context levels, and token budget trimming.
  - `tokenEstimate.ts`: Token estimator (ceil(chars/4)) with 4k, 8k, 32k, 128k, 200k limit presets and color coding (green/yellow/red).
  - `planImport.ts`: Robust JSON parser with code fence stripping, balanced JSON extraction, auto-fix for smart quotes and trailing commas, and Zod schemas.
  - `exporter.ts`: Human-readable Markdown and full-fidelity JSON project exporters.

- **Screens & UI Workflows**:
  - **Dashboard**: Active projects with live progress bars, today's part banner, streak counter, overdue part metrics, and backup reminder banner.
  - **New Project Wizard**: Multi-step wizard with core info (name, description, goal), technical constraints & AI rules, and options to create by hand, generate breakdown prompt, or pick from 5 starter archetypes (Web App, Research Paper, Indie Game, Business Plan, Study Plan).
  - **Projects List**: Search bar, status filters (active, paused, done, archived), project cards with progress bars, and delete cascade confirmation modal.
  - **Project Detail View**: Multi-tab workspace with Overview, Sections (list & kanban view with priority and status tags), Daily Plan (add part, mark done, recalculate schedule dates), Memory & Decisions (rolling summary, glossary, decisions log), and Prompt History.
  - **Today Screen (Context Loop Core)**: Part checklist with interactive step completion, 3-step prompt execution stepper (Generate prompt with live preview, token counter, and one-click copy; Paste LLM response with verdict buttons; Finish Day with daily note and memory append).
  - **Calendar**: Interactive monthly view displaying work days, rest markers, done/planned/skipped parts, and day details drawer.
  - **Templates**: Prompt template editor, reset to default, unknown variable detector, and variable reference table.
  - **Settings & Data Safety**: Storage quota usage estimate, eviction protection request (`navigator.storage.persist()`), export backup JSON (`progress-den-backup-YYYY-MM-DD.json`), and restore backup with Zod schema validation.
