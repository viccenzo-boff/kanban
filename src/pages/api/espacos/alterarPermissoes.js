import db from '@/pages/api/config/connectDB';
import defaultResponse from '@/pages/api/config/defaultResponse';
import authMiddleware from '@/pages/api/config/middlewares/authMiddleware';
import usuarioTemPermissao from '@/pages/api/utils/usuarioTemPermissao';
import isTriggerException from '@/pages/api/utils/isTriggerException';

const requiredPermission = {
    name: 'USUARIOS',
    escrita: true,
};

const permissionValues = [
    { value: 'NONE', label: 'Sem permissão' },
    { value: 'READ', label: 'Apenas leitura'  },
    { value: 'WRITE', label: 'Escrita'  },
];

const handler = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json(defaultResponse('Método não permitido'));
    }

    const client = await db.connect();

    try {
        const data = req.body ?? {};

        await client.query('BEGIN');

        // Verificando espaço
        if(!data.hasOwnProperty('id_espaco')){
            return res.status(400).json(defaultResponse('Informe o ID do espaço!'));
        }
        data.id_espaco = Number(data.id_espaco);
        const spaceResult = await client.query('SELECT id, id_usuario FROM espaco WHERE id = $1', [data.id_espaco]);
        if(spaceResult.rowCount !== 1){
            await client.query('ROLLBACK');
            return res.status(404).json(defaultResponse('Espaço não encontrado!'));
        }

        // Verificando usuário
        if(!data.hasOwnProperty('id_usuario')){
            return res.status(400).json(defaultResponse('Informe o ID do usuário!'));
        }
        data.id_usuario = Number(data.id_usuario);
        const userResult = await client.query('SELECT id FROM usuario WHERE id = $1', [data.id_usuario]);
        if(userResult.rowCount !== 1){
            await client.query('ROLLBACK');
            return res.status(404).json(defaultResponse('Usuário não encontrado!'));
        }

        // Verificando permissões
        for(const permission of data.permissions){
            if(!permission.hasOwnProperty('id_permissao')){
                await client.query('ROLLBACK');
                return res.status(400).json(defaultResponse('Informe o ID da permissão!'));
            }
            if(!permission.hasOwnProperty('escrita')){
                await client.query('ROLLBACK');
                return res.status(400).json(defaultResponse('Informe o valor de escrita!'));
            }
            
            permission.id_permissao = Number(permission.id_permissao);
            permission.escrita = permission.escrita.toUpperCase();

            const permissionResult = await client.query('SELECT id FROM espaco_permissoes WHERE id = $1', [permission.id_permissao]);
            if(permissionResult.rowCount === 0){
                await client.query('ROLLBACK');
                return res.status(404).json(defaultResponse(`Permissão com ID ${permission.id_permissao} não encontrada!`));
            }

            if(!permissionValues.some(p => p.value === permission.escrita)){
                await client.query('ROLLBACK');
                return res.status(400).json(defaultResponse(`Valor de 'escrita' inválido! Informe um dos seguintes valores: ${permissionValues.map(p => p.value).join(', ')}`));
            }
        }

        // Verificar se o usuário tem permissão para alterar as permissões de outros usuários no espaço
        const hasPermission = await usuarioTemPermissao({
            idUsuario: req.user.id,
            idEspaco: data.id_espaco,
            nomePermissao: requiredPermission.name,
            escrita: requiredPermission.escrita,
            dbClient: client
        });
        if(!hasPermission){
            return res.status(403).json(defaultResponse('Você não tem permissão para alterar as permissões de usuários neste espaço!'));
        }

        // Permissões NONE
        const toDeletePermissionIds = data.permissions.filter(p => p.escrita === 'NONE').map(p => p.id_permissao);
        if(toDeletePermissionIds.length > 0) {
            await client.query( 
                `
                    DELETE FROM espaco_usuario_permissoes
                    WHERE id_usuario = $1 AND id_espaco = $2 AND id_permissao = ANY($3::int[])
                `,
                [data.id_usuario, data.id_espaco, toDeletePermissionIds]
            );
        }

        // Permissões READ ou WRITE
        for(const permission of data.permissions.filter(p => p.escrita !== 'NONE')){
            const escritaValue = permission.escrita === 'WRITE' ? true : false;

            await client.query({
                text: `
                    INSERT INTO espaco_usuario_permissoes (id_usuario, id_espaco, id_permissao,escrita)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (id_usuario, id_espaco, id_permissao)
                    DO UPDATE SET escrita = EXCLUDED.escrita
                `,
                values:[data.id_usuario, data.id_espaco, permission.id_permissao, escritaValue]
            });
        }

        await client.query('COMMIT');

        return res.status(200).json(defaultResponse('Permissões alteradas com sucesso!'));

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        if(isTriggerException(error.code)){
            return res.status(409).json(defaultResponse(error.message));
        }
        return res.status(500).json(defaultResponse('Erro ao alterar permissões!'));
    } finally {
        await client.release();
    }
}

export default authMiddleware(handler);
