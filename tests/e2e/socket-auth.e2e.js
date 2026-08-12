/* eslint-disable no-console */
// Autenticação e autorização do Socket.IO.
// Ver tests/e2e/README.md — exige ambiente no ar.
const { io } = require('socket.io-client');
const {
  BASE, SOCKET_PATH, registrar, encerrar, get, post, sleep, criarUsuario, criarTarefa,
} = require('./helpers');

const JOIN_MS = 2000;        // margem para o join (faz roundtrip no banco)
const RECEBIMENTO_MS = 5000; // margem para o NOTIFY chegar

const tentarConectar = (auth) =>
  new Promise((resolve) => {
    const socket = io(BASE, { path: SOCKET_PATH, addTrailingSlash: false, auth, reconnection: false });
    const done = (resultado) => { socket.close(); resolve(resultado); };
    socket.on('connect', () => done({ conectou: true }));
    socket.on('connect_error', (err) => done({ conectou: false, mensagem: err.message, codigo: err?.data?.code }));
    setTimeout(() => done({ conectou: false, mensagem: 'timeout' }), 8000);
  });

// Conecta e entra na room, coletando os eventos recebidos.
const abrirQuadro = (token, idEspaco) =>
  new Promise((resolve, reject) => {
    const socket = io(BASE, { path: SOCKET_PATH, addTrailingSlash: false, auth: { token }, reconnection: false });
    const eventos = [];
    socket.on('tarefas', (p) => eventos.push(p));
    socket.on('connect_error', (e) => reject(new Error('connect_error: ' + e.message)));
    socket.on('connect', async () => {
      socket.emit('join_quadro', { id_espaco: idEspaco });
      await sleep(JOIN_MS);
      resolve({ socket, eventos, conectado: () => socket.connected });
    });
    setTimeout(() => reject(new Error('timeout ao abrir quadro')), 12000);
  });

const main = async () => {
  await get(SOCKET_PATH); // inicializa o servidor de socket (lazy)

  const alice = await criarUsuario('al');
  const bob = await criarUsuario('bo');
  console.log(`\ncontexto: espaco de alice=${alice.espaco.id} espaco de bob=${bob.espaco.id}\n`);

  await criarTarefa(alice, 'aquecimento'); // compila a rota no modo dev

  // ---------- Autenticação do handshake ----------
  const semToken = await tentarConectar(undefined);
  registrar('T1 conexao SEM token e rejeitada',
    semToken.conectou === false && semToken.codigo === 'NAO_AUTORIZADO', semToken.mensagem);

  const tokenRuim = await tentarConectar({ token: 'token.invalido.qualquer' });
  registrar('T2 conexao com token INVALIDO e rejeitada',
    tokenRuim.conectou === false && tokenRuim.codigo === 'NAO_AUTORIZADO', tokenRuim.mensagem);

  const tokenBom = await tentarConectar({ token: alice.token });
  registrar('T3 conexao com token VALIDO e aceita', tokenBom.conectou === true, tokenBom.mensagem);

  // ---------- Não-regressão: o próprio quadro recebe eventos ----------
  const proprio = await abrirQuadro(alice.token, alice.espaco.id);
  const tarefaPropria = await criarTarefa(alice, 'tarefa propria');
  await sleep(RECEBIMENTO_MS);
  registrar('T4 usuario RECEBE tarefas do proprio espaco',
    proprio.eventos.length > 0 && tarefaPropria.status === 201,
    `criacao=${tarefaPropria.status} eventos=${proprio.eventos.length} conectado=${proprio.conectado()}`);
  proprio.socket.close();

  // ---------- Autorização: quadro alheio não entrega nada ----------
  // Exige tarefa criada E socket vivo: sem isso, a ausência de vazamento
  // poderia ser apenas queda de transporte, e não prova autorização.
  const alheio = await abrirQuadro(alice.token, bob.espaco.id);
  const tarefaDeBob = await criarTarefa(bob, 'tarefa secreta de bob');
  await sleep(RECEBIMENTO_MS);
  registrar('T5 usuario NAO recebe tarefas de espaco alheio',
    alheio.eventos.length === 0 && tarefaDeBob.status === 201 && alheio.conectado() === true,
    `criacao=${tarefaDeBob.status} eventos=${alheio.eventos.length} conectado=${alheio.conectado()}`);
  alheio.socket.close();

  // ---------- Autorização do responsável (regressão do await ausente) ----------
  const responsavelDeFora = await post('/api/tarefas/criarTarefa', {
    titulo: 'responsavel de fora',
    descricao: 'deve ser barrado',
    prioridade: 'MEDIO',
    id_espaco: alice.espaco.id,
    id_coluna: alice.coluna.id,
    id_responsavel: bob.espaco.id_usuario, // dono do outro espaço
  }, alice.token);
  registrar('T6 responsavel de FORA do espaco e barrado (403)', responsavelDeFora.status === 403,
    `status ${responsavelDeFora.status} :: ${responsavelDeFora.json?.mensagem}`);

  encerrar();
};

main().catch((e) => { console.error('ERRO NO SETUP:', e.message); process.exit(2); });
