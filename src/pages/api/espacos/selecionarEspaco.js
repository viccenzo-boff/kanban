import db from '@/pages/api/config/connectDB';

import defaultResponse from '../config/defaultResponse';
import authMiddleware from '../config/middlewares/authMiddleware';
import usuarioTemPermissao from '../utils/usuarioTemPermissao';

const requiredPermission = {
    name: 'ESPACO',
    escrita: false,
};

const handler = async (req, res) => {
    try {
        const user = req.user;
        const idRaw = req.query?.id;
        const id = Number(idRaw);   

        if(isNaN(id)){
            return res.status(400).json(defaultResponse('ID inválido'));
        }

        const sql = "SELECT * FROM espaco WHERE id = $1 ORDER BY id ASC";
        const spaceResult = await db.query({ text: sql, values:[id]});

        if(spaceResult.rowCount !== 1){
            return res.status(404).json(defaultResponse('Espaço não encontrado!'));
        }

        const hasPermission = await usuarioTemPermissao({
            idUsuario: user.id,
            idEspaco: id,
            nomePermissao: requiredPermission.name,
            escrita: requiredPermission.escrita,
            dbClient: db
        });
        if(!hasPermission){
            return res.status(404).json(defaultResponse('Espaço não encontrado!'));
        }

        const space = spaceResult.rows[0];

        return res.status(200).json(defaultResponse('Segue espaços', space));
    } catch (error) {
        console.error(error);
        return res.status(500).json(defaultResponse('Erro ao listar espaços'));
    }
};

export default authMiddleware(handler);
