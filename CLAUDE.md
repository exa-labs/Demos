# Stock Sentiment Analyzer - Bank Demo

## Overview
Demo application showcasing Exa's API for financial intelligence. Enter a ticker symbol to see stock performance alongside sentiment analysis from professional sources vs retail investors (Reddit).

## Input
- **Ticker Symbol:** Text input (e.g., AAPL, TSLA, NVDA)
- **Time Range:** Dropdown (1W, 1M, 3M, 6M, 1Y)

## Output Sections

### 1. Stock Chart
Display price chart using a free API (Yahoo Finance via `yahoo-finance2` or similar).

### 2. Professional Sentiment
Search professional financial sites, summarize bull/bear arguments.

### 3. Reddit Sentiment
Search Reddit investing communities, summarize retail investor sentiment.

### 4. Sentiment Comparison
Visual comparison of professional vs retail sentiment with divergence indicator.

### 5. News Momentum (Creative Addition)
Show volume of news articles over time - sudden spikes often precede price moves.

### 6. Key Events Timeline (Creative Addition)
Extract and display recent significant events (earnings, FDA approvals, lawsuits, etc.)

---

## Data Structures

### API Response Format
```json
{
  "ticker": "AAPL",
  "companyName": "Apple Inc.",
  "price": {
    "current": 178.52,
    "change": 2.34,
    "changePercent": 1.33,
    "chart": [{ "date": "2024-01-15", "close": 176.18 }, ...]
  },
  "professional": {
    "sentiment": "bullish",
    "score": 65,
    "bullPoints": ["Strong services growth...", "AI integration..."],
    "bearPoints": ["China exposure...", "Valuation concerns..."],
    "sources": [
      { "title": "...", "url": "...", "source": "MarketWatch", "date": "..." }
    ]
  },
  "reddit": {
    "sentiment": "very_bullish",
    "score": 82,
    "bullPoints": ["Diamond hands...", "iPhone 16 hype..."],
    "bearPoints": ["Too expensive...", "Innovation slowing..."],
    "sources": [
      { "title": "...", "url": "...", "subreddit": "wallstreetbets", "date": "..." }
    ]
  },
  "divergence": {
    "score": 17,
    "label": "Moderate",
    "insight": "Retail investors more bullish than professionals"
  },
  "newsVolume": [
    { "date": "2024-01-15", "count": 45 },
    { "date": "2024-01-16", "count": 123 }
  ],
  "keyEvents": [
    { "date": "2024-01-25", "event": "Q1 Earnings Report", "sentiment": "positive" }
  ]
}
```

---

## Exa Search Domains

### Professional Sources
```javascript
const PROFESSIONAL_DOMAINS = [
  "marketwatch.com",
  "bloomberg.com",
  "reuters.com",
  "wsj.com",
  "cnbc.com",
  "fool.com",
  "seekingalpha.com",
  "barrons.com",
  "investopedia.com",
  "finance.yahoo.com"
];
```

### Reddit Sources
```javascript
const REDDIT_DOMAINS = [
  "reddit.com/r/wallstreetbets",
  "reddit.com/r/stocks",
  "reddit.com/r/investing",
  "reddit.com/r/stockmarket",
  "reddit.com/r/options"
];
```

---

## API Structure

### Step 1: Fetch Stock Data (Fast)
```javascript
// Get price data from Yahoo Finance
const stockData = await yahooFinance.quote(ticker);
const chartData = await yahooFinance.historical(ticker, { period1, period2 });
```

### Step 2: Exa Searches (Parallel)
```javascript
// Professional sentiment search
const proSearch = exa.search(`${companyName} stock analysis outlook`, {
  type: "neural",
  useAutoprompt: true,
  includeDomains: PROFESSIONAL_DOMAINS,
  startPublishedDate: thirtyDaysAgo,
  numResults: 15,
  contents: {
    text: { maxCharacters: 1000 }
  }
});

// Reddit sentiment search
const redditSearch = exa.search(`${ticker} ${companyName} stock`, {
  type: "neural",
  useAutoprompt: true,
  includeDomains: REDDIT_DOMAINS,
  startPublishedDate: thirtyDaysAgo,
  numResults: 15,
  contents: {
    text: { maxCharacters: 1000 }
  }
});

// News volume search (for momentum chart)
const newsVolumeSearch = exa.search(`${companyName} stock`, {
  type: "neural",
  includeDomains: PROFESSIONAL_DOMAINS,
  startPublishedDate: ninetyDaysAgo,
  numResults: 100  // Just need counts, not content
});

const [proResults, redditResults, newsResults] = await Promise.all([
  proSearch, redditSearch, newsVolumeSearch
]);
```

