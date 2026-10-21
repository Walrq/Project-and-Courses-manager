# QA Checklist & Manual Test Plan (QA.md)

Use this checklist to verify Progress Den behavior across desktop, tablet, and mobile browsers.

## 1. Foundation & Navigation
- [ ] **Initial Load**: App loads cleanly at `http://localhost:5173/` or static host with no console errors.
- [ ] **Theme Switching**: Click Sun/Moon icon in sidebar/top-bar. UI toggles smoothly between Dark and Light mode. Preference survives page reload.
- [ ] **Responsive Layout**:
  - Desktop: Sidebar visible on the left with active project selector and navigation links.
  - Mobile (<768px): Top bar with project title and theme toggle; bottom sticky tab bar with touch targets $\ge 44\text{px}$.
- [ ] **Offline PWA Support**:
  - Open Chrome DevTools -> Application -> Service Workers. Service worker is registered and active.
  - Toggle "Offline" in Network tab. Refresh page: app opens and runs fully offline.

## 2. New Project Wizard
- [ ] Click **"+ New Project"**.
- [ ] Step 1: Enter Name (e.g., "AI Desktop Assistant"), Description, and Goal. Click "Next".
- [ ] Step 2: Enter Constraints (e.g., "Offline-first, React, TypeScript") and AI Rules. Click "Next".
- [ ] Step 3:
  - Select "From Template" -> "Modern Web Application". Click "Create with Template".
  - Verify project is created, auto-selected as active project, and navigates to the project view with 7 prefilled sections.

## 3. Project Detail View & Sections
- [ ] **Overview Tab**: Edit description or goal; click "Save Changes". Toast confirms save. Reload page: changes persist.
- [ ] **Sections Tab**:
  - List View: Add a section "Core Testing". Set priority "High". Section appears in list.
  - Kanban View: Toggle to Kanban view. Drag or change status to "In Progress" or "Done". Column counts update live.
  - Click "Split into Parts" on any section. Specify 3 parts. 3 sequential parts are created and dated.
- [ ] **Daily Plan Tab & Drag-and-Drop (Phase 2)**:
  - Click "Plan Settings". Change cadence to "Every 3 days" (work 2, rest 1). Save. Dates recalculate live.
  - Set a deadline in the near future: verify Slack badge turns red with warning when negative.
  - Drag part #3 above part #1 using the grip handle. Drop it: order numbers update to #1, #2, #3 and planned dates re-sequence automatically.
  - Mark a part as Done via the circle checkbox. Title shows strikethrough and status updates to "done".

## 4. Today Screen (The Context Loop - Phase 2)
- [ ] Open **Today** tab.
- [ ] Today's scheduled part is shown with deliverable goal and checklist steps.
- [ ] Check off a checklist step. The change persists.
- [ ] **Step 1: Generate Prompt**:
  - Toggle context levels between Minimal, Standard, and Full.
  - Verify prompt preview updates with labeled markdown headings (`# ROLE`, `# PROJECT`, `# RULES`, `# MEMORY`, `# DECISIONS`, `# PLAN_POSITION`, `# TASK`, etc.).
  - Token counter shows estimated tokens with colored badge (green/yellow/red).
  - Click "Copy Prompt" (or press `Ctrl+Shift+C`). Toast confirms copy and prompt is in system clipboard.
- [ ] **Special Prompts**:
  - Click "Handoff Prompt" in header: modal pops up with "Continue from here" format with completed checklist steps and last output.
- [ ] **Step 2: Paste Response & Code Extraction**:
  - Switch to Step 2. Paste mock LLM output containing a code block (e.g. ```typescript ... ```).
  - Verify code block is automatically extracted into a snippet card with language badge and individual "Copy" button.
  - Set 5-star rating and select verdict: "Accepted" (or "Needs Revision" to trigger follow-up prompt).
  - Click "Save Response & Continue".
- [ ] **Step 3: Finish Day & Summarize Prompt**:
  - Switch to Step 3. Enter a 2-line summary in the note field.
  - Click "Generate Summarize Prompt".
  - Copy the summarize prompt and paste back mock 8-bullet summary in the input box.
  - Click "Save to Rolling Memory (Archiving Previous)". Toast confirms memory update and version archive.
  - Click "Complete Part & Finish Day". Part is marked done.
- [ ] **Tomorrow's Prompt Verification**:
  - Open the next scheduled part: verify its generated prompt visibly includes the newly updated rolling memory under `# MEMORY` and active decisions under `# DECISIONS`.
- [ ] **Memory History**:
  - In Project page -> "Memory & Decisions" tab, click "History (1)". Verify previous version is archived and can be reverted.

