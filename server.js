// server.js
// -----------------------------------------------------------------------------
// Ponto de entrada da API "Controle de Ativos - Shopee Xpress".
// ResponsÃ¡vel por configurar middlewares globais, CORS e registrar as rotas.
// -----------------------------------------------------------------------------

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

// Garante que o database.js seja executado e as tabelas criadas
// assim que o servidor sobe.
require('./database');

const rotasUsuarios = require('./routes/usuarios');
const rotasAtivos = require('./routes/ativos');
const rotasRequisicoes = require('./routes/requisicoes');
const { router: rotasAuth } = require('./routes/auth');
const rotasAuditoria = require('./routes/auditoria');

const app = express();
const PORTA = process.env.PORT || 3001;

// -----------------------------------------------------------------------------
// MIDDLEWARES GLOBAIS
// -----------------------------------------------------------------------------

// Helmet adiciona diversos headers HTTP de seguranÃ§a (proteÃ§Ã£o bÃ¡sica
// contra XSS, sniffing de MIME type, clickjacking, etc).
app.use(helmet());

// Interpreta corpo das requisiÃ§Ãµes em JSON (necessÃ¡rio para POST/PATCH)
app.use(express.json());

/**
 * CONFIGURAÃ‡ÃƒO DE CORS
 * -----------------------------------------------------------------
 * Como o front-end (HTML/CSS/JS estÃ¡tico) roda em uma origem diferente
 * da API (ex: aberto via Live Server em http://127.0.0.1:5500, ou
 * file://), precisamos liberar explicitamente essas origens.
 *
 * Em produÃ§Ã£o, troque a lista abaixo pelo(s) domÃ­nio(s) real(is)
 * do sistema interno (ex: 'https://ativos.shopeexpress.internal').
 */
const origensPermitidas = [
  'null',
  `http://localhost:${PORTA}`,
  `http://127.0.0.1:${PORTA}`,
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:5173', // caso use Vite
  'http://localhost:3000',
  'https://inventory-rj02.onrender.com',
  ...(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Permite ferramentas como Postman/cURL (sem "origin") e as origens da lista
      const origemRender = typeof origin === 'string' && /^https:\/\/[a-z0-9-]+\.onrender\.com$/i.test(origin);
      if (!origin || origensPermitidas.includes(origin) || origemRender) {
        callback(null, true);
      } else {
        callback(new Error('Origem nÃ£o permitida pelo CORS.'));
      }
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'site-controle-ativo.html')));

// -----------------------------------------------------------------------------
// ROTAS
// -----------------------------------------------------------------------------

app.get('/api/health', (req, res) => {
  res.json({ sucesso: true, mensagem: 'API de Controle de Ativos operando normalmente.' });
});

app.use('/api/auth', rotasAuth);
app.use('/api/usuarios', rotasUsuarios);
app.use('/api/ativos', rotasAtivos);
app.use('/api/requisicoes', rotasRequisicoes);
app.use('/api/auditoria', rotasAuditoria);

// -----------------------------------------------------------------------------
// TRATAMENTO DE ROTA NÃƒO ENCONTRADA (404)
// -----------------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ sucesso: false, mensagem: 'Endpoint nÃ£o encontrado.' });
});

// -----------------------------------------------------------------------------
// TRATAMENTO GLOBAL DE ERROS (ex: erro de CORS lanÃ§ado acima)
// -----------------------------------------------------------------------------
app.use((erro, req, res, next) => {
  console.error('[Erro nÃ£o tratado]', erro.message);
  res.status(500).json({ sucesso: false, mensagem: erro.message || 'Erro interno do servidor.' });
});

app.listen(PORTA, () => {
  console.log(`âœ… API Controle de Ativos rodando em http://localhost:${PORTA}`);
});


