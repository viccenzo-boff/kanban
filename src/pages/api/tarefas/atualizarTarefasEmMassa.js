import dbPrisma from '@/pages/api/config/connectDbPrisma';
import defaultResponse from '@/pages/api/config/defaultResponse';
import authMiddleware from '@/pages/api/config/middlewares/authMiddleware';
import usuarioTemPermissao from '@/pages/api/utils/usuarioTemPermissao';

const requiredPermission = {
    name: 'QUADRO',
    escrita: true,
};

const handler = async (req, res) => {
    try {
        if(req.method !== 'PATCH'){
            return res.status(405).json(defaultResponse('Método não permitido, use PATCH'));
        }

        const data = req.body ?? {};
        const dadosObrigatorios = ['id','ordem','id_coluna'];
        
        if(!data?.id_espaco || !Number.isInteger(Number(data?.id_espaco))){
            return res.status(400).json(defaultResponse('Informe o ID do espaço como número inteiro!'));
        }
        data.id_espaco = Number(data.id_espaco);

        if(!data?.tarefas || !Array.isArray(data?.tarefas)){
            return res.status(400).json(defaultResponse('Informe um array de tarefas a serem atualizadas'));
        }

        const hasPermission = await usuarioTemPermissao({
            idUsuario: req.user.id,
            idEspaco: data.id_espaco,
            nomePermissao: requiredPermission.name,
            escrita: requiredPermission.escrita
        });
        if(!hasPermission){
            return res.status(403).json(defaultResponse('Você não tem permissão para editar tarefas neste espaço!'));
        }

        for(const tarefa of data.tarefas) {
            if(!dadosObrigatorios.every(key => key in tarefa)){
                return res.status(400).json(defaultResponse('Informe os dados obrigatórios nas tarefas para continuar!', { obrigatorios: dadosObrigatorios }));
            }

            // Checando ID
            const idTarefa = Number(tarefa.id);
            if(!Number.isInteger(idTarefa) || !(idTarefa > 0)){
                return res.status(400).json(defaultResponse('ID da tarefa deve ser um número inteiro!, ', { tarefa }));
            }

            // Checando Ordem
            const ordem = Number(tarefa.ordem)
            if(!Number.isInteger(ordem) || !(ordem >= 0)){
                return res.status(400).json(defaultResponse('Ordem da tarefa deve ser um número inteiro!, ', { tarefa }));
            }

            // Checando id coluna
            const idColuna = Number(tarefa.id_coluna);
            if(!Number.isInteger(idColuna) || !(idColuna > 0)){
                return res.status(400).json(defaultResponse('ID Coluna da tarefa deve ser um número inteiro!, ', { tarefa }));
            }
        }

        const result = await dbPrisma.$transaction(
            data.tarefas.map(tarefa => dbPrisma.tarefa.update({
                where: {
                    id: tarefa.id,
                    id_espaco: data.id_espaco,
                },
                data: {
                    ordem: Number(tarefa.ordem),
                    id_coluna: Number(tarefa.id_coluna),
                }
            }))
        );

        return res.status(200).json(defaultResponse('Tarefas atualizadas!'));
    } catch (error) {
        console.error('Erro ao atualizar tarefas em massa: ', error.message, error);

        return res.status(500).json(defaultResponse('Erro interno de servidor ao atualizar tarefas. Contate o suporte'));
    }
};

export default authMiddleware(handler);
