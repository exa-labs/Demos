// DOM Elements
const tickerInput = document.getElementById('ticker-input');
const exchangeSelect = document.getElementById('exchange-select');
const searchBtn = document.getElementById('search-btn');
const loadingSearch = document.getElementById('loading-search');
const loadingTicker = document.getElementById('loading-ticker');
const errorEl = document.getElementById('error');
const errorText = document.getElementById('error-text');
const resultsEl = document.getElementById('results');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  searchBtn.addEventListener('click', handleSearch);
  tickerInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch();
  });
});

// Handle search - two phase: fast results first, then AI enrichment
async function handleSearch() {
  const ticker = tickerInput.value.trim().toUpperCase();
  const exchange = exchangeSelect.value;

  if (!ticker) {
    showError('Please enter a ticker symbol');
    return;
  }

  hideError();
  hideResults();
  showLoading(ticker);

  try {
    // Phase 1: Fast search - display results immediately
    const searchResponse = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker, exchange })
    });

    const searchData = await searchResponse.json();

    if (!searchResponse.ok) {
      throw new Error(searchData.error || 'Search failed');
    }

    hideLoading();
    displayResults(searchData, false);
    showEnrichmentLoading();

    // Phase 2: Enrich with AI summaries and sentiment (async, updates UI when ready)
    enrichResults(searchData);

  } catch (error) {
    console.error('Search error:', error);
    hideLoading();
    showError(error.message || 'Failed to search. Please try again.');
  }
}

// Fetch AI enrichment and update UI
async function enrichResults(searchData) {
  try {
    const enrichResponse = await fetch('/api/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticker: searchData.ticker,
        professional: searchData.professional,
        twitter: searchData.twitter
      })
    });

    const enrichData = await enrichResponse.json();

    if (enrichResponse.ok) {
      displaySentimentBar('pro', enrichData.proSentiment, enrichData.professional.length);
      displaySentimentBar('twitter', enrichData.twitterSentiment, enrichData.twitter.length);
      displayProfessionalFeed(enrichData.professional);
      displayTwitterFeed(enrichData.twitter);
    }
  } catch (error) {
    console.error('Enrichment error:', error);
  } finally {
    hideEnrichmentLoading();
  }
}

