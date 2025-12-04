import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from './tools.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-token', 'x-full-access-token'],
}));

app.options('/mcp', (req, res) => {
  res.sendStatus(204);
});
const port = 3000;

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] Received ${req.method} request for ${req.url}`);
  console.log('Request Headers:', req.headers);
  next();
});

app.post('/mcp', async (req, res) => {
  let apiToken = process.env.MARVIN_API_TOKEN || req.headers['x-api-token'] as string;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    apiToken = authHeader.substring(7);
  }
  const fullAccessToken = process.env.MARVIN_FULL_ACCESS_TOKEN || req.headers['x-full-access-token'] as string;
  if (!apiToken || !fullAccessToken) {
    console.error('Authorization failed: Missing API token or full access token.');
    res.status(401).send('Unauthorized. Provide API tokens via environment variables (MARVIN_API_TOKEN, MARVIN_FULL_ACCESS_TOKEN) or headers ("x-api-token", "x-full-access-token", or "Authorization: Bearer <token>").');
    return;
  }
  console.log('Authentication successful.');

  const server = createServer(apiToken, fullAccessToken);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  res.on('close', () => {
    transport.close();
  });

  await server.connect(transport);
  await transport.handleRequest(req as any, res as any);
});

app.get('*', (req, res) => {
  res.send(`
    <h1>MCP Server is running</h1>
    <p>This server provides an interface to the Amazing Marvin API via the Model Context Protocol.</p>
    <h2>Available Endpoints:</h2>
    <ul>
      <li><strong>POST /mcp</strong>: The main endpoint for MCP requests.</li>
    </ul>
  `);
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running at http://0.0.0.0:${port}`);
});