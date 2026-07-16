# StratScope

Competitive Intelligence Decoded - A SaaS platform for automated competitive analysis powered by AI agents.

## Project Structure

```
stratscope/
├── backend/          # Express + TypeScript API
│   ├── src/
│   │   ├── agents/   # AI agent logic
│   │   ├── scraper/  # Web scraping utilities
│   │   ├── routes/   # API route handlers
│   │   ├── db/       # Database schema & seed
│   │   ├── middleware/
│   │   └── utils/
│   ├── package.json
│   └── tsconfig.json
├── frontend/         # React + Vite + Tailwind
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── utils/
│   │   └── styles/
│   ├── package.json
│   └── vite.config.ts
├── .gitignore
└── README.md
```

## Quick Start

### Backend

```bash
cd backend
npm install
cp .env.example .env  # Configure your API keys
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` and proxies API requests to the backend on `http://localhost:3001`.

## Tech Stack

- **Backend:** Express, TypeScript, SQLite (better-sqlite3), Groq AI, Cheerio
- **Frontend:** React 18, Vite, Tailwind CSS, Zustand, React Router, Recharts
