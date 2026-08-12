import jwt from 'jsonwebtoken';

import db from '@/pages/api/config/connectDB.js';
import defaultResponse from '@/pages/api/config/defaultResponse.js';
import verifyPassword from '@/pages/api/utils/verifyPassword.js';

const MENSAGEM_ERRO = 'Credenciais inválidas';

const handler = async (req, res) => {
    try {
        const { login = null, senha = null } = req.body ?? {};

        if(!login){
            return res.status(401).json(defaultResponse(MENSAGEM_ERRO));
        }

        if(!senha){
            return res.status(401).json(defaultResponse(MENSAGEM_ERRO));
        }

        const [userByUsername, userByEmail] = await Promise.all([
            db.query({ text: `SELECT * FROM usuario WHERE username = $1`, values: [login] }),
            db.query({ text: `SELECT * FROM usuario WHERE email = $1`, values: [login] }),
        ]);

        const usernameFound = userByUsername.rows.length > 0;
        const emailFound = userByEmail.rows.length > 0;

        if(usernameFound === emailFound){
            return res.status(401).json(defaultResponse(MENSAGEM_ERRO));
        }

        const user = usernameFound ? userByUsername.rows[0] : userByEmail.rows[0];

        const dbPassword = user.senha;

        if(!dbPassword){
            return res.status(401).json(defaultResponse(MENSAGEM_ERRO));
        }

        const senhaCorreta = await verifyPassword(senha,dbPassword);
        
        if(!senhaCorreta){
            return res.status(401).json(defaultResponse(MENSAGEM_ERRO));
        }
        
        // O payload carrega apenas o id: JWT é base64, não criptografia, e o
        // authMiddleware recarrega o usuário do banco a cada requisição. Incluir
        // a linha inteira exporia toda coluna nova de `usuario` automaticamente.
        const token = jwt.sign(
            { id: user.id },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        return res.status(200).json(defaultResponse('Login realizado', token));

    } catch (error) {
        console.log('Erro inesperado ao realizar login', error);
        
        return res.status(500).json(defaultResponse('Erro inesperado ao realizar login. Contate o suporte'));
    }
};

export default handler;
