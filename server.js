const express = require('express');
const Parser = require('rss-parser');
const parser = new Parser();
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ── LIVE AQI DATA (CPCB India - No API key needed) ──
app.get('/api/aqi/:city', async (req, res) => {
  try {
    const city = req.params.city;
    const url = `https://api.waqi.info/feed/${city}/?token=demo`;
    const response = await fetch(url);
    const data = await response.json();
    res.json({
      city: city,
      aqi: data.data?.aqi || 'N/A',
      status: getAQIStatus(data.data?.aqi),
      dominentpol: data.data?.dominentpol || 'N/A',
      updated: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: 'AQI fetch failed', message: err.message });
  }
});

// ── LIVE WEATHER ALERTS (Open-Meteo - No API key needed) ──
app.get('/api/weather/:city', async (req, res) => {
  const coords = {
    delhi:     { lat: 28.6139, lon: 77.2090 },
    mumbai:    { lat: 19.0760, lon: 72.8777 },
    bengaluru: { lat: 12.9716, lon: 77.5946 },
    chennai:   { lat: 13.0827, lon: 80.2707 },
    kolkata:   { lat: 22.5726, lon: 88.3639 },
    hyderabad: { lat: 17.3850, lon: 78.4867 },
    pune:      { lat: 18.5204, lon: 73.8567 },
    ahmedabad: { lat: 23.0225, lon: 72.5714 },
  };
  try {
    const city = req.params.city.toLowerCase();
    const c = coords[city] || coords.delhi;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&current=temperature_2m,weathercode,windspeed_10m,relative_humidity_2m&timezone=Asia/Kolkata`;
    const response = await fetch(url);
    const data = await response.json();
    res.json({
      city: city,
      temperature: data.current?.temperature_2m,
      humidity: data.current?.relative_humidity_2m,
      windspeed: data.current?.windspeed_10m,
      condition: getWeatherCondition(data.current?.weathercode),
      updated: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: 'Weather fetch failed', message: err.message });
  }
});

// ── PARLIAMENT BILLS (Sansad.in RSS Feed) ──
app.get('/api/parliament', async (req, res) => {
  try {
    const url = 'https://sansad.in/ls/bills';
    const response = await fetch(url, {
      headers: { 'User-Agent': 'CivicWatch-India/1.0' }
    });
    res.json({
      source: 'sansad.in',
      message: 'Parliament data — connect to Sansad API v2 for live bills',
      updated: new Date().toISOString(),
      bills_url: 'https://sansad.in/ls/bills'
    });
  } catch (err) {
    res.status(500).json({ error: 'Parliament fetch failed' });
  }
});

// ── GOLD & FUEL PRICES (No API key needed) ──
app.get('/api/prices', async (req, res) => {
  try {
    const goldUrl = 'https://api.metals.live/v1/spot/gold';
    const goldRes = await fetch(goldUrl);
    const goldData = await goldRes.json();
    res.json({
      gold_usd_per_oz: goldData[0]?.price || 'N/A',
      note: 'Multiply by 3.5 approx for INR per gram',
      updated: new Date().toISOString()
    });
  } catch (err) {
    res.json({ message: 'Price data temporarily unavailable', updated: new Date().toISOString() });
  }
});
// ── PARLIAMENT BILLS (PRS India RSS) ──
app.get('/api/parliament', async (req, res) => {
  try {
    const feed = await parser.parseURL('https://prsindia.org/rss/bills');
    const bills = feed.items.slice(0, 10).map(item => ({
      title: item.title,
      date: item.pubDate,
      link: item.link,
      desc: item.contentSnippet
    }));
    res.json({ bills, updated: new Date().toISOString() });
  } catch(err) {
    res.status(500).json({ error: 'Parliament feed failed', message: err.message });
  }
});

// ── LIVE ACTIVITY FEED (Parliament + News RSS) ──
app.get('/api/activity', async (req, res) => {
  try {
    const feed = await parser.parseURL('https://feeds.feedburner.com/ndtvnews-india-news');
    const items = feed.items.slice(0, 5).map(i => ({
      text: i.title,
      time: new Date(i.pubDate).toLocaleDateString('en-IN'),
      color: '#FF9933',
      link: i.link
    }));
    res.json({ items, updated: new Date().toISOString() });
  } catch(err) {
    res.status(500).json({ error: 'Activity feed failed', message: err.message });
  }
});
// ── HEALTH CHECK ──
app.get('/', (req, res) => {
  res.json({
    name: 'CivicWatch India API',
    version: '1.0.0',
    status: 'running',
    endpoints: [
      'GET /api/aqi/:city',
      'GET /api/weather/:city',
      'GET /api/parliament',
      'GET /api/prices'
    ],
    cities: ['delhi','mumbai','bengaluru','chennai','kolkata','hyderabad','pune','ahmedabad'],
    updated: new Date().toISOString()
  });
});

// ── HELPERS ──
function getAQIStatus(aqi) {
  if (!aqi) return 'Unknown';
  if (aqi <= 50)  return 'Good';
  if (aqi <= 100) return 'Satisfactory';
  if (aqi <= 200) return 'Moderate';
  if (aqi <= 300) return 'Poor';
  if (aqi <= 400) return 'Very Poor';
  return 'Severe';
}

function getWeatherCondition(code) {
  if (code === 0) return 'Clear Sky';
  if (code <= 3)  return 'Partly Cloudy';
  if (code <= 48) return 'Foggy';
  if (code <= 67) return 'Rainy';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Rain Showers';
  return 'Thunderstorm';
}

app.listen(PORT, () => {
  console.log(`CivicWatch India API running on port ${PORT}`);
});
