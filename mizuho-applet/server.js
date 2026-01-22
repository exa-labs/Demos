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

async function exaGetContents(urls) {
  const response = await fetch(`${EXA_BASE_URL}/contents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': EXA_API_KEY
    },
    body: JSON.stringify({
      urls,
      text: { maxCharacters: 1000 }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Exa Contents API error: ${response.status} - ${error}`);
  }

  return response.json();
}

async function generateSummary(ticker, title, text) {
  const client = getOpenAI();
  if (!client || !text) return null;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Generate a one-sentence summary of the article's relevance to the stock. Be concise and focus on the key insight."
        },
        {
          role: "user",
          content: `Stock: ${ticker}\nTitle: ${title}\nContent: ${text.slice(0, 800)}`
        }
      ],
      temperature: 0.3,
      max_tokens: 100
    });
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Summary generation error:', error.message);
    return null;
  }
}

// Map exchange codes to full names for better Exa search context
const EXCHANGE_NAMES = {
  'NASDAQ': 'NASDAQ',
  'NYSE': 'New York Stock Exchange NYSE',
  'TSE': 'Tokyo Stock Exchange',
  'LSE': 'London Stock Exchange',
  'HKEX': 'Hong Kong Stock Exchange',
  'SSE': 'Shanghai Stock Exchange',
  'XETRA': 'Frankfurt Stock Exchange XETRA',
  'ASX': 'Australian Securities Exchange'
};

// Look up company name from ticker and exchange using Exa
async function lookupCompanyName(ticker, exchangeName) {
  try {
    const result = await exaSearch({
      query: `${ticker} ${exchangeName} stock company`,
      type: 'auto',
      numResults: 3,
      contents: {
        text: { maxCharacters: 300 }
      }
    });

    if (result.results && result.results.length > 0) {
      // Extract company name from the first result's title
      // Titles often follow patterns like "Apple Inc. (AAPL)" or "AAPL - Apple Inc."
      const firstTitle = result.results[0].title || '';
      const firstText = result.results[0].text || '';

      // Use OpenAI to extract the company name
      const client = getOpenAI();
      if (client) {
        const response = await client.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "Extract the full company name from the given context. Respond with ONLY the company name, nothing else. If unclear, respond with just the ticker symbol."
            },
            {
              role: "user",
              content: `Ticker: ${ticker}\nExchange: ${exchangeName}\nTitle: ${firstTitle}\nText: ${firstText.slice(0, 200)}`
            }
          ],
          temperature: 0
        });
        const companyName = response.choices[0].message.content.trim();
        console.log(`Resolved ${ticker} on ${exchangeName} to: ${companyName}`);
        return companyName;
      }
    }
  } catch (error) {
    console.error('Company name lookup error:', error.message);
  }
  return ticker; // Fallback to ticker if lookup fails
}

// Main search endpoint - only uses Exa search, no answer
app.post('/api/search', async (req, res) => {
  const { ticker, exchange } = req.body;

  if (!ticker) {
    return res.status(400).json({ error: 'Ticker symbol is required' });
  }

  if (!EXA_API_KEY) {
    return res.status(500).json({ error: 'EXA_API_KEY not configured' });
  }

  const upperTicker = ticker.toUpperCase();
  const exchangeName = EXCHANGE_NAMES[exchange] || exchange || 'stock market';
  const exaStartTime = Date.now();

  try {
    // First, look up the company name for better search results
    const companyName = await lookupCompanyName(upperTicker, exchangeName);
    const searchTerm = companyName !== upperTicker ? `${companyName} (${upperTicker})` : upperTicker;

    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    // Build a focused query for professional sources
    const professionalQuery = `"${companyName}" stock news`;

    // Run 2 searches in parallel WITHOUT contents for speed
    const [professionalData, twitterData] = await Promise.all([
      exaSearch({
        query: professionalQuery,
        type: 'keyword',
        useAutoprompt: true,
        numResults: 10,
        startPublishedDate: twoWeeksAgo.toISOString()
      }).catch(err => ({ results: [], error: err.message })),

      exaSearch({
        query: `${searchTerm} stock`,
        type: 'auto',
        category: 'tweet',
        numResults: 10,
        startPublishedDate: twoWeeksAgo.toISOString(),
        contents: { text: true }
      }).catch(err => ({ results: [], error: err.message }))
    ]);

    const exaSearchTime = Date.now() - exaStartTime;
    const analysisStartTime = Date.now();

    // Process professional results - just titles/urls initially
    const allProfessional = professionalData.results || [];
    const professional = allProfessional.slice(0, 10).map(r => ({
      title: r.title,
      url: r.url,
      publishedDate: r.publishedDate,
      source: r.url ? new URL(r.url).hostname.replace('www.', '') : 'Unknown',
      favicon: r.favicon
    }));

    // Get contents for professional URLs and generate summaries
    const professionalUrls = professional.map(p => p.url).filter(Boolean);
    let contentsData = { results: [] };
    if (professionalUrls.length > 0) {
      try {
        contentsData = await exaGetContents(professionalUrls);
      } catch (err) {
        console.error('Contents fetch error:', err.message);
      }
    }

    // Map contents back to professional items and generate summaries
    const contentsByUrl = {};
    (contentsData.results || []).forEach(r => {
      contentsByUrl[r.url] = r.text;
    });

    // Generate summaries in parallel
    const summaryPromises = professional.map(item => {
      const text = contentsByUrl[item.url];
      if (text) {
        return generateSummary(upperTicker, item.title, text);
      }
      return Promise.resolve(null);
    });
    const summaries = await Promise.all(summaryPromises);
    professional.forEach((item, i) => {
      item.summary = summaries[i];
      item.text = contentsByUrl[item.url]?.slice(0, 300);
    });

    // Process Twitter results - ensure URLs go to x.com
    const twitter = twitterData.results?.map(r => {
      let url = r.url || '';
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

    // Classify sentiments in parallel
    const [proClassifications, twitterClassifications] = await Promise.all([
      classifySentiment(upperTicker, professional, 'professional articles'),
      classifySentiment(upperTicker, twitter, 'tweets')
    ]);

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
      companyName: companyName !== upperTicker ? companyName : null,
      exchange: exchange || 'NASDAQ',
      exaSearchTime,
      analysisTime,
      totalResults: professional.length + twitter.length,
      professional,
      twitter,
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
