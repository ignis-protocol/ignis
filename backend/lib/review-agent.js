const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_MODEL = 'deepseek-v4-flash';
const DEFAULT_TIMEOUT_MS = 45000;
const DEFAULT_MAX_DIFF_BYTES = 60000;

class ReviewAgent {
  constructor(env = process.env) {
    this.env = env;
  }

  status() {
    return {
      configured: Boolean(this.env.OPENROUTER_API_KEY),
      provider: 'openrouter',
      model: this.env.OPENROUTER_MODEL || DEFAULT_MODEL,
      base_url: this.env.OPENROUTER_BASE_URL || DEFAULT_BASE_URL,
      dry_run: this.env.AGENT_DRY_RUN === '1',
      max_diff_bytes: numberEnv(this.env.AGENT_MAX_DIFF_BYTES, DEFAULT_MAX_DIFF_BYTES),
    };
  }

  async analyze({ review, submission, bundle }) {
    const status = this.status();
    const diff = String(bundle.sanitized_diff || '');
    if (Buffer.byteLength(diff, 'utf8') > status.max_diff_bytes) {
      return normalizeReport({
        decision: 'needs_human',
        score: 1,
        confidence: 'low',
        risk: 'high',
        summary: 'The sanitized diff exceeds the configured AI review limit.',
        findings: [{
          severity: 'high',
          category: 'scope',
          summary: 'Diff too large for AI first-pass review',
          evidence: `${Buffer.byteLength(diff, 'utf8')} bytes exceeds ${status.max_diff_bytes}`,
          recommendation: 'Split the patch or require human review.',
        }],
        tests_required: ['Manual review required because the diff exceeds the agent limit.'],
        maintainer_note: 'Do not treat this as an approval signal.',
      });
    }
    if (status.dry_run) return this.dryRunReport({ review, submission, bundle });
    if (!status.configured) throw new Error('OpenRouter API key is not configured.');

    const response = await fetch(`${status.base_url.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      signal: AbortSignal.timeout(numberEnv(this.env.AGENT_TIMEOUT_MS, DEFAULT_TIMEOUT_MS)),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': this.env.OPENROUTER_SITE_URL || 'https://ignis-protocol.com',
        'X-Title': this.env.OPENROUTER_APP_TITLE || 'IGNIS',
      },
      body: JSON.stringify({
        model: status.model,
        temperature: Number(this.env.AGENT_TEMPERATURE || 0.1),
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt() },
          { role: 'user', content: userPrompt({ review, submission, bundle }) },
        ],
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error?.message || `OpenRouter request failed with HTTP ${response.status}`;
      throw new Error(message.slice(0, 500));
    }
    const content = data?.choices?.[0]?.message?.content;
    return normalizeReport(parseJsonReport(content));
  }

  dryRunReport({ bundle }) {
    const report = bundle.metadata_report || {};
    const risk = report.risk === 'high' ? 'medium' : 'low';
    return normalizeReport({
      decision: risk === 'low' ? 'needs_human' : 'needs_human',
      score: risk === 'low' ? 7 : 5,
      confidence: 'medium',
      risk,
      summary: 'Dry-run agent completed without contacting OpenRouter.',
      findings: [{
        severity: risk === 'low' ? 'low' : 'medium',
        category: 'dry_run',
        summary: 'Synthetic agent report',
        evidence: 'AGENT_DRY_RUN=1',
        recommendation: 'Use only for local testing and route validation.',
      }],
      tests_required: ['Run the real OpenRouter agent before relying on this report.'],
      maintainer_note: 'Dry-run report is not a production review signal.',
    });
  }
}

function systemPrompt() {
  return [
    'You are the IGNIS Adversarial Review Agent.',
    'Review only the sanitized diff and metadata provided. Do not infer identity, location, wallet, social graph, or author reputation.',
    'Be skeptical and senior-level: search for correctness bugs, security issues, regression risk, hidden side effects, fragile assumptions, and missing tests.',
    'Never rubber-stamp. If evidence is insufficient, choose needs_human.',
    'Return strict JSON only with these keys: decision, score, confidence, risk, summary, findings, tests_required, maintainer_note.',
    'decision must be accept, reject, or needs_human. score must be integer 1-10. confidence must be low, medium, or high. risk must be low, medium, high, or critical.',
    'Each finding must include severity, category, summary, evidence, recommendation.',
  ].join('\n');
}

function userPrompt({ review, submission, bundle }) {
  return JSON.stringify({
    review: {
      id: review.id,
      status: review.status,
      quorum_required: review.quorum_required,
      reviewers_responded: review.votes.length,
    },
    submission: {
      id: submission.id,
      repo: submission.repo,
      summary: submission.summary,
      diff_hash: submission.diff_hash,
      sanitized_hash: submission.sanitized_hash,
      metadata_report: bundle.metadata_report,
    },
    sanitized_diff: bundle.sanitized_diff,
  });
}

function parseJsonReport(content) {
  if (!content) throw new Error('Agent returned an empty response.');
  const text = String(content).trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  return JSON.parse(text);
}

function normalizeReport(input = {}) {
  const decision = enumValue(input.decision, ['accept', 'reject', 'needs_human'], 'needs_human');
  const score = clampInt(input.score, 1, 10, 1);
  const confidence = enumValue(input.confidence, ['low', 'medium', 'high'], 'low');
  const risk = enumValue(input.risk, ['low', 'medium', 'high', 'critical'], 'high');
  const findings = Array.isArray(input.findings) ? input.findings.slice(0, 20).map(normalizeFinding) : [];
  const testsRequired = Array.isArray(input.tests_required)
    ? input.tests_required.slice(0, 20).map(item => limit(item, 220)).filter(Boolean)
    : [];
  return {
    decision,
    score,
    confidence,
    risk,
    summary: limit(input.summary, 700) || 'No summary provided.',
    findings,
    tests_required: testsRequired,
    maintainer_note: limit(input.maintainer_note, 700) || '',
  };
}

function normalizeFinding(input = {}) {
  return {
    severity: enumValue(input.severity, ['low', 'medium', 'high', 'critical'], 'medium'),
    category: limit(input.category, 60) || 'general',
    summary: limit(input.summary, 240) || 'Finding requires review.',
    evidence: limit(input.evidence, 500) || '',
    recommendation: limit(input.recommendation, 500) || '',
  };
}

function enumValue(value, allowed, fallback) {
  const normalized = String(value || '').trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function clampInt(value, min, max, fallback) {
  const number = Number(value);
  return Number.isInteger(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function numberEnv(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function limit(value, max) {
  return String(value || '').trim().slice(0, max);
}

module.exports = { ReviewAgent, normalizeReport };
