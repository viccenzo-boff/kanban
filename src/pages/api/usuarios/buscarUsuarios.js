import db from '@/pages/api/config/connectDB';
import defaultResponse from '@/pages/api/config/defaultResponse';
import authMiddleware from '@/pages/api/config/middlewares/authMiddleware';
import buildImgSrc from '@/pages/api/utils/buildImgSrc';

const LIMIT_USERS_SEARCH = 25;

const handler = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json(defaultResponse('Método não permitido'));
  }

  try {
    const termo = String(req.query?.termo ?? '').trim();

    if (termo.length < 2) {
      return res.status(200).json(defaultResponse('Segue usuários', []));
    }

    const usuariosResult = await db.query({
      text: `
        SELECT id, nome, email, username, avatar_public_url
        FROM usuario u
        WHERE u.ativo = true
          AND u.id <> $2
          AND CONCAT_WS(' ', u.nome, u.username, u.email) ILIKE $1
        ORDER BY u.nome ASC
        LIMIT $3
      `,
      values: [`%${termo}%`, req.user.id, LIMIT_USERS_SEARCH],
    });

    const usuarios = usuariosResult.rows.map(({ avatar_public_url, ...usuario }) => ({
      ...usuario,
      src: avatar_public_url ? buildImgSrc(avatar_public_url) : null,
    }));

    return res.status(200).json(defaultResponse('Segue usuários', usuarios));
  } catch (error) {
    console.error(error);
    return res.status(500).json(defaultResponse('Erro ao listar usuários'));
  }
};

export default authMiddleware(handler);