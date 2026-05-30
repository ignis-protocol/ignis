// db.js — SQLite via sql.js (pure JS, no native compile needed)
const path    = require('path');
const fs      = require('fs');
const initSql = require('sql.js');

const DB_PATH = path.join(__dirname, 'ignis.db');

let db;
let SQL;

async function initDB() {
  SQL = await initSql();
  
  // Load existing DB file if it exists
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Save to disk helper
  function save() {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }

  // Run schema
  db.run(`
    CREATE TABLE IF NOT EXISTS tokens (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      contract        TEXT    NOT NULL UNIQUE,
      tx_hash         TEXT    NOT NULL,
      block_number    INTEGER NOT NULL,
      deployer        TEXT    NOT NULL,
      name            TEXT    NOT NULL,
      symbol          TEXT    NOT NULL,
      supply          TEXT    NOT NULL,
      decimals        INTEGER NOT NULL DEFAULT 18,
      description     TEXT,
      website         TEXT,
      twitter         TEXT,
      gitlawb_repo    TEXT,
      lp_alloc        TEXT,
      vesting         TEXT,
      governance      TEXT,
      chain_id        INTEGER NOT NULL DEFAULT 8453,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS launches (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      token_id   INTEGER NOT NULL,
      event      TEXT    NOT NULL,
      data       TEXT,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS bonds (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      repo            TEXT    NOT NULL,
      token_contract  TEXT    NOT NULL,
      bonder          TEXT    NOT NULL,
      amount_ignis    TEXT    NOT NULL,
      tx_hash         TEXT,
      status          TEXT    NOT NULL DEFAULT 'active',
      last_commit_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      slashed_at      TEXT,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS tips (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      repo         TEXT    NOT NULL,
      commit_hash  TEXT    NOT NULL,
      contributor  TEXT    NOT NULL,
      tipper       TEXT    NOT NULL,
      amount_ignis TEXT    NOT NULL,
      tx_hash      TEXT,
      message      TEXT,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS launch_keys (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      address     TEXT    NOT NULL UNIQUE,
      ignis_bal   TEXT    NOT NULL DEFAULT '0',
      verified_at TEXT    NOT NULL DEFAULT (datetime('now')),
      eligible    INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      address    TEXT    NOT NULL,
      nonce      TEXT    NOT NULL UNIQUE,
      token      TEXT    UNIQUE,
      used       INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT    NOT NULL,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);
  save();

  // Helper: run query and save
  function run(sql, params = []) {
    db.run(sql, params);
    save();
  }

  // Helper: get one row
  function get(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    }
    stmt.free();
    return null;
  }

  // Helper: get all rows
  function all(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  }

  // Helper: run and return lastInsertRowid
  function runGetId(sql, params = []) {
    db.run(sql, params);
    const row = get('SELECT last_insert_rowid() as id');
    save();
    return row ? row.id : null;
  }

  return {
    db,

    // ── TOKENS ──
    insertToken(d) {
      return runGetId(`INSERT INTO tokens (contract,tx_hash,block_number,deployer,name,symbol,supply,decimals,description,website,twitter,gitlawb_repo,lp_alloc,vesting,governance,chain_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [d.contract,d.tx_hash,d.block_number,d.deployer,d.name,d.symbol,d.supply,d.decimals,d.description,d.website,d.twitter,d.gitlawb_repo,d.lp_alloc,d.vesting,d.governance,d.chain_id]);
    },
    getToken(q) {
      if (q && q.startsWith('0x')) return get('SELECT * FROM tokens WHERE LOWER(contract)=LOWER(?)',[q]);
      return get('SELECT * FROM tokens WHERE LOWER(symbol)=LOWER(?)',[q]);
    },
    getTokensByDeployer(a) { return all('SELECT * FROM tokens WHERE LOWER(deployer)=LOWER(?) ORDER BY created_at DESC',[a]); },
    listTokens(limit=20,offset=0) {
      const tokens = all('SELECT * FROM tokens ORDER BY created_at DESC LIMIT ? OFFSET ?',[limit,offset]);
      const tot = get('SELECT COUNT(*) as n FROM tokens');
      return { tokens, total: tot?tot.n:0, limit, offset };
    },
    searchTokens(q) {
      const like = `%${q}%`;
      return all('SELECT * FROM tokens WHERE name LIKE ? OR symbol LIKE ? OR description LIKE ? ORDER BY created_at DESC LIMIT 20',[like,like,like]);
    },
    logLaunch(tokenId,event,data=null) {
      run('INSERT INTO launches (token_id,event,data) VALUES (?,?,?)',[tokenId,event,data?JSON.stringify(data):null]);
    },
    recentActivity() { return all('SELECT name,symbol,contract,deployer,created_at FROM tokens ORDER BY created_at DESC LIMIT 10'); },

    // ── BONDS ──
    insertBond(d) { return runGetId('INSERT INTO bonds (repo,token_contract,bonder,amount_ignis,tx_hash,status,last_commit_at) VALUES (?,?,?,?,?,\'active\',datetime(\'now\'))',[d.repo,d.token_contract,d.bonder,d.amount_ignis,d.tx_hash]); },
    getBondByRepo(repo) { return get('SELECT * FROM bonds WHERE repo=? AND status=\'active\'',[repo]); },
    getBondsByBonder(a) { return all('SELECT * FROM bonds WHERE LOWER(bonder)=LOWER(?) ORDER BY created_at DESC',[a]); },
    listActiveBonds() { return all('SELECT * FROM bonds WHERE status=\'active\' ORDER BY created_at DESC LIMIT 20'); },
    updateBondCommit(repo) { run('UPDATE bonds SET last_commit_at=datetime(\'now\') WHERE repo=? AND status=\'active\'',[repo]); },
    slashBond(id) { run('UPDATE bonds SET status=\'slashed\',slashed_at=datetime(\'now\') WHERE id=?',[id]); },
    releaseBond(id) { run('UPDATE bonds SET status=\'released\' WHERE id=?',[id]); },
    getStaleBonds() { return all('SELECT * FROM bonds WHERE status=\'active\' AND last_commit_at < datetime(\'now\',\'-90 days\')'); },

    // ── TIPS ──
    insertTip(d) { return runGetId('INSERT INTO tips (repo,commit_hash,contributor,tipper,amount_ignis,tx_hash,message) VALUES (?,?,?,?,?,?,?)',[d.repo,d.commit_hash,d.contributor,d.tipper,d.amount_ignis,d.tx_hash,d.message]); },
    getTipsByContributor(a) { return all('SELECT * FROM tips WHERE LOWER(contributor)=LOWER(?) ORDER BY created_at DESC',[a]); },
    getTipsByRepo(repo) { return all('SELECT * FROM tips WHERE repo=? ORDER BY created_at DESC LIMIT 50',[repo]); },
    getTipsByCommit(hash) { return all('SELECT * FROM tips WHERE commit_hash=? ORDER BY created_at DESC',[hash]); },
    topContributors() { return all('SELECT contributor,SUM(CAST(amount_ignis AS REAL)) as total_earned,COUNT(*) as tip_count FROM tips GROUP BY contributor ORDER BY total_earned DESC LIMIT 10'); },

    // ── LAUNCH KEY ──
    upsertLaunchKey(d) { run('INSERT INTO launch_keys (address,ignis_bal,verified_at,eligible) VALUES (?,?,datetime(\'now\'),?) ON CONFLICT(address) DO UPDATE SET ignis_bal=excluded.ignis_bal,verified_at=datetime(\'now\'),eligible=excluded.eligible',[d.address,d.ignis_bal,d.eligible]); },
    getLaunchKey(a) { return get('SELECT * FROM launch_keys WHERE LOWER(address)=LOWER(?)',[a]); },

    // ── AUTH ──
    createAuthNonce(address,nonce) { run('INSERT INTO auth_sessions (address,nonce,expires_at) VALUES (?,?,datetime(\'now\',\'+10 minutes\'))',[address.toLowerCase(),nonce]); },
    getAuthNonce(nonce) { return get('SELECT * FROM auth_sessions WHERE nonce=? AND used=0 AND expires_at > datetime(\'now\')',[nonce]); },
    activateSession(nonce,token) { run('UPDATE auth_sessions SET token=?,used=1 WHERE nonce=?',[token,nonce]); },
    getSession(token) { return get('SELECT * FROM auth_sessions WHERE token=? AND expires_at > datetime(\'now\')',[token]); },
    extendSession(token) { run('UPDATE auth_sessions SET expires_at=datetime(\'now\',\'+24 hours\') WHERE token=?',[token]); },
    cleanExpiredSessions() { run('DELETE FROM auth_sessions WHERE expires_at < datetime(\'now\',\'-1 hour\')'); },

    // ── STATS (raw access) ──
    rawGet: get,
    rawAll: all,
  };
}

// Export a promise that resolves to the db object
let _db;
module.exports = {
  init: async () => {
    if (!_db) _db = await initDB();
    return _db;
  },
  getDB: () => _db,
};
