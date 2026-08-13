import db from '@/pages/api/config/connectDB';
import defaultResponse from '@/pages/api/config/defaultResponse';
import authMiddleware from '@/pages/api/config/middlewares/authMiddleware';
import usuarioTemPermissao from '@/pages/api/utils/usuarioTemPermissao';

const requiredPermission = {
    name: 'QUADRO',
    escrita: true,
};

const handler = async (req, res) => {
    if (req.method !== 'DELETE') {
        return res.status(405).json(defaultResponse('Método não permitido'));
    }

    try {
        const { id } = req.query ?? {};

        if (!id) {
            return res.status(400).json(defaultResponse('Preencha todos os dados para continuar'));
        }

        const tarefaExistente = await db.query({text: 'SELECT id_espaco FROM tarefa WHERE id = $1', values: [id]});

        if(tarefaExistente.rowCount !== 1){
            return res.status(404).json(defaultResponse('Tarefa não encontrada'));
        }

        const hasPermission = await usuarioTemPermissao({
            idUsuario: req.user.id,
            idEspaco: tarefaExistente.rows[0].id_espaco,
            nomePermissao: requiredPermission.name,
            escrita: requiredPermission.escrita,
            dbClient: db
        });
        if(!hasPermission){
            return res.status(403).json(defaultResponse('Você não tem permissão para deletar tarefas neste espaço!'));
        }

        const hasFiles = await db.query({ text: 'SELECT 1 FROM tarefa_arquivo WHERE id_tarefa = $1', values:[id] });

        if(hasFiles.rowCount > 0){
            return res.status(409).json(defaultResponse('Delete os arquivos antes de deletar as tarefas'));
        }

        const sql = `
            DELETE FROM tarefa
            WHERE id = $1
            RETURNING *
        `;

        const tarefa = await db.query({ text: sql, values: [id] });

        if (tarefa.rowCount === 0) {
            return res.status(404).json(defaultResponse('Tarefa não encontrada!'));
        }

        return res.status(200).json(defaultResponse('Tarefa deletada com sucesso', tarefa.rows[0]));
    } catch (error) {
        console.error(error);
        return res.status(500).json(defaultResponse());
    }
};

export default authMiddleware(handler);
