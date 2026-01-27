import { z } from 'zod'

export default defineMcpApp({
  name: 'counter',
  title: 'Interactive Counter',
  description: 'An interactive counter app that demonstrates MCP Apps with UI. The user can increment/decrement the counter directly in the UI.',
  inputSchema: {
    initialValue: z.number().default(0).describe('Initial counter value'),
  },
  ui: {
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Counter App</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 200px;
      background: var(--color-background-primary, #f5f5f5);
      color: var(--color-text-primary, #1a1a1a);
      padding: 20px;
    }
    .container {
      text-align: center;
      background: var(--color-background-secondary, white);
      padding: 24px 32px;
      border-radius: var(--border-radius-lg, 12px);
      box-shadow: var(--shadow-md, 0 4px 6px rgba(0,0,0,0.1));
    }
    h1 {
      font-size: 1.25rem;
      margin-bottom: 16px;
      color: var(--color-text-secondary, #666);
    }
    .counter {
      font-size: 3rem;
      font-weight: bold;
      margin: 16px 0;
      font-variant-numeric: tabular-nums;
    }
    .buttons {
      display: flex;
      gap: 12px;
      justify-content: center;
    }
    button {
      font-size: 1.5rem;
      width: 48px;
      height: 48px;
      border: none;
      border-radius: var(--border-radius-md, 8px);
      background: var(--color-background-info, #3b82f6);
      color: white;
      cursor: pointer;
      transition: transform 0.1s, background 0.2s;
    }
    button:hover {
      background: #2563eb;
    }
    button:active {
      transform: scale(0.95);
    }
    .status {
      margin-top: 16px;
      font-size: 0.875rem;
      color: var(--color-text-muted, #888);
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Interactive Counter</h1>
    <div class="counter" id="count">0</div>
    <div class="buttons">
      <button id="decrement">−</button>
      <button id="increment">+</button>
    </div>
    <div class="status" id="status">Connecting...</div>
  </div>

  <script type="module">
    // MCP App client setup
    let count = 0;
    const countEl = document.getElementById('count');
    const statusEl = document.getElementById('status');
    const incrementBtn = document.getElementById('increment');
    const decrementBtn = document.getElementById('decrement');

    // Simple postMessage-based MCP communication
    let requestId = 1;

    function sendRequest(method, params) {
      const id = requestId++;
      window.parent.postMessage({ jsonrpc: '2.0', id, method, params }, '*');
      return new Promise((resolve, reject) => {
        const handler = (event) => {
          if (event.data?.id === id) {
            window.removeEventListener('message', handler);
            if (event.data.error) {
              reject(new Error(event.data.error.message));
            } else {
              resolve(event.data.result);
            }
          }
        };
        window.addEventListener('message', handler);
      });
    }

    function sendNotification(method, params) {
      window.parent.postMessage({ jsonrpc: '2.0', method, params }, '*');
    }

    // Handle incoming messages from host
    window.addEventListener('message', (event) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      // Handle tool input (initial value)
      if (data.method === 'ui/notifications/tool-input') {
        const args = data.params?.arguments || {};
        count = args.initialValue ?? 0;
        countEl.textContent = count;
        statusEl.textContent = 'Ready';
      }

      // Handle tool result
      if (data.method === 'ui/notifications/tool-result') {
        statusEl.textContent = 'Tool completed';
      }
    });

    // Initialize connection
    async function init() {
      try {
        await sendRequest('ui/initialize', {
          appCapabilities: {},
          appInfo: { name: 'Counter App', version: '1.0.0' },
          protocolVersion: '2025-06-18'
        });
        sendNotification('ui/notifications/initialized', {});
        statusEl.textContent = 'Connected';
      } catch (err) {
        statusEl.textContent = 'Connection failed';
        console.error('Init error:', err);
      }
    }

    // Button handlers
    function updateCount(delta) {
      count += delta;
      countEl.textContent = count;

      // Update model context so the AI knows the current value
      sendRequest('ui/update-model-context', {
        content: [{ type: 'text', text: \`Counter value: \${count}\` }],
        structuredContent: { count }
      }).catch(console.error);
    }

    incrementBtn.addEventListener('click', () => updateCount(1));
    decrementBtn.addEventListener('click', () => updateCount(-1));

    // Start
    init();
  </script>
</body>
</html>`,
    csp: {
      // No external domains needed for this simple example
    },
    visibility: ['model', 'app'],
    prefersBorder: true,
  },
  handler: async ({ initialValue }) => {
    return {
      content: [{
        type: 'text',
        text: `Counter initialized with value: ${initialValue}. The interactive UI allows incrementing and decrementing the counter.`,
      }],
      structuredContent: {
        initialValue,
        description: 'Interactive counter app',
      },
    }
  },
})
