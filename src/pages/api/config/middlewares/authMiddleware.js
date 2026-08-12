import jwt from 'jsonwebtoken';
import db from '../connectDB';
import defaultResponse from '../defaultResponse';

const MESSAGE = 'Não autorizado. Faça login para continuar';

const authMiddleware = handler => async (req, res) => {
    try {
        const token = req.headers.authorization;

        if(!token){
            return res.status(401).json(defaultResponse(MESSAGE));
        }

        const tokenData = jwt.verify(token, process.env.JWT_SECRET);

        // Colunas explícitas: com SELECT * o hash da senha circularia em
        // req.user por toda a aplicação, a um res.json(req.user) de vazar.
        const userResult = await db.query({
            text: "SELECT id, nome, email, username, ativo, avatar_public_url FROM usuario WHERE id = $1",
            values: [tokenData.id]
        });

        if (userResult.rowCount !== 1) {
            console.log('Usuário não encontrado');
            return res.status(401).json(defaultResponse(MESSAGE));
        }

        const user = userResult.rows[0];

        if (user?.ativo !== true) {
            console.log('Autenticação: Usuário inativo!');
            return res.status(401).json(defaultResponse(MESSAGE));
        }

        req.user = user;

        return handler(req, res);

    } catch (error) {
        if(error.name === 'TokenExpiredError'){
            return res.status(401).json(defaultResponse('Sessão expirada. Faça login novamente.'));
        }

        if(error.name === 'JsonWebTokenError'){
            return res.status(401).json(defaultResponse(MESSAGE));
        }
        
        console.log('Erro ao autenticar rota', error);
        return res.status(500).json(defaultResponse('Erro ao autenticar rota. Contate o suporte!'));
    }
}

export default authMiddleware;
