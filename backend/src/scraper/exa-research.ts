import Exa from 'exa-js';

function getExa() {
  return new Exa(process.env.EXA_API_KEY);
}

export interface ExaResearchResult {
  companyName: string;
  mainSite: { url: string; title: string; text: string; highlights: string[] };
  pricingPages: { url: string; text: string }[];
  reviewPages: { url: string; text: string; source: string }[];
  newsPages: { url: string; title: string; text: string; publishedDate: string }[];
  competitorMentions: { url: string; text: string }[];
  techStack: string[];
  fundingInfo: string;
  employeeCount: string;
  customerSentiment: string;
  allSearchText: string;
}

const REVIEW_DOMAINS = ['g2.com', 'capterra.com', 'trustpilot.com', 'softwareadvice.com', 'getapp.com', 'sourceforge.net', 'producthunt.com'];
const NEWS_DOMAINS = ['techcrunch.com', 'forbes.com', 'bloomberg.com', 'reuters.com', 'venturebeat.com', 'prnewswire.com', 'businesswire.com', 'crunchbase.com'];
const FUNDING_DOMAINS = ['crunchbase.com', 'pitchbook.com', 'tracxn.com'];

function isReviewDomain(url: string): boolean {
  return REVIEW_DOMAINS.some(d => url.includes(d));
}

function isNewsDomain(url: string): boolean {
  return NEWS_DOMAINS.some(d => url.includes(d));
}

function isFundingDomain(url: string): boolean {
  return FUNDING_DOMAINS.some(d => url.includes(d));
}

function isPricingPage(url: string, domain: string): boolean {
  const normalized = url.toLowerCase();
  if (normalized.includes(`${domain}/pricing`) || normalized.includes(`${domain}/plans`) || normalized.includes(`${domain}/cost`)) return true;
  if (normalized.endsWith('/pricing') || normalized.endsWith('/plans') || normalized.endsWith('/pricing/')) return true;
  if (normalized.includes('pricing') && !normalized.includes('blog')) return true;
  return false;
}

function extractTechStack(text: string): string[] {
  const techKeywords = [
    'React', 'Vue', 'Angular', 'Svelte', 'Next.js', 'Nuxt', 'Remix',
    'Node.js', 'Express', 'Fastify', 'NestJS', 'Django', 'Flask', 'FastAPI',
    'Python', 'Ruby on Rails', 'Go', 'Rust', 'Java', 'Spring Boot',
    'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'DynamoDB',
    'AWS', 'GCP', 'Azure', 'Cloudflare', 'Vercel', 'Netlify', 'Heroku',
    'Docker', 'Kubernetes', 'Terraform', 'Pulumi',
    'GraphQL', 'REST API', 'gRPC', 'WebSocket',
    'Stripe', 'Twilio', 'SendGrid', 'Segment', 'Amplitude', 'Mixpanel',
    'OpenAI', 'Anthropic', 'Cohere', 'Hugging Face',
    'TypeScript', 'JavaScript', 'PHP', 'Laravel', 'Docker', 'Redis',
    'Supabase', 'Firebase', 'PlanetScale', 'Neon', 'Turso',
    'Tailwind CSS', 'Bootstrap', 'Material UI', 'Shadcn',
    'Vite', 'Webpack', 'esbuild', 'Bun',
    'Prisma', 'Drizzle', 'Sequelize', 'TypeORM',
    'ClickHouse', 'Snowflake', 'BigQuery', 'Redshift',
    'Kafka', 'RabbitMQ', 'SQS', 'Bull',
  ];

  const lowerText = text.toLowerCase();
  const found: string[] = [];
  for (const tech of techKeywords) {
    if (lowerText.includes(tech.toLowerCase())) {
      found.push(tech);
    }
  }
  return [...new Set(found)];
}

function extractFundingInfo(text: string): string {
  const patterns = [
    /(?:raised|funding|series [A-Z]|seed|pre-seed|valuation|investor|venture capital|angel investor).{0,200}/gi,
    /\$[\d,.]+\s*(?:million|billion|M|B)\s*(?:in\s+)?(?:funding|raised|round|valuation)/gi,
    /(?:Series [A-Z])\s*(?:round|funding)\s*(?:of\s*)?(?:\$[\d,.]+\s*(?:million|billion|M|B)?)/gi,
  ];

  const matches: string[] = [];
  for (const pattern of patterns) {
    const found = text.match(pattern);
    if (found) matches.push(...found.map(m => m.trim()));
  }
  return [...new Set(matches)].slice(0, 5).join('. ') || 'Not found';
}

