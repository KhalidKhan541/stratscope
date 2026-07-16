import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DATABASE_URL || './data/stratscope.db';
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

let db: SqlJsDatabase;

function saveDB() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

export function getDB() {
  if (!db) throw new Error('Database not initialized. Call initDB() first.');
  return {
    prepare(sql: string) {
      return {
        run(...params: any[]) {
          db.run(sql, params);
          saveDB();
          return { changes: db.getRowsModified() };
        },
        get(...params: any[]): any {
          const stmt = db.prepare(sql);
          stmt.bind(params);
          if (stmt.step()) {
            const cols = stmt.getColumnNames();
            const values = stmt.get();
            const row: any = {};
            cols.forEach((col, i) => { row[col] = values[i]; });
            stmt.free();
            return row;
          }
          stmt.free();
          return undefined;
        },
        all(...params: any[]): any[] {
          const results: any[] = [];
          const stmt = db.prepare(sql);
          stmt.bind(params);
          while (stmt.step()) {
            const cols = stmt.getColumnNames();
            const values = stmt.get();
            const row: any = {};
            cols.forEach((col, i) => { row[col] = values[i]; });
            results.push(row);
          }
          stmt.free();
          return results;
        },
      };
    },
    exec(sql: string) {
      db.run(sql);
      saveDB();
    },
  };
}

interface SnapshotData {
  competitorId: string;
  url: string;
  htmlContent?: string;
  textContent?: string;
  pricingData?: any;
  featuresData?: any;
  reviewData?: any;
  newsData?: any;
  techStack?: any;
  fundingInfo?: any;
  competitorMentions?: any;
  employeeCount?: string;
  sentimentScore?: string;
  researchMetadata?: any;
}

export function saveSnapshot(data: SnapshotData) {
  const database = getDB();
  const id = `snap_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const stmt = database.prepare(`
    INSERT INTO snapshots (id, competitor_id, url, html_content, text_content, pricing_data, features_data, review_data, news_data, tech_stack, funding_info, competitor_mentions, employee_count, sentiment_score, research_metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    data.competitorId,
    data.url,
    data.htmlContent || null,
    data.textContent || null,
    data.pricingData ? JSON.stringify(data.pricingData) : null,
    data.featuresData ? JSON.stringify(data.featuresData) : null,
    data.reviewData ? JSON.stringify(data.reviewData) : null,
    data.newsData ? JSON.stringify(data.newsData) : null,
    data.techStack ? JSON.stringify(data.techStack) : null,
    data.fundingInfo ? JSON.stringify(data.fundingInfo) : null,
    data.competitorMentions ? JSON.stringify(data.competitorMentions) : null,
    data.employeeCount || null,
    data.sentimentScore || null,
    data.researchMetadata ? JSON.stringify(data.researchMetadata) : null,
  );

  return id;
}

export async function initDB() {
  const SQL = await initSqlJs();
  
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      plan TEXT DEFAULT 'free',
      analyses_count INTEGER DEFAULT 0,
      analyses_limit INTEGER DEFAULT 3,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      onboarding_completed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS competitors (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      website_url TEXT NOT NULL,
      description TEXT,
      last_scraped_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id TEXT PRIMARY KEY,
      competitor_id TEXT NOT NULL,
      url TEXT NOT NULL,
      html_content TEXT,
      text_content TEXT,
      pricing_data TEXT,
      features_data TEXT,
      review_data TEXT,
      news_data TEXT,
      tech_stack TEXT,
      funding_info TEXT,
      competitor_mentions TEXT,
      employee_count TEXT,
      sentiment_score TEXT,
      research_metadata TEXT,
      scraped_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (competitor_id) REFERENCES competitors(id) ON DELETE CASCADE
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS analyses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      competitor_id TEXT NOT NULL,
      snapshot_id TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      extracted_patterns TEXT,
      psychological_profile TEXT,
      strategic_options TEXT,
      executive_brief TEXT,
      error_message TEXT,
      processing_time_ms INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (competitor_id) REFERENCES competitors(id) ON DELETE CASCADE
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      competitor_id TEXT NOT NULL,
      alert_type TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (competitor_id) REFERENCES competitors(id) ON DELETE CASCADE
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS monitoring (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      competitor_id TEXT NOT NULL,
      schedule TEXT DEFAULT 'weekly',
      enabled INTEGER DEFAULT 1,
      last_run TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (competitor_id) REFERENCES competitors(id) ON DELETE CASCADE
    );
  `);

  // Migrations for existing databases
  const migrations = [
    "ALTER TABLE users ADD COLUMN onboarding_completed INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN stripe_customer_id TEXT",
    "ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT",
    "ALTER TABLE analyses ADD COLUMN snapshot_diff TEXT",
  ];

  for (const sql of migrations) {
    try {
      db.run(sql);
    } catch {
      // Column already exists, ignore
    }
  }

  saveDB();
  console.log('Database initialized successfully');
}
