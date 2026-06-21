const assert = require('assert');
const fs = require('fs');
const path = require('path');

const configPath = process.env.IGNIS_MONITOR_CONFIG ||
  path.resolve(__dirname, '..', '..', 'monitoring', 'http-checks.json');
const timeoutMs = Number(process.env.IGNIS_MONITOR_TIMEOUT_MS || 12000);

async function main() {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const startedAt = new Date();
  const results = [];

  for (const check of config.checks || []) {
    results.push(await runCheck(check));
  }

  const failed = results.filter(result => result.status !== 'pass');
  const summary = {
    project: config.project || 'ignis',
    checked_at: startedAt.toISOString(),
    duration_ms: Date.now() - startedAt.getTime(),
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    results,
  };

  console.log(JSON.stringify(summary, null, 2));
  assert.equal(failed.length, 0, `monitor checks failed: ${failed.map(item => item.name).join(', ')}`);
}

async function runCheck(check) {
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(check.url, {
      method: check.method || 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': 'IGNIS-free-monitor/1.0' },
    });
    const bodyText = await response.text();
    const result = {
      name: check.name,
      url: check.url,
      status: 'pass',
      http_status: response.status,
      duration_ms: Date.now() - started,
    };

    if (response.status !== check.expected_status) {
      throw new Error(`expected HTTP ${check.expected_status}, got ${response.status}`);
    }

    if (check.json_assertions) {
      const body = parseJson(bodyText, check.name);
      for (const [key, expected] of Object.entries(check.json_assertions)) {
        const actual = getPath(body, key);
        assert.deepEqual(actual, expected, `${key} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    }

    return result;
  } catch (error) {
    return {
      name: check.name,
      url: check.url,
      status: 'fail',
      duration_ms: Date.now() - started,
      error: error.name === 'AbortError' ? `timeout after ${timeoutMs}ms` : error.message,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function parseJson(text, name) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${name} did not return JSON`);
  }
}

function getPath(value, dottedPath) {
  return dottedPath.split('.').reduce((current, key) => current?.[key], value);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
