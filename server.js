require('dotenv').config();
const express = require('express');
const path = require('path');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const EXA_API_KEY = process.env.EXA_API_KEY || process.env.EXASEARCH_API_KEY;
const EXA_BASE_URL = 'https://api.exa.ai';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

let openai = null;
function getOpenAI() {
  if (!openai && OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  }
  return openai;
}

// Professional financial domains
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

// Exa search request
// Classify sentiment using OpenAI
async function classifySentiment(ticker, items, sourceType) {
  const client = getOpenAI();
  if (!client || !items.length) {
    return items.map(() => 'neutral');
  }

  const textsToClassify = items.map((item, i) =>
    `${i + 1}. "${item.title || ''}" - ${(item.text || '').slice(0, 200)}`
  ).join('\n');

  const prompt = `Classify each of the following ${sourceType} about ${ticker} stock as "bullish", "bearish", or "neutral".

${textsToClassify}

Respond with a JSON array of classifications in order, like: ["bullish", "neutral", "bearish", ...]
Only respond with the JSON array, nothing else.`;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a financial sentiment classifier. Classify stock-related content as bullish (positive outlook), bearish (negative outlook), or neutral. Respond only with a JSON array."
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.3
    });

    const content = response.choices[0].message.content.trim();
    const classifications = JSON.parse(content);
    return classifications;
  } catch (error) {
    console.error('Sentiment classification error:', error.message);
    return items.map(() => 'neutral');
  }
}

async function exaSearch(body) {
  const response = await fetch(`${EXA_BASE_URL}/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': EXA_API_KEY
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Exa API error: ${response.status} - ${error}`);
  }

  return response.json();
}

// Main search endpoint - only uses Exa search, no answer
app.post('/api/search', async (req, res) => {
  const { ticker } = req.body;

  if (!ticker) {
    return res.status(400).json({ error: 'Ticker symbol is required' });
  }

  if (!EXA_API_KEY) {
    return res.status(500).json({ error: 'EXA_API_KEY not configured' });
  }

  const upperTicker = ticker.toUpperCase();
  const exaStartTime = Date.now();

  try {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    // Run 2 searches in parallel for maximum speed
    const [professionalData, twitterData] = await Promise.all([
      // Professional sources + news combined (15 results)
      exaSearch({
        query: `${upperTicker} stock analysis outlook news`,
        type: 'auto',
        numResults: 15,
        includeDomains: PROFESSIONAL_DOMAINS,
        startPublishedDate: twoWeeksAgo.toISOString(),
        contents: {
          text: { maxCharacters: 800 },
          highlights: {
            numSentences: 2,
            highlightsPerUrl: 1,
            query: `${upperTicker} stock outlook`
          }
        }
      }).catch(err => ({ results: [], error: err.message })),

      // Twitter/X search (15 results)
      exaSearch({
        query: `${upperTicker} stock`,
        type: 'auto',
        category: 'tweet',
        numResults: 15,
        startPublishedDate: twoWeeksAgo.toISOString(),
        contents: {
          text: true
        }
      }).catch(err => ({ results: [], error: err.message }))
    ]);

    const exaSearchTime = Date.now() - exaStartTime;
    const analysisStartTime = Date.now();

    // Process professional results (first 10 for analysis, last 5 for news)
    const allProfessional = professionalData.results || [];
    const professional = allProfessional.slice(0, 10).map(r => ({
      title: r.title,
      url: r.url,
      text: r.text?.slice(0, 600),
      highlights: r.highlights,
      publishedDate: r.publishedDate,
      source: r.url ? new URL(r.url).hostname.replace('www.', '') : 'Unknown',
      favicon: r.favicon
    }));

    // Process Twitter results - ensure URLs go to x.com
    const twitter = twitterData.results?.map(r => {
      let url = r.url || '';
      // Convert twitter.com URLs to x.com
      if (url.includes('twitter.com')) {
        url = url.replace('twitter.com', 'x.com');
      }
      return {
        title: r.title,
        url: url,
        text: r.text?.slice(0, 280),
        publishedDate: r.publishedDate,
        author: r.author
      };
    }) || [];

    // Use remaining professional results as news (last 5)
    const news = allProfessional.slice(10, 15).map(r => ({
      title: r.title,
      url: r.url,
      text: r.text?.slice(0, 150),
      publishedDate: r.publishedDate,
      source: r.url ? new URL(r.url).hostname.replace('www.', '') : 'Unknown'
    }));

    // Classify sentiments in parallel
    const [proClassifications, twitterClassifications] = await Promise.all([
      classifySentiment(upperTicker, professional, 'professional articles'),
      classifySentiment(upperTicker, twitter, 'tweets')
    ]);

    // Add classifications to items
    professional.forEach((item, i) => {
      item.sentiment = proClassifications[i] || 'neutral';
    });
    twitter.forEach((item, i) => {
      item.sentiment = twitterClassifications[i] || 'neutral';
    });

    const analysisTime = Date.now() - analysisStartTime;

    // Calculate sentiment counts
    const countSentiments = (items) => {
      const counts = { bullish: 0, neutral: 0, bearish: 0 };
      items.forEach(item => {
        if (counts.hasOwnProperty(item.sentiment)) {
          counts[item.sentiment]++;
        } else {
          counts.neutral++;
        }
      });
      return counts;
    };

    res.json({
      ticker: upperTicker,
      exaSearchTime,
      analysisTime,
      totalResults: professional.length + twitter.length + news.length,
      professional,
      twitter,
      news,
      proSentiment: countSentiments(professional),
      twitterSentiment: countSentiments(twitter)
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      error: 'Search failed',
      message: error.message
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', hasApiKey: !!EXA_API_KEY });
});

app.listen(PORT, () => {
  console.log(`Stock Sentiment Analyzer running at http://localhost:${PORT}`);
  console.log(`Exa API Key configured: ${!!EXA_API_KEY}`);
});
