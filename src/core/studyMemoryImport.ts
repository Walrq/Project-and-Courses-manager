import { z } from 'zod';
import { autoFixJSONString, extractFirstBalancedJSON, stripMarkdownFences } from './planImport';

const MemorySchema = z.object({
  summary: z.string().default(''),
  concepts: z.array(z.string()).default([]),
  understood: z.array(z.string()).default([]),
  weak: z.array(z.string()).default([]),
  doubts: z.array(z.string()).default([]),
});

export function parseStudyMemoryImport(input: string) {
  if (!input.trim()) return { success: false as const, errors: ['Paste the memory JSON first.'] };
  const source = stripMarkdownFences(input);
  const balanced = extractFirstBalancedJSON(source) || extractFirstBalancedJSON(autoFixJSONString(source));
  if (!balanced) return { success: false as const, errors: ['Could not find a JSON object in the pasted text.'] };
  let parsed: unknown;
  try { parsed = JSON.parse(balanced); }
  catch {
    try { parsed = JSON.parse(autoFixJSONString(balanced)); }
    catch { return { success: false as const, errors: ['The pasted text is not valid JSON.'] }; }
  }
  const result = MemorySchema.safeParse(parsed);
  return result.success ? { success: true as const, data: result.data } : { success: false as const, errors: result.error.issues.slice(0, 4).map((issue) => `${issue.path.join('.') || 'memory'}: ${issue.message}`) };
}
