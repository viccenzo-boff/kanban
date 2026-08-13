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

        // A recusa acontece apenas quando nenhuma das duas buscas acha alguém.
        // Comparar os dois booleanos entre si também recusava o caso em que as
        // duas acham — `login` sendo o username de um usuário e o email de
        // outro —, negando um login legítimo. Hoje isso é inalcançável, porque
        // `isUsernameValid` restringe username a [A-Za-z0-9_] e `isEmailValid`
        // exige `@`, então nenhuma string satisfaz os dois; a colisão volta a
        // ser possível se essas regras mudarem ou se houver linha legada.
        // Nesse caso o username decide, por ser o identificador mais restrito.
        const user = userByUsername.rows[0] ?? userByEmail.rows[0] ?? null;

        if(!user){
            return res.status(401).json(defaultResponse(MENSAGEM_ERRO));
        }

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
        console.error('Erro inesperado ao realizar login', error);
        
        return res.status(500).json(defaultResponse('Erro inesperado ao realizar login. Contate o suporte'));
    }
};

export default handler;
