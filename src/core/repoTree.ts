export interface FileTreeNode {
  name: string;
  path: string;
  size?: number;
  isDir: boolean;
  children: FileTreeNode[];
}

/**
 * Builds an indented tree string from a list of relative paths.
 */
export function buildRepoTree(
  files: Array<{ path: string; sizeChars?: number }>,
  maxDepth: number = 4
): string {
  // Sort paths
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));

  // Build hierarchical root
  const root: FileTreeNode = {
    name: 'root',
    path: '',
    isDir: true,
    children: [],
  };

  for (const file of sorted) {
    const parts = file.path.replace(/\\/g, '/').split('/').filter(Boolean);
    let current = root;

    for (let depth = 0; depth < parts.length; depth++) {
      const partName = parts[depth];
      const isLast = depth === parts.length - 1;

      let child = current.children.find((c) => c.name === partName);
      if (!child) {
        child = {
          name: partName,
          path: parts.slice(0, depth + 1).join('/'),
          size: isLast ? file.sizeChars : undefined,
          isDir: !isLast,
          children: [],
        };
        current.children.push(child);
      }
      current = child;
    }
  }

  // Render tree lines
  const output: string[] = [];

  function render(node: FileTreeNode, prefix: string, depth: number) {
    if (depth > maxDepth) return;

    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const isLastChild = i === node.children.length - 1;
      const connector = isLastChild ? '└── ' : '├── ';
      const nextPrefix = prefix + (isLastChild ? '    ' : '│   ');

      const sizeStr = child.size !== undefined ? ` (${child.size} chars)` : '';
      output.push(`${prefix}${connector}${child.name}${sizeStr}`);

      if (child.isDir) {
        render(child, nextPrefix, depth + 1);
      }
    }
  }

  render(root, '', 1);
  return output.join('\n');
}