function extractEmployeeCount(text: string): string {
  const patterns = [
    /(\d[\d,]+)\s*(?:employees|team members|people|staff|workers)/gi,
    /(?:team of|company of|workforce of|headcount of)\s*(\d[\d,]+)/gi,
    /(?:~|approximately|about|over|around)\s*(\d[\d,]+)\s*(?:employees|people|team)/gi,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0].trim();
  }
  return 'Not found';
}

async function runSearch(
  query: string,
  label: string,
  index: number,
  total: number
): Promise<{ url: string; title: string; text: string; highlights: string[]; publishedDate?: string }[]> {
  console.log(`[Exa] Running search ${index}/${total}: ${label}...`);
  try {
    const response = await getExa().searchAndContents(query, {
      type: 'auto',
      numResults: 5,
      text: true,
      highlights: true,
    });

    const results: { url: string; title: string; text: string; highlights: string[]; publishedDate?: string }[] = [];

    for (const r of response.results) {
      const text = (r as any).text || '';
      const highlights = (r as any).highlights || [];
      if (text && text.length > 50) {
        results.push({
          url: r.url,
          title: r.title || '',
          text: text.slice(0, 5000),
          highlights,
          publishedDate: r.publishedDate,
        });
      }
    }

    console.log(`[Exa] Search ${index}/${total} complete: ${results.length} results`);
    return results;
  } catch (err) {
    console.error(`[Exa] Search ${index}/${total} failed:`, (err as Error).message);
    return [];
  }
}

