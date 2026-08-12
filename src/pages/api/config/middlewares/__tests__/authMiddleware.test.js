import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted: vi.mock é içado ao topo do arquivo, então os mocks precisam
// existir antes das declarações normais para poderem ser referenciados aqui.
const { dbMock, jwtMock } = vi.hoisted(() => ({
  dbMock: { query: vi.fn() },
  jwtMock: { verify: vi.fn() },
}));

vi.mock('@/pages/api/config/connectDB', () => ({ default: dbMock }));
vi.mock('jsonwebtoken', () => ({ default: jwtMock }));

import authMiddleware from '@/pages/api/config/middlewares/authMiddleware';

const USUARIO_ATIVO = {
  id: 7,
  nome: 'Fulano',
  email: 'fulano@exemplo.com',
  username: 'fulano',
  ativo: true,
  avatar_public_url: null,
};

const criarRes = () => {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
};

const criarReq = (token = 'token-valido') => ({ headers: { authorization: token } });

const erroDeToken = (nome) => {
  const erro = new Error(nome);
  erro.name = nome;
  return erro;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

describe('authMiddleware', () => {
  describe('rejeição de credenciais', () => {
    it('devolve 401 sem cabeçalho de autorização', async () => {
      const handler = vi.fn();
      const res = criarRes();

      await authMiddleware(handler)({ headers: {} }, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(handler).not.toHaveBeenCalled();
      expect(dbMock.query).not.toHaveBeenCalled();
    });

    it('devolve 401 para token malformado', async () => {
      jwtMock.verify.mockImplementation(() => { throw erroDeToken('JsonWebTokenError'); });
      const handler = vi.fn();
      const res = criarRes();

      await authMiddleware(handler)(criarReq(), res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(handler).not.toHaveBeenCalled();
    });

    it('devolve 401 e mensagem específica para token expirado', async () => {
      jwtMock.verify.mockImplementation(() => { throw erroDeToken('TokenExpiredError'); });
      const handler = vi.fn();
      const res = criarRes();

      await authMiddleware(handler)(criarReq(), res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ mensagem: expect.stringContaining('Sessão expirada') })
      );
      expect(handler).not.toHaveBeenCalled();
    });

    it('devolve 401 quando o usuário do token não existe mais', async () => {
      jwtMock.verify.mockReturnValue({ id: 7 });
      dbMock.query.mockResolvedValue({ rowCount: 0, rows: [] });
      const handler = vi.fn();
      const res = criarRes();

      await authMiddleware(handler)(criarReq(), res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(handler).not.toHaveBeenCalled();
    });

    it('devolve 401 para usuário inativo', async () => {
      jwtMock.verify.mockReturnValue({ id: 7 });
      dbMock.query.mockResolvedValue({ rowCount: 1, rows: [{ ...USUARIO_ATIVO, ativo: false }] });
      const handler = vi.fn();
      const res = criarRes();

      await authMiddleware(handler)(criarReq(), res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(handler).not.toHaveBeenCalled();
    });

    it('devolve 500 em falha inesperada, sem executar o handler', async () => {
      jwtMock.verify.mockReturnValue({ id: 7 });
      dbMock.query.mockRejectedValue(new Error('banco fora do ar'));
      const handler = vi.fn();
      const res = criarRes();

      await authMiddleware(handler)(criarReq(), res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('caminho autorizado', () => {
    beforeEach(() => {
      jwtMock.verify.mockReturnValue({ id: 7 });
      dbMock.query.mockResolvedValue({ rowCount: 1, rows: [USUARIO_ATIVO] });
    });

    it('executa o handler e anexa o usuário à requisição', async () => {
      const handler = vi.fn();
      const req = criarReq();

      await authMiddleware(handler)(req, criarRes());

      expect(handler).toHaveBeenCalledOnce();
      expect(req.user).toEqual(USUARIO_ATIVO);
    });

    it('busca o usuário pelo id contido no token', async () => {
      await authMiddleware(vi.fn())(criarReq(), criarRes());

      expect(dbMock.query).toHaveBeenCalledWith(expect.objectContaining({ values: [7] }));
    });

    it('valida o token com o segredo do ambiente', async () => {
      await authMiddleware(vi.fn())(criarReq('abc123'), criarRes());

      expect(jwtMock.verify).toHaveBeenCalledWith('abc123', process.env.JWT_SECRET);
    });
  });

  describe('escopo dos dados do usuário', () => {
    // Regressão: com SELECT * o hash da senha circulava em req.user por toda a
    // aplicação, a um res.json(req.user) distraído de vazar.
    it('não seleciona colunas com curinga', async () => {
      jwtMock.verify.mockReturnValue({ id: 7 });
      dbMock.query.mockResolvedValue({ rowCount: 1, rows: [USUARIO_ATIVO] });

      await authMiddleware(vi.fn())(criarReq(), criarRes());

      const { text } = dbMock.query.mock.calls[0][0];
      expect(text).not.toMatch(/SELECT\s+\*/i);
      expect(text).toContain('id');
      expect(text).toContain('ativo');
    });

    it('não busca a coluna senha', async () => {
      jwtMock.verify.mockReturnValue({ id: 7 });
      dbMock.query.mockResolvedValue({ rowCount: 1, rows: [USUARIO_ATIVO] });

      await authMiddleware(vi.fn())(criarReq(), criarRes());

      expect(dbMock.query.mock.calls[0][0].text).not.toContain('senha');
    });

    it('não expõe senha em req.user', async () => {
      jwtMock.verify.mockReturnValue({ id: 7 });
      dbMock.query.mockResolvedValue({ rowCount: 1, rows: [USUARIO_ATIVO] });
      const req = criarReq();

      await authMiddleware(vi.fn())(req, criarRes());

      expect(req.user).not.toHaveProperty('senha');
    });
  });
});