### Step 3: OpenAI Analysis
```javascript
const analysisPrompt = `Analyze these articles about ${companyName} (${ticker}).

PROFESSIONAL SOURCES:
${proResults.results.map(r => `- ${r.title}\n${r.text}`).join('\n\n')}

Provide:
1. Overall sentiment: "very_bearish", "bearish", "neutral", "bullish", or "very_bullish"
2. Sentiment score: -100 to +100
3. Top 3 bull arguments (brief, specific to this stock)
4. Top 3 bear arguments (brief, specific to this stock)

JSON format:
{
  "sentiment": "...",
  "score": <number>,
  "bullPoints": ["...", "...", "..."],
  "bearPoints": ["...", "...", "..."]
}`;
```

---

## UI Components

### Layout
```
┌─────────────────────────────────────────────────────────┐
│  [AAPL]  Search                    [1W] [1M] [3M] [1Y]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  APPLE INC.                              $178.52 +1.33% │
│  ▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▂▃▄▅▆▇ (Stock Chart)                   │
│                                                         │
├──────────────────────────┬──────────────────────────────┤
│   PROFESSIONAL SENTIMENT │     REDDIT SENTIMENT         │
│   ████████░░ 65 Bullish  │     ██████████░ 82 V.Bullish │
│                          │                              │
│   BULL CASE:             │     BULL CASE:               │
│   • Services growth      │     • iPhone 16 hype         │
│   • AI integration       │     • Vision Pro momentum    │
│                          │                              │
│   BEAR CASE:             │     BEAR CASE:               │
│   • China exposure       │     • Already priced in      │
│   • High valuation       │     • Competition heating up │
├──────────────────────────┴──────────────────────────────┤
│   SENTIMENT DIVERGENCE: 17 (Moderate)                   │
│   "Retail investors more bullish than professionals"    │
├─────────────────────────────────────────────────────────┤
│   NEWS MOMENTUM                                         │
│   ▁▂▁▃▂▁▂▁▁▂███▅▃▂▁ ← Spike on Jan 25 (Earnings)       │
├─────────────────────────────────────────────────────────┤
│   KEY EVENTS                                            │
│   • Jan 25: Q1 Earnings Beat  (+)                       │
│   • Jan 18: Analyst Upgrade   (+)                       │
│   • Jan 10: China Sales Drop  (-)                       │
└─────────────────────────────────────────────────────────┘
```

---

## Tech Stack
- **Frontend:** Vanilla HTML/CSS/JS (same pattern as Media Sentiment)
- **Backend:** Node.js + Express
- **APIs:**
  - Exa (search)
  - OpenAI GPT-4o-mini (summarization)
  - yahoo-finance2 (stock data)
- **Charts:** Chart.js or Lightweight Charts (TradingView)

---

## File Structure
```
stock-sentiment/
├── server.js           # Express server, API routes
├── sentiment.js        # OpenAI analysis logic
├── stock.js            # Yahoo Finance wrapper
├── public/
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   └── assets/
│       └── exa-logo-blue.svg
├── package.json
└── .env                # EXA_API_KEY, OPENAI_API_KEY
```

---

## CLI Usage
```bash
node server.js
# Opens at http://localhost:3001
```

---

## Environment Variables
```
EXA_API_KEY=your_exa_key
OPENAI_API_KEY=your_openai_key
```

---

## Color Scheme (Exa Brand)
```css
:root {
  --exa-blue: #1E40ED;
  --bg-marble: #FAF9F8;
  --bg-white: #FFFFFF;
  --text-primary: #1A1A1A;
  --text-secondary: #5F5F5F;
  --positive: #059669;
  --negative: #DC2626;
  --neutral: #6B7280;
}
```

---

## Sentiment Scoring
```javascript
// Sentiment labels
const SENTIMENT_LABELS = {
  very_bearish: { min: -100, max: -60, color: '#DC2626' },
  bearish:      { min: -60,  max: -20, color: '#F87171' },
  neutral:      { min: -20,  max: 20,  color: '#6B7280' },
  bullish:      { min: 20,   max: 60,  color: '#34D399' },
  very_bullish: { min: 60,   max: 100, color: '#059669' }
};

// Divergence calculation
const divergence = Math.abs(proScore - redditScore);
const divergenceLabel = divergence < 15 ? 'Low' : divergence < 35 ? 'Moderate' : 'High';
```

---

## Test Tickers
AAPL, TSLA, NVDA, MSFT, GOOGL, META, AMZN, GME, AMC, PLTR

---

## Notes
- Use `contents.text` in Exa to get article snippets for summarization
- Rate limit: 2-3 Exa calls per search (professional, reddit, news volume)
- Cache stock data for 5 minutes to reduce API calls
- Show loading states for each section independently
