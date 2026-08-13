-- O Postgres nao cria indice automaticamente na coluna que referencia uma FK.
-- Sem eles, toda consulta filtrada por id_espaco varre a tabela inteira, e todo
-- DELETE em espaco/usuario varre cada tabela filha para validar a restricao.
--
-- Os indices abaixo cobrem os filtros que as rotas realmente usam e as colunas
-- referenciadoras das tabelas envolvidas na remocao de um espaco ou usuario.
--
-- CREATE INDEX CONCURRENTLY nao e usado porque o runner (src/database/migrate.js)
-- executa cada migration dentro de uma transacao, e CONCURRENTLY nao pode rodar
-- em transacao.

-- Caminho mais quente do sistema: userBelongsToSpace roda em toda verificacao de
-- autorizacao, incluindo o handshake do socket. Filtra por id_espaco + id_usuario.
CREATE INDEX IF NOT EXISTS idx_espaco_usuario_espaco_usuario ON espaco_usuario (id_espaco, id_usuario);
CREATE INDEX IF NOT EXISTS idx_espaco_usuario_usuario ON espaco_usuario (id_usuario);

-- Listagem do quadro: colunas e tarefas de um espaco, tarefas de uma coluna.
CREATE INDEX IF NOT EXISTS idx_coluna_espaco ON coluna (id_espaco);
CREATE INDEX IF NOT EXISTS idx_tarefa_espaco ON tarefa (id_espaco);
CREATE INDEX IF NOT EXISTS idx_tarefa_coluna ON tarefa (id_coluna);
CREATE INDEX IF NOT EXISTS idx_tarefa_responsavel ON tarefa (id_responsavel);
CREATE INDEX IF NOT EXISTS idx_tarefa_arquivo_tarefa ON tarefa_arquivo (id_tarefa);

-- Espacos de um usuario (listarEspacos) e convites por espaco/usuario.
CREATE INDEX IF NOT EXISTS idx_espaco_usuario_dono ON espaco (id_usuario);
CREATE INDEX IF NOT EXISTS idx_espaco_convite_espaco ON espaco_convite (id_espaco);
CREATE INDEX IF NOT EXISTS idx_espaco_convite_usuario ON espaco_convite (id_usuario);

-- unique_usuario_espaco_permissao e (id_usuario, id_espaco, id_permissao), entao
-- ja atende buscas que comecam por id_usuario. Falta o acesso por espaco e o
-- referenciador de permissao.
CREATE INDEX IF NOT EXISTS idx_espaco_usuario_permissoes_espaco ON espaco_usuario_permissoes (id_espaco);
CREATE INDEX IF NOT EXISTS idx_espaco_usuario_permissoes_permissao ON espaco_usuario_permissoes (id_permissao);

CREATE INDEX IF NOT EXISTS idx_tipo_tarefa_espaco ON tipo_tarefa (id_espaco);

-- Login busca por email a cada tentativa. username ja tem indice pela restricao
-- UNIQUE; email nao tem restricao equivalente, entao o indice e comum.
CREATE INDEX IF NOT EXISTS idx_usuario_email ON usuario (email);
