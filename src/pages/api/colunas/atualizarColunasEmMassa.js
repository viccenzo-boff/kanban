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
        const dadosObrigatorios = ['id','ordem'];
        
        if(!data?.id_espaco || !Number.isInteger(Number(data?.id_espaco))){
            return res.status(400).json(defaultResponse('Informe o ID do espaço como número inteiro!'));
        }
        data.id_espaco = Number(data.id_espaco);

        if(!data?.colunas || !Array.isArray(data?.colunas)){
            return res.status(400).json(defaultResponse('Informe um array de colunas a serem atualizadas'));
        }

        const hasPermission = await usuarioTemPermissao({
            idUsuario: req.user.id,
            idEspaco: data.id_espaco,
            nomePermissao: requiredPermission.name,
            escrita: requiredPermission.escrita
        });
        if(!hasPermission){
            return res.status(403).json(defaultResponse('Você não tem permissão para editar colunas neste espaço!'));
        }

        for(const coluna of data.colunas) {
            if(!dadosObrigatorios.every(key => key in coluna)){
                return res.status(400).json(defaultResponse('Informe os dados obrigatórios nas colunas para continuar!', { obrigatorios: dadosObrigatorios }));
            }

            // Checando ID
            const idColuna = Number(coluna.id);
            if(!Number.isInteger(idColuna) || !(idColuna > 0)){
                return res.status(400).json(defaultResponse('ID deve ser um número inteiro maior que 0!, ', { coluna }));
            }

            // Checando Ordem
            const ordem = Number(coluna.ordem);
            if(!Number.isInteger(ordem) || !(ordem >= 0)){
                return res.status(400).json(defaultResponse('ID deve ser um número inteiro maior ou igual a 0!, ', { coluna }));
            }
        }

        await dbPrisma.$transaction(
            data.colunas.map(coluna => dbPrisma.coluna.update({
                where: { id: coluna.id, id_espaco: data.id_espaco },
                data: { ordem: Number(coluna.ordem) },
            }))
        );

        return res.status(200).json(defaultResponse('colunas atualizadas!'));
    } catch (error) {
        console.error('Erro ao atualizar colunas em massa: ', error.message, error);

        return res.status(500).json(defaultResponse('Erro interno de servidor ao atualizar colunas. Contate o suporte'));
    }
};

export default authMiddleware(handler);
