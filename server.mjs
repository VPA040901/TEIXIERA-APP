import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 4173;

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

const supabaseUrl = String(
  process.env.SUPABASE_URL || ''
).trim();

const supabaseSecretKey = String(
  process.env.SUPABASE_SECRET_KEY || ''
).trim();

const geminiApiKey = String(
  process.env.GEMINI_API_KEY || ''
).trim();

const supabase =
  supabaseUrl && supabaseSecretKey
    ? createClient(supabaseUrl, supabaseSecretKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false
        }
      })
    : null;

const gemini = geminiApiKey
  ? new GoogleGenAI({ apiKey: geminiApiKey })
  : null;

const sendJson = (res, status, body) => {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods':
      'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });

  res.end(JSON.stringify(body));
};

const readJson = req =>
  new Promise((resolve, reject) => {
    let body = '';

    req.on('data', chunk => {
      body += chunk;

      if (body.length > 500_000) {
        reject(new Error('payload too large'));
        req.destroy();
      }
    });

    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('invalid json'));
      }
    });

    req.on('error', reject);
  });

function normalizeRows(rows) {
  if (!Array.isArray(rows)) return [];

  return rows
    .filter(row => row && typeof row === 'object')
    .map(row => ({ ...row }));
}

/*
 * Campos principais que possuem colunas próprias no Supabase.
 * Os demais campos ficam dentro de "dados".
 */
const TABLES = {
  clientes: {
    columns: [
      'id',
      'nome',
      'telefone',
      'email',
      'cidade',
      'observacoes'
    ]
  },

  produtos: {
    columns: [
      'id',
      'nome',
      'codigo',
      'categoria',
      'preco',
      'custo',
      'estoque'
    ]
  },

  servicos: {
    columns: [
      'id',
      'nome',
      'categoria',
      'preco',
      'descricao'
    ]
  },

  pedidos: {
    columns: [
      'id',
      'numero',
      'cliente',
      'descricao',
      'total',
      'status',
      'data'
    ]
  },

  agenda: {
    columns: [
      'id',
      'titulo',
      'cliente',
      'data',
      'hora',
      'status',
      'obs'
    ]
  },

  lancamentos: {
    columns: [
      'id',
      'tipo',
      'descricao',
      'cliente',
      'categoria',
      'valor',
      'data',
      'forma'
    ]
  }
};

function splitRecord(table, record) {
  const definition = TABLES[table];

  if (!definition) {
    return {
      main: { ...record },
      dados: {}
    };
  }

  const main = {};
  const dados = {};

  for (const [key, value] of Object.entries(record)) {
    if (definition.columns.includes(key)) {
      main[key] = value;
    } else if (key !== 'created_at') {
      dados[key] = value;
    }
  }

  main.dados = dados;

  return { main, dados };
}

function mergeRecord(row) {
  if (!row || typeof row !== 'object') return row;

  const {
    dados,
    created_at,
    ...main
  } = row;

  return {
    ...main,
    ...(dados && typeof dados === 'object' ? dados : {})
  };
}

async function getTable(table) {
  if (!supabase) {
    throw new Error('Supabase não configurado no servidor.');
  }

  if (!TABLES[table]) {
    throw new Error(`Tabela não permitida: ${table}`);
  }

  const { data, error } = await supabase
    .from(table)
    .select('*')
    .order('created_at', {
      ascending: true,
      nullsFirst: true
    });

  if (error) throw error;

  return normalizeRows(data).map(mergeRecord);
}

async function upsertTable(table, rows) {
  if (!supabase) {
    throw new Error('Supabase não configurado no servidor.');
  }

  if (!TABLES[table]) {
    throw new Error(`Tabela não permitida: ${table}`);
  }

  const normalized = normalizeRows(rows);

  if (!normalized.length) {
    return;
  }

  const payload = normalized.map(record => {
    const { main } = splitRecord(table, record);

    return {
      ...main,
      id: String(record.id || crypto.randomUUID())
    };
  });

  const { error } = await supabase
    .from(table)
    .upsert(payload, {
      onConflict: 'id'
    });

  if (error) throw error;
}

async function deleteTableRecord(table, id) {
  if (!supabase) {
    throw new Error('Supabase não configurado no servidor.');
  }

  if (!TABLES[table]) {
    throw new Error(`Tabela não permitida: ${table}`);
  }

  const { error } = await supabase
    .from(table)
    .delete()
    .eq('id', id);

  if (error) throw error;
}

async function getConfig() {
  if (!supabase) {
    throw new Error('Supabase não configurado no servidor.');
  }

  const { data, error } = await supabase
    .from('config')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (error) throw error;

  if (!data) return {};

  return mergeRecord(data);
}

