import axios from 'axios';

import db from '@/pages/api/config/connectDB';
import defaultResponse from '@/pages/api/config/defaultResponse';
import authMiddleware from '@/pages/api/config/middlewares/authMiddleware';
import parseForm from '@/pages/api/utils/parseForm';
import readFileAsync from '@/pages/api/utils/readFileAsync';
import maxSize from '@/pages/api/utils/maxSize';
import buildImgSrc from '@/pages/api/utils/buildImgSrc';

export const config = {
  api: {
    bodyParser: false,
  },
};

const extensoesPermitidas = ['png', 'jpg', 'jpeg', 'webp'];
const mimeTypesPermitidos = ['image/png', 'image/jpg', 'image/jpeg', 'image/webp'];

const handler = async (req, res) => {
  if (!['POST', 'DELETE'].includes(req.method)) {
    return res.status(405).json(defaultResponse('Método não permitido'));
  }

  try {
    if (req.method === 'DELETE') {
      const userResult = await db.query({
        text: `
          UPDATE usuario
          SET avatar_public_url = NULL
          WHERE id = $1
          RETURNING id, nome, email, username
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
        src: null,
      };

      return res.status(200).json(defaultResponse('Imagem removida com sucesso', profile));
    }

    const maxSizeMb = 5;
    const maxSizeByte = maxSize(maxSizeMb);
    const { files } = await parseForm(req);
    const arquivoRaw = files?.imagem;

    if (Array.isArray(arquivoRaw) && arquivoRaw.length > 1) {
      return res.status(400).json(defaultResponse('Envie apenas 1 imagem'));
    }

    const arquivo = Array.isArray(arquivoRaw) ? arquivoRaw[0] : arquivoRaw;

    if (!arquivo) {
      return res.status(400).json(defaultResponse('Nenhuma imagem foi enviada'));
    }

    const fileBuffer = await readFileAsync(arquivo.filepath);

    if (fileBuffer.length > maxSizeByte) {
      return res.status(400).json(defaultResponse(`A imagem deve ter no máximo ${maxSizeMb} MB`));
    }

    const extensao = arquivo.originalFilename?.split('.').pop()?.toLowerCase();
    const mimeType = arquivo.mimetype;

    if (!extensoesPermitidas.includes(extensao) || !mimeTypesPermitidos.includes(mimeType)) {
      return res.status(400).json(defaultResponse(`Extensões permitidas: ${extensoesPermitidas.join(', ')}`));
    }

    let response;

    try {
      const url = `${process.env.OPERA_LINK}/files`;
      response = await axios.post(url, fileBuffer, {
        headers: {
          authorization: process.env.OPERA_API_KEY,
          'Content-Type': 'application/octet-stream',
          'x-file-extension': extensao,
          'x-folder-id': process.env.OPERA_FOLDER_ID,
        },
      });
    } catch (error) {
      console.error('Erro ao salvar imagem de perfil no Opera', error?.response ?? error);
      return res.status(500).json(defaultResponse('Erro ao salvar imagem internamente. Contate o suporte!'));
    }

    const publicUrl = response?.data?.content?.public_url;

    if (!publicUrl) {
      return res.status(500).json(defaultResponse('Erro ao obter imagem salva. Contate o suporte!'));
    }

    const userResult = await db.query({
      text: `
        UPDATE usuario
        SET avatar_public_url = $1
        WHERE id = $2
        RETURNING id, nome, email, username, avatar_public_url AS public_url
      `,
      values: [publicUrl, req.user.id],
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
      src: buildImgSrc(user.public_url),
    };

    return res.status(200).json(defaultResponse('Imagem atualizada com sucesso', profile));
  } catch (error) {
    console.error(error);
    return res.status(500).json(defaultResponse('Erro interno ao salvar imagem de perfil'));
  }
};

export default authMiddleware(handler);
