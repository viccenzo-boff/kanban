import db from '@/pages/api/config/connectDB';
import defaultResponse from '@/pages/api/config/defaultResponse';
import authMiddleware from '@/pages/api/config/middlewares/authMiddleware';
import usuarioTemPermissao from '@/pages/api/utils/usuarioTemPermissao';

const requiredPermission = {
  name: 'USUARIOS',
  escrita: true,
};

const handler = async (req, res) => {
  if (req.method !== 'DELETE') {
    return res.status(405).json(defaultResponse('Método não permitido'));
  }

  try {
    const idConvite = Number(req.query?.id_convite);

    if (!Number.isInteger(idConvite) || idConvite <= 0) {
      return res.status(400).json(defaultResponse('ID inválido'));
    }

    const conviteResult = await db.query({
      text: `
        SELECT
          ec.id,
          ec.status,
          ec.id_espaco
        FROM espaco_convite ec
        JOIN espaco e ON e.id = ec.id_espaco
        WHERE ec.id = $1
        LIMIT 1
      `,
      values: [idConvite],
    });

    if (conviteResult.rowCount !== 1) {
      return res.status(404).json(defaultResponse('Convite não encontrado'));
    }

    const convite = conviteResult.rows[0];
    const hasPermission = await usuarioTemPermissao({
      idUsuario: req.user.id,
      idEspaco: convite.id_espaco,
      nomePermissao: requiredPermission.name,
      escrita: requiredPermission.escrita,
      dbClient: db
    });
    if (!hasPermission) {
      return res.status(403).json(defaultResponse('Você não tem permissão para cancelar convites neste espaço!'));
    }

    if (convite.status !== 'PENDENTE') {
      return res.status(409).json(defaultResponse('Apenas convites pendentes podem ser cancelados'));
    }

    const cancelResult = await db.query({
      text: `
        UPDATE espaco_convite
        SET status = 'CANCELADO'
        WHERE id = $1
        RETURNING id, status
      `,
      values: [idConvite],
    });

    if (cancelResult.rowCount !== 1) {
      return res.status(500).json(defaultResponse('Convite não cancelado. Contate o suporte'));
    }

    return res.status(200).json(defaultResponse('Convite cancelado', cancelResult.rows[0]));
  } catch (error) {
    console.error('Erro ao cancelar convite: ', error);
    return res.status(500).json(defaultResponse('Erro ao cancelar convite. Contate o suporte!'));
  }
};

export default authMiddleware(handler);
