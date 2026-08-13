import authMiddleware from "./config/middlewares/authMiddleware";
import defaultResponse from "./config/defaultResponse";

const handler = async (req, res) => {
    try {
        res.status(200).json(defaultResponse('Autenticado com sucesso'));
    } catch (error) {
        console.error(error);
        res.status(401).json(defaultResponse('Erro ao checar autenticação. Contate o suporte!'));
    }
};

export default authMiddleware(handler);