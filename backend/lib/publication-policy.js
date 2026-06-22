const { parsePatch } = require('diff');

const DEFAULT_PROTECTED_PATTERNS = [
  '.github/workflows/**',
  '.env',
  '.env.*',
  'backend/.env*',
  'frontend/.env*',
  '**/*.pem',
  '**/*.key',
  '**/*.p12',
  '**/*.pfx',
  '**/id_rsa',
  '**/id_ed25519',
  '.secrets/**',
  'secrets/**',
];

function evaluatePublicationPolicy({ repo, patch, env = process.env }) {
  const findings = [];
  const files = [];
  const allowedRepositories = parseList(env.GITHUB_ALLOWED_REPOSITORIES || 'ignis-protocol/ignis');
  const protectedPatterns = parseList(env.PUBLICATION_PROTECTED_PATHS || DEFAULT_PROTECTED_PATTERNS.join(','));
  const maxFiles = numberEnv(env.MAX_PUBLICATION_FILES, 25);
  const maxAddedLines = numberEnv(env.MAX_PUBLICATION_ADDED_LINES, 2500);

  if (allowedRepositories.length && !allowedRepositories.includes(repo)) {
    findings.push({
      severity: 'high',
      code: 'repo_not_allowed',
      detail: `Repository ${repo} is outside the publication allowlist.`,
    });
  }

  let parsed;
  try {
    parsed = parsePatch(String(patch || ''));
  } catch (error) {
    findings.push({ severity: 'high', code: 'patch_parse_failed', detail: error.message });
    parsed = [];
  }

  if (!parsed.length) {
    findings.push({ severity: 'high', code: 'empty_patch', detail: 'Patch contains no parseable file changes.' });
  }

  let addedLines = 0;
  let removedLines = 0;
  for (const file of parsed) {
    const filePath = normalizePatchPath(file.newFileName === '/dev/null' ? file.oldFileName : file.newFileName);
    const oldPath = normalizePatchPath(file.oldFileName);
    const isRename = oldPath && filePath && oldPath !== filePath && oldPath !== '/dev/null' && filePath !== '/dev/null';
    const stats = countPatchLines(file);
    addedLines += stats.added;
    removedLines += stats.removed;
    files.push({ path: filePath, old_path: oldPath || null, added: stats.added, removed: stats.removed, hunks: file.hunks.length });

    if (!filePath || filePath === '/dev/null') {
      findings.push({ severity: 'high', code: 'invalid_path', detail: 'Patch contains a file without a valid path.' });
    }
    if (isRename) {
      findings.push({ severity: 'medium', code: 'rename_requires_manual_review', path: filePath, detail: 'Renames require manual application.' });
    }
    if (protectedPatterns.some(pattern => pathMatches(filePath, pattern))) {
      findings.push({ severity: 'high', code: 'protected_path', path: filePath, detail: 'Protected path cannot be published automatically.' });
    }
  }

  if (files.length > maxFiles) {
    findings.push({ severity: 'high', code: 'too_many_files', detail: `${files.length} files exceeds limit ${maxFiles}.` });
  }
  if (addedLines > maxAddedLines) {
    findings.push({ severity: 'high', code: 'too_many_added_lines', detail: `${addedLines} added lines exceeds limit ${maxAddedLines}.` });
  }

  const blocked = findings.some(item => item.severity === 'high');
  return {
    ok: !blocked,
    status: blocked ? 'fail' : (findings.length ? 'warn' : 'pass'),
    repo,
    files,
    added_lines: addedLines,
    removed_lines: removedLines,
    limits: { max_files: maxFiles, max_added_lines: maxAddedLines },
    protected_patterns: protectedPatterns,
    findings,
  };
}

function normalizePatchPath(value) {
  const raw = String(value || '').replace(/\\/g, '/');
  if (!raw || raw === '/dev/null') return raw;
  return raw.replace(/^[ab]\//, '').replace(/^\/+/, '');
}

function countPatchLines(file) {
  let added = 0;
  let removed = 0;
  for (const hunk of file.hunks || []) {
    for (const line of hunk.lines || []) {
      if (line.startsWith('+') && !line.startsWith('+++')) added += 1;
      if (line.startsWith('-') && !line.startsWith('---')) removed += 1;
    }
  }
  return { added, removed };
}

function parseList(value) {
  return String(value || '').split(',').map(item => item.trim()).filter(Boolean);
}

function numberEnv(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function pathMatches(filePath, pattern) {
  let regex = '';
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    const next = pattern[index + 1];
    if (char === '*' && next === '*') {
      regex += '.*';
      index += 1;
    } else if (char === '*') {
      regex += '[^/]*';
    } else {
      regex += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${regex}$`, 'i').test(filePath);
}

module.exports = { evaluatePublicationPolicy, normalizePatchPath };
