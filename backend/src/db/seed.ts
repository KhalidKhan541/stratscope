import { initDB, getDB } from './schema.js';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';

async function seed() {
  await initDB();
  const db = getDB();

  const demoId = uuid();
  const hash = bcrypt.hashSync('demo123', 10);

  db.prepare(`INSERT INTO users (id, email, password_hash, name, plan, analyses_limit) VALUES (?, ?, ?, ?, ?, ?)`).run(demoId, 'demo@stratscope.io', hash, 'Demo User', 'pro', 100);

  const competitors = [
    { name: 'Notion', url: 'https://notion.so', description: 'All-in-one workspace' },
    { name: 'Linear', url: 'https://linear.app', description: 'Issue tracking' },
    { name: 'Coda', url: 'https://coda.io', description: 'Doc-powered apps' },
  ];

  for (const c of competitors) {
    db.prepare(`INSERT INTO competitors (id, user_id, name, website_url, description) VALUES (?, ?, ?, ?, ?)`).run(uuid(), demoId, c.name, c.url, c.description);
  }

  console.log('Seed data inserted');
  process.exit(0);
}

seed();
