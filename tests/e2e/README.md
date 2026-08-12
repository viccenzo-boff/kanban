# Testes end-to-end de segurança

Estes testes são de **nível diferente** dos testes unitários em
`src/**/__tests__` e por isso não rodam com `npm test`. Eles exigem o ambiente
de desenvolvimento **no ar** (aplicação, Postgres e RabbitMQ) e criam usuários,
espaços e tarefas reais no banco.

## Como rodar

```bash
npm run dev:up        # sobe o ambiente
npm run test:e2e      # roda a suíte dentro do container
```

Para apontar para outro host, defina `BASE_URL`:

```bash
BASE_URL=http://localhost:3001 node tests/e2e/socket-auth.e2e.js
```

## O que cada arquivo cobre

| Arquivo | Cobertura |
|---|---|
| `socket-auth.e2e.js` | Handshake do Socket.IO recusa conexão sem token e com token inválido; usuário não recebe eventos de espaço a que não pertence; responsável de fora do espaço é barrado com 403 |
| `jwt-payload.e2e.js` | Payload do JWT contém apenas `id`/`iat`/`exp`; nenhuma rota devolve hash de senha; fluxo autenticado continua funcionando |

## Limitação conhecida

As asserções de **tempo real** (`A RECEBE tarefas do proprio espaco` e
`A NAO recebe tarefas do espaco de B`) são intermitentes quando vários sockets
são abertos em sequência no mesmo processo Node: o socket cai com
`transport close` e o teste reporta `conectado=false`.

Isso foi investigado a fundo e **não decorre da autenticação**: um teste com
socket único é estável, e um A/B com 8 execuções de cada lado deu 8/8 tanto no
código original quanto no código com autenticação. A causa provável é a
interação entre o cliente Node do Socket.IO e o servidor de desenvolvimento do
Next.

Consequência prática ao ler uma falha: `conectado=false` indica queda de
transporte, não falha de segurança. As asserções de autenticação e autorização
(`T1`, `T2`, `T3`, `T6`) nunca falharam. Se elas falharem, é regressão real.
