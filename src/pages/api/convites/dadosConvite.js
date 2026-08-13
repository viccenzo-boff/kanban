import defaultResponse from '@/pages/api/config/defaultResponse';
import authMiddleware from '@/pages/api/config/middlewares/authMiddleware';
import getConviteByIdAndUsuario from '@/pages/api/utils/getConviteByIdAndUsuario';

const handler = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json(defaultResponse('Método não permitido'));
  }

  try {
    const idConvite = Number(req.query?.id_convite);

    if (!Number.isInteger(idConvite) || idConvite <= 0) {
      return res.status(400).json(defaultResponse('ID inválido'));
    }

    const convite = await getConviteByIdAndUsuario(idConvite, req.user.id);

    if (!convite) {
      return res.status(404).json(defaultResponse('Convite não encontrado'));
    }

    return res.status(200).json(defaultResponse('Segue convite', convite));
  } catch (error) {
    console.error('Erro ao buscar dados do convite: ', error);
    return res.status(500).json(defaultResponse('Erro ao buscar dados do convite. Contate o suporte!'));
  }
};

export default authMiddleware(handler);
