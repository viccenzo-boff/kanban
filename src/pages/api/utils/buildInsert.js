// Identificador aceito pelo schema: minúsculas, dígitos e underscore.
// Todas as tabelas e colunas das migrations seguem esse formato.
const IDENTIFICADOR_VALIDO = /^[a-z_][a-z0-9_]*$/;

const validarIdentificador = (valor, tipo) => {
  if (typeof valor !== 'string' || !IDENTIFICADOR_VALIDO.test(valor)) {
    throw new Error(`Identificador de ${tipo} inválido: ${JSON.stringify(valor)}`);
  }
};

const buildInsert = (table, data) => {
  // Os valores são parametrizados, mas tabela e colunas entram direto no SQL.
  // A validação impede que um caller que esqueça a whitelist e repasse dados do
  // cliente transforme nomes de coluna em injeção de identificador.
  validarIdentificador(table, 'tabela');

  const keys = Object.keys(data ?? {});

  if (keys.length === 0) {
    throw new Error('buildInsert exige ao menos uma coluna');
  }

  keys.forEach((key) => validarIdentificador(key, 'coluna'));

  const columns = keys.join(', ');
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  const values = Object.values(data);

  return {
    text: `
      INSERT INTO ${table}
      (${columns})
      VALUES (${placeholders})
      RETURNING *
    `,
    values,
  };
}

export default buildInsert;
