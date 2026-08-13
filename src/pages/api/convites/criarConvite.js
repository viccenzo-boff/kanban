import db from '@/pages/api/config/connectDB';
import defaultResponse from '@/pages/api/config/defaultResponse';
import authMiddleware from '@/pages/api/config/middlewares/authMiddleware';
import RabbitmqServer from '@/pages/api/config/rabbitmq';
import buildInsert from '@/pages/api/utils/buildInsert';
import getCurrentUrl from '@/pages/api/config/getCurrentUrl';
import usuarioTemPermissao from '@/pages/api/utils/usuarioTemPermissao';
import rules from './inviteRules';

const requiredPermission = {
    name: 'USUARIOS',
    escrita: true,
};

const publishEmail = async (value) => {
    try {
        const queueName = 'espaco_convite';
        const queue = new RabbitmqServer();
        await queue.start();

        await queue.publish(queueName, value);

        await queue.disconnect();

        return true;
    } catch (error) {
        console.error('Erro ao publicar na fila: ', error);
        
        return false;
    }
};

const emailBody = (data) => {
    return `
        <h1>Convite para espaço </h1>
        <p>Você foi convidado para participar do espaço <strong>${data.nomeEspaco}</strong></p>
        <p>Acesse seu perfil na aba <strong>Convites</strong> para ver o convite:</p>
        <a href="${getCurrentUrl().fullUrl}/usuarios/perfil">Clique aqui</a> para acessar seu perfil</a>
    `;
}

const handler = async (req, res) => {
    const client = await db.connect();
    try {

        if(req.method !== 'POST'){
            return res.status(405).json(defaultResponse('Método não permitido'));
        }

        const requiredData = ['id_espaco','id_usuario','enviar_email'];
        const data = req.body ?? {};
        const missingData = !requiredData.every(requiredKey => data[requiredKey] !== undefined );
        const idEspaco = Number(data.id_espaco);
        const idUsuario = Number(data.id_usuario);

        if(missingData) {
            return res.status(400).json(defaultResponse('Informe todos os dados obrigatórios'));
        }
        
        if(!Number.isInteger(idEspaco) || idEspaco <= 0 || !Number.isInteger(idUsuario) || idUsuario <= 0){
            return res.status(400).json(defaultResponse('ID inválido'));
        }

        if(typeof data.enviar_email !== 'boolean'){
            return res.status(400).json(defaultResponse('Enviar e-mail deve ser verdadeiro ou falso'));
        }

        await client.query('BEGIN');

        const [spaceResult, userResult] = await Promise.all([
            client.query({
                text: `SELECT id, nome, id_usuario FROM espaco WHERE id = $1`,
                values: [idEspaco]
            }),
            client.query({
                text: `SELECT id, email, nome FROM usuario WHERE id = $1`,
                values: [idUsuario]
            })
        ]);

        if(spaceResult.rowCount !== 1){
            await client.query('ROLLBACK');
            return res.status(404).json(defaultResponse('Espaço não encontrado!'));
        }

        const space = spaceResult.rows[0];
        const hasPermission = await usuarioTemPermissao({
            idUsuario: req.user.id,
            idEspaco,
            nomePermissao: requiredPermission.name,
            escrita: requiredPermission.escrita,
            dbClient: client
        });
        if(!hasPermission){
            await client.query('ROLLBACK');
            return res.status(403).json(defaultResponse('Você não tem permissão para criar convites neste espaço!'));
        }

        if(userResult.rowCount !== 1){
            await client.query('ROLLBACK');
            return res.status(404).json(defaultResponse('Usuário não encontrado!'));
        }

        const user = userResult.rows[0];

        if(Number(space.id_usuario) === Number(user.id)){
            await client.query('ROLLBACK');
            return res.status(409).json(defaultResponse('Usuário já pertence ao espaço'));
        }

        const userBondResult = await client.query({
            text: `
                SELECT id
                FROM espaco_usuario
                WHERE id_espaco = $1
                AND id_usuario = $2
                AND ativo = true
                LIMIT 1
            `,
            values: [idEspaco, idUsuario]
        });

        if(userBondResult.rowCount === 1){
            await client.query('ROLLBACK');
            return res.status(409).json(defaultResponse('Usuário já pertence ao espaço'));
        }

        if(data.enviar_email === true){
            const sentEmailsResult = await client.query({
                text: `
                    SELECT COUNT(*)::int AS total
                    FROM espaco_convite
                    WHERE id_usuario = $1
                    AND enviar_email = true
                    AND data_cadastro >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
                `,
                values: [idUsuario]
            });

            if(sentEmailsResult.rows[0].total >= rules.max_emails_in_24h){
                await client.query('ROLLBACK');
                return res.status(429).json(defaultResponse(`Limite de ${rules.max_emails_in_24h} e-mails em 24h atingido`));
            }
        }

        const pendingInvitesResult = await client.query({
            text: `
                SELECT 1
                FROM espaco_convite
                WHERE id_usuario = $1
                AND id_espaco = $2
                AND status = 'PENDENTE'
            `,
            values: [idUsuario, idEspaco]
        });

        if(pendingInvitesResult.rowCount > 0){
            await client.query('ROLLBACK');
            return res.status(409).json(defaultResponse('Usuário já foi convidado!'));
        }

        const inviteData = {
            id_espaco: idEspaco,
            id_usuario: idUsuario,
            enviar_email: data.enviar_email,
            data_expiracao: new Date(Date.now() + rules.expiration_days * 24 * 60 * 60 * 1000),
        };

        const inviteSql = buildInsert('espaco_convite', inviteData);
        const inviteResult = await client.query({ text: inviteSql.text, values: inviteSql.values });
        
        if(inviteResult.rowCount !== 1){
            console.log('Convite não criado: ', inviteResult);
            await client.query('ROLLBACK');
            return res.status(500).json(defaultResponse('Convite não criado. Contate o suporte'));
        }

        const invite = inviteResult.rows[0];

        if(data.enviar_email === true){
            const body = emailBody({ nomeEspaco: space.nome });

            const emailData = {
                id_usuario: user.id,
                email: user.email,
                assunto: `KANBAN: Convite de espaço`,
                corpo: body,
                id_convite: invite.id,
            };

            const published = await publishEmail(JSON.stringify(emailData));

            if(!published){
                await client.query('ROLLBACK');
                return res.status(500).json(defaultResponse('Erro ao enviar e-mail. Contate o suporte'));
            }
        }

        await client.query('COMMIT');

        return res.status(201).json(defaultResponse('Convite criado', invite));
    } catch (error) {
        console.error('Erro ao criar convite: ', error);
        await client.query('ROLLBACK');
        return res.status(500).json(defaultResponse('Erro ao criar convite. Contate o suporte!'));
    } finally {
        client.release();
    }
};

export default authMiddleware(handler);
