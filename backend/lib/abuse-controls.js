const SECRET_PATTERNS = [
  { id: 'private_key', severity: 'block', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i },
  { id: 'cloud_secret', severity: 'block', pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/ },
  { id: 'github_token', severity: 'block', pattern: /\bgh[opsu]_[A-Za-z0-9]{30,}\b/ },
  { id: 'generic_secret', severity: 'warn', pattern: /\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*["'][^"'\n]{12,}["']/i },
];

const MALWARE_PATTERNS = [
  { id: 'powershell_encoded_command', pattern: /\bpowershell(?:\.exe)?\b[^\n]{0,80}-(?:enc|encodedcommand)\b/i },
  { id: 'shell_pipe_execution', pattern: /\b(?:curl|wget)\b[^\n|]{0,300}\|\s*(?:sh|bash|zsh|powershell)\b/i },
  { id: 'credential_exfiltration', pattern: /(?:\.ssh\/id_(?:rsa|ed25519)|AWS_SECRET_ACCESS_KEY|process\.env)[^\n]{0,160}(?:fetch|curl|request|send)/i },
  { id: 'reverse_shell', pattern: /(?:\/dev\/tcp\/|nc\s+-e|bash\s+-i\s+>&)/i },
];

function inspectDiff(diff, options = {}) {
  const text = String(diff || '');
  const findings = [];
  const maxAddedLines = Number(options.maxAddedLines || process.env.MAX_ADDED_LINES || 2500);
  const maxLineLength = Number(options.maxLineLength || process.env.MAX_DIFF_LINE_LENGTH || 12000);
  const addedLines = text.split('\n').filter(line => line.startsWith('+') && !line.startsWith('+++'));

  for (const rule of SECRET_PATTERNS) {
    if (rule.pattern.test(text)) findings.push({ type: rule.id, severity: rule.severity });
  }
  for (const rule of MALWARE_PATTERNS) {
    if (rule.pattern.test(text)) findings.push({ type: rule.id, severity: 'block' });
  }
  if (addedLines.length > maxAddedLines) {
    findings.push({ type: 'excessive_added_lines', severity: 'block', count: addedLines.length, limit: maxAddedLines });
  }
  const longestLine = text.split('\n').reduce((max, line) => Math.max(max, line.length), 0);
  if (longestLine > maxLineLength) {
    findings.push({ type: 'oversized_line', severity: 'block', length: longestLine, limit: maxLineLength });
  }

  const blocked = findings.some(item => item.severity === 'block');
  return {
    status: blocked ? 'blocked' : findings.length ? 'warning' : 'clean',
    blocked,
    findings,
    added_lines: addedLines.length,
    scanned_at: new Date().toISOString(),
  };
}

function enforceSubmissionQuota(submissions, sessionId, options = {}) {
  const hourlyLimit = Number(options.hourlyLimit || process.env.SUBMISSION_QUOTA_PER_HOUR || 10);
  const dailyLimit = Number(options.dailyLimit || process.env.SUBMISSION_QUOTA_PER_DAY || 30);
  const now = Date.now();
  const owned = submissions.filter(item => item.session === sessionId);
  const hourly = owned.filter(item => now - new Date(item.created_at).getTime() < 60 * 60 * 1000).length;
  const daily = owned.filter(item => now - new Date(item.created_at).getTime() < 24 * 60 * 60 * 1000).length;
  return {
    allowed: hourly < hourlyLimit && daily < dailyLimit,
    hourly: { used: hourly, limit: hourlyLimit },
    daily: { used: daily, limit: dailyLimit },
  };
}

module.exports = { enforceSubmissionQuota, inspectDiff };
