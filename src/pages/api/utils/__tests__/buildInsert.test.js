import { describe, it, expect } from 'vitest';
import buildInsert from '@/pages/api/utils/buildInsert';

describe('buildInsert', () => {
  describe('montagem da consulta', () => {
    it('parametriza os valores em vez de interpolá-los', () => {
      const { text, values } = buildInsert('tarefa', { titulo: "O'Brien", id_espaco: 3 });

      expect(values).toEqual(["O'Brien", 3]);
      expect(text).toContain('$1');
      expect(text).toContain('$2');
      expect(text).not.toContain("O'Brien");
    });

    it('gera placeholders na mesma ordem das colunas', () => {
      const { text, values } = buildInsert('coluna', { nome: 'A Fazer', tipo: 'A FAZER', ordem: 1 });

      expect(text).toMatch(/\(nome, tipo, ordem\)/);
      expect(text).toMatch(/VALUES \(\$1, \$2, \$3\)/);
      expect(values).toEqual(['A Fazer', 'A FAZER', 1]);
    });

    it('aceita identificadores válidos com underscore e dígitos', () => {
      expect(() => buildInsert('espaco_usuario', { id_espaco: 1, id_usuario: 2 })).not.toThrow();
    });
  });

  describe('rejeição de identificadores inseguros', () => {
    // Os valores são parametrizados, mas tabela e colunas são interpoladas no
    // SQL. Se um caller esquecer a whitelist e repassar req.body, os nomes de
    // coluna viriam do usuário.
    const tabelasInvalidas = [
      ['injeção via ponto e vírgula', 'usuario; DROP TABLE usuario'],
      ['injeção via comentário', 'usuario --'],
      ['espaço no nome', 'tabela invalida'],
      ['aspas', 'usu"ario'],
      ['parêntese', 'usuario()'],
      ['vazio', ''],
    ];

    it.each(tabelasInvalidas)('rejeita tabela com %s', (_titulo, tabela) => {
      expect(() => buildInsert(tabela, { nome: 'x' })).toThrow(/identificador/i);
    });

    const colunasInvalidas = [
      ['injeção via vírgula', 'nome, senha'],
      ['injeção via subconsulta', 'nome) VALUES ((SELECT senha FROM usuario'],
      ['espaço no nome', 'nome completo'],
      ['aspas', 'no"me'],
    ];

    it.each(colunasInvalidas)('rejeita coluna com %s', (_titulo, coluna) => {
      expect(() => buildInsert('usuario', { [coluna]: 'x' })).toThrow(/identificador/i);
    });

    it('rejeita objeto de dados vazio', () => {
      expect(() => buildInsert('usuario', {})).toThrow();
    });
  });
});
