import axios from 'axios';

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
            return res.status(400).json(defaultResponse('Informe o arquivo!'));
        }

        const idArquivo = Number(id);
        if (!Number.isInteger(idArquivo) || idArquivo <= 0) {
            return res.status(400).json(defaultResponse('Arquivo inválido!'));
        }

        const tarefaArquivo = await db.query({
            text: `
                SELECT ta.*, t.id_espaco
                FROM tarefa_arquivo ta
                JOIN tarefa t ON t.id = ta.id_tarefa
                WHERE ta.id = $1
            `,
            values: [idArquivo],
        });

        if (!tarefaArquivo || tarefaArquivo.rowCount === 0) {
            return res.status(404).json(defaultResponse('Arquivo não encontrado!'));
        }

        const arquivo = tarefaArquivo.rows[0];

        const hasPermission = await usuarioTemPermissao({
            idUsuario: req.user.id,
            idEspaco: arquivo.id_espaco,
            nomePermissao: requiredPermission.name,
            escrita: requiredPermission.escrita,
            dbClient: db
        });
        if(!hasPermission){
            return res.status(403).json(defaultResponse('Você não tem permissão para deletar arquivos desta tarefa!'));
        }

        if (arquivo.id_opera) {
            try {
                const urlParams = new URLSearchParams({ file_id: arquivo.id_opera });
                const deleteOperaUrl = `${process.env.OPERA_LINK}/files?${urlParams.toString()}`;
                await axios.delete(deleteOperaUrl, {
                    headers: {
                        authorization: process.env.OPERA_API_KEY,
                    },
                });
            } catch (error) {
                console.error('Erro ao deletar arquivo no opera:', error?.response?.data?.message || 'Erro genérico');
            }
        }

        const arquivoDeletado = await db.query({
            text: 'DELETE FROM tarefa_arquivo WHERE id = $1 RETURNING *',
            values: [idArquivo],
        });

        if (!arquivoDeletado || arquivoDeletado.rowCount === 0) {
            return res.status(400).json(defaultResponse('Erro ao deletar arquivo no banco de dados!'));
        }

        return res.status(200).json(defaultResponse('Arquivo deletado com sucesso', arquivoDeletado.rows[0]));
    } catch (error) {
        console.error(error);
        return res.status(500).json(defaultResponse('Erro interno ao deletar arquivos'));
    }
};

export default authMiddleware(handler);
