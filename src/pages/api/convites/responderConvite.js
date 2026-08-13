import db from '@/pages/api/config/connectDB';
import defaultResponse from '@/pages/api/config/defaultResponse';
import authMiddleware from '@/pages/api/config/middlewares/authMiddleware';
import buildInsert from '@/pages/api/utils/buildInsert';
import getConviteByIdAndUsuario from '@/pages/api/utils/getConviteByIdAndUsuario';

const handler = async (req, res) => {
  const client = await db.connect();

  try {
    if (req.method !== 'PUT') {
      return res.status(405).json(defaultResponse('Método não permitido'));
    }

    const { id_convite, resposta } = req.body ?? {};

    const idConvite = Number(id_convite);
    if (!Number.isInteger(idConvite) || idConvite <= 0) {
      return res.status(400).json(defaultResponse('ID inválido'));
    }

    if(typeof resposta !== 'boolean'){
      return res.status(400).json(defaultResponse('Resposta deve ser um booleano'));
    }

    await client.query('BEGIN');

    const convite = await getConviteByIdAndUsuario(idConvite, req.user.id, client);

    if (!convite) {
      await client.query('ROLLBACK');
      return res.status(404).json(defaultResponse('Convite não encontrado'));
    }

    if (convite.status !== 'PENDENTE') {
      await client.query('ROLLBACK');
      return res.status(409).json(defaultResponse('Apenas convites pendentes podem ser respondidos'));
    }

    if (convite.expirado) {
      await client.query('ROLLBACK');
      return res.status(409).json(defaultResponse('Convite expirado'));
    }

    const vinculoExistente = await client.query({
      text: `
        SELECT id
        FROM espaco_usuario
        WHERE id_espaco = $1
          AND id_usuario = $2
          AND ativo = true
        LIMIT 1
      `,
      values: [convite.id_espaco, req.user.id],
    });

    if(vinculoExistente.rowCount > 0){
      await client.query('ROLLBACK');
      return res.status(409).json(defaultResponse('Usuário já pertence ao espaço'));
    }

    const novoStatus = resposta === true ? 'ACEITO' : 'RECUSADO';
    const colunaData = resposta === true ? 'data_aceite' : 'data_recusa';
    const mensagem = resposta === true ? 'Convite aceito' : 'Convite recusado';

    const insertSql = buildInsert('espaco_usuario', {
      id_espaco: convite.id_espaco,
      id_usuario: req.user.id,
    });

    const vinculoResult = await client.query({
      text: insertSql.text,
      values: insertSql.values,
    });

    if (vinculoResult.rowCount !== 1) {
      await client.query('ROLLBACK');
      return res.status(500).json(defaultResponse('Usuário não vinculado ao espaço. Contate o suporte'));
    }

    const conviteUpdateResult = await client.query({
      text: `
        UPDATE espaco_convite
        SET status = $1, ${colunaData} = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING id
      `,
      values: [novoStatus, idConvite],
    });

    if (conviteUpdateResult.rowCount !== 1) {
      await client.query('ROLLBACK');
      return res.status(500).json(defaultResponse('Convite não atualizado. Contate o suporte'));
    }

    await client.query('COMMIT');

    const conviteAtualizado = await getConviteByIdAndUsuario(idConvite, req.user.id);

    return res.status(200).json(defaultResponse('Convite respondido', conviteAtualizado));
  } catch (error) {
    console.error('Erro ao aceitar convite: ', error);
    await client.query('ROLLBACK');
    return res.status(500).json(defaultResponse('Erro ao aceitar convite. Contate o suporte!'));
  } finally {
    client.release();
  }
};

export default authMiddleware(handler);
