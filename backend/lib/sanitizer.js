const net = require('node:net');
const { sha256 } = require('./security');

const MAX_DIFF_BYTES = Number(process.env.MAX_DIFF_BYTES || 256 * 1024);
const MAX_DIFF_LINES = Number(process.env.MAX_DIFF_LINES || 5000);

const RULES = [
  {
    id: 'git_author_email',
    label: 'Git author email',
    pattern: /([A-Z0-9._%+-]+)@([A-Z0-9.-]+\.[A-Z]{2,})/gi,
    replacement: '[redacted-email]',
    severity: 'high',
  },
  {
    id: 'git_author_header',
    label: 'Git author header',
    pattern: /^(author|committer|signed-off-by|co-authored-by):\s+.+$/gim,
    replacement: match => `${match.split(':', 1)[0]}: [redacted]`,
    severity: 'high',
  },
  {
    id: 'git_remote_url',
    label: 'Git remote URL',
    pattern: /\b(?:git@|https?:\/\/)(?:github\.com|gitlab\.com|bitbucket\.org|[^/\s]+)[:/][^\s]+(?:\.git)?/gi,
    replacement: '[redacted-git-remote]',
    severity: 'high',
  },
  {
    id: 'windows_user_path',
    label: 'Windows user path',
    pattern: /\b[A-Z]:\\Users\\[^\\\s]+/gi,
    replacement: '[redacted-user-path]',
    severity: 'high',
  },
  {
    id: 'unix_user_path',
    label: 'Unix user path',
    pattern: /\/(?:Users|home)\/[^/\s]+/g,
    replacement: '[redacted-user-path]',
    severity: 'high',
  },
  {
    id: 'absolute_temp_path',
    label: 'Absolute temp path',
    pattern: /(?:\/tmp\/[^\s]+|[A-Z]:\\(?:Temp|Windows\\Temp)\\[^\s]+)/gi,
    replacement: '[redacted-temp-path]',
    severity: 'medium',
  },
  {
    id: 'timezone_offset',
    label: 'Timezone offset',
    pattern: /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+[+-]\d{4}\b/g,
    replacement: '[redacted-timestamp]',
    severity: 'medium',
  },
  {
    id: 'iso_timestamp',
    label: 'ISO timestamp',
    pattern: /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})\b/g,
    replacement: '[redacted-timestamp]',
    severity: 'medium',
  },
  {
    id: 'editor_artifact',
    label: 'Editor or OS artifact',
    pattern: /(?:\.DS_Store|Thumbs\.db|\.idea\/workspace\.xml|\.vscode\/settings\.json|\.swp\b|~$)/gim,
    replacement: '[redacted-artifact]',
    severity: 'low',
  },
  {
    id: 'ip_address',
    label: 'IPv4 address',
    pattern: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
    replacement: '[redacted-ip]',
    severity: 'medium',
  },
  {
    id: 'ipv6_address',
    label: 'IPv6 address',
    pattern: /(?<![A-F0-9:])(?:[A-F0-9]{0,4}:){2,7}[A-F0-9]{0,4}(?![A-F0-9:])/gi,
    replacement: '[redacted-ip]',
    validate: match => net.isIP(match) === 6,
    severity: 'medium',
  },
];

