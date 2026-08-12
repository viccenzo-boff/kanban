/* eslint-disable no-console */
// Utilitários compartilhados pelos testes end-to-end.
// Requer o ambiente de desenvolvimento no ar (ver tests/e2e/README.md).

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const SOCKET_PATH = '/api/socketio';

const resultados = [];

const registrar = (nome, passou, detalhe) => {
  resultados.push({ nome, passou });
  console.log(`${passou ? 'PASS' : 'FALHA'} :: ${nome}${detalhe ? ' :: ' + detalhe : ''}`);
};

const encerrar = () => {
  const falhas = resultados.filter((r) => !r.passou);
  console.log(`\n===== ${resultados.length - falhas.length}/${resultados.length} testes passaram =====`);
  process.exit(falhas.length === 0 ? 0 : 1);
};

const post = async (path, body, token) => {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { authorization: token } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
};

const get = async (path, token) => {
  const res = await fetch(BASE + path, { headers: token ? { authorization: token } : {} });
  return { status: res.status, json: await res.json().catch(() => null) };
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// username tem limite de 15 caracteres na migration.
const sufixo = () => String(Date.now()).slice(-9);

// Cria usuário, faz login e devolve token, espaço pessoal e primeira coluna.
// O espaço pessoal e as colunas padrão são criados por trigger no banco.
const criarUsuario = async (prefixo) => {
  const stamp = sufixo();
  const dados = {
    nome: `E2E ${prefixo}`,
    username: `${prefixo}${stamp}`.slice(0, 15),
    email: `${prefixo}${stamp}@exemplo.test`,
    senha: 'SenhaForte123',
  };

  const criado = await post('/api/usuarios/novo', dados);
  if (criado.status !== 201 && criado.status !== 200) {
    throw new Error(`Falha ao criar usuário: ${criado.status} ${JSON.stringify(criado.json)}`);
  }

  const login = await post('/api/usuarios/login', { login: dados.username, senha: dados.senha });
  const token = login.json?.data;
  if (!token) throw new Error(`Falha no login: ${JSON.stringify(login.json)}`);

  const espaco = (await get('/api/espacos/listarEspacos', token)).json?.data?.[0];
  if (!espaco) throw new Error('Usuário criado sem espaço pessoal');

  const colunasRes = await get(`/api/colunas/listarColunas?id_espaco=${espaco.id}`, token);
  const coluna = colunasRes.json?.data?.colunas?.[0] ?? colunasRes.json?.data?.[0];
  if (!coluna) throw new Error('Espaço criado sem colunas padrão');

  return { dados, token, espaco, coluna };
};

// `prioridade` é obrigatória de fato, embora não conste em dadosObrigatorios.
const criarTarefa = (usuario, titulo) =>
  post(
    '/api/tarefas/criarTarefa',
    {
      titulo,
      descricao: titulo,
      prioridade: 'MEDIO',
      id_espaco: usuario.espaco.id,
      id_coluna: usuario.coluna.id,
    },
    usuario.token
  );

module.exports = { BASE, SOCKET_PATH, registrar, encerrar, post, get, sleep, criarUsuario, criarTarefa };
