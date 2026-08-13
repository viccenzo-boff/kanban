import db from '@/pages/api/config/connectDB.js';
import buildInsert from '@/pages/api/utils/buildInsert.js';
import isDatabaseDate from '@/pages/api/utils/isDatabaseDate';
import defaultResponse from '@/pages/api/config/defaultResponse.js';
import authMiddleware from '@/pages/api/config/middlewares/authMiddleware';
import usuarioTemPermissao from '@/pages/api/utils/usuarioTemPermissao';
import userBelongsToSpace from '../utils/userBelongsToSpace';
import { isValidTaskPriority } from '@/utils/taskPriority';

const requiredPermission = {
    name: 'QUADRO',
    escrita: true,
};

const handler = async (req, res) => {
    try {
        const dadosForm = req.body ?? {};
        // `prioridade` entra aqui porque já era obrigatória de fato: a validação
        // abaixo rejeita `undefined`. Fora da lista, omitir o campo devolvia
        // 'Prioridade inválida' — mensagem que sugere valor errado, e não campo
        // ausente, e que deixava `prioridade` fora dos obrigatórios da resposta.
        const dadosObrigatorios = ['titulo','descricao','id_espaco','id_coluna','prioridade'];
        const dadosPermitidos = [...dadosObrigatorios, 'id_responsavel','data_prevista','data_limite'];
        const dadosObrigatoriosPreenchidos = dadosObrigatorios.every(dado => dadosForm[dado]);
        const somenteDadosPermitidosPreenchidos = Object.keys(dadosForm).every(key => dadosPermitidos.includes(key));

        if(!dadosObrigatoriosPreenchidos){
            return res.status(400).json(defaultResponse('Preencha todos os dados para continuar', { obrigatorios: dadosObrigatorios} ));
        }

        if(!somenteDadosPermitidosPreenchidos){
            return res.status(400).json(defaultResponse('Preencha apenas os dados permitidos para continuar', { obrigatorios: dadosObrigatorios} ));
        }
        
        if(!isValidTaskPriority(dadosForm.prioridade)){
            return res.status(400).json(defaultResponse('Prioridade inválida'));
        }

        const idEspaco = Number(dadosForm.id_espaco);
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
            return res.status(403).json(defaultResponse('Você não tem permissão para criar tarefas neste espaço!'));
        }
        dadosForm.id_espaco = idEspaco;

        const idColuna = Number(dadosForm.id_coluna);
        if(!Number.isInteger(idColuna) || idColuna <= 0){
            return res.status(400).json(defaultResponse('ID inválido'));
        }
        const columnResult = await db.query({ text: 'SELECT id FROM coluna WHERE id = $1 AND id_espaco = $2', values:[idColuna, idEspaco] });
        if(columnResult.rowCount !== 1){
            return res.status(404).json(defaultResponse('Coluna não encontrada!'));
        }
        dadosForm.id_coluna = idColuna;

        if(dadosForm?.id_responsavel){
            const responsavelResult = await db.query({
                text: `SELECT * FROM usuario WHERE id = $1`,
                values:[dadosForm.id_responsavel]
            });

            if(responsavelResult.rowCount !== 1){
                return res.status(404).json(defaultResponse('Responsável não encontrado!'));
            }

            const responsavelPertenceAoEspaco = await userBelongsToSpace(dadosForm.id_espaco, dadosForm.id_responsavel);

            if(responsavelPertenceAoEspaco.belongs === false){
                return res.status(403).json(defaultResponse('Usuário não pertence a este espaço!'));
            }
        }

        if(dadosForm?.data_prevista && !isDatabaseDate(dadosForm.data_prevista)){
            return res.status(400).json(defaultResponse('Tipo de data inválida'));
        }

        if(dadosForm?.data_limite && !isDatabaseDate(dadosForm.data_limite)){
            return res.status(400).json(defaultResponse('Tipo de data inválida'));
        }

        const ordemResult = await db.query({ text: 'SELECT MAX(ordem) AS max_ordem FROM tarefa WHERE id_coluna = $1', values:[idColuna] });
        const maxOrdem = ordemResult.rows[0].max_ordem ?? 0;
        dadosForm.ordem = maxOrdem + 1;

        const insert = buildInsert('tarefa', dadosForm);
        const tarefa = await db.query({text: insert.text, values: insert.values });

        return res.status(201).json(defaultResponse('Tarefa criada com sucesso', tarefa.rows[0]));

    } catch (error) {
        console.error(error);
        return res.status(500).json(defaultResponse());
    }
}

export default authMiddleware(handler);
