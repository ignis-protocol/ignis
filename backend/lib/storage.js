const fs = require('fs');
const path = require('path');

const createDefaultState = () => ({
  meta: { version: 3, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  sessions: [],
  submissions: [],
  reviews: [],
  wallet_challenges: [],
  wallet_links: [],
  proofs: [],
  anchor_jobs: [],
  publications: [],
  audit_events: [],
});

class IgnisStorage {
  constructor(options = {}) {
    this.filePath = options.filePath;
    this.databaseUrl = options.databaseUrl || '';
    this.state = this.loadFile();
    this.driver = 'json-file';
    this.pool = null;
    this.ready = this.initPostgres();
    this.writeQueue = Promise.resolve();
  }

  loadFile() {
    try {
      if (!fs.existsSync(this.filePath)) return createDefaultState();
      return normalizeState(JSON.parse(fs.readFileSync(this.filePath, 'utf8')));
    } catch (error) {
      console.error('[STORE] failed to load JSON state:', error.message);
      return createDefaultState();
    }
  }

  async initPostgres() {
    if (!this.databaseUrl) return;
    try {
      const { Pool } = require('pg');
      this.pool = new Pool({
        connectionString: this.databaseUrl,
        ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false },
        max: Number(process.env.PG_POOL_MAX || 5),
      });
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS ignis_protocol_state (
          id TEXT PRIMARY KEY,
          payload JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      const result = await this.pool.query(
        'SELECT payload FROM ignis_protocol_state WHERE id = $1',
        ['primary'],
      );
      if (result.rows[0]?.payload) {
        this.state = normalizeState(result.rows[0].payload);
        this.persistFile();
      } else {
        await this.persistPostgres();
      }
      this.driver = 'postgresql';
    } catch (error) {
      console.error('[STORE] PostgreSQL unavailable, using JSON fallback:', error.message);
      this.pool = null;
      this.driver = 'json-file-fallback';
    }
  }

  async persist() {
    this.state.meta.updated_at = new Date().toISOString();
    this.persistFile();
    if (!this.pool) return;
    this.writeQueue = this.writeQueue
      .catch(() => {})
      .then(() => this.persistPostgres());
    await this.writeQueue;
  }

  persistFile() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(this.state, null, 2));
    fs.renameSync(tempPath, this.filePath);
  }

  async persistPostgres() {
    await this.pool.query(
      `INSERT INTO ignis_protocol_state (id, payload, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`,
      ['primary', JSON.stringify(this.state)],
    );
  }

  isWritable() {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.accessSync(path.dirname(this.filePath), fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }

  async close() {
    if (this.pool) await this.pool.end();
  }
}

function normalizeState(input = {}) {
  const base = createDefaultState();
  const state = { ...base, ...input, meta: { ...base.meta, ...(input.meta || {}) } };
  for (const key of Object.keys(base)) {
    if (Array.isArray(base[key]) && !Array.isArray(state[key])) state[key] = [];
  }
  return state;
}

module.exports = { IgnisStorage };
