// Next Auth Provider
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

// Node
import jwt from 'jsonwebtoken';

// Personalizados
import defaultResponse from '../../config/defaultResponse';
import db from '@/pages/api/config/connectDB';
import buildInsert from '@/pages/api/utils/buildInsert.js';
import usernameGenerator from '@/pages/api/utils/usernameGenerator';
import insertIndividualSpace from '@/pages/api/utils/insertIndividualSpace';

const handler = async (req, res) => {
    const session = await getServerSession(req, res, authOptions);

    if (!session) {
        return res.status(401).json(defaultResponse('Login com conta do google não autorizado'));
    }

    const data = {
        email: session.user.email,
        nome: session.user.name,
        provedor: 'google',
    };


    while (1) {
        const username = usernameGenerator();

        const existingUsername = await db.query({ text: `SELECT 1 FROM usuario WHERE username = $1`, values: [username] });

        if (existingUsername.rowCount === 0) {
            data.username = username;
            break;
        }
    }

    const [emailExistente, usernameExistente] = await Promise.all([
        db.query({ text: `SELECT * FROM usuario WHERE email = $1 LIMIT 1`, values: [data.email] }),
        db.query({ text: `SELECT 1 FROM usuario WHERE username = $1 LIMIT 1`, values: [data.username] }),
    ]);

    if (usernameExistente.rowCount > 0) {
        return res.status(409).json(defaultResponse('Nome de usuário já existe, tente novamente'));
    }

    let user = emailExistente.rowCount > 0 ? emailExistente.rows[0] : null;

    if (!user) {
        const { text, values } = buildInsert('usuario', data);
        const userResult = await db.query({ text, values });

        if (userResult.rowCount > 0) {
            user = userResult.rows[0];
        } else {
            throw new Error('Usuário não criado', {
                cause: userResult
            });
        }

        try {
            const espacoResult = await insertIndividualSpace(user);

            if (espacoResult.rowCount === 0) {
                console.log('Erro ao criar espaço pessoal para o usuário', user.id);
            }
        } catch (error) {
            console.error('Erro ao criar espaço pessoal:', error);
        }
    }

    // Mesmo critério do login por senha: apenas o id no payload.
    const token = jwt.sign(
        { id: user.id },
        process.env.JWT_SECRET,
        { expiresIn: '8h' }
    );

    return res.status(200).json(defaultResponse('Login realizado', token));
}

export default handler;