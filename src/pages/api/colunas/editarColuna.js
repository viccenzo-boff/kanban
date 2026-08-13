import dbPrisma from '@/pages/api/config/connectDbPrisma';
import defaultResponse from '@/pages/api/config/defaultResponse';
import authMiddleware from '@/pages/api/config/middlewares/authMiddleware';
import usuarioTemPermissao from '@/pages/api/utils/usuarioTemPermissao';

const requiredPermission = {
    name: 'QUADRO',
    escrita: true,
};

const tiposValidos = ['A FAZER', 'FAZENDO', 'FEITO'];

const handler = async (req, res) => {
    try {
        const data = req.body ?? {};
        const dadosPermitidos = ['id','ativo','nome','tipo','ordem'];
        const idInformado = 'id' in data;
        const apenasDadosPermitidosInformados = Object.keys(data).every(key => dadosPermitidos.includes(key));

        if(!idInformado){
            return res.status(defaultResponse('Informe pelo menos o ID'));
        }

        if(!apenasDadosPermitidosInformados){
            return res.status(400).json(defaultResponse('Informe apenas os dados permitidos', { informados: data, permitidos: dadosPermitidos }));
        }

        const coluna = await dbPrisma.coluna.findUnique({ where: { id: data.id } });

        if(!coluna){
            return res.status(404).json(defaultResponse('Coluna não encontrada!'));
        }

        const hasPermission = await usuarioTemPermissao({
            idUsuario: req.user.id,
            idEspaco: coluna.id_espaco,
            nomePermissao: requiredPermission.name,
            escrita: requiredPermission.escrita,
        });
        if(!hasPermission){   
            return res.status(403).json(defaultResponse('Você não tem permissão para criar colunas neste espaço!'));
        }

        if(data.tipo != null && !tiposValidos.includes(data.tipo)){
            return res.status(400).json(defaultResponse('Tipo de coluna inválido'));
        }

        if(data.ativo === false){
            const tarefas = await dbPrisma.tarefa.findMany({
                where: { id_coluna: coluna.id }
            });

            if(tarefas.length !== 0){
                return res.status(409).json(defaultResponse('Mova as tarefas desta coluna antes de desativá-la'));
            }
        }

        const { id: _, ...safeData } = data;

        const colunaAtualizada = await dbPrisma.$transaction(async tx => {

            if(safeData.ordem != null && safeData.ordem != undefined){
                const localWhere = {
                    id_espaco: coluna.id_espaco,
                    id: { not: coluna.id }
                };
                const localData = {};

                if(coluna.ordem > safeData.ordem){
                    localWhere.ordem = { gte: safeData.ordem, lt: coluna.ordem };
                    localData.ordem = { increment: 1 };
                } else {
                    localWhere.ordem = { gt: coluna.ordem, lte: safeData.ordem };
                    localData.ordem = { decrement: 1 };
                }

                await tx.coluna.updateMany({ where: localWhere, data: localData });
            }

            const colunaAtualizada = await tx.coluna.update({
                where: { id: coluna.id },
                data: safeData
            });

            return colunaAtualizada;
        });

        return res.status(200).json(defaultResponse('Coluna atualizada com sucesso', colunaAtualizada));

    } catch (error) {
        console.error(error);
        return res.status(500).json(defaultResponse());
    }
};

export default authMiddleware(handler);
