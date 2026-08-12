/* eslint-disable no-console */
// Escopo dos dados expostos na autenticação: payload do JWT e req.user.
// Ver tests/e2e/README.md — exige ambiente no ar.
const { registrar, encerrar, post, get, criarUsuario, criarTarefa } = require('./helpers');

// Decodifica o payload sem verificar assinatura — exatamente o que qualquer
// pessoa que interceptar o token consegue fazer.
const lerPayload = (token) => JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

const main = async () => {
  const usuario = await criarUsuario('jwt');
  const { dados, token, espaco } = usuario;

  const payload = lerPayload(token);
  const chaves = Object.keys(payload).sort();
  registrar('T1 payload do JWT contem somente id/iat/exp',
    JSON.stringify(chaves) === JSON.stringify(['exp', 'iat', 'id']), `chaves=${JSON.stringify(chaves)}`);

  registrar('T2 payload nao contem dados pessoais nem senha',
    !('email' in payload) && !('username' in payload) && !('nome' in payload) && !('senha' in payload),
    JSON.stringify(payload));

  const porEmail = await post('/api/usuarios/login', { login: dados.email, senha: dados.senha });
  registrar('T3 login por email funciona', porEmail.status === 200 && !!porEmail.json?.data,
    `status ${porEmail.status}`);

  const senhaErrada = await post('/api/usuarios/login', { login: dados.username, senha: 'errada' });
  registrar('T4 senha incorreta e rejeitada', senhaErrada.status === 401, `status ${senhaErrada.status}`);

  const perfil = await get('/api/usuarios/perfil', token);
  registrar('T5 rota autenticada funciona com token enxuto',
    perfil.status === 200 && perfil.json?.data?.username === dados.username, `status ${perfil.status}`);

  registrar('T6 perfil nao devolve senha',
    perfil.status === 200 && !('senha' in (perfil.json?.data ?? {})), JSON.stringify(perfil.json?.data));

  // listarUsuarios monta a resposta a partir de req.user: prova que o middleware
  // ainda fornece nome/email/username após a troca de SELECT * por colunas.
  const usuarios = await get(`/api/espacos/listarUsuarios?id_espaco=${espaco.id}`, token);
  const eu = usuarios.json?.data?.[0];
  registrar('T7 listarUsuarios monta dados a partir de req.user',
    usuarios.status === 200 && eu?.nome === dados.nome && eu?.email === dados.email,
    `status ${usuarios.status}`);

  registrar('T8 nenhuma rota devolve hash bcrypt',
    !JSON.stringify(usuarios.json ?? {}).includes('$2b$') && !JSON.stringify(perfil.json ?? {}).includes('$2b$'),
    'nenhum hash nas respostas');

  const tarefa = await criarTarefa(usuario, 'pos reducao do token');
  registrar('T9 criar tarefa funciona (req.user.id intacto)', tarefa.status === 201, `status ${tarefa.status}`);

  const semToken = await get('/api/usuarios/perfil');
  registrar('T10 rota autenticada sem token responde 401', semToken.status === 401, `status ${semToken.status}`);

  encerrar();
};

main().catch((e) => { console.error('ERRO NO SETUP:', e.message); process.exit(2); });
