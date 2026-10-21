export interface StarterProjectTemplate {
  id: string;
  name: string;
  description: string;
  goal: string;
  constraints: string;
  aiRules: string;
  sections: Array<{
    title: string;
    description: string;
    priority: 1 | 2 | 3;
  }>;
}

export const STARTER_PROJECT_TEMPLATES: StarterProjectTemplate[] = [
  {
    id: 'web_app',
    name: 'Modern Web Application',
    description: 'A full-stack, responsive web application with clean architecture and automated tests.',
    goal: 'Build, test, and ship a high-quality web application.',
    constraints: 'TypeScript, React/Next.js or Vite, Tailwind CSS, offline-first data, responsive UI.',
    aiRules: 'Prioritize type safety, concise modular components, zero unnecessary external dependencies.',
    sections: [
      { title: 'Foundations & Tooling', description: 'Setup repo, bundler, linters, and design system tokens.', priority: 1 },
      { title: 'Data Layer & Schemas', description: 'Data modeling, schema validation with Zod, and local storage/database.', priority: 1 },
      { title: 'Core Business Logic', description: 'Framework-independent business rules, state machines, and unit tests.', priority: 1 },
      { title: 'UI Components & Layout', description: 'Reusable UI primitives, accessible navigation, dark mode, responsive styling.', priority: 2 },
      { title: 'User Workflows & Views', description: 'Interactive forms, dashboard views, filtering, and data mutations.', priority: 2 },
      { title: 'Performance & Offline PWA', description: 'Service worker cache, indexing, optimization, and keyboard shortcuts.', priority: 2 },
      { title: 'QA, Testing & Launch', description: 'Cross-browser testing, edge cases, documentation, and deployment.', priority: 3 },
    ],
  },
  {
    id: 'research_paper',
    name: 'Academic Research Paper',
    description: 'A rigorous academic research paper with literature review, methodology, and empirical evaluation.',
    goal: 'Complete and submit a publication-ready academic manuscript.',
    constraints: 'LaTeX formatting, peer-reviewed citations, reproducibility artifacts.',
    aiRules: 'Maintain scholarly tone, verify clarity of arguments, avoid fluff or unsupported assertions.',
    sections: [
      { title: 'Literature Review & Taxonomy', description: 'Survey existing work, identify knowledge gaps, structure classification.', priority: 1 },
      { title: 'Problem Formulation', description: 'Formalize mathematical/computational definitions and core hypotheses.', priority: 1 },
      { title: 'Proposed Methodology', description: 'Detailed architecture, algorithms, and theoretical guarantees.', priority: 1 },
      { title: 'Experimental Setup', description: 'Datasets, baseline algorithms, hardware specs, and evaluation metrics.', priority: 2 },
      { title: 'Results & Comparative Analysis', description: 'Tabulated benchmarks, ablation studies, and qualitative findings.', priority: 2 },
      { title: 'Discussion & Limitations', description: 'Critical self-critique, failure modes, and ethical considerations.', priority: 2 },
      { title: 'Draft Polish & Submission', description: 'Proofreading, abstract refinement, citation verification, camera-ready compile.', priority: 3 },
    ],
  },
  {
    id: 'indie_game',
    name: 'Indie Video Game',
    description: 'A 2D/3D indie game with engaging core game loop, audio, visual assets, and levels.',
    goal: 'Create an engaging, polished playable game prototype ready for release.',
    constraints: 'Stable 60 FPS, responsive controls, gamepad support, self-contained assets.',
    aiRules: 'Focus on game feel, juice, tight feedback loops, and robust physics separation.',
    sections: [
      { title: 'Core Mechanics Prototype', description: 'Player movement, inputs, collision detection, and camera controls.', priority: 1 },
      { title: 'Game Loop & State Machine', description: 'Title screen, pause menu, game over, score tracking, win conditions.', priority: 1 },
      { title: 'Enemies & AI Behavior', description: 'Enemy state machines, pathfinding, attack patterns, and balance tuning.', priority: 2 },
      { title: 'Level Design & Environments', description: 'Tilemaps, level progression, hazard placement, and secret areas.', priority: 2 },
      { title: 'Art & Visual Polish (Juice)', description: 'Particle effects, screen shake, sprite animations, and UI styling.', priority: 2 },
      { title: 'Audio & Sound Effects', description: 'Background music, impact SFX, spatial audio cues.', priority: 3 },
      { title: 'Playtesting & Build Packaging', description: 'Bug fixing, difficulty smoothing, standalone executable builds.', priority: 3 },
    ],
  },
  {
    id: 'business_plan',
    name: 'Startup Business Plan',
    description: 'A comprehensive startup pitch deck and strategic business roadmap.',
    goal: 'Develop an investor-ready business model and execution blueprint.',
    constraints: 'Market validated unit economics, realistic customer acquisition, clear differentiation.',
    aiRules: 'Be realistic, back projections with sound unit economics, focus on defensible moats.',
    sections: [
      { title: 'Executive Summary & Problem Statement', description: 'Core problem, target ICP, market opportunity, value proposition.', priority: 1 },
      { title: 'Market & Competitive Landscape', description: 'TAM/SAM/SOM, competitor matrix, unfair advantages.', priority: 1 },
      { title: 'Product & Technology Strategy', description: 'MVP feature set, technology stack, development roadmap.', priority: 2 },
      { title: 'Go-To-Market & Growth', description: 'Acquisition channels, sales cycle, pricing model, launch strategy.', priority: 2 },
      { title: 'Financial Model & Unit Economics', description: 'CAC, LTV, burn rate, 3-year cash flow forecast, break-even point.', priority: 2 },
      { title: 'Team & Milestones', description: 'Hiring plan, advisory board, key quarterly OKRs.', priority: 3 },
    ],
  },
  {
    id: 'study_plan',
    name: 'Intensive Technical Study Plan',
    description: 'A structured curriculum to master a new engineering domain or prepare for exams.',
    goal: 'Deep conceptual and practical mastery within scheduled parts.',
    constraints: 'Spaced repetition, daily active coding exercises, summary notes.',
    aiRules: 'Explain intuitively with analogies first, then formal rigor, followed by practical code exercises.',
    sections: [
      { title: 'Core Foundations & Mental Models', description: 'First principles, vocabulary, history, and foundational mechanics.', priority: 1 },
      { title: 'Standard Algorithms & Patterns', description: 'Key data structures, algorithmic paradigms, and complexity analysis.', priority: 1 },
      { title: 'Hands-on Coding Lab I', description: 'Implementing key concepts from scratch without high-level libraries.', priority: 2 },
      { title: 'Advanced Topics & Edge Cases', description: 'Concurrency, distributed systems considerations, performance traps.', priority: 2 },
      { title: 'Hands-on Coding Lab II', description: 'Full real-world project incorporating all studied techniques.', priority: 2 },
      { title: 'Mock Evaluation & Synthesis', description: 'Timed practice exams, peer review simulation, cheat-sheet synthesis.', priority: 3 },
    ],
  },
];
