import { z } from 'zod';
import { autoFixJSONString, extractFirstBalancedJSON, stripMarkdownFences } from './planImport';

export const StudyQuizQuestionSchema = z.object({
  question: z.string().trim().min(1, 'Question cannot be empty'),
  options: z.array(z.string()).min(2, 'Add at least two answer options'),
  answerIndex: z.number().int().min(0),
  explanation: z.string().optional().default(''),
  topicId: z.number().int().positive().optional(),
});
export type StudyQuizQuestion = z.infer<typeof StudyQuizQuestionSchema>;
const QuizSchema = z.array(StudyQuizQuestionSchema).min(1, 'Add at least one quiz question').max(200, 'A quiz can contain at most 200 questions');

export function parseStudyQuizImport(input: string) {
  if (!input.trim()) return { success: false as const, errors: ['Paste quiz JSON first.'] };
  const source = stripMarkdownFences(input);
  const balanced = extractFirstBalancedJSON(source) || extractFirstBalancedJSON(autoFixJSONString(source));
  if (!balanced) return { success: false as const, errors: ['Could not find a JSON array in the pasted text.'] };
  let parsed: unknown;
  try { parsed = JSON.parse(balanced); }
  catch {
    try { parsed = JSON.parse(autoFixJSONString(balanced)); }
    catch { return { success: false as const, errors: ['The pasted text is not valid JSON.'] }; }
  }
  const result = QuizSchema.safeParse(parsed);
  if (!result.success) return { success: false as const, errors: result.error.issues.slice(0, 5).map((issue) => `${issue.path.join('.') || 'questions'}: ${issue.message}`) };
  const invalidAnswer = result.data.findIndex((question) => question.answerIndex >= question.options.length);
  if (invalidAnswer >= 0) return { success: false as const, errors: [`Question ${invalidAnswer + 1}: answerIndex must match one of the options (starting at 0).`] };
  return { success: true as const, data: result.data };
}