// Display results - isEnriched=false means initial fast display without sentiment
function displayResults(data, isEnriched = true) {
  resultsEl.classList.remove('hidden');

  // Stock Chart
  const tvSymbol = initChart(data.ticker, data.exchange);
  document.getElementById('chart-ticker').textContent = data.ticker;
  document.getElementById('chart-link').href = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol)}`;

  // Banner
  document.getElementById('result-count').textContent = data.totalResults;
  const displayName = data.companyName ? `${data.companyName} (${data.ticker})` : data.ticker;
  document.getElementById('ticker-display').textContent = `Showing results for ${displayName} from the past 2 weeks`;

  // Professional sources
  document.getElementById('pro-count').textContent = `${data.professional.length} sources`;
  if (isEnriched && data.proSentiment) {
    displaySentimentBar('pro', data.proSentiment, data.professional.length);
  } else {
    displaySentimentBar('pro', null, 0);
  }
  displayProfessionalFeed(data.professional);

  // Twitter
  document.getElementById('twitter-count').textContent = `${data.twitter.length} tweets`;
  if (isEnriched && data.twitterSentiment) {
    displaySentimentBar('twitter', data.twitterSentiment, data.twitter.length);
  } else {
    displaySentimentBar('twitter', null, 0);
  }
  displayTwitterFeed(data.twitter);
}

// Initialize TradingView chart - minimal config for speed
function initChart(ticker, exchange) {
  const container = document.getElementById('tradingview-widget');
  container.innerHTML = '';

  // Map exchange to TradingView format
  const exchangeMap = {
    'NASDAQ': 'NASDAQ',
    'NYSE': 'NYSE',
    'TSE': 'TSE',
    'LSE': 'LSE',
    'HKEX': 'HKEX',
    'SSE': 'SSE',
    'XETRA': 'XETR',
    'ASX': 'ASX'
  };
  const tvExchange = exchangeMap[exchange] || exchange;
  const symbol = `${tvExchange}:${ticker}`;

  if (typeof TradingView !== 'undefined') {
    new TradingView.widget({
      symbol: symbol,
      interval: 'D',
      timezone: 'Etc/UTC',
      theme: 'light',
      style: '3',
      locale: 'en',
      hide_top_toolbar: true,
      hide_legend: true,
      hide_side_toolbar: true,
      allow_symbol_change: false,
      save_image: false,
      enable_publishing: false,
      withdateranges: false,
      details: false,
      hotlist: false,
      calendar: false,
      container_id: 'tradingview-widget',
      width: '100%',
      height: 350
    });
  } else {
    container.innerHTML = '<p class="no-data">Chart unavailable</p>';
  }

  return symbol;
}

// Display sentiment bar
function displaySentimentBar(prefix, sentiment, total) {
  if (!sentiment || total === 0) {
    document.getElementById(`${prefix}-bullish`).style.width = '0%';
    document.getElementById(`${prefix}-neutral`).style.width = '100%';
    document.getElementById(`${prefix}-bearish`).style.width = '0%';
    return;
  }

  const bullishPct = Math.round((sentiment.bullish / total) * 100);
  const neutralPct = Math.round((sentiment.neutral / total) * 100);
  const bearishPct = Math.round((sentiment.bearish / total) * 100);

  document.getElementById(`${prefix}-bullish`).style.width = `${bullishPct}%`;
  document.getElementById(`${prefix}-neutral`).style.width = `${neutralPct}%`;
  document.getElementById(`${prefix}-bearish`).style.width = `${bearishPct}%`;

  document.getElementById(`${prefix}-bullish-count`).textContent = sentiment.bullish;
  document.getElementById(`${prefix}-neutral-count`).textContent = sentiment.neutral;
  document.getElementById(`${prefix}-bearish-count`).textContent = sentiment.bearish;
}

// Display professional articles
function displayProfessionalFeed(articles) {
  const el = document.getElementById('professional-feed');

  if (!articles?.length) {
    el.innerHTML = '<p class="no-data">No professional sources found</p>';
    return;
  }

  el.innerHTML = articles.map(article => `
    <a href="${article.url || '#'}" target="_blank" rel="noopener" class="article-item-link">
      <div class="article-item ${article.sentiment || 'neutral'}">
        <div class="article-source">
          ${article.favicon ? `<img src="${article.favicon}" alt="" onerror="this.style.display='none'">` : ''}
          <span class="article-source-name">${article.source}</span>
          <span class="article-source-date">${formatDate(article.publishedDate)}</span>
          <span class="sentiment-tag ${article.sentiment || 'neutral'}">${article.sentiment || 'neutral'}</span>
        </div>
        <div class="article-title">${article.title || 'Untitled'}</div>
        ${article.summary ? `
          <div class="article-summary">${article.summary}</div>
        ` : ''}
      </div>
    </a>
  `).join('');
}

// Display Twitter feed
function displayTwitterFeed(tweets) {
  const el = document.getElementById('twitter-feed');

  if (!tweets?.length) {
    el.innerHTML = '<p class="no-data">No tweets found</p>';
    return;
  }

  el.innerHTML = tweets.map(tweet => `
    <div class="tweet-item ${tweet.sentiment || 'neutral'}">
      <div class="tweet-header">
        <span class="tweet-author">@${tweet.author || 'user'}</span>
        <span class="sentiment-tag ${tweet.sentiment || 'neutral'}">${tweet.sentiment || 'neutral'}</span>
        <span class="tweet-date">${formatDate(tweet.publishedDate)}</span>
      </div>
      <div class="tweet-text">${escapeHtml(tweet.text || tweet.title || '')}</div>
    </div>
  `).join('');
}

// Utility functions
function showLoading(ticker) {
  loadingTicker.textContent = ticker;
  loadingSearch.classList.remove('hidden');
  searchBtn.disabled = true;
}

function hideLoading() {
  loadingSearch.classList.add('hidden');
  searchBtn.disabled = false;
}

function showEnrichmentLoading() {
  document.getElementById('enrichment-loading').classList.remove('hidden');
}

function hideEnrichmentLoading() {
  document.getElementById('enrichment-loading').classList.add('hidden');
}

function showError(message) {
  errorText.textContent = message;
  errorEl.classList.remove('hidden');
}

function hideError() {
  errorEl.classList.add('hidden');
}

function hideResults() {
  resultsEl.classList.add('hidden');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

function truncate(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
