import db from '@/pages/api/config/connectDB';
import dbPrisma from '@/pages/api/config/connectDbPrisma';
import defaultResponse from '@/pages/api/config/defaultResponse';
import authMiddleware from '@/pages/api/config/middlewares/authMiddleware';
import usuarioTemPermissao from '@/pages/api/utils/usuarioTemPermissao';
import userBelongsToSpace from '@/pages/api/utils/userBelongsToSpace';
import isDatabaseDate from '@/pages/api/utils/isDatabaseDate';
import databaseDateToPrisma from '@/pages/api/utils/databaseDateToPrisma';
import { isValidTaskPriority } from '@/utils/taskPriority';

const requiredPermission = {
    name: 'QUADRO',
    escrita: true,
};

const handler = async (req, res) => {
    try {
        const data = req.body ?? {};
        const dadosPermitidos = ['id','titulo','descricao','id_coluna','ordem','id_responsavel','data_prevista','data_limite','prioridade'];
        const idInformado = 'id' in data;
        const apenasDadosPermitidosInformados = Object.keys(data).every(key => dadosPermitidos.includes(key));

        if(!idInformado){
            return res.status(400).json(defaultResponse('Informe o ID para continuar', { informados: data }));
        }

        if(!apenasDadosPermitidosInformados){
            return res.status(400).json(defaultResponse('Informe apenas dados permitidos', { informados: data, permitidos: dadosPermitidos }));
        }

        if('prioridade' in data && !isValidTaskPriority(data.prioridade)){
            return res.status(400).json(defaultResponse('Prioridade inválida'));
        }

        const tarefa = await dbPrisma.tarefa.findUnique({ where: { id: data.id }});

        if(!tarefa){
            return res.status(404).json(defaultResponse('Tarefa não encontrada'));
        }

        const hasPermission = await usuarioTemPermissao({
            idUsuario: req.user.id,
            idEspaco: tarefa.id_espaco,
            nomePermissao: requiredPermission.name,
            escrita: requiredPermission.escrita
        });
        if(!hasPermission){
            return res.status(403).json(defaultResponse('Você não tem permissão para editar tarefas neste espaço!'));
        }

        if(data?.id_coluna && tarefa.id_coluna != data.id_coluna){
            const coluna = await dbPrisma.coluna.findUnique({ where: { id: data.id_coluna }});

            if(!coluna){
                return res.status(404).json(defaultResponse('Coluna nova inexistente'));
            }

            if(coluna.ativo === false){
                console.log('coluna inativa cara: ', coluna);
                return res.status(409).json(defaultResponse(`A coluna '${coluna}' está inativa, use outra`));
            }
        }

        if(data?.id_responsavel){
            const responsavelResult = await db.query({
                text: `SELECT * FROM usuario WHERE id = $1`,
                values:[data.id_responsavel]
            });

            if(responsavelResult.rowCount !== 1){
                return res.status(404).json(defaultResponse('Responsável não encontrado!'));
            }

            const responsavelPertenceAoEspaco = await userBelongsToSpace(tarefa.id_espaco, data.id_responsavel);

            if(responsavelPertenceAoEspaco.belongs === false){
                return res.status(403).json(defaultResponse('Usuário não pertence a este espaço!'));
            }
        }

        
        if(data?.data_prevista){
            if(!isDatabaseDate(data.data_prevista)){
                return res.status(400).json(defaultResponse('Tipo de data inválida'));
            }
            data.data_prevista = databaseDateToPrisma(data.data_prevista);
        }

        if(data?.data_limite){
            if(!isDatabaseDate(data.data_limite)){
                return res.status(400).json(defaultResponse('Tipo de data inválida'));
            }
            data.data_limite = databaseDateToPrisma(data.data_limite);
        }

        const { id: _, ...safeData } = data;

        const tarefaAtualizada = await dbPrisma.$transaction(async tx => {

            if(safeData.ordem != null && safeData.ordem != undefined){
                const localColuna = safeData?.id_coluna ?? tarefa.id_coluna;
                const localWhere = {
                    id_coluna: localColuna,
                    id: { not: tarefa.id }
                };
                const localData = {};

                if(tarefa.id_coluna !== localColuna || tarefa.ordem > safeData.ordem){
                    localWhere.ordem = { gte: safeData.ordem };
                    localData.ordem = { increment: 1 };
                } else {
                    localWhere.ordem = { lte: safeData.ordem };
                    localData.ordem = { decrement: 1 };
                }

                await tx.tarefa.updateMany({ where: localWhere, data: localData });
            }

            const tarefaAtualizada = await tx.tarefa.update({
                where: { id: data.id },
                data: safeData
            });
            
            return tarefaAtualizada;
        });

        return res.status(200).json(defaultResponse('Tarefa atualizada com sucesso', tarefaAtualizada));
    } catch (error) {
        console.error(error);
        return res.status(500).json(defaultResponse());
    }
};

export default authMiddleware(handler);
