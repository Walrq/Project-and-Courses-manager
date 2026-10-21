export type TemplateKind =
  | 'breakdown'
  | 'plan'
  | 'part'
  | 'review'
  | 'debug'
  | 'improve'
  | 'explain'
  | 'summarize'
  | 'handoff'
  | 'replan'
  | 'revise_plan'
  | 'followup'
  | 'walkthrough'
  | 'triage'
  | 'weekly_review'
  | 'checklist_review'
  | 'adr'
  | 'readme'
  | 'commit'
  | 'release_notes'
  | 'report'
  | 'standup';

export interface DefaultTemplateDef {
  kind: TemplateKind;
  name: string;
  body: string;
}

export const DEFAULT_TEMPLATES: DefaultTemplateDef[] = [
  {
    kind: 'breakdown',
    name: 'Project Breakdown',
    body: `You are a project planner.
Using the PROJECT block below, split the project into 5 to 15 logical, sequential sections.

# PROJECT
Name: {{project_name}}
Description: {{project_description}}
Goal: {{project_goal}}
Constraints: {{project_constraints}}

Reply ONLY with JSON in this exact shape:
{
  "sections": [
    {
      "title": "Architecture & Setup",
      "description": "Establish the foundational repository and core primitives",
      "depends_on": []
    }
  ]
}`,
  },
  {
    kind: 'plan',
    name: 'Day-by-Day Plan',
    body: `You are a technical project manager.
Break each section into daily, focused parts. Each part must fit in {{hours_per_day}} hours of focused work.
Start date is {{start_date}}.

# PROJECT
Name: {{project_name}}
Description: {{project_description}}

# SECTIONS
{{sections_list}}

Reply ONLY with JSON in this exact shape:
{
  "parts": [
    {
      "day": 1,
      "section": "Setup",
      "title": "Initialize Repository and Tooling",
      "goal": "Have build scripts, linting, and basic entry points running",
      "est_minutes": 90,
      "steps": [
        "Initialize project directory",
        "Configure linter and compiler",
        "Verify hello-world test passes"
      ]
    },
    {
      "day": 2,
      "rest": true
    }
  ]
}`,
  },
  {
    kind: 'part',
    name: 'Daily Part Execution',
    body: `{{ROLE}}

{{PROJECT}}

{{RULES}}

{{MEMORY}}

{{DECISIONS}}

{{PLAN_POSITION}}

{{RELATED}}

{{TASK}}

{{OUTPUT_FORMAT}}

{{END_INSTRUCTION}}`,
  },
  {
    kind: 'review',
    name: 'Review & Critique',
    body: `You are a senior engineer and reviewer.
Review the previous response for correctness, edge cases, maintainability, and deviations from specifications.

# PREVIOUS RESPONSE
{{previous_response}}

Rank any identified issues or potential bugs by severity (Critical, Major, Minor).
Provide clear, actionable fixes for each issue.`,
  },
  {
    kind: 'debug',
    name: 'Debug & Resolve Error',
    body: `You are an expert debugger.
Here is the error or failure encountered during the implementation of {{part_title}}:

# ERROR CONTEXT
{{error_text}}

# TASK GOAL
{{part_goal}}

Identify the exact root cause and provide the minimal, robust code modification needed to fix it.`,
  },
  {
    kind: 'improve',
    name: 'Refactor & Improve',
    body: `You are an expert software craftsman.
Analyze the following implementation and suggest improvements for performance, readability, and testability without changing external behavior:

# CODE / ARTIFACT
{{input_text}}

Provide improved code and list key benefits of each change.`,
  },
  {
    kind: 'explain',
    name: 'Concept Explanation',
    body: `Explain the following concept or architecture in clear, concise terms:

# TOPIC
{{input_text}}

Include practical tradeoffs, best practices, and a concise example.`,
  },
  {
    kind: 'summarize',
    name: 'Daily Memory Summarizer',
    body: `You are the memory keeper for the project '{{project_name}}'.
Compress the following daily progress into at most 8 crisp bullet points.
Preserve architectural decisions, naming conventions, new tools/libraries, and unresolved open questions.

# EXISTING ROLLING SUMMARY
{{rolling_summary}}

# TODAY'S WORK ({{part_title}})
Goal: {{part_goal}}
Note: {{part_note}}

# ACCEPTED RESPONSE
{{accepted_response}}

Output format:
- Key decisions made
- What was completed
- Open questions / known issues`,
  },
  {
    kind: 'handoff',
    name: 'Mid-Part Handoff',
    body: `You are continuing implementation of '{{part_title}}' for project '{{project_name}}'.

# CONTEXT
Goal: {{part_goal}}
Steps Completed:
{{steps_done}}

Remaining Steps:
{{steps_remaining}}

# LAST ACCEPTED OUTPUT
{{last_response_summary}}

Continue directly from the next remaining step.`,
  },
  {
    kind: 'replan',
    name: 'Re-plan Remaining Parts',
    body: `You are re-planning the remainder of '{{project_name}}'.
Current remaining parts need to be rescheduled to meet deadline: {{deadline}}.

# REASON & FEEDBACK
{{user_feedback}}

# REMAINING SECTIONS & PARTS
{{remaining_parts_list}}

Reply ONLY with valid JSON in this exact shape:
{
  "parts": [
    {
      "day": 1,
      "section": "Section Name",
      "title": "Part Title",
      "goal": "Part Goal",
      "est_minutes": 60,
      "steps": ["Step 1", "Step 2"]
    }
  ]
}`,
  },
  {
    kind: 'revise_plan',
    name: 'Revise Plan',
    body: `Revise the current plan based on the following user feedback:
Feedback: {{user_feedback}}

Current plan summary:
{{current_plan_summary}}

Adjust the parts distribution and provide corrected plan JSON.`,
  },
  {
    kind: 'followup',
    name: 'Follow-up Prompt',
    body: `Regarding the previous task '{{part_title}}':

# PREVIOUS PROMPT
{{previous_prompt}}

# PREVIOUS RESPONSE
{{previous_response}}

# FEEDBACK / ADDITIONAL REQUEST
{{user_feedback}}

Please address the feedback while maintaining consistency with previous work.`,
  },
  {
    kind: 'walkthrough',
    name: 'Walkthrough Plan Generation',
    body: `You are a project curriculum designer.
Convert the following walkthrough tutorial/transcript into a structured, daily, sequential implementation plan.

# PROJECT BRIEF
Project: {{project_name}}
Description: {{project_description}}
Plan Settings: {{parts_per_day}} part(s) per day, ~{{hours_per_day}} hours per day.

# WALKTHROUGH SOURCE
{{walkthrough_text}}

Reply ONLY with valid JSON in this exact shape:
{
  "parts": [
    {
      "day": 1,
      "section": "Setup & Foundations",
      "title": "Part Title",
      "goal": "Clear objective of this part",
      "est_minutes": 45,
      "steps": ["Step 1", "Step 2"],
      "source_start": 0,
      "source_end": 754,
      "source_excerpt": "Relevant tutorial context excerpt"
    }
  ]
}`,
  },
  {
    kind: 'triage',
    name: 'Deadline Triage & Scope Cut',
    body: `You are an agile engineering lead assisting with deadline triage.
The project has a strict deadline: {{deadline}}.

# REMAINING WORK & PRIORITIES
{{remaining_parts_list}}

Current Slack: {{slack_days}} day(s).

Rank the remaining work. Propose what parts to drop, merge, or simplify so the remaining plan fits the deadline comfortably.
Reply ONLY with valid JSON in the standard plan format with adjusted parts.`,
  },
  {
    kind: 'weekly_review',
    name: 'Weekly Review & Adjustments',
    body: `You are an engineering coach reviewing weekly progress on '{{project_name}}'.

# FACTS FOR THE WEEK
{{weekly_facts}}

# DEV LOG
{{dev_log}}

# USER REFLECTION
{{reflection}}

Reply ONLY with JSON in this exact shape:
{
  "summary": "Brief summary of progress and momentum",
  "wins": ["Win 1", "Win 2"],
  "problems": ["Problem 1"],
  "adjustments": [
    { "type": "change_parts_per_day", "value": 2 },
    { "type": "note", "text": "Focus on testing first" }
  ]
}`,
  },
  {
    kind: 'checklist_review',
    name: 'Review Work Against Checklist',
    body: `You are a senior code reviewer.
Review the following completed work against the checklist items.

# CHECKLIST
{{checklist_items}}

# WORK / CODE PRODUCED
{{work_summary}}

Evaluate each item and return:
- Item text
- Status: [PASS], [FAIL], or [UNSURE]
- Brief explanation and remediation if not pass.`,
  },
  {
    kind: 'adr',
    name: 'ADR Assistant',
    body: `You are a software architect.
Draft an Architecture Decision Record (ADR) based on the choice described below:

# CHOICE DESCRIPTION
{{choice_description}}

Reply ONLY with JSON:
{
  "title": "Short title (e.g. Use IndexedDB via Dexie)",
  "context": "The problem, constraints, and background",
  "decision": "The change or architectural choice being made",
  "consequences": "Tradeoffs, benefits, and drawbacks",
  "alternatives": "Other options considered and why rejected"
}`,
  },
  {
    kind: 'readme',
    name: 'Generate README.md',
    body: `Generate a production-ready, beautiful README.md for the following project:

# PROJECT
Name: {{project_name}}
Description: {{project_description}}
Goal: {{project_goal}}
Constraints: {{project_constraints}}

# ARCHITECTURE DECISIONS
{{decisions_list}}

# PROJECT STRUCTURE
{{file_tree}}

Include overview, features, installation, usage, architecture summary, and license sections.`,
  },
  {
    kind: 'commit',
    name: 'Generate Commit Message',
    body: `Generate a conventional commit message following standard conventions (feat, fix, docs, refactor, test, chore).

# RECENT NOTES / DIFF
{{commit_context}}

Provide:
1. Short imperative subject line (< 72 chars)
2. Bulleted explanation of why and what changed.`,
  },
  {
    kind: 'release_notes',
    name: 'Generate Release Notes',
    body: `Generate user-facing release notes for the upcoming version release:

# DEV LOG / COMPLETED ITEMS
{{release_context}}

# ARCHITECTURAL DECISIONS
{{decisions_list}}

Group changes under Features, Improvements, Bug Fixes, and Breaking Changes.`,
  },
  {
    kind: 'report',
    name: 'Student / Client Project Report',
    body: `Generate a structured, professional project status report:

# PROJECT
Project: {{project_name}}
Summary: {{project_description}}

# ACCOMPLISHMENTS & METRICS
{{report_metrics}}

# ARCHITECTURE & DESIGN
{{decisions_list}}

Format with executive summary, methodology, deliverables completed, technical decisions, and next steps.`,
  },
  {
    kind: 'standup',
    name: 'Daily Standup Summary',
    body: `Generate a concise 3-bullet daily standup report:

# YESTERDAY'S WORK
{{yesterday_notes}}

# TODAY'S PLAN
{{today_part_title}}

# BLOCKERS & NOTES
{{blockers_notes}}

Output:
- **Yesterday**: ...
- **Today**: ...
- **Blockers**: ...`,
  },
];
