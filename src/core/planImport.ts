import { z } from 'zod';

export const ImportedSectionItemSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty'),
  description: z.string().optional().default(''),
  depends_on: z.array(z.string()).optional().default([]),
});

export const ImportedBreakdownSchema = z.object({
  sections: z.array(ImportedSectionItemSchema),
});

export const ImportedPartItemSchema = z.object({
  day: z.number().optional(),
  section: z.string().optional().default('General'),
  title: z.string().optional(),
  goal: z.string().optional().default(''),
  est_minutes: z.number().optional().default(60),
  steps: z.array(z.string()).optional().default([]),
  rest: z.boolean().optional().default(false),
  source_start: z.number().optional(),
  source_end: z.number().optional(),
  source_excerpt: z.string().optional(),
  source_label: z.string().optional(),
});

export const ImportedPlanSchema = z.object({
  parts: z.array(ImportedPartItemSchema),
});

export type ImportedBreakdown = z.infer<typeof ImportedBreakdownSchema>;
export type ImportedPlan = z.infer<typeof ImportedPlanSchema>;
export type ImportedPartItem = z.infer<typeof ImportedPartItemSchema>;
export type ImportedSectionItem = z.infer<typeof ImportedSectionItemSchema>;

export type ParseImportResult =
  | { success: true; type: 'breakdown'; data: ImportedBreakdown }
  | { success: true; type: 'plan'; data: ImportedPlan }
  | { success: false; errors: string[]; rawExtracted?: string };

/**
 * Auto-fix common issues:
 * - Smart / curly quotes (“ ” ‘ ’) -> standard straight quotes (" ')
 * - Trailing commas before } or ]
 */
export function autoFixJSONString(raw: string): string {
  let cleaned = raw
    .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");

  // Remove trailing commas before closing braces/brackets
  cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');

  return cleaned;
}

/**
 * Strips markdown fences (e.g. ```json ... ```)
 */
export function stripMarkdownFences(text: string): string {
  let cleaned = text.trim();
  const fenceRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const match = cleaned.match(fenceRegex);
  if (match) {
    return match[1].trim();
  }
  return cleaned;
}

/**
 * Finds the first balanced JSON object { ... } or array [ ... ]
 */
export function extractFirstBalancedJSON(text: string): string | null {
  const openBrace = text.indexOf('{');
  const openBracket = text.indexOf('[');

  let startIdx = -1;
  let isObject = true;

  if (openBrace !== -1 && (openBracket === -1 || openBrace < openBracket)) {
    startIdx = openBrace;
    isObject = true;
  } else if (openBracket !== -1) {
    startIdx = openBracket;
    isObject = false;
  } else {
    return null;
  }

  const openChar = isObject ? '{' : '[';
  const closeChar = isObject ? '}' : ']';

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIdx; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === '\\') {
        escape = true;
      } else if (char === '"') {
        inString = false;
      }
    } else {
      if (char === '"') {
        inString = true;
      } else if (char === openChar) {
        depth++;
      } else if (char === closeChar) {
        depth--;
        if (depth === 0) {
          return text.substring(startIdx, i + 1);
        }
      }
    }
  }

  return null;
}

/**
 * Parses user-pasted text, handles code fences, balances JSON, validates with zod
 */
export function parseImportText(rawInput: string): ParseImportResult {
  const errors: string[] = [];
  if (!rawInput.trim()) {
    return { success: false, errors: ['Input text is empty.'] };
  }

  const unfenced = stripMarkdownFences(rawInput);
  let jsonSubstring = extractFirstBalancedJSON(unfenced);

  if (!jsonSubstring) {
    // Try auto-fixing smart quotes first and retry
    const fixed = autoFixJSONString(unfenced);
    jsonSubstring = extractFirstBalancedJSON(fixed);
  }

  if (!jsonSubstring) {
    return {
      success: false,
      errors: ['Could not find a valid JSON object or array in the pasted text.'],
    };
  }

  // Attempt parse
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonSubstring);
  } catch (err: unknown) {
    // Try auto-fixing
    try {
      const fixed = autoFixJSONString(jsonSubstring);
      parsed = JSON.parse(fixed);
      jsonSubstring = fixed;
    } catch {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        errors: [`JSON syntax error: ${msg}. You can click "Auto-fix" to repair trailing commas or smart quotes.`],
        rawExtracted: jsonSubstring,
      };
    }
  }

  // If parsed is array, check if it's parts or sections
  if (Array.isArray(parsed)) {
    if (parsed.length > 0 && ('day' in parsed[0] || 'goal' in parsed[0] || 'rest' in parsed[0])) {
      parsed = { parts: parsed };
    } else {
      parsed = { sections: parsed };
    }
  }

  // Validate as Breakdown
  const breakdownCheck = ImportedBreakdownSchema.safeParse(parsed);
  if (breakdownCheck.success) {
    return { success: true, type: 'breakdown', data: breakdownCheck.data };
  }

  // Validate as Plan
  const planCheck = ImportedPlanSchema.safeParse(parsed);
  if (planCheck.success) {
    return { success: true, type: 'plan', data: planCheck.data };
  }

  // If neither, gather readable zod error messages
  const planIssues = planCheck.error.issues.map((i) => `Part error at ${i.path.join('.')}: ${i.message}`);
  const sectionIssues = breakdownCheck.error.issues.map((i) => `Section error at ${i.path.join('.')}: ${i.message}`);

  errors.push(...planIssues.slice(0, 3));
  errors.push(...sectionIssues.slice(0, 3));

  return {
    success: false,
    errors,
    rawExtracted: jsonSubstring,
  };
}
