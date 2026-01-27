import { z } from 'zod'

export default defineMcpApp({
  description: 'Display weather information for a given location in an interactive UI',
  inputSchema: {
    location: z.string().default('Paris').describe('City name (e.g., "Paris", "New York")'),
    units: z.enum(['celsius', 'fahrenheit']).default('celsius').describe('Temperature units'),
  },
  ui: {
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weather</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 200px;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }
    .card {
      background: rgba(255,255,255,0.95);
      border-radius: 16px;
      padding: 24px 32px;
      text-align: center;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      min-width: 280px;
    }
    .loading { color: #666; }
    .location {
      font-size: 1.5rem;
      font-weight: 600;
      color: #333;
      margin-bottom: 8px;
    }
    .temp {
      font-size: 4rem;
      font-weight: 300;
      color: #667eea;
      line-height: 1;
    }
    .condition {
      font-size: 1.125rem;
      color: #666;
      margin-top: 8px;
    }
    .details {
      display: flex;
      justify-content: center;
      gap: 24px;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #eee;
    }
    .detail {
      text-align: center;
    }
    .detail-label {
      font-size: 0.75rem;
      color: #999;
      text-transform: uppercase;
    }
    .detail-value {
      font-size: 1rem;
      color: #333;
      font-weight: 500;
    }
    .refresh-btn {
      margin-top: 16px;
      padding: 8px 16px;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.875rem;
    }
    .refresh-btn:hover { background: #5a6fd6; }
  </style>
</head>
<body>
  <div class="card">
    <div id="content" class="loading">Loading weather data...</div>
  </div>

  <script type="module">
    const contentEl = document.getElementById('content');
    let currentLocation = '';
    let currentUnits = 'celsius';
    let requestId = 1;

    function sendRequest(method, params) {
      const id = requestId++;
      window.parent.postMessage({ jsonrpc: '2.0', id, method, params }, '*');
      return new Promise((resolve, reject) => {
        const handler = (event) => {
          if (event.data?.id === id) {
            window.removeEventListener('message', handler);
            if (event.data.error) reject(new Error(event.data.error.message));
            else resolve(event.data.result);
          }
        };
        window.addEventListener('message', handler);
        setTimeout(() => reject(new Error('Timeout')), 10000);
      });
    }

    function sendNotification(method, params) {
      window.parent.postMessage({ jsonrpc: '2.0', method, params }, '*');
    }

    function renderWeather(data) {
      const unitSymbol = data.units === 'fahrenheit' ? '°F' : '°C';
      contentEl.innerHTML = \`
        <div class="location">\${data.location}</div>
        <div class="temp">\${data.temperature}\${unitSymbol}</div>
        <div class="condition">\${data.condition}</div>
        <div class="details">
          <div class="detail">
            <div class="detail-label">Humidity</div>
            <div class="detail-value">\${data.humidity}%</div>
          </div>
          <div class="detail">
            <div class="detail-label">Wind</div>
            <div class="detail-value">\${data.wind} km/h</div>
          </div>
        </div>
        <button class="refresh-btn" id="refresh">Refresh</button>
      \`;

      document.getElementById('refresh')?.addEventListener('click', refreshWeather);
    }

    async function refreshWeather() {
      if (!currentLocation) return;
      try {
        contentEl.innerHTML = '<div class="loading">Refreshing...</div>';
        const result = await sendRequest('tools/call', {
          name: 'weather',
          arguments: { location: currentLocation, units: currentUnits }
        });
        // Result will come via ui/notifications/tool-result
      } catch (err) {
        contentEl.innerHTML = '<div class="loading">Failed to refresh</div>';
      }
    }

    window.addEventListener('message', (event) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.method === 'ui/notifications/tool-input') {
        const args = data.params?.arguments || {};
        currentLocation = args.location || 'Unknown';
        currentUnits = args.units || 'celsius';
      }

      if (data.method === 'ui/notifications/tool-result') {
        const result = data.params;
        if (result?.structuredContent) {
          renderWeather(result.structuredContent);
        } else if (result?.content?.[0]?.text) {
          contentEl.innerHTML = \`<div class="loading">\${result.content[0].text}</div>\`;
        }
      }
    });

    async function init() {
      try {
        await sendRequest('ui/initialize', {
          appCapabilities: { tools: {} },
          appInfo: { name: 'Weather App', version: '1.0.0' },
          protocolVersion: '2025-06-18'
        });
        sendNotification('ui/notifications/initialized', {});
      } catch (err) {
        console.error('Init error:', err);
      }
    }

    init();
  </script>
</body>
</html>`,
    prefersBorder: false,
  },
  handler: async ({ location, units }) => {
    // Simulate weather data (in a real app, this would call a weather API)
    const conditions = ['Sunny', 'Partly Cloudy', 'Cloudy', 'Rainy', 'Stormy']
    const condition = conditions[Math.floor(Math.random() * conditions.length)]

    // Generate random temperature
    let temperature = Math.round(15 + Math.random() * 20) // 15-35°C
    if (units === 'fahrenheit') {
      temperature = Math.round(temperature * 9 / 5 + 32)
    }

    const humidity = Math.round(40 + Math.random() * 40) // 40-80%
    const wind = Math.round(5 + Math.random() * 25) // 5-30 km/h

    const unitLabel = units === 'fahrenheit' ? '°F' : '°C'

    return {
      content: [{
        type: 'text',
        text: `Weather for ${location}: ${temperature}${unitLabel}, ${condition}. Humidity: ${humidity}%, Wind: ${wind} km/h.`,
      }],
      structuredContent: {
        location,
        temperature,
        units,
        condition,
        humidity,
        wind,
      },
    }
  },
})