function sanitizeDiff(input, options = {}) {
  const original = String(input || '').replace(/\r\n/g, '\n');
  const byteLength = Buffer.byteLength(original, 'utf8');
  if (!original.trim()) throw validationError('diff_required', 'Diff content is required.');
  if (byteLength > MAX_DIFF_BYTES) {
    throw validationError('diff_too_large', `Diff must be ${MAX_DIFF_BYTES} bytes or less.`);
  }

  const lines = original.split('\n');
  if (lines.length > MAX_DIFF_LINES) {
    throw validationError('diff_too_many_lines', `Diff must be ${MAX_DIFF_LINES} lines or less.`);
  }

  if (looksBinary(original)) {
    throw validationError('binary_diff_rejected', 'Binary or unsafe payloads are not accepted.');
  }

  let sanitized = normalizeDiffHeaders(original);
  const findings = [];

  for (const rule of RULES) {
    const before = sanitized;
    let count = 0;
    sanitized = sanitized.replace(rule.pattern, (...args) => {
      const match = args[0];
      if (rule.validate && !rule.validate(match)) return match;
      count += 1;
      if (typeof rule.replacement === 'function') return rule.replacement(match);
      return rule.replacement;
    });
    if (count > 0) {
      findings.push({ id: rule.id, label: rule.label, severity: rule.severity, count });
    }
    rule.pattern.lastIndex = 0;
    if (before !== sanitized) continue;
  }

  const pathFindings = sanitizeDiffPaths(sanitized);
  sanitized = pathFindings.text;
  findings.push(...pathFindings.findings);

  const report = {
    status: findings.length ? 'sanitized' : 'clean',
    findings: mergeFindings(findings),
    removed_fields: mergeFindings(findings).map(item => item.id),
    retained_fields: ['repo', 'summary', 'diff_hash', 'sanitized_diff'],
    original_bytes: byteLength,
    sanitized_bytes: Buffer.byteLength(sanitized, 'utf8'),
    original_lines: lines.length,
    sanitized_lines: sanitized.split('\n').length,
    risk: riskLevel(findings),
  };

  return {
    original_hash: sha256(original),
    sanitized_hash: sha256(sanitized),
    sanitized_diff: sanitized,
    report,
    preview: sanitized.slice(0, options.previewBytes || 4000),
  };
}

function normalizeDiffHeaders(text) {
  return text
    .replace(/^From\s+[a-f0-9]{7,40}\s+.+$/gim, 'From [redacted-commit] [redacted-timestamp]')
    .replace(/^Date:\s+.+$/gim, 'Date: [redacted-timestamp]');
}

function sanitizeDiffPaths(text) {
  const findings = [];
  const sanitized = text.replace(/^((?:diff --git a\/|--- |\+\+\+ |rename from |rename to ))(.+)$/gm, (line, prefix, filePath) => {
    const cleanPath = sanitizePath(filePath);
    if (cleanPath !== filePath) {
      findings.push({ id: 'path_identity_marker', label: 'Path identity marker', severity: 'high', count: 1 });
    }
    return `${prefix}${cleanPath}`;
  });
  return { text: sanitized, findings };
}

function sanitizePath(filePath) {
  return filePath
    .replace(/(?:^|\/)(?:Users|home)\/[^/\s]+/g, '/[redacted-user]')
    .replace(/[A-Z]:\\Users\\[^\\\s]+/gi, '[redacted-user-path]')
    .replace(/([^/\s]+)@([^/\s]+)/g, '[redacted-identity]');
}

function looksBinary(text) {
  if (text.includes('\u0000')) return true;
  if (/^(?:Binary files\b.*\bdiffer|GIT binary patch|literal \d+|delta \d+)$/gim.test(text)) return true;
  const controlChars = [...text].filter(char => {
    const code = char.charCodeAt(0);
    return code < 9 || (code > 13 && code < 32);
  }).length;
  return controlChars > Math.max(12, text.length * 0.02);
}

function mergeFindings(findings) {
  const merged = new Map();
  for (const finding of findings) {
    const current = merged.get(finding.id);
    if (current) current.count += finding.count;
    else merged.set(finding.id, { ...finding });
  }
  return [...merged.values()].sort((a, b) => severityScore(b.severity) - severityScore(a.severity));
}

function riskLevel(findings) {
  if (findings.some(item => item.severity === 'high')) return 'high';
  if (findings.some(item => item.severity === 'medium')) return 'medium';
  if (findings.length) return 'low';
  return 'clean';
}

function severityScore(value) {
  return { high: 3, medium: 2, low: 1 }[value] || 0;
}

function validationError(code, message) {
  const error = new Error(message);
  error.status = 400;
  error.code = code;
  return error;
}

module.exports = { sanitizeDiff, MAX_DIFF_BYTES, MAX_DIFF_LINES };
