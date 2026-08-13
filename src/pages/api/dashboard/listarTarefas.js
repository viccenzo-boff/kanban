import db from '@/pages/api/config/connectDB';
import defaultResponse from '@/pages/api/config/defaultResponse';
import authMiddleware from '@/pages/api/config/middlewares/authMiddleware';

const handler = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json(defaultResponse('Método não permitido'));
  }

  try {
    const result = await db.query({
      text: `
        SELECT
          t.id,
          t.titulo,
          t.data_cadastro,
          t.data_atualizacao,
          t.data_prevista,
          t.data_limite,
          t.prioridade,
          t.id_espaco,
          e.nome AS espaco_nome,
          e.sigla AS espaco_sigla,
          c.nome AS coluna_nome,
          c.tipo AS coluna_tipo
        FROM tarefa t
        JOIN espaco e ON e.id = t.id_espaco
        LEFT JOIN coluna c ON c.id = t.id_coluna
        WHERE t.id_responsavel = $1
          AND e.ativo IS TRUE
          AND (c.id IS NULL OR c.ativo IS TRUE)
        ORDER BY t.data_limite ASC NULLS LAST, t.data_atualizacao DESC
      `,
      values: [req.user.id],
    });

    return res.status(200).json(defaultResponse('Tarefas da dashboard listadas com sucesso', result.rows));
  } catch (error) {
    console.error(error);
    return res.status(500).json(defaultResponse('Erro ao carregar dados da dashboard'));
  }
};

export default authMiddleware(handler);