async function saveConfig(config) {
  if (!supabase) {
    throw new Error('Supabase não configurado no servidor.');
  }

  const main = {
    id: 1,
    empresa: config.empresa || '',
    telefone: config.telefone || '',
    email: config.email || '',
    endereco: config.endereco || '',
    moeda: config.moeda || 'BRL',
    dados: {}
  };

  const core = [
    'id',
    'empresa',
    'telefone',
    'email',
    'endereco',
    'moeda'
  ];

  for (const [key, value] of Object.entries(config)) {
    if (!core.includes(key)) {
      main.dados[key] = value;
    }
  }

  const { error } = await supabase
    .from('config')
    .upsert(main, {
      onConflict: 'id'
    });

  if (error) throw error;
}

async function getAllData() {
  const [
    clientes,
    produtos,
    servicos,
    pedidos,
    agenda,
    lancamentos,
    documentos,
    config
  ] = await Promise.all([
    getTable('clientes'),
    getTable('produtos'),
    getTable('servicos'),
    getTable('pedidos'),
    getTable('agenda'),
    getTable('lancamentos'),
    getDocuments(),
    getConfig()
  ]);

  return {
    clientes,
    produtos,
    servicos,
    pedidos,
    agenda,
    lancamentos,
    documentos,
    config
  };
}

async function getDocuments() {
  if (!supabase) {
    throw new Error('Supabase não configurado no servidor.');
  }

  const { data, error } = await supabase
    .from('documentos')
    .select('*')
    .order('created_at', {
      ascending: true,
      nullsFirst: true
    });

  if (error) throw error;

  return normalizeRows(data).map(row => ({
    id: row.id,
    ...(row.dados || {})
  }));
}

async function saveDocuments(rows) {
  if (!supabase) {
    throw new Error('Supabase não configurado no servidor.');
  }

  const normalized = normalizeRows(rows);

  if (!normalized.length) return;

  const payload = normalized.map(record => ({
    id: String(record.id || crypto.randomUUID()),
    dados: { ...record }
  }));

  for (const row of payload) {
    delete row.dados.id;
  }

  const { error } = await supabase
    .from('documentos')
    .upsert(payload, {
      onConflict: 'id'
    });

  if (error) throw error;
}

async function deleteDocument(id) {
  if (!supabase) {
    throw new Error('Supabase não configurado no servidor.');
  }

  const { error } = await supabase
    .from('documentos')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

async function interpretWithGemini(body) {
  if (!gemini) {
    throw new Error(
      'GEMINI_API_KEY não configurada no servidor.'
    );
  }

  const transcript = String(
    body.transcript || ''
  ).trim();

  const language = String(
    body.language || 'pt-BR'
  ).trim();

  const today = String(
    body.today || ''
  ).trim();

  const allowedActions = [
    'pedidos',
    'agenda',
    'financeiro',
    'clientes',
    'documentos'
  ];

  const requestedActions = Array.isArray(body.allowedActions)
    ? body.allowedActions.filter(action =>
        allowedActions.includes(action)
      )
    : allowedActions;

  if (!transcript) {
    throw new Error('Transcrição vazia.');
  }

  const prompt = `
Você é o assistente administrativo do sistema Teixeira Gestão.

Interprete a solicitação do usuário e transforme-a
em uma ação estruturada para revisão.

Idioma: ${language}
Data de hoje: ${today}

Ações permitidas:
${requestedActions.join(', ')}

Solicitação:
"${transcript}"

REGRAS:
- Escolha somente uma ação permitida.
- Nunca invente uma ação.
- Retorne SOMENTE JSON válido.
- Não use Markdown.
- Não coloque explicações fora do JSON.
- A IA NÃO salva nada no banco.
- O resultado será revisado pelo usuário antes de salvar.
- Datas devem estar em YYYY-MM-DD.
- Horários devem estar em HH:MM.
- Se uma informação não estiver disponível, use string vazia.

Formato:

{
  "action": "agenda",
  "summary": "Resumo curto da solicitação.",
  "fields": {
    "titulo": "",
    "cliente": "",
    "data": "",
    "hora": "",
    "status": "",
    "obs": ""
  }
}
`;

  const response = await gemini.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      temperature: 0.1,
      responseMimeType: 'application/json'
    }
  });

  const text = String(
    response.text || ''
  ).trim();

  if (!text) {
    throw new Error(
      'O Gemini não retornou uma resposta.'
    );
  }

  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(
      'O Gemini retornou JSON inválido.'
    );
  }

  const action = String(
    parsed.action || ''
  ).trim();

  if (!allowedActions.includes(action)) {
    throw new Error(
      'A IA retornou uma ação inválida.'
    );
  }

  return {
    action,
    summary: String(
      parsed.summary || ''
    ).trim(),
    fields:
      parsed.fields &&
      typeof parsed.fields === 'object'
        ? parsed.fields
        : {}
  };
}

async function testSupabase() {
  if (!supabase) {
    return {
      configured: false,
      connected: false
    };
  }

  const { error } = await supabase
    .from('config')
    .select('id')
    .limit(1);

  return {
    configured: true,
    connected: !error,
    error: error
      ? error.message
      : null
  };
}

