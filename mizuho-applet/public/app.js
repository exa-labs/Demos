// DOM Elements
const tickerInput = document.getElementById('ticker-input');
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

// Handle search
async function handleSearch() {
  const ticker = tickerInput.value.trim().toUpperCase();

  if (!ticker) {
    showError('Please enter a ticker symbol');
    return;
  }

  hideError();
  hideResults();
  showLoading(ticker);

  try {
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Search failed');
    }

    hideLoading();
    displayResults(data);

  } catch (error) {
    console.error('Search error:', error);
    hideLoading();
    showError(error.message || 'Failed to search. Please try again.');
  }
}

// Display results
function displayResults(data) {
  resultsEl.classList.remove('hidden');

  // Stock Chart
  initChart(data.ticker);
  document.getElementById('chart-ticker').textContent = data.ticker;

  // Banner - showcase Exa speed
  document.getElementById('exa-time').textContent = data.exaSearchTime;
  document.getElementById('analysis-time').textContent = data.analysisTime;
  document.getElementById('result-count').textContent = data.totalResults;
  document.getElementById('ticker-display').textContent = `Showing results for ${data.ticker} from the past 2 weeks`;

  // Professional sentiment bar
  displaySentimentBar('pro', data.proSentiment, data.professional.length);
  document.getElementById('pro-count').textContent = `${data.professional.length} sources`;
  displayProfessionalFeed(data.professional);

  // Twitter sentiment bar
  displaySentimentBar('twitter', data.twitterSentiment, data.twitter.length);
  document.getElementById('twitter-count').textContent = `${data.twitter.length} tweets`;
  displayTwitterFeed(data.twitter);

  // News
  displayNewsFeed(data.news);
}

// Initialize TradingView chart - minimal config for speed
function initChart(ticker) {
  const container = document.getElementById('tradingview-widget');
  container.innerHTML = '';

  if (typeof TradingView !== 'undefined') {
    new TradingView.widget({
      symbol: ticker,
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
    <div class="article-item ${article.sentiment || 'neutral'}">
      <div class="article-source">
        ${article.favicon ? `<img src="${article.favicon}" alt="" onerror="this.style.display='none'">` : ''}
        <span class="article-source-name">${article.source}</span>
        <span class="article-source-date">${formatDate(article.publishedDate)}</span>
        <span class="sentiment-tag ${article.sentiment || 'neutral'}">${article.sentiment || 'neutral'}</span>
      </div>
      <div class="article-title">
        ${article.url ? `<a href="${article.url}" target="_blank" rel="noopener">${article.title || 'Untitled'}</a>` : (article.title || 'Untitled')}
      </div>
      ${article.highlights?.length ? `
        <div class="article-highlight">"${article.highlights[0]}"</div>
      ` : (article.text ? `
        <div class="article-highlight">${truncate(article.text, 200)}</div>
      ` : '')}
    </div>
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

// Display news feed
function displayNewsFeed(news) {
  const el = document.getElementById('news-feed');

  if (!news?.length) {
    el.innerHTML = '<p class="no-data">No recent news found</p>';
    return;
  }

  el.innerHTML = news.map(item => `
    <div class="news-item">
      <div class="news-date">${formatDate(item.publishedDate)}</div>
      <div class="news-content">
        <div class="news-title">
          ${item.url ? `<a href="${item.url}" target="_blank" rel="noopener">${item.title || 'News'}</a>` : (item.title || 'News')}
        </div>
        ${item.text ? `<div class="news-excerpt">${truncate(item.text, 120)}</div>` : ''}
        <div class="news-source">${item.source}</div>
      </div>
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
