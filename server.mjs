import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
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

const databaseUrl = String(
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.NEON_DATABASE_URL ||
  ''
).trim();

const geminiApiKey = String(
  process.env.GEMINI_API_KEY || ''
).trim();

const database = databaseUrl
  ? new pg.Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('localhost')
        ? false
        : { rejectUnauthorized: false }
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
 * Campos principais preservados para a migração ao Neon.
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

async function legacyGetTable(table) {
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

async function legacyUpsertTable(table, rows) {
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

async function legacyDeleteTableRecord(table, id) {
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

async function legacyGetConfig() {
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

async function legacySaveConfig(config) {
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

async function legacyGetDocuments() {
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

async function legacySaveDocuments(rows) {
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

async function legacyDeleteDocument(id) {
  if (!supabase) {
    throw new Error('Supabase não configurado no servidor.');
  }

  const { error } = await supabase
    .from('documentos')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

/* Render Postgres: armazena cada registro como JSONB e preserva a API atual. */
let databaseSetup;

async function requireDatabase() {
  if (!database) {
    throw new Error('Banco de dados não configurado no servidor.');
  }

  databaseSetup ||= database.query(`
    CREATE TABLE IF NOT EXISTS app_records (
      type TEXT NOT NULL,
      id TEXT NOT NULL,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (type, id)
    )
  `);

  await databaseSetup;
  return database;
}

async function getRecords(type) {
  const client = await requireDatabase();
  const result = await client.query(
    'SELECT id, data FROM app_records WHERE type = $1 ORDER BY created_at ASC',
    [type]
  );
  return result.rows.map(row => ({ id: row.id, ...row.data }));
}

async function saveRecords(type, rows) {
  const normalized = normalizeRows(rows);
  if (!normalized.length) return;

  const client = await requireDatabase();
  for (const record of normalized) {
    const { id = crypto.randomUUID(), ...data } = record;
    await client.query(
      `INSERT INTO app_records (type, id, data)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (type, id) DO UPDATE SET data = EXCLUDED.data`,
      [type, String(id), JSON.stringify(data)]
    );
  }
}

async function deleteRecord(type, id) {
  const client = await requireDatabase();
  await client.query(
    'DELETE FROM app_records WHERE type = $1 AND id = $2',
    [type, String(id)]
  );
}

async function getTable(table) {
  if (!TABLES[table]) throw new Error(`Tabela não permitida: ${table}`);
  return getRecords(table);
}

async function upsertTable(table, rows) {
  if (!TABLES[table]) throw new Error(`Tabela não permitida: ${table}`);
  await saveRecords(table, rows);
}

async function deleteTableRecord(table, id) {
  if (!TABLES[table]) throw new Error(`Tabela não permitida: ${table}`);
  await deleteRecord(table, id);
}

async function getConfig() {
  const records = await getRecords('config');
  return records[0] || {};
}

async function saveConfig(config) {
  await saveRecords('config', [{ id: 'default', ...config }]);
}

async function getDocuments() {
  return getRecords('documentos');
}

async function saveDocuments(rows) {
  await saveRecords('documentos', rows);
}

async function deleteDocument(id) {
  await deleteRecord('documentos', id);
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

async function testDatabase() {
  if (!database) {
    return {
      configured: false,
      connected: false
    };
  }

  try {
    const client = await requireDatabase();
    await client.query('SELECT 1');
    return { configured: true, connected: true, error: null };
  } catch (error) {
    return {
      configured: true,
      connected: false,
      error: error instanceof Error ? error.message : 'Falha ao conectar ao banco.'
    };
  }
}

export async function handler(req, res) {
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
        databaseConfigured: Boolean(database),
        geminiConfigured: Boolean(gemini)
      });
    }

    /*
     * STATUS DO BANCO DE DADOS
     */
    if (
      pathname === '/api/database/status' &&
      req.method === 'GET'
    ) {
      const status = await testDatabase();

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
}

if (!process.env.VERCEL) http.createServer(handler).listen(
  port,
  '0.0.0.0',
  () => {
    console.log(
      `Teixeira Gestão disponível na porta ${port}`
    );
  }
);
