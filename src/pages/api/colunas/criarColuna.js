import db from '@/pages/api/config/connectDB';
import buildInsert from '@/pages/api/utils/buildInsert';
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
        const dadosForm = req.body ?? {};
        const dadosObrigatorios = ['nome','tipo','id_espaco'];
        const dadosObrigatoriosPreenchidos = dadosObrigatorios.every(dado => dadosForm[dado]);

        if(!dadosObrigatoriosPreenchidos){
            return res.status(400).json(defaultResponse('Preencha todos os dados para continuar'));
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
            return res.status(403).json(defaultResponse('Você não tem permissão para criar colunas neste espaço!'));
        }
        dadosForm.id_espaco = idEspaco;

        if(!tiposValidos.includes(dadosForm.tipo)){
            return res.status(400).json(defaultResponse('Tipo de coluna inválido'));
        }

        const ordemResult = await db.query({ text: 'SELECT COALESCE(MAX(ordem), 0) + 1 AS proxima_ordem FROM coluna WHERE id_espaco = $1', values:[idEspaco] });
        dadosForm.ordem = ordemResult.rows[0].proxima_ordem;

        const insert = buildInsert('coluna', dadosForm);
        const coluna = await db.query({text: insert.text, values: insert.values });

        return res.status(201).json(defaultResponse('Coluna criada com sucesso', coluna.rows[0]));

    } catch (error) {
        console.error(error);
        return res.status(500).json(defaultResponse());
    }
}

export default authMiddleware(handler);