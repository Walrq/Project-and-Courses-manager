export const DEFAULT_IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'venv',
  '.venv',
  '__pycache__',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
];

export const BINARY_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.pdf',
  '.zip',
  '.tar',
  '.gz',
  '.mp4',
  '.mp3',
  '.woff',
  '.woff2',
  '.ttf',
  '.exe',
  '.dll',
  '.dylib',
  '.so',
];

const SECRET_FILE_PATTERNS = [
  /^\.env/i,
  /\.pem$/i,
  /\.key$/i,
  /id_rsa/i,
  /id_ed25519/i,
  /credentials\.json$/i,
  /service_account.*\.json$/i,
  /\.keystore$/i,
];

const SECRET_CONTENT_PATTERNS = [
  /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/,
  /AKIA[0-9A-Z]{16}/, // AWS Access Key
  /ghp_[0-9a-zA-Z]{36}/, // GitHub Personal Token
  /eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/, // JWT pattern
  /xox[baprs]-[0-9a-zA-Z]{10,48}/, // Slack Token
];

export interface SecretCheckResult {
  isSafe: boolean;
  isIgnored: boolean;
  isBinary: boolean;
  reason?: string;
}

/**
 * Checks if a file path or its content contains sensitive secrets or should be ignored.
 */
export function checkFileSafety(path: string, content?: string): SecretCheckResult {
  const normalized = path.replace(/\\/g, '/');
  const filename = normalized.split('/').pop() || '';

  // 1. Check ignore list
  for (const ign of DEFAULT_IGNORE_PATTERNS) {
    if (normalized.includes(`/${ign}/`) || normalized.startsWith(`${ign}/`) || filename === ign) {
      return { isSafe: false, isIgnored: true, isBinary: false, reason: `Ignored pattern: ${ign}` };
    }
  }

  // 2. Check binary extension
  for (const ext of BINARY_EXTENSIONS) {
    if (filename.toLowerCase().endsWith(ext)) {
      return { isSafe: false, isIgnored: true, isBinary: true, reason: `Binary file format: ${ext}` };
    }
  }

  // 3. Check secret filename
  for (const pat of SECRET_FILE_PATTERNS) {
    if (pat.test(filename)) {
      return { isSafe: false, isIgnored: false, isBinary: false, reason: `Sensitive secret file pattern matched: ${filename}` };
    }
  }

  // 4. Check content secrets
  if (content) {
    for (const pat of SECRET_CONTENT_PATTERNS) {
      if (pat.test(content)) {
        return { isSafe: false, isIgnored: false, isBinary: false, reason: 'Detected potential secret token or private key in file content.' };
      }
    }
  }

  return { isSafe: true, isIgnored: false, isBinary: false };
}
