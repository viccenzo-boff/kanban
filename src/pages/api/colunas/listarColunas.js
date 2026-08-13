import db from '@/pages/api/config/connectDB.js';
import defaultResponse from '@/pages/api/config/defaultResponse.js';
import authMiddleware from '@/pages/api/config/middlewares/authMiddleware';
import usuarioTemPermissao from '@/pages/api/utils/usuarioTemPermissao';

const requiredPermission = {
    name: 'QUADRO',
    escrita: false,
};

const handler = async (req, res) => {
    try {
        const { id_espaco } = req.query;
        const idEspaco = Number(id_espaco);
        if(!Number.isInteger(idEspaco) || idEspaco <= 0){
            return res.status(400).json(defaultResponse('ID inválido'));
        }

        const spaceResult = await db.query({ text: 'SELECT id FROM espaco WHERE id = $1', values:[idEspaco] });
        if(spaceResult.rowCount !== 1){
            return res.status(404).json(defaultResponse('Espaço não encontrado!'));
        }

        const hasPermission = await usuarioTemPermissao({
            idUsuario: req.user.id,
            idEspaco,
            nomePermissao: requiredPermission.name,
            escrita: requiredPermission.escrita,
            dbClient: db
        });
        if(!hasPermission){   
            return res.status(403).json(defaultResponse('Você não tem permissão para listar colunas neste espaço!'));
        }

        const colunasResult = await db.query({ text: 'SELECT * FROM coluna WHERE id_espaco = $1 ORDER BY ordem ASC', values:[idEspaco] });
        return res.status(200).json(defaultResponse('Colunas listadas com sucesso', colunasResult.rows));

    } catch (error) {
        console.error(error);
        return res.status(500).json(defaultResponse());
    }
};

export default authMiddleware(handler);