## 5. Month Calendar View
- [ ] Open **Calendar** tab.
- [ ] Verify scheduled parts appear on their assigned planned dates.
- [ ] Click a calendar day cell to open the day's drawer showing parts and goals.
- [ ] Navigate previous and next months using arrow buttons.

## 6. Prompt Templates
- [ ] Open **Templates** tab.
- [ ] Select "Daily Part Execution" or "Project Breakdown".
- [ ] Edit body text or add `{{part_title}}`.
- [ ] Type an unknown variable `{{random_variable}}`. Verify yellow notice identifies the unknown variable.
- [ ] Click "Reset Default". Confirm dialog restores original default template.

## 7. Settings, Backup & Restore
- [ ] Open **Settings** tab.
- [ ] Verify **Storage Usage** shows current IndexedDB megabytes and quota.
- [ ] Click **"Export Backup File (.json)"**. Browser downloads a file named `progress-den-backup-YYYY-MM-DD.json`.
- [ ] Open downloaded JSON in text editor: confirm all projects, sections, parts, and settings are present.
- [ ] Click **"Select Backup File to Restore"**. Upload the backup file. Confirm replacement dialog.
- [ ] Database reloads with 100% data fidelity.

## 8. Scheduling Intelligence & AI Import (Phase 3)
- [ ] **Missed-Day Overdue Dialog**:
  - Set a part's `plannedDate` to yesterday in Daily Plan or IndexedDB.
  - Refresh or navigate to Dashboard: overdue alert banner appears showing overdue items.
  - Click "Resolve Schedule": modal opens with 4 recovery strategies.
  - Test **Shift Schedule**: Remaining parts re-sequence starting tomorrow, preserving rest days.
  - Test **Merge into Today**: Missed part's steps and minutes merge into today's part, marking missed part skipped.
  - Test **Skip & Log**: Part is marked skipped and note is logged to memory.
  - Test **Re-plan with AI**: Generates a re-plan prompt with remaining parts list.
