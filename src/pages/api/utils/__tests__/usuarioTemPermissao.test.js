import { describe, it, expect, vi, beforeEach } from 'vitest';

// O módulo real abre um Pool do pg ao ser importado; o mock evita conexão no teste.
vi.mock('@/pages/api/config/connectDB', () => ({
  default: { query: vi.fn() },
}));

import usuarioTemPermissao from '@/pages/api/utils/usuarioTemPermissao';

const argsValidos = {
  idUsuario: 7,
  idEspaco: 3,
  nomePermissao: 'QUADRO',
  escrita: true,
};

const clienteQueRetorna = (rowCount) => ({ query: vi.fn().mockResolvedValue({ rowCount, rows: [] }) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('usuarioTemPermissao', () => {
  describe('resultado da consulta', () => {
    it('concede permissão quando a consulta encontra vínculo', async () => {
      const dbClient = clienteQueRetorna(1);
      await expect(usuarioTemPermissao({ ...argsValidos, dbClient })).resolves.toBe(true);
    });

    it('nega permissão quando a consulta não encontra vínculo', async () => {
      const dbClient = clienteQueRetorna(0);
      await expect(usuarioTemPermissao({ ...argsValidos, dbClient })).resolves.toBe(false);
    });
  });

  describe('montagem da consulta', () => {
    it('usa prepared statement, sem interpolar valores no SQL', async () => {
      const dbClient = clienteQueRetorna(1);
      await usuarioTemPermissao({ ...argsValidos, dbClient });

      const consulta = dbClient.query.mock.calls[0][0];
      expect(consulta.values).toEqual([7, 3, 'QUADRO', true]);
      expect(consulta.text).toContain('$1');
      expect(consulta.text).not.toContain('QUADRO');
    });

    it('normaliza ids numéricos vindos como texto', async () => {
      const dbClient = clienteQueRetorna(1);
      await usuarioTemPermissao({ ...argsValidos, idUsuario: '7', idEspaco: '3', dbClient });

      expect(dbClient.query.mock.calls[0][0].values.slice(0, 2)).toEqual([7, 3]);
    });

    it('remove espaços ao redor do nome da permissão', async () => {
      const dbClient = clienteQueRetorna(1);
      await usuarioTemPermissao({ ...argsValidos, nomePermissao: '  QUADRO  ', dbClient });

      expect(dbClient.query.mock.calls[0][0].values[2]).toBe('QUADRO');
    });

    it('filtra por usuário e espaço, nunca só por permissão', async () => {
      const dbClient = clienteQueRetorna(1);
      await usuarioTemPermissao({ ...argsValidos, dbClient });

      const { text } = dbClient.query.mock.calls[0][0];
      expect(text).toContain('eup.id_usuario = $1');
      expect(text).toContain('eup.id_espaco = $2');
    });
  });

  describe('entradas inválidas', () => {
    const casos = [
      ['id de usuário não numérico', { idUsuario: 'abc' }],
      ['id de usuário zero', { idUsuario: 0 }],
      ['id de usuário negativo', { idUsuario: -1 }],
      ['id de espaço não numérico', { idEspaco: 'abc' }],
      ['id de espaço zero', { idEspaco: 0 }],
      ['nome de permissão vazio', { nomePermissao: '   ' }],
      ['nome de permissão não textual', { nomePermissao: 42 }],
      ['escrita não booleana', { escrita: 'true' }],
      ['escrita nula', { escrita: null }],
    ];

    it.each(casos)('rejeita %s sem consultar o banco', async (_titulo, invalido) => {
      const dbClient = clienteQueRetorna(1);
      await expect(usuarioTemPermissao({ ...argsValidos, ...invalido, dbClient })).rejects.toThrow(
        'Erro ao verificar permissão do usuário'
      );
      expect(dbClient.query).not.toHaveBeenCalled();
    });
  });

  describe('falha do banco', () => {
    it('propaga erro em vez de conceder permissão silenciosamente', async () => {
      const dbClient = { query: vi.fn().mockRejectedValue(new Error('conexão perdida')) };

      await expect(usuarioTemPermissao({ ...argsValidos, dbClient })).rejects.toThrow(
        'Erro ao verificar permissão do usuário'
      );
    });

    it('não vaza a mensagem interna do banco para quem chamou', async () => {
      const dbClient = { query: vi.fn().mockRejectedValue(new Error('relation "x" does not exist')) };

      await expect(usuarioTemPermissao({ ...argsValidos, dbClient })).rejects.not.toThrow(
        'relation "x" does not exist'
      );
    });
  });
});
