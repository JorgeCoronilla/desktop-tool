const http = require('http');
const url = require('url');
require('dotenv').config();
const OpenAI = require('openai');

const PORT = process.env.PORT || 4000;
const API_KEY = process.env.OPENAI_API_KEY || '';
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

if (!API_KEY) {
  console.warn('[proxy] OPENAI_API_KEY no definido en entorno. Define en .env y reinicia.');
}

const client = new OpenAI({ apiKey: API_KEY });

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3001');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  if (req.method === 'OPTIONS') {
    setCors(res);
    res.writeHead(204);
    return res.end();
  }

  if (req.method === 'POST' && parsed.pathname === '/api/chat') {
    setCors(res);
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', async () => {
      try {
        if (!API_KEY) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, message: 'Falta OPENAI_API_KEY en servidor.' }));
        }

        const payload = JSON.parse(body || '{}');
        const messages = Array.isArray(payload.messages) ? payload.messages : [];
        const model = payload.model || DEFAULT_MODEL;
        const maxTokens = Math.max(1, Math.min(4096, Number(payload.maxTokens) || 2000));

        const completion = await client.chat.completions.create({
          model,
          messages,
          temperature: 1,
          max_completion_tokens: maxTokens,
        });

        const content = completion.choices?.[0]?.message?.content || '';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, response: content }));
      } catch (err) {
        console.error('[proxy] Error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, message: err?.message || 'Error desconocido' }));
      }
    });
    return;
  }

  if (req.method === 'POST' && parsed.pathname === '/api/chat-stream') {
    setCors(res);
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', async () => {
      try {
        if (!API_KEY) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, message: 'Falta OPENAI_API_KEY en servidor.' }));
        }

        const payload = JSON.parse(body || '{}');
        const messages = Array.isArray(payload.messages) ? payload.messages : [];
        const model = payload.model || DEFAULT_MODEL;
        const maxTokens = Math.max(1, Math.min(4096, Number(payload.maxTokens) || 2000));

        const stream = await client.chat.completions.create({
          model,
          messages,
          temperature: 1,
          max_completion_tokens: maxTokens,
          stream: true,
        });

        res.writeHead(200, {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });

        for await (const chunk of stream) {
          const content = chunk.choices?.[0]?.delta?.content;
          if (content) {
            res.write(content);
          }
        }
        return res.end();
      } catch (err) {
        console.error('[proxy] Stream error:', err);
        // If headers not sent, send error JSON; else try to write error and end
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, message: err?.message || 'Error desconocido' }));
        } else {
          res.write(`\n[error] ${err?.message || 'Error desconocido'}`);
          return res.end();
        }
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: false, message: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`[proxy] Servidor iniciado en http://localhost:${PORT}`);
});