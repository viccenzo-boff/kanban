import db from '@/pages/api/config/connectDB';
import defaultResponse from '@/pages/api/config/defaultResponse';
import authMiddleware from '@/pages/api/config/middlewares/authMiddleware';

const handler = async (req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).json(defaultResponse('Método não permitido'));
    }

    try {
        const requiredData = ['id_espaco','id_usuario'];
        const data = req.query ?? {};

        // Verificando dados faltantes ou inválidos
        for(const requiredKey of requiredData){
            if(!data.hasOwnProperty(requiredKey)){
                return res.status(400).json(defaultResponse('Informe espaço e usuário!'));
            }

            if(!Number.isInteger(Number(data[requiredKey]))){
                return res.status(400).json(defaultResponse(`${requiredKey} '${data[requiredKey]}' inválido!`));    
            }

            data[requiredKey] = Number(data[requiredKey]);
        }

        const spaceResult = await db.query({
            text: 'SELECT id, id_usuario FROM espaco WHERE id = $1',
            values: [data.id_espaco]
        });
        if(spaceResult.rowCount !== 1){
            return res.status(404).json(defaultResponse('Espaço não encontrado!'));
        }

        // Verificando pertencimento do usuário ao espaço
        const targetBelongsToSpace = Number(spaceResult.rows[0].id_usuario) === Number(data.id_usuario)
            ? { rowCount: 1 }
            : await db.query({
                text: `
                    SELECT id
                    FROM espaco_usuario
                    WHERE id_espaco = $1
                        AND id_usuario = $2
                        AND ativo = true
                    LIMIT 1
                `,
                values: [data.id_espaco, data.id_usuario]
            });
        if(targetBelongsToSpace.rowCount !== 1){
            return res.status(404).json(defaultResponse('Permissões não encontradas!'));
        }

        // Permissões existentes no sistema
        const permissionsResult = await db.query('SELECT id, nome, descricao FROM espaco_permissoes');
        if(permissionsResult.rowCount === 0){
            return res.status(500).json(defaultResponse('Nenhuma permissão encontrada. Contate o suporte'));
        }

        // Permissões do usuário no espaço
        const userPermissionsResult = await db.query({
            text: `
                SELECT id_permissao, escrita
                FROM espaco_usuario_permissoes eup
                WHERE eup.id_usuario = $1 AND eup.id_espaco = $2
            `,
            values: [data.id_usuario, data.id_espaco]
        });
        const userPermissions = userPermissionsResult.rows;

        const permissions = permissionsResult.rows.map(permission => {
            const userPermission = userPermissions.find(p => p.id_permissao == permission.id);

            return { ...permission, escrita: userPermission?.escrita ?? null };
        });

        return res.status(200).json(defaultResponse('Segue permissões', permissions));

    } catch (error) {
        console.error(error);
        return res.status(500).json(defaultResponse('Erro ao listar permissões de usuário'));
    }
};

export default authMiddleware(handler);
