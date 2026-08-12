import db from '@/pages/api/config/connectDB';
import defaultResponse from '@/pages/api/config/defaultResponse';
import authMiddleware from '@/pages/api/config/middlewares/authMiddleware';
import buildImgSrc from '@/pages/api/utils/buildImgSrc';
import usuarioTemPermissao from '@/pages/api/utils/usuarioTemPermissao';

const requiredPermission = {
  name: 'USUARIOS',
  escrita: false,
};

const formatUsuario = (usuario, vinculo) => ({
  id: usuario.id,
  nome: usuario.nome,
  email: usuario.email,
  username: usuario.username,
  vinculo,
  src: usuario.avatar_public_url ? buildImgSrc(usuario.avatar_public_url) : null,
});

const handler = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json(defaultResponse('Método não permitido'));
  }

  try {
    const { id_espaco } = req.query ?? {};
    const idEspaco = Number(id_espaco);

    if (!Number.isInteger(idEspaco) || idEspaco <= 0) {
      return res.status(400).json(defaultResponse('ID inválido'));
    }

    const espacoResult = await db.query({
      text: `
        SELECT id, id_usuario
        FROM espaco
        WHERE id = $1
      `,
      values: [idEspaco],
    });

    if (espacoResult.rowCount !== 1) {
      return res.status(404).json(defaultResponse('Espaço não encontrado!'));
    }

    const hasPermission = await usuarioTemPermissao({
      idUsuario: req.user.id,
      idEspaco,
      nomePermissao: requiredPermission.name,
      escrita: requiredPermission.escrita,
      dbClient: db
    });
    if (!hasPermission) {
      return res.status(403).json(defaultResponse('Você não tem permissão para visualizar os usuários deste espaço!'));
    }

    const columns = ['id','nome','email','username','avatar_public_url'];

    const espaco = espacoResult.rows[0];
    const isProprietario = Number(espaco.id_usuario) === Number(req.user.id);

    const participantesResult = await db.query({
      text: `
        SELECT ${(columns.map(col => `u.${col}`)).join(', ')}
        FROM espaco_usuario eu
        JOIN usuario u ON u.id = eu.id_usuario
        WHERE eu.id_espaco = $1 AND eu.ativo = true
        ORDER BY u.nome ASC
      `,
      values: [idEspaco],
    });

    const usuariosMap = new Map();

    if (isProprietario) {
      usuariosMap.set(req.user.id, formatUsuario(req.user, 'Proprietário'));
    } else {
      const proprietarioResult = await db.query({ text: `SELECT ${columns.join(', ')} FROM usuario WHERE id = $1`, values:[espaco.id_usuario] });
      if(proprietarioResult.rowCount == 1){
        const proprietario = proprietarioResult.rows[0];
        usuariosMap.set(proprietario.id, formatUsuario(proprietario, 'Proprietário'));
      }
    }

    participantesResult.rows.forEach((usuario) => {
      if (!usuariosMap.has(usuario.id)) {
        usuariosMap.set(usuario.id, formatUsuario(usuario, 'Participante'));
      }
    });

    const usuarios = Array.from(usuariosMap.values()).sort((a, b) => a.nome.localeCompare(b.nome));

    return res.status(200).json(defaultResponse('Segue usuários', usuarios));
  } catch (error) {
    console.log(error);
    return res.status(500).json(defaultResponse('Erro ao listar usuários'));
  }
};

export default authMiddleware(handler);
