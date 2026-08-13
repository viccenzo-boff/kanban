import db from '@/pages/api/config/connectDB';
import defaultResponse from '@/pages/api/config/defaultResponse';
import authMiddleware from '@/pages/api/config/middlewares/authMiddleware';
import getTableColumns from '@/pages/api/utils/getTableColumns';
import buildImgSrc from '@/pages/api/utils/buildImgSrc';
import isEmailValid from '@/pages/api/utils/isEmailValid';
import isUsernameValid from '@/pages/api/utils/isUsernameValid';

const handler = async (req, res) => {
  if (req.method !== 'PUT') {
    return res.status(405).json(defaultResponse('Método não permitido'));
  }

  try {
    const dbColumns = await getTableColumns('usuario');
    const dadosForm = req.body ?? {};
    const data = {};

    data.nome = dadosForm.nome?.trim();
    data.email = dadosForm.email?.trim().toLowerCase();
    data.username = dadosForm.username?.trim();

    const requiredData = {
      nome: 'Nome',
      email: 'E-mail',
      username: 'Nome de usuário',
    };

    for (const key in requiredData) {
      if (!data[key]) {
        return res.status(400).json(defaultResponse('Preencha todos os dados para continuar'));
      }

      const column = dbColumns.find((col) => col.column_name === key);
      const maxLength = column?.character_maximum_length;

      if (maxLength && data[key].length > maxLength) {
        return res.status(400).json(defaultResponse(`${requiredData[key]} deve ter no máximo ${maxLength} caracteres`));
      }
    }

    if (!isEmailValid(data.email)) {
      return res.status(400).json(defaultResponse('Informe um e-mail válido.'));
    }

    if (!isUsernameValid(data.username)) {
      return res.status(400).json(defaultResponse('Usuário deve ter apenas letras e números'));
    }

    const [emailExistente, usernameExistente] = await Promise.all([
      db.query({
        text: 'SELECT 1 FROM usuario WHERE email = $1 AND id <> $2 LIMIT 1',
        values: [data.email, req.user.id],
      }),
      db.query({
        text: 'SELECT 1 FROM usuario WHERE username = $1 AND id <> $2 LIMIT 1',
        values: [data.username, req.user.id],
      }),
    ]);

    if (emailExistente.rowCount > 0) {
      return res.status(409).json(defaultResponse('E-mail já cadastrado.'));
    }

    if (usernameExistente.rowCount > 0) {
      return res.status(409).json(defaultResponse('Username já cadastrado.'));
    }

    const userResult = await db.query({
      text: `
        UPDATE usuario
        SET nome = $1,
          email = $2,
          username = $3
        WHERE id = $4
        RETURNING id, nome, email, username, avatar_public_url AS public_url
      `,
      values: [data.nome, data.email, data.username, req.user.id],
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

    return res.status(200).json(defaultResponse('Perfil atualizado com sucesso', profile));
  } catch (error) {
    console.error(error);
    return res.status(500).json(defaultResponse('Erro ao editar perfil'));
  }
};

export default authMiddleware(handler);
