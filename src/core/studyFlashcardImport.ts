import { z } from 'zod';
import { autoFixJSONString, extractFirstBalancedJSON, stripMarkdownFences } from './planImport';

const FlashcardSchema = z.array(z.object({
  front: z.string().trim().min(1, 'Front cannot be empty'),
  back: z.string().trim().min(1, 'Back cannot be empty'),
  topicId: z.number().int().positive().optional(),
  tags: z.array(z.string()).optional().default([]),
})).min(1, 'Include at least one flashcard');

export function parseFlashcardImport(input: string) {
  if (!input.trim()) return { success: false as const, errors: ['Paste flashcards JSON first.'] };
  const source = stripMarkdownFences(input);
  const balanced = extractFirstBalancedJSON(source) || extractFirstBalancedJSON(autoFixJSONString(source));
  if (!balanced) return { success: false as const, errors: ['Could not find a JSON array in the pasted text.'] };
  let parsed: unknown;
  try { parsed = JSON.parse(balanced); }
  catch {
    try { parsed = JSON.parse(autoFixJSONString(balanced)); }
    catch { return { success: false as const, errors: ['The pasted text is not valid JSON.'] }; }
  }
  const result = FlashcardSchema.safeParse(parsed);
  return result.success ? { success: true as const, data: result.data } : { success: false as const, errors: result.error.issues.slice(0, 4).map((issue) => `${issue.path.join('.') || 'flashcards'}: ${issue.message}`) };
}
