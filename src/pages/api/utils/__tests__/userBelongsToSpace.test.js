import { describe, it, expect, vi, beforeEach } from 'vitest';

const clientMock = { query: vi.fn(), release: vi.fn() };

vi.mock('@/pages/api/config/connectDB', () => ({
  default: { connect: vi.fn(async () => clientMock) },
}));

import userBelongsToSpace from '@/pages/api/utils/userBelongsToSpace';

const ID_ESPACO = 3;
const ID_DONO = 7;
const ID_PARTICIPANTE = 9;
const ID_ESTRANHO = 42;

const espaco = { id: ID_ESPACO, id_usuario: ID_DONO, nome: 'Espaço' };

// A função dispara duas consultas em paralelo: espaço e vínculo, nessa ordem.
const respostas = ({ espacoRows = [espaco], vinculoRows = [] } = {}) => {
  clientMock.query
    .mockResolvedValueOnce({ rowCount: espacoRows.length, rows: espacoRows })
    .mockResolvedValueOnce({ rowCount: vinculoRows.length, rows: vinculoRows });
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

describe('userBelongsToSpace', () => {
  describe('contrato de retorno', () => {
    // Regressão: a trilha de sucesso retornava `true` puro enquanto as demais
    // retornavam objeto, o que fazia `resultado.belongs` virar undefined.
    it('sempre devolve um objeto com error, belongs e espaco', async () => {
      const cenarios = [
        { titulo: 'dono', args: [ID_ESPACO, ID_DONO], resposta: {} },
        { titulo: 'participante', args: [ID_ESPACO, ID_PARTICIPANTE], resposta: { vinculoRows: [{ id: 1 }] } },
        { titulo: 'estranho', args: [ID_ESPACO, ID_ESTRANHO], resposta: {} },
        { titulo: 'espaço inexistente', args: [999, ID_DONO], resposta: { espacoRows: [] } },
      ];

      for (const cenario of cenarios) {
        vi.clearAllMocks();
        respostas(cenario.resposta);

        const resultado = await userBelongsToSpace(...cenario.args);

        expect(resultado, cenario.titulo).toBeTypeOf('object');
        expect(resultado, cenario.titulo).toHaveProperty('error');
        expect(resultado, cenario.titulo).toHaveProperty('belongs');
        expect(resultado, cenario.titulo).toHaveProperty('espaco');
        expect(typeof resultado.belongs, cenario.titulo).toBe('boolean');
      }
    });
  });

  describe('decisão de vínculo', () => {
    it('reconhece o dono do espaço mesmo sem linha em espaco_usuario', async () => {
      respostas({ vinculoRows: [] });
      const resultado = await userBelongsToSpace(ID_ESPACO, ID_DONO);

      expect(resultado.belongs).toBe(true);
      expect(resultado.error).toBe(false);
      expect(resultado.espaco).toEqual(espaco);
    });

    it('reconhece participante com vínculo ativo', async () => {
      respostas({ vinculoRows: [{ id: 1 }] });
      const resultado = await userBelongsToSpace(ID_ESPACO, ID_PARTICIPANTE);

      expect(resultado.belongs).toBe(true);
    });

    it('nega usuário sem vínculo', async () => {
      respostas({ vinculoRows: [] });
      const resultado = await userBelongsToSpace(ID_ESPACO, ID_ESTRANHO);

      expect(resultado.belongs).toBe(false);
      expect(resultado.error).toBe(false);
    });

    it('nega quando o espaço não existe', async () => {
      respostas({ espacoRows: [] });
      const resultado = await userBelongsToSpace(999, ID_DONO);

      expect(resultado.belongs).toBe(false);
      expect(resultado.espaco).toBeNull();
    });
  });

  describe('consulta de vínculo', () => {
    it('exige vínculo ativo e filtra por espaço e usuário', async () => {
      respostas({ vinculoRows: [{ id: 1 }] });
      await userBelongsToSpace(ID_ESPACO, ID_PARTICIPANTE);

      const consultaVinculo = clientMock.query.mock.calls[1][0];
      expect(consultaVinculo.text).toContain('ativo = TRUE');
      expect(consultaVinculo.values).toEqual([ID_ESPACO, ID_PARTICIPANTE]);
    });
  });

  describe('falhas', () => {
    it('nega acesso quando a consulta falha (falha fechada)', async () => {
      clientMock.query.mockRejectedValue(new Error('conexão perdida'));
      const resultado = await userBelongsToSpace(ID_ESPACO, ID_DONO);

      expect(resultado.belongs).toBe(false);
      expect(resultado.error).toBe(true);
    });

    it('nega acesso para ids não inteiros', async () => {
      clientMock.query.mockResolvedValue({ rowCount: 0, rows: [] });
      const resultado = await userBelongsToSpace('abc', ID_DONO);

      expect(resultado.belongs).toBe(false);
      expect(resultado.error).toBe(true);
    });

    it('devolve a conexão ao pool mesmo em caso de erro', async () => {
      clientMock.query.mockRejectedValue(new Error('falhou'));
      await userBelongsToSpace(ID_ESPACO, ID_DONO);

      expect(clientMock.release).toHaveBeenCalledTimes(1);
    });

    it('devolve a conexão ao pool no caminho feliz', async () => {
      respostas({ vinculoRows: [] });
      await userBelongsToSpace(ID_ESPACO, ID_DONO);

      expect(clientMock.release).toHaveBeenCalledTimes(1);
    });
  });
});
