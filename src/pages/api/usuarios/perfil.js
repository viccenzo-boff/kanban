import db from '@/pages/api/config/connectDB';
import defaultResponse from '@/pages/api/config/defaultResponse';
import authMiddleware from '@/pages/api/config/middlewares/authMiddleware';
import buildImgSrc from '@/pages/api/utils/buildImgSrc';

const handler = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json(defaultResponse('Método não permitido'));
  }

  try {
    const userResult = await db.query({
      text: `
        SELECT id, nome, email, username, avatar_public_url AS public_url
        FROM usuario
        WHERE id = $1
      `,
      values: [req.user.id],
    });

    if (userResult.rowCount !== 1) {
      return res.status(404).json(defaultResponse('Usuário não encontrado'));
    }

    const user = userResult.rows[0];
    const profile = {
      id: user.id,
      nome: user.nome,
      email: user.email,
      username: user.username,
      src: user.public_url ? buildImgSrc(user.public_url) : null,
    };

    return res.status(200).json(defaultResponse('Segue perfil', profile));
  } catch (error) {
    console.error(error);
    return res.status(500).json(defaultResponse('Erro ao buscar perfil'));
  }
};

export default authMiddleware(handler);
