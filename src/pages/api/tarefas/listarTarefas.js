import db from '@/pages/api/config/connectDB';

import defaultResponse from '@/pages/api/config/defaultResponse';
import authMiddleware from '@/pages/api/config/middlewares/authMiddleware';
import usuarioTemPermissao from '@/pages/api/utils/usuarioTemPermissao';

const requiredPermission = {
    name: 'QUADRO',
    escrita: false,
};

const handler = async (req, res) => {
    try {
        const { id_espaco } = req.query ?? {};
        if(!id_espaco || isNaN(Number(id_espaco))){
            return res.status(400).json(defaultResponse('ID inválido'));
        }

        const spaceResult = await db.query({ text: 'SELECT id FROM espaco WHERE id = $1', values:[Number(id_espaco)]});
        if(spaceResult.rowCount !== 1){
            return res.status(404).json(defaultResponse('Espaço não encontrado!'));
        }

        const hasPermission = await usuarioTemPermissao({
            idUsuario: req.user.id,
            idEspaco: Number(id_espaco),
            nomePermissao: requiredPermission.name,
            escrita: requiredPermission.escrita,
            dbClient: db
        });
        if(!hasPermission){
            return res.status(403).json(defaultResponse('Você não tem permissão para visualizar as tarefas deste espaço!'));
        }

        const space = spaceResult.rows[0];
        const sql = "SELECT * FROM tarefa WHERE id_espaco = $1 ORDER BY id ASC";
        const tarefas = await db.query({ text: sql, values:[space.id]});

        return res.status(200).json(defaultResponse('Segue tarefas', tarefas.rows));
    } catch (error) {
        console.error(error);
        return res.status(500).json(defaultResponse());
    }
};

export default authMiddleware(handler);