http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods':
          'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'Access-Control-Allow-Headers':
          'Content-Type'
      });

      res.end();
      return;
    }

    const url = new URL(
      req.url,
      'http://localhost'
    );

    const pathname = decodeURIComponent(
      url.pathname
    );

    /*
     * LOGIN
     */
    if (
      pathname === '/api/login' &&
      req.method === 'POST'
    ) {
      const body = await readJson(req);

      const expectedUser = String(
        process.env.APP_USERNAME || ''
      ).trim().toUpperCase();

      const expectedPassword = String(
        process.env.APP_PASSWORD || ''
      );

      if (
        !expectedUser ||
        !expectedPassword
      ) {
        return sendJson(res, 503, {
          message:
            'Acesso ainda não configurado no servidor.'
        });
      }

      const username = String(
        body.username || ''
      ).trim().toUpperCase();

      const password = String(
        body.password || ''
      );

      if (
        username !== expectedUser ||
        password !== expectedPassword
      ) {
        return sendJson(res, 401, {
          message:
            'Usuário ou senha inválidos.'
        });
      }

      return sendJson(res, 200, {
        user: expectedUser
      });
    }

    /*
     * STATUS DO SERVIDOR
     */
    if (
      pathname === '/health' &&
      req.method === 'GET'
    ) {
      return sendJson(res, 200, {
        status: 'ok',
        supabaseConfigured: Boolean(supabase),
        geminiConfigured: Boolean(gemini)
      });
    }

    /*
     * STATUS DO SUPABASE
     */
    if (
      pathname === '/api/supabase/status' &&
      req.method === 'GET'
    ) {
      const status = await testSupabase();

      return sendJson(res, 200, status);
    }

    /*
     * BUSCAR TODOS OS DADOS
     */
    if (
      pathname === '/api/data' &&
      req.method === 'GET'
    ) {
      const data = await getAllData();

      return sendJson(res, 200, {
        ok: true,
        data
      });
    }

    /*
     * SALVAR UMA TABELA
     */
    if (
      pathname.startsWith('/api/data/') &&
      req.method === 'POST'
    ) {
      const table = pathname
        .replace('/api/data/', '')
        .replace(/\/+$/, '');

      const body = await readJson(req);

      if (table === 'documentos') {
        await saveDocuments(
          body.rows || []
        );
      } else if (table === 'config') {
        await saveConfig(
          body.data || {}
        );
      } else {
        await upsertTable(
          table,
          body.rows || []
        );
      }

      return sendJson(res, 200, {
        ok: true
      });
    }

    /*
     * EXCLUIR REGISTRO
     */
    if (
      pathname.startsWith('/api/data/') &&
      req.method === 'DELETE'
    ) {
      const parts = pathname
        .split('/')
        .filter(Boolean);

      const table = parts[2];
      const id = parts[3];

      if (!table || !id) {
        return sendJson(res, 400, {
          message:
            'Tabela ou ID não informado.'
        });
      }

      if (table === 'documentos') {
        await deleteDocument(id);
      } else {
        await deleteTableRecord(
          table,
          id
        );
      }

      return sendJson(res, 200, {
        ok: true
      });
    }

    /*
     * GEMINI
     */
    if (
      pathname === '/api/ai/interpret' &&
      req.method === 'POST'
    ) {
      const body = await readJson(req);

      try {
        const result =
          await interpretWithGemini(body);

        return sendJson(res, 200, result);
      } catch (error) {
        console.error(
          'Erro Gemini:',
          error
        );

        return sendJson(res, 500, {
          message:
            error instanceof Error
              ? error.message
              : 'Erro ao interpretar a solicitação com a IA.'
        });
      }
    }

    /*
     * ARQUIVOS DO SITE
     */
    const requested =
      pathname === '/'
        ? '/index.html'
        : pathname;

    const file = path.resolve(
      root,
      `.${requested}`
    );

    if (
      !file.startsWith(
        root + path.sep
      )
    ) {
      throw new Error(
        'invalid path'
      );
    }

    const body = await readFile(file);

    res.writeHead(200, {
      'Content-Type':
        types[path.extname(file)] ||
        'application/octet-stream',
      'Cache-Control':
        'no-cache',
      'Access-Control-Allow-Origin':
        '*'
    });

    res.end(body);

  } catch (error) {
    console.error(error);

    if (!res.headersSent) {
      res.writeHead(500, {
        'Content-Type':
          'application/json; charset=utf-8',
        'Access-Control-Allow-Origin':
          '*'
      });

      res.end(
        JSON.stringify({
          message:
            error instanceof Error
              ? error.message
              : 'Erro interno do servidor.'
        })
      );

      return;
    }

    res.end();
  }
}).listen(
  port,
  '0.0.0.0',
  () => {
    console.log(
      `Teixeira Gestão disponível na porta ${port}`
    );
  }
);