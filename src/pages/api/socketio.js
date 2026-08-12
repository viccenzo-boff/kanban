import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import db from "@/pages/api/config/connectDB";
import getQuadroRoom from "@/utils/getQuadroRoom";
import userBelongsToSpace from "@/pages/api/utils/userBelongsToSpace";

let io = null;
let pgClient = null;
let pgHasListen = false;

const AUTH_ERROR_CODE = 'NAO_AUTORIZADO';

// Erro de autenticação identificável pelo cliente.
// `data` é serializado pelo Socket.IO e chega em `error.data` no connect_error,
// permitindo distinguir falha de credencial de falha de transporte (rede).
const authError = (message) => {
  const error = new Error(message);
  error.data = { code: AUTH_ERROR_CODE };
  return error;
};

// Autentica o handshake com a mesma cadeia de verificação do authMiddleware
// HTTP: token válido -> usuário existe -> usuário ativo.
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake?.auth?.token;

    if (!token) {
      return next(authError('Não autorizado. Faça login para continuar'));
    }

    const tokenData = jwt.verify(token, process.env.JWT_SECRET);

    const userResult = await db.query({
      text: "SELECT id, nome, email, username, ativo FROM usuario WHERE id = $1",
      values: [tokenData.id],
    });

    if (userResult.rowCount !== 1) {
      return next(authError('Não autorizado. Faça login para continuar'));
    }

    const user = userResult.rows[0];

    if (user?.ativo !== true) {
      return next(authError('Não autorizado. Faça login para continuar'));
    }

    socket.data.user = user;

    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(authError('Sessão expirada. Faça login novamente.'));
    }

    if (error.name === 'JsonWebTokenError') {
      return next(authError('Não autorizado. Faça login para continuar'));
    }

    console.error('Erro ao autenticar socket', error);
    return next(new Error('Erro ao autenticar conexão'));
  }
};

export default async function SocketHandler(req, res) {
  if (res.socket.server.io) {
    res.end();
    return;
  }

  io = new Server(res.socket.server, {
    path: "/api/socketio",
    addTrailingSlash: false,
  });

  res.socket.server.io = io;

  io.use(authenticateSocket);

  if (!pgClient) {
    pgClient = await db.connect();
  }

  if (!pgHasListen) {
    pgHasListen = true;

    await pgClient.query("LISTEN tarefas");

    pgClient.on("notification", (msg) => {
      if (msg.channel === "tarefas") {
        try {
          const payload = JSON.parse(msg.payload);
          const room = getQuadroRoom(payload.id_espaco);

          if (!room) {
            console.error("Notificação do Quadro com ID de espaço inválido:", payload);
            return;
          }

          io.to(room).emit("tarefas", payload);
        } catch (error) {
          console.error("Erro ao processar notificação do Quadro:", error);
        }
      }
    });
  }

  io.on("connection", (socket) => {
    const user = socket.data.user;

    socket.on("join_quadro", async ({ id_espaco } = {}) => {
      const room = getQuadroRoom(id_espaco);

      if (!room) {
        console.error(`${socket.id} tentou entrar em uma room com ID de espaço inválido`);
        return;
      }

      // Sem vínculo com o espaço não há entrada na room, mesmo com token válido.
      // Em caso de erro na verificação a falha é fechada (nega o acesso).
      const vinculo = await userBelongsToSpace(id_espaco, user.id);

      if (vinculo.belongs !== true) {
        console.error(`Usuário ${user.id} tentou entrar no espaço ${id_espaco} sem permissão`);
        return;
      }

      socket.join(room);
    });

    socket.on("leave_quadro", ({ id_espaco } = {}) => {
      const room = getQuadroRoom(id_espaco);

      if (!room) {
        console.error(`${socket.id} tentou sair de uma room com ID de espaço inválido`);
        return;
      }

      socket.leave(room);
    });
  });

  res.end();
}
