# Progress Den

> An installable offline-first Progressive Web App (PWA) that breaks any project into day-sized parts and generates context-rich prompts for any LLM.
> **No backend. No AI APIs. No accounts. Everything runs locally in your browser.**

---

## 🚀 Key Features

- **The Context Loop & Rolling Memory**: Generates structured, token-budgeted prompts containing project memory, active architectural decisions, and current checklist steps. Copy with one click, run in any LLM (ChatGPT, Claude, Gemini, local model), and paste the result back to extract code snippets and update rolling memory with rollback support.
- **Smart Plan Import & Revision**: Direct import of raw LLM plans with fault-tolerant JSON parsing (extracts JSON from code blocks, handles unclosed arrays/braces, unquoted keys, and trailing commas) with live preview and project-level "Revise Plan" prompt generator.
- **Dependency DAG & Visual Locks**: Prerequisite validation across parts and sections with visual lock indicators preventing out-of-order execution.
- **Missed Day Rescheduling Engine**: Automatic detection of overdue days with 4 flexible recovery strategies (Shift forward, Merge with today, Mark skipped, or generate an AI Re-plan prompt).
- **Fast Global Search Palette**: In-memory indexed fuzzy search (`Ctrl+K` / `Cmd+K`) powered by `MiniSearch` to jump instantly to projects, sections, parts, decisions, and documentation.
- **Reference Links & Specifications**: Attach reference URLs and pasted documentation (enforced 20,000-character ceiling per item) with live char counters and automated injection into daily prompts under `# RELATED`.
- **Native Automated Backups**: Direct-to-folder auto-backups via the modern browser File System Access API, plus 7-day backup audit warnings and atomic JSON export/restore validated with Zod.
- **Walkthrough Import**: Convert YouTube tutorials (chapter timestamps or even-duration slices), articles, notes, and transcripts into scheduled daily parts with editable multi-row preview, split/merge tools, and automatic `# SOURCE` prompt injection.
- **Focus Timer (Pomodoro)**: Integrated header timer with 25m/50m/custom intervals, audio chimes, browser crash recovery, and automated time-logging.
- **Time Stats & 52-Week Activity Heatmap**: Accurate tracking of estimated vs. actual time, accuracy ratios, 30-day SVG bar charts, estimate correction scalers, and a GitHub-style 364-day activity heatmap with rest day forgiveness.
- **Deadlines, Priorities & Plan Compressor**: Automatic slack calculation (comfortable/tight/overdue), priority ranking (`must`/`should`/`could`), and intelligent plan compression for fixed deadlines.
- **Weekly Review & Plan Calibration**: Weekly facts aggregator, 1-click calibration prompt generator, and schedule adjustment preview.
- **Reusable Checklists & Bug Tracker**: Template-driven checklists (Code Quality, Deploy, PR Review) and dedicated bug tracking with debug prompt generation and 1-click schedule-as-part.
- **Local Repo Context Reader**: Security-conscious directory reader via File System Access API with indented tree generator, automatic `.env` and secret filtering, and a 5M character safety budget.
- **Instant Undo & Soft-Delete Trash**: 20-action in-memory undo stack (`Ctrl+Z`), 8-second toast, and durable soft-deleted trash bin with batch recovery.
- **Installable PWA & 100% Private**: IndexedDB storage (Dexie v3), zero AI APIs, zero telemetry, full offline functionality.

---

## ⌨️ Global Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + K` / `Cmd + K` | Open Command & Search Palette |
| `Ctrl + Z` / `Cmd + Z` | Undo Last Action |
| `?` | Show Keyboard Shortcuts Modal |
| `Esc` | Close search, modals, or active dialog |

---

## 🛠️ Running Locally

### Prerequisites
- [Node.js](https://nodejs.org/) LTS (v18 or higher)
- npm (installed with Node)

### Development
```bash
# Install dependencies
npm install

# Start local development server
npm run dev
```
Open `http://localhost:5173` in your browser.

### Run Unit Tests
```bash
npm run test
```

### Production Build & Preview
```bash
# Build production bundle with PWA service worker
npm run build

# Preview production build locally (with offline support)
npm run preview
```

---

## 🌐 Deploying to GitHub Pages (Beginner's Guide)

Because Progress Den is an entirely static, client-side PWA, you can host it for free on **GitHub Pages**, **Netlify**, or **Cloudflare Pages**.

> ⚠️ **Privacy Notice**: The deployed web URL is public so your browser can download the app bundle. However, **your project data is 100% private** and stored exclusively in your local browser profile. Anyone visiting the URL will simply open their own blank local instance.

### Step-by-Step Publishing to GitHub:

1. **Initialize Git & Commit**:
   ```bash
   git init
   git add .
   git commit -m "feat: initial commit of Progress Den"
   ```

2. **Create a GitHub Repository**:
   - Go to [GitHub](https://github.com/new) and create a new repository (e.g., `progress-den`).
   - Do **not** initialize with a README, .gitignore, or license.

3. **Push Code to GitHub**:
   ```bash
   git branch -M main
   git remote add origin https://github.com/<YOUR_USERNAME>/<REPO_NAME>.git
   git push -u origin main
   ```

4. **Enable GitHub Pages**:
   - In your repository, go to **Settings** -> **Pages**.
   - Under **Build and deployment** -> **Source**, select **GitHub Actions**.
   - The included workflow in `.github/workflows/deploy.yml` will automatically build and publish your app on every push to `main`!

5. **Open Live App**:
   - Visit `https://<YOUR_USERNAME>.github.io/<REPO_NAME>/`.
   - Your app is now live, installable, and ready to use!

---

## 📱 Installing as a Native App

### On Desktop (Chrome / Edge / Brave):
1. Visit the app URL in your browser.
2. Click the **"Install App"** button in the sidebar (or the install icon in your browser address bar).
3. Progress Den opens in its own standalone, distraction-free window without browser toolbars.

### On iOS (Safari):
1. Open the app in Safari.
2. Tap the **Share** button (box with upward arrow).
3. Tap **"Add to Home Screen"**.

### On Android (Chrome):
1. Open the app in Chrome.
2. Tap the three dots menu -> **"Install app"** or **"Add to Home Screen"**.

---

## 💾 Backups & Auto-Save

1. **Native Folder Auto-Backup**:
   - In **Settings** -> **Automated Backup Folder**, click **Select Auto-Backup Folder**.
   - Pick any local directory on your disk (e.g. Dropbox, Google Drive folder, or local documents).
   - Progress Den will automatically save timestamped snapshots directly to your disk!
2. **Manual JSON Export/Import**:
   - Navigate to **Settings** -> **Backup & Disaster Recovery**.
   - Click **"Export Backup File (.json)"** to download an immediate snapshot.
   - Use **"Select Backup File to Restore"** to restore from any prior JSON backup with full schema validation.

---

## 🧪 Technology Stack

- **Framework**: React 18 + TypeScript + Vite 6
- **Styling**: Tailwind CSS (class-based dark mode) + Lucide Icons
- **Local Database**: IndexedDB through Dexie.js v4 + `dexie-react-hooks`
- **Search Engine**: MiniSearch in-memory fuzzy index
- **Drag & Drop**: `@dnd-kit/core` & `@dnd-kit/sortable`
- **Routing**: React Router (`HashRouter` for zero-configuration static hosting)
- **PWA & Offline**: `vite-plugin-pwa` with Workbox precaching
- **Date Arithmetic**: `date-fns` & custom local calendar walk engine
- **Testing**: Vitest unit test suite (35 automated tests covering schedulers, DAG dependencies, token budget, recovery, search, and import)
- **Schema Validation**: Zod