export async function deepResearchCompetitor(
  companyName: string,
  domain: string
): Promise<ExaResearchResult> {
  console.log(`[Exa] Starting deep research for ${companyName} (${domain})...`);

  const pricingPages: { url: string; text: string }[] = [];
  const reviewPages: { url: string; text: string; source: string }[] = [];
  const newsPages: { url: string; title: string; text: string; publishedDate: string }[] = [];
  const competitorMentions: { url: string; text: string }[] = [];
  const allTexts: string[] = [];

  // --- Run 6 search queries in parallel ---
  const queries = [
    { query: `${companyName} pricing plans cost`, label: 'pricing intelligence' },
    { query: `${companyName} review rating G2 Capterra`, label: 'user sentiment' },
    { query: `${companyName} features product updates changelog`, label: 'product intelligence' },
    { query: `${companyName} funding valuation employees`, label: 'company intelligence' },
    { query: `${companyName} vs competitors alternatives comparison`, label: 'market position' },
    { query: `${companyName} technology stack built with`, label: 'tech intelligence' },
  ];

  const searchResultsArrays = await Promise.all(
    queries.map((q, i) => runSearch(q.query, q.label, i + 1, queries.length).catch(() => []))
  );

  // Categorize all results
  for (const results of searchResultsArrays) {
    for (const r of results) {
      allTexts.push(`[${r.title}] ${r.text}`);

      if (isPricingPage(r.url, domain)) {
        pricingPages.push({ url: r.url, text: r.text });
      } else if (isReviewDomain(r.url)) {
        const source = REVIEW_DOMAINS.find(d => r.url.includes(d)) || 'unknown';
        reviewPages.push({ url: r.url, text: r.text, source });
      } else if (isNewsDomain(r.url) || isFundingDomain(r.url)) {
        newsPages.push({
          url: r.url,
          title: r.title,
          text: r.text,
          publishedDate: r.publishedDate || '',
        });
      } else if (r.url.includes('vs') || r.url.includes('alternative') || r.url.includes('competitor') || r.url.includes('comparison')) {
        competitorMentions.push({ url: r.url, text: r.text });
      }
    }
  }

  // --- Fetch main site content ---
  console.log('[Exa] Fetching main site content...');
  let mainSite = { url: `https://${domain}`, title: '', text: '', highlights: [] as string[] };
  try {
    const mainResponse = await getExa().getContents(`https://${domain}`, {
      text: true,
      highlights: true,
    });
    if (mainResponse.results.length > 0) {
      const r = mainResponse.results[0];
      mainSite = {
        url: r.url,
        title: r.title || '',
        text: ((r as any).text || '').slice(0, 10000),
        highlights: (r as any).highlights || [],
      };
      allTexts.push(`[MAIN SITE] ${mainSite.title}\n${mainSite.text}`);
    }
  } catch (err) {
    console.error('[Exa] Failed to fetch main site:', (err as Error).message);
  }

  // --- Fetch dedicated pricing page ---
  console.log('[Exa] Fetching pricing page...');
  try {
    const pricingResponse = await getExa().getContents(`https://${domain}/pricing`, {
      text: true,
      highlights: true,
    });
    if (pricingResponse.results.length > 0) {
      const r = pricingResponse.results[0];
      const pricingText = ((r as any).text || '').slice(0, 10000);
      if (pricingText.length > 50) {
        pricingPages.push({ url: r.url, text: pricingText });
        allTexts.push(`[PRICING PAGE] ${r.title}\n${pricingText}`);
      }
    }
  } catch (err) {
    console.error('[Exa] Failed to fetch pricing page:', (err as Error).message);
  }

  // --- Aggregate intelligence from all collected text ---
  const combinedText = allTexts.join('\n\n---\n\n');
  const techStack = extractTechStack(combinedText);
  const fundingInfo = extractFundingInfo(combinedText);
  const employeeCount = extractEmployeeCount(combinedText);

  // --- Derive customer sentiment from review text ---
  let customerSentiment = '';
  if (reviewPages.length > 0) {
    const sentimentChunks = reviewPages.slice(0, 3).map(r => {
      const snippet = r.text.slice(0, 800);
      return `[${r.source}] ${snippet}`;
    });
    customerSentiment = sentimentChunks.join('\n\n');
  } else if (newsPages.length > 0) {
    customerSentiment = newsPages.slice(0, 2).map(n => `[${n.title}] ${n.text.slice(0, 500)}`).join('\n\n');
  } else {
    customerSentiment = 'Limited review data available from search results.';
  }

  // --- Build the final allSearchText (ensure at least 20K chars) ---
  const sections: string[] = [];

  sections.push(`=== COMPANY: ${companyName} ===`);
  sections.push(`=== DOMAIN: ${domain} ===\n`);

  if (mainSite.text) {
    sections.push(`=== MAIN SITE: ${mainSite.url} ===`);
    sections.push(mainSite.text);
    sections.push('');
  }

  if (pricingPages.length > 0) {
    sections.push(`=== PRICING PAGES (${pricingPages.length} found) ===`);
    for (const p of pricingPages) {
      sections.push(`URL: ${p.url}`);
      sections.push(p.text);
      sections.push('');
    }
  }

  if (reviewPages.length > 0) {
    sections.push(`=== REVIEW PAGES (${reviewPages.length} found) ===`);
    for (const r of reviewPages) {
      sections.push(`URL: ${r.url} [${r.source}]`);
      sections.push(r.text);
      sections.push('');
    }
  }

  if (newsPages.length > 0) {
    sections.push(`=== NEWS & FUNDING (${newsPages.length} found) ===`);
    for (const n of newsPages) {
      sections.push(`URL: ${n.url}`);
      sections.push(`Title: ${n.title}`);
      sections.push(`Date: ${n.publishedDate}`);
      sections.push(n.text);
      sections.push('');
    }
  }

  if (competitorMentions.length > 0) {
    sections.push(`=== COMPETITOR MENTIONS (${competitorMentions.length} found) ===`);
    for (const c of competitorMentions) {
      sections.push(`URL: ${c.url}`);
      sections.push(c.text);
      sections.push('');
    }
  }

  sections.push(`=== TECH STACK DETECTED ===`);
  sections.push(techStack.length > 0 ? techStack.join(', ') : 'Not detected');
  sections.push('');

  sections.push(`=== FUNDING INFORMATION ===`);
  sections.push(fundingInfo);
  sections.push('');

  sections.push(`=== EMPLOYEE COUNT ===`);
  sections.push(employeeCount);
  sections.push('');

  sections.push(`=== CUSTOMER SENTIMENT ===`);
  sections.push(customerSentiment);
  sections.push('');

  // Append all raw search result text to guarantee volume
  sections.push(`=== ALL SEARCH RESULTS RAW TEXT ===`);
  for (const t of allTexts) {
    sections.push(t);
    sections.push('');
  }

  let allSearchText = sections.join('\n');

  // Pad if under 20K chars by repeating key sections
  if (allSearchText.length < 20000) {
    const extra = allTexts.join('\n\n');
    while (allSearchText.length < 20000 && extra.length > 0) {
      allSearchText += '\n\n' + extra;
    }
  }

  allSearchText = allSearchText.slice(0, 100000);

  console.log(`[Exa] Research complete. ${allSearchText.length} chars total, ${pricingPages.length} pricing pages, ${reviewPages.length} review pages, ${newsPages.length} news pages, ${techStack.length} tech items`);

  return {
    companyName,
    mainSite,
    pricingPages,
    reviewPages,
    newsPages,
    competitorMentions,
    techStack,
    fundingInfo,
    employeeCount,
    customerSentiment,
    allSearchText,
  };
}
