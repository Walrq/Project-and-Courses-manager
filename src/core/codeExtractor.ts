export interface ExtractedCodeSnippet {
  id: string;
  language: string;
  code: string;
  title: string;
}

/**
 * Extracts markdown fenced code blocks (```lang ... ```)
 */
export function extractCodeBlocks(markdownText: string): ExtractedCodeSnippet[] {
  if (!markdownText) return [];

  // Normalize Windows CRLF line endings to LF
  const normalized = markdownText.replace(/\r\n/g, '\n');
  const snippets: ExtractedCodeSnippet[] = [];

  // Match ```lang[:title] \n code \n ```
  // Use [: \t] so that newlines are never mistakenly consumed as horizontal whitespace
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)(?:[: \t]([^\n]*))?\n([\s\S]*?)```/g;

  let match: RegExpExecArray | null;
  let counter = 1;

  while ((match = codeBlockRegex.exec(normalized)) !== null) {
    const rawLang = match[1]?.trim() || 'text';
    const rawTitle = match[2]?.trim() || `Snippet ${counter}`;
    const code = match[3]?.trim();

    if (code) {
      snippets.push({
        id: `snippet-${counter}`,
        language: rawLang,
        title: rawTitle,
        code,
      });
      counter++;
    }
  }

  return snippets;
}
