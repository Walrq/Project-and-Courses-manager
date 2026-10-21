import { z } from 'zod';
import { autoFixJSONString, extractFirstBalancedJSON, stripMarkdownFences } from './planImport';

const StudyImportedTopicSchema = z.object({
  title: z.string().trim().min(1, 'Topic title is required'),
  minutes: z.number().int().positive().optional().default(30),
  sessionType: z.enum(['learn', 'practice', 'revise', 'mock_test']).optional().default('learn'),
  pageStart: z.number().int().positive().optional(),
  pageEnd: z.number().int().positive().optional(),
});

const StudyImportedUnitSchema = z.object({
  title: z.string().trim().min(1, 'Unit title is required'),
  weight: z.number().positive().optional(),
  topics: z.array(StudyImportedTopicSchema).max(500, 'A unit can contain at most 500 topics').optional().default([]),
}).strict();

export const StudyImportedPlanSchema = z.object({ units: z.array(StudyImportedUnitSchema).min(1, 'Add at least one unit').max(200, 'A plan can contain at most 200 units') }).strict();
export type StudyImportedPlan = z.infer<typeof StudyImportedPlanSchema>;

export type StudyPlanParseResult =
  | { success: true; data: StudyImportedPlan }
  | { success: false; errors: string[] };

export function parseStudyPlanImport(raw: string): StudyPlanParseResult {
  if (!raw.trim()) return { success: false, errors: ['Paste the plan JSON first.'] };
  const unfenced = stripMarkdownFences(raw);
  const extracted = extractFirstBalancedJSON(unfenced) || extractFirstBalancedJSON(autoFixJSONString(unfenced));
  if (!extracted) return { success: false, errors: ['Could not find a JSON object. Paste an object with a units array.'] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(extracted);
  } catch {
    try {
      parsed = JSON.parse(autoFixJSONString(extracted));
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return { success: false, errors: [`JSON syntax error: ${reason}`] };
    }
  }
  if (Array.isArray(parsed)) parsed = { units: parsed };
  const result = StudyImportedPlanSchema.safeParse(parsed);
  if (result.success) return { success: true, data: result.data };
  return {
    success: false,
    errors: result.error.issues.slice(0, 6).map((issue) => `${issue.path.join('.') || 'plan'}: ${issue.message}`),
  };
}
