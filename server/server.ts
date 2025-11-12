import * as http from 'http';
import * as url from 'url';
import * as dotenv from 'dotenv';
import OpenAI from 'openai';
import { IntegratedMCPService } from '../src/services/integratedMcpService';
import { ChatMessage } from '../src/types/global';

// Cargar variables de entorno
dotenv.config();

const PORT = process.env.PORT || 4000;
const API_KEY = process.env.OPENAI_API_KEY || '';
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

console.log('🔧 [Server] Iniciando servidor web con MCP service...');
console.log('🔑 [Server] Estado de la API Key:', {
  defined: !!API_KEY,
  length: API_KEY ? API_KEY.length : 0,
  firstChars: API_KEY ? API_KEY.substring(0, 8) + '...' : 'undefined'
});

if (!API_KEY) {
  console.warn('[Server] OPENAI_API_KEY no definido en entorno. Define en .env y reinicia.');
}

const client = new OpenAI({ apiKey: API_KEY });

// Inicializar IntegratedMCPService para el entorno web
let integratedMcpService: IntegratedMCPService | null = null;

if (API_KEY) {
  console.log('🚀 [Server] Inicializando IntegratedMCPService...');
  try {
    integratedMcpService = new IntegratedMCPService({
      apiKey: API_KEY,
      model: DEFAULT_MODEL
    });
    console.log('✅ [Server] IntegratedMCPService inicializado correctamente');
  } catch (error) {
    console.error('❌ [Server] Error inicializando IntegratedMCPService:', error);
  }
} else {
  console.error('❌ [Server] No se puede inicializar IntegratedMCPService: OPENAI_API_KEY no definida');
}

function setCors(res: http.ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3002');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const server = http.createServer(async (req: http.IncomingMessage, res: http.ServerResponse) => {
  const parsed = url.parse(req.url || '', true);
  
  if (req.method === 'OPTIONS') {
    setCors(res);
    res.writeHead(204);
    return res.end();
  }

  // Ruta para verificar el estado del MCP service
  if (req.method === 'GET' && parsed.pathname === '/api/mcp/status') {
    setCors(res);
    const status = {
      initialized: !!integratedMcpService,
      hasApiKey: !!API_KEY,
      model: DEFAULT_MODEL
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, status }));
  }

  // Ruta para obtener herramientas disponibles
  if (req.method === 'GET' && parsed.pathname === '/api/mcp/tools') {
    setCors(res);
    if (!integratedMcpService) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ 
        success: false, 
        message: 'IntegratedMCPService no está inicializado' 
      }));
    }

    try {
      const tools = integratedMcpService.getAvailableTools();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, tools }));
    } catch (error: any) {
      console.error('[Server] Error obteniendo herramientas:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ 
        success: false, 
        message: error?.message || 'Error obteniendo herramientas' 
      }));
    }
  }

  // Ruta para ejecutar herramientas
  if (req.method === 'POST' && parsed.pathname === '/api/mcp/tools/execute') {
    setCors(res);
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', async () => {
      try {
        if (!integratedMcpService) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ 
            success: false, 
            message: 'IntegratedMCPService no está inicializado' 
          }));
        }

        const payload = JSON.parse(body || '{}');
        const toolName = payload.tool;
        const toolArgs = payload.arguments || {};
        const currentFolder = payload.currentFolder;

        if (!toolName) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ 
            success: false, 
            message: 'El parámetro "tool" es requerido' 
          }));
        }

        console.log('🔧 [Server] Ejecutando herramienta:', toolName);

        // Usar el servicio MCP para ejecutar la herramienta
        const result = await integratedMcpService['mcpService'].callTool(toolName, toolArgs, 
          currentFolder ? { cwd: currentFolder } : undefined
        );
        
        console.log('✅ [Server] Herramienta ejecutada exitosamente:', toolName);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, result }));
      } catch (error: any) {
        console.error('[Server] Error ejecutando herramienta:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ 
          success: false, 
          message: error?.message || 'Error ejecutando herramienta',
          error: error instanceof Error ? error.message : 'Error desconocido'
        }));
      }
    });
    return;
  }

  // Ruta para enviar mensajes al MCP service
  if (req.method === 'POST' && parsed.pathname === '/api/mcp/send-message') {
    setCors(res);
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', async () => {
      try {
        if (!integratedMcpService) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ 
            success: false, 
            message: 'IntegratedMCPService no está inicializado' 
          }));
        }

        const payload = JSON.parse(body || '{}');
        const messages: ChatMessage[] = Array.isArray(payload.messages) ? payload.messages : [];
        const options = payload.options || {};

        console.log('📨 [Server] Enviando mensaje al MCP service:', {
          messagesCount: messages.length,
          options
        });

        const response = await integratedMcpService.sendMessage(messages, options);
        
        console.log('✅ [Server] Respuesta del MCP service recibida');
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, response }));
      } catch (err: any) {
        console.error('[Server] Error en MCP service:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ 
          success: false, 
          message: err?.message || 'Error desconocido en MCP service' 
        }));
      }
    });
    return;
  }

  // Ruta original para chat directo (sin MCP)
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
      } catch (err: any) {
        console.error('[Server] Error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, message: err?.message || 'Error desconocido' }));
      }
    });
    return;
  }

  // Ruta para streaming (sin MCP)
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
      } catch (err: any) {
        console.error('[Server] Stream error:', err);
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
  console.log(`🌐 [Server] Servidor iniciado en http://localhost:${PORT}`);
  console.log(`🔧 [Server] MCP Service: ${integratedMcpService ? 'Inicializado' : 'No inicializado'}`);
});