- [ ] **Messy LLM Plan & Breakdown Import**:
  - In Sections tab, click "Paste AI Breakdown".
  - Paste messy LLM response (wrapped in conversational text, markdown ```json code blocks, trailing commas, smart quotes).
  - Importer extracts and displays parsed sections in live preview table.
  - Click "Import Sections": sections appear in Sections tab.
  - In Daily Plan tab, click "Paste AI Plan".
  - Paste messy parts JSON with days and checklist steps.
  - Importer previews parts; clicking "Import Schedule" adds parts to the plan.
- [ ] **Section Dependency DAG & Conflict Lock Badges**:
  - Add Section A and Section B. Edit Section B: select Section A as "Depends On".
  - Section B displays "Depends on: Section A". If Section A is not done, Section B shows red "Blocked" lock badge.
  - In Daily Plan tab, schedule a part of Section B on the same date or earlier than unfinished Section A.
  - Part displays red "Blocked by: Section A" badge with lock icon.
  - In Today screen, if today's part is blocked, yellow "Dependency Notice" banner warns the user.
- [ ] **Plan Modes & Schedule Revision**:
  - In Daily Plan tab, switch between "Plan by me", "AI Plan", and "Hybrid". Mode persists.
  - Click "Revise Plan", enter revision feedback (e.g., "Add an extra test day").
  - Click "Generate Revision Prompt": generates complete prompt ready to paste to any LLM.
- [ ] **Clickable Variable Chips**:
  - In Templates tab, click on any variable chip (e.g. `{{project_name}}`).
  - Chip inserts `{{project_name}}` directly at current cursor position in template textarea.

## 9. Search, Links, Auto-Backup & Notifications (Phase 4)
- [ ] **Global Search (`Ctrl+K` / `Cmd+K`)**:
  - Press `Ctrl+K` (or `Cmd+K` on macOS) anywhere in the application.
  - Search command palette opens with auto-focused search input.
  - Type a query matching a project, section, part, decision, or link.
  - Use Up/Down arrow keys to highlight results; press Enter to navigate directly to the matched item.
  - Press Escape or click outside to dismiss the palette.
  - Click the search button in the sidebar or mobile top header to verify pointer accessibility.
- [ ] **Project Reference Links & Pasted Docs**:
  - In Project Detail view, open the **"Links & Docs"** tab.
  - Click "+ Add Link / Doc".
  - Enter a title, URL, note, and paste reference documentation text.
  - Verify live character counter shows `${count} / 20,000` and enforces max limit.
  - Save item. Card displays URL with clickable external link, note, and monospace text preview with 1-click "Copy" button.
  - Edit and Delete link items to verify CRUD persistence.
  - Open Today's Part: verify saved links are automatically formatted into the generated prompt under `# RELATED`.
- [ ] **Native Folder Auto-Backup (File System Access API)**:
  - In Settings tab, locate the "Auto-Save to Local Folder" section.
  - Click "Select Backup Folder" and grant permission to a directory on disk.
  - Click "Save Backup to Folder Now". Verify file `progress-den-backup-YYYY-MM-DD.json` is created on disk.
  - Verify last backup date updates to today.
  - Verify weekly backup reminder warning banner disappears once backed up.
- [ ] **Daily Check-In Reminders & Notifications**:
  - In Settings tab, toggle "Daily Check-In Reminders" to Enabled.
  - Browser prompts for notification permission; click "Allow". Permission status updates to `granted`.
  - Click "Test Notification": browser shows test notification *"Progress Den — Ready for Today's Work"*.
  - Change reminder time to desired hour/minute. Setting persists across reloads.
- [ ] **PWA Standalone Installation**:
  - In Chromium browsers, click "Install App" in sidebar or Settings.
  - Native installation prompt appears to install Progress Den as a standalone desktop/mobile app.
  - Verify all touch targets on mobile view are $\ge 44\text{px}$.

## 10. Walkthrough Import Parsers & Data Model (Add-on 1: Sub-phase A1)
- [ ] **YouTube URL & Video ID Parsing**:
  - Supported URL formats correctly resolve to 11-char IDs:
    - `https://www.youtube.com/watch?v=dQw4w9WgXcQ` -> `dQw4w9WgXcQ`
    - `https://youtu.be/dQw4w9WgXcQ` -> `dQw4w9WgXcQ`
    - `https://www.youtube.com/shorts/dQw4w9WgXcQ` -> `dQw4w9WgXcQ`
    - `https://www.youtube.com/embed/dQw4w9WgXcQ` -> `dQw4w9WgXcQ`
    - `https://www.youtube.com/live/dQw4w9WgXcQ` -> `dQw4w9WgXcQ`
    - Raw ID `dQw4w9WgXcQ` -> `dQw4w9WgXcQ`
  - Junk inputs, Vimeo URLs, and empty text return graceful errors without throwing.
- [ ] **Chapter Timestamp Parser**:
  - Accepts leading and embedded timestamp lines (`0:00 Intro`, `00:00 - Intro`, `1. 05:10 Setup`, `(3:45) Styling`, `- 12:30 | Testing`, `1:02:15 Deploying`, `120:30 Deep Dive`).
  - Handles emojis in titles and Windows `\r\n` line endings.
  - Out-of-order timestamps are re-sorted chronologically with a warning.
  - Duplicates are deduplicated with a warning.
  - Starts other than 0:00 trigger a non-zero start warning.
  - Computes `sourceStart` and `sourceEnd` for each chapter.
- [ ] **Even Slicing Engine**:
  - When no chapters exist, duration splits into equal non-overlapping slices titled `Part N (mm:ss to mm:ss)`.
  - Slice boundaries are continuous with no gaps and no overlaps.
- [ ] **Deterministic Text Splitter**:
  - Evaluates all 5 prioritized rules (Headings > Steps > Lists $\ge 3$ > Timestamps > Sentence sizes).
  - Cleans transcript text by stripping timestamps and normalizing whitespace while maintaining time boundaries.
  - Splits 100,000 characters in $< 100\text{ms}$.
- [ ] **Dexie Version 2 Upgrade & Storage Capping**:
  - Version 1 database upgrades to version 2 without loss of existing projects, sections, parts, or settings.
  - `walkthroughs` table holds walkthrough records with rawText capped at 100,000 characters.
  - Part entity supports `walkthroughId`, `sourceStart`, `sourceEnd`, `sourceExcerpt` (capped at 6,000 chars), `sourceLabel`, and `stoppedAt`.
  - Project cascade delete removes associated walkthrough records.
- [ ] **Backup & Export Round-Trip**:
  - Database JSON export includes `walkthroughs` table and Part source fields.
  - Database restore reloads `walkthroughs` cleanly with schema validation.
  - Markdown export includes Walkthrough Sources section and `[Source: mm:ss - mm:ss]` per part.

## 11. Walkthrough Modal & Today View Integration (Add-on 1 Complete)
- [ ] **Walkthrough Import Modal (`WalkthroughImportModal.tsx`)**:
  - Opens from Daily Plan tab ("Import Walkthrough" button).
  - Tab A (YouTube Chapters): parses description timestamps, generates preview parts.
  - Tab B (Paste Text): applies deterministic rule or allows manual rule selection; preview displays cleanly.
  - Tab C (LLM Prompt): copies prompt to clipboard and parses structured JSON reply.
  - Preview table: selection checkboxes, merge rows, split rows, rename parts, reorder.
  - Schedule CTA creates walkthrough record and transactional parts with correct `plannedDate` sequence.
- [ ] **Today View Walkthrough Card (`TodayPage.tsx`)**:
  - Appears automatically when current part has `walkthroughId` or source excerpt.
  - "Open at this time" link opens YouTube video at exact `sourceStart` timestamp in new tab.
  - "Inline Video" button toggles privacy-conscious embed (`youtube-nocookie.com/embed` off by default).
  - "Where I stopped" text input saves timestamp position (`Part.stoppedAt`) into IndexedDB.
  - Collapsible source excerpt displays formatted transcript excerpt.
  - Generated prompt includes `# SOURCE` section with title, URL, timestamp interval, and excerpt.

## 12. Productivity, Developer Tools & Quality of Life (Add-on Pack 2)
- [ ] **Global Undo Stack (`Ctrl+Z`) & Undo Toast**:
  - Delete an entity or change part status: 8-second toast appears with countdown bar.
  - Press `Ctrl+Z` or click "Undo": state rolls back immediately.
- [ ] **Tags & Multi-Tag Filtering**:
  - Open TagPicker on project, part, or bug: create new tag with color or assign existing tag.
  - Use TagFilterBar: multi-select tags to filter list views in real-time.
- [ ] **Command Palette (`Ctrl+K` / `?`)**:
  - Press `Ctrl+K`: search and action launcher opens with fuzzy match and keyboard navigation.
  - Press `?`: quick modal showing all global keyboard shortcuts appears.
- [ ] **Focus Timer (Pomodoro)**:
  - Focus timer appears in Today page header.
  - Start 25m or 50m block: counts down with pause/resume and sound chime toggle.
  - Crash recovery: page reload resumes timer from exact timestamp.
  - Completed focus sessions auto-log to `timeLogs` table.
- [ ] **Trash Bin & Soft-Delete**:
  - Navigate to `/trash`: soft-deleted items grouped by batch with timestamp.
  - "Restore": restores items back into active view.
  - "Delete Forever": permanently removes records.
  - "Empty Trash": clears all soft-deleted records.
- [ ] **Time Stats & Estimate Correction Scaler (`/stats`)**:
  - Metric cards: estimated vs actual time, accuracy ratio, 30-day SVG bar chart.
  - Estimate correction factor computes automatic multiplier (e.g. $1.25\times$) for realistic planning.
- [ ] **52-Week Activity Heatmap (`/stats`)**:
  - 364-day SVG grid displays colored intensity blocks for days with completed parts or time logs.
  - Shows current streak, longest streak, rest day forgiveness, and freeze status.
- [ ] **Deadline Slack Calculator & Plan Compressor**:
  - In Plan tab: slack badge dynamically displays comfortable/tight/overdue status.
  - Priority ranking (`must`, `should`, `could`) allows triaging when deadlines are negative.
- [ ] **Weekly Review Wizard (`/review`)**:
  - Aggregates weekly metrics (parts done, focus time, streak, closed bugs, decisions).
  - Generates calibration prompt for LLM; user pastes reply to preview and apply schedule adjustments.
- [ ] **Reusable Checklists (`ChecklistsSection.tsx`)**:
  - Add checklist to part from starter templates (Code Quality, Deploy, PR Review).
  - Check/uncheck items: progress bar updates in real time.
- [ ] **Bug Tracker (`BugsSection.tsx`)**:
  - Log bug with title, severity (`critical`, `major`, `minor`), and reproduction steps.
  - "Generate Debug Prompt" generates copyable prompt for LLM.
  - "Schedule as Part" converts bug directly into a scheduled part in the plan.
- [ ] **Repository Context Reader (`RepoContextModal.tsx`)**:
  - Open "Repo Context" from project header: import folder via File System Access API.
  - Security check automatically excludes `.env*`, keys, and binary directories.
  - Indented folder tree visualizer with character meter and token estimation.
- [ ] **Prompt Builder Token Hierarchy**:
  - Under token constraints, verify trimming hierarchy drops `FILES` $\rightarrow$ `SOURCE` $\rightarrow$ `RELATED` $\rightarrow$ `MEMORY` $\rightarrow$ `PLAN_POSITION` while preserving `TASK`, `RULES`, `OUTPUT_FORMAT`.


