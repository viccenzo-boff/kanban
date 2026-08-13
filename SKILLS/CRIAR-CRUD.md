# Skill: Criar CRUD

## Objetivo

Criar ou expandir CRUDs seguindo o padrão atual do projeto.

Use esta skill quando o usuário pedir para criar funcionalidades de cadastro, listagem, edição, exclusão ou leitura de uma entidade.

A skill pode ser usada para CRUD completo ou parcial.

Exemplos:
- criar CRUD de espaços
- criar só listagem de usuários
- criar create/update de tipos de tarefa
- criar tela readonly de perfil
- criar delete de arquivos
- criar formulário de edição de status

## Leitura inicial obrigatória

Antes de alterar arquivos, leia:

- `AGENTS.md`
- migrations em `src/database/migrations`
- páginas relacionadas em `src/pages`
- APIs relacionadas em `src/pages/api`
- componentes existentes similares
- utilitários de API/autenticação
- componentes compartilhados, especialmente `src/components/common/Loading.jsx`

## Regra de fonte da verdade

A migration é a fonte da verdade para campos, tipos e obrigatoriedade da entidade.

Antes de criar qualquer CRUD, localize a migration da tabela correspondente.

Se não existir migration para a entidade, pare e informe que não é seguro criar o CRUD sem migration.

Não invente campos.

Não invente relacionamentos.

Não invente obrigatoriedade.

Use apenas o que estiver definido nas migrations e confirmado pelo código existente.

## Entrada esperada do usuário

O usuário deve informar, direta ou indiretamente:

- entidade
- operações desejadas
- tipo de acesso da rota
- se deve aparecer na Navbar
- se deve criar APIs
- se deve criar tela
- regras específicas adicionais

Operações possíveis:
- create
- read
- update
- delete

O usuário pode usar português ou inglês.
Exemplos:
- criar
- listar
- editar
- deletar
- create
- read
- update
- delete

## Se faltar informação

Se faltar uma informação essencial, pergunte antes de implementar.

Informações essenciais:
- entidade
- operações desejadas
- tipo de acesso da tela: `public`, `guest` ou `private`

Não pergunte sobre detalhes que podem ser inferidos com segurança pelo padrão do projeto.

## Nomenclatura de APIs

Use o padrão:

```txt
/api/[entidade]/criar[Entidade]
/api/[entidade]/listar[Entidade]
/api/[entidade]/editar[Entidade]
/api/[entidade]/deletar[Entidade]
````

Exemplo para entidade `espacos` / `Espaco`:

```txt
/api/espacos/criarEspaco
/api/espacos/listarEspacos
/api/espacos/editarEspaco
/api/espacos/deletarEspaco
```

Use o padrão de plural/singular já existente no projeto quando houver.

## APIs por operação

### create

Criar rota:

```txt
src/pages/api/[entidade]/criar[Entidade].js
```

A API deve:

* aceitar somente método adequado ao padrão atual, preferencialmente `POST`
* validar usuário autenticado se for rota privada
* validar campos obrigatórios conforme migration
* rejeitar campos extras quando o padrão do projeto fizer isso
* inserir no banco com prepared statement
* retornar resposta no padrão atual do projeto
* usar `defaultResponse`, se esse for o padrão existente
* usar `authMiddleware`, se esse for o padrão existente

### read

Criar rota:

```txt
src/pages/api/[entidade]/listar[Entidade].js
```

A API deve:

* aceitar somente método adequado ao padrão atual, preferencialmente `GET`
* validar usuário autenticado se for rota privada
* filtrar por usuário autenticado quando a tabela ou relacionamento exigir
* suportar paginação se o padrão da entidade/tela exigir
* retornar lista no padrão atual do projeto
* retornar estado vazio de forma segura

### update

Criar rota:

```txt
src/pages/api/[entidade]/editar[Entidade].js
```

A API deve:

* aceitar somente método adequado ao padrão atual, preferencialmente `PUT`
* validar usuário autenticado se for rota privada
* exigir `id`
* validar campos obrigatórios conforme migration
* validar se o registro existe
* validar se o usuário tem permissão sobre o registro
* atualizar apenas campos permitidos
* não permitir alteração indevida de campos como `id`, `id_usuario`, `created_at`, quando aplicável
* retornar resposta no padrão atual do projeto

### delete

Criar rota:

```txt
src/pages/api/[entidade]/deletar[Entidade].js
```

A API deve:

* aceitar somente método adequado ao padrão atual, preferencialmente `DELETE`
* validar usuário autenticado se for rota privada
* exigir `id`
* validar se o registro existe
* validar se o usuário tem permissão sobre o registro
* validar dependências antes de deletar, se houver
* deletar com prepared statement
* retornar resposta no padrão atual do projeto

## Front-end

Quando criar tela principal da entidade, use preferencialmente:

```txt
src/pages/[entidade]/index.js
```

Quando houver formulário de create/update, crie componente separado:

```txt
src/pages/[entidade]/[Entidade]Formulario.jsx
```

Exemplo:

```txt
src/pages/espacos/EspacoFormulario.jsx
```

## Formulários

Todo formulário criado por esta skill deve usar:

* `react-hook-form`

O componente de formulário deve receber:

```js
mode
initialValues
```

`mode` deve aceitar:

```txt
create
edit
```

O formulário deve possuir:

```js
const defaultValues = {
  // campos conforme migration
};
```

Regras para `defaultValues`:

* campos numéricos: `null`
* campos texto: `''`
* booleanos: `false`, salvo se a migration indicar outro default
* datas: `null` ou `''`, conforme padrão existente
* não incluir campos que o usuário não deve editar, salvo se forem necessários internamente

O formulário deve sincronizar valores iniciais com:

```js
useEffect(() => {
  reset(initialValues ? initialValues : defaultValues);
}, [initialValues, reset]);
```

O formulário deve:

* validar campos obrigatórios conforme migration
* respeitar tamanho máximo de campos `VARCHAR`
* usar componentes MUI
* usar `toast` para sucesso e erro
* usar `authAxios` em rotas privadas
* usar `axios` normal em rotas públicas ou guest
* possuir estado de submit/loading quando necessário
* desabilitar botão durante submit
* não duplicar lógica desnecessária

## Loading

Telas criadas ou alteradas por esta skill devem usar:

```js
const [isLoading, setIsLoading] = useState(false);
```

Quando houver carregamento principal da página, usar o componente:

```js
import Loading from '@/components/common/Loading';
```

Deve renderizar `Loading` conforme o padrão atual do projeto.

## Toast

Use `toast` para feedback ao usuário.

Exemplos:

* sucesso ao criar
* sucesso ao editar
* sucesso ao deletar
* erro ao carregar
* erro ao salvar
* erro ao deletar
* validações relevantes

Não substitua `toast` por `Alert`, salvo se o projeto já usar `Alert` naquele contexto específico.

## Listagem

Para listagens, use Material UI.

Pode usar:

* `Table`
* `DataGrid`
* `Card`
* `Stack`
* `Grid`
* componentes próprios existentes

Escolha conforme o padrão mais próximo já existente no projeto.

A listagem deve ter:

* loading
* erro tratado com toast
* estado vazio
* ações conforme operações solicitadas
* atualização da lista após create/update/delete quando aplicável

## Delete

Quando implementar delete no front-end:

* usar confirmação antes de deletar
* preferir `Dialog` do Material UI
* usar `toast` para sucesso/erro
* atualizar listagem após exclusão
* não usar `window.confirm`, salvo se o usuário pedir simplicidade

## Navbar

Se for uma tela principal da entidade, pode adicionar item na Navbar automaticamente.

Ao adicionar item:

* usar label em português brasileiro
* escolher ícone MUI adequado
* respeitar controle de acesso existente
* preservar modo collapsed
* preservar tema claro/escuro
* não quebrar itens existentes

## Controle de acesso

Toda nova tela deve ser configurada como:

* `public`
* `guest`
* `private`

Conforme especificado pelo usuário.

Regras:

* rota `private`: usar `authAxios` no front e autenticação nas APIs
* rota `public`: usar `axios` normal
* rota `guest`: usar `axios` normal

Não trate uma rota como pública se o usuário informou que é privada.

Não trate uma rota como privada se o usuário informou que é pública ou guest.

## Banco de dados

Use a migration como base.

Ao criar SQL:

* usar prepared statements
* não concatenar valores diretamente na query
* preferir consultas menores, simples e legíveis, combinadas no JavaScript, em vez de uma consulta grande com muitos `OR`, `EXISTS`, `UNION`, CTEs ou regras condicionais difíceis de ler
* usar `Promise.all` para executar em paralelo consultas independentes, como validação de registro, validação de vínculo/permissão e busca de listas relacionadas
* montar ou combinar resultados no JavaScript quando isso deixar a regra mais clara e evitar SQL excessivamente complexo, preservando validação, autorização e performance
* validar ownership/permissão quando existir relação com usuário
* respeitar `NOT NULL`
* respeitar `VARCHAR(n)`
* respeitar foreign keys
* respeitar defaults definidos no banco

Não criar migration se o usuário não pediu.

Mas, se não existir migration da entidade, pare e informe o problema.

## Segurança

Não confie em dados vindos do front-end.

APIs devem:

* validar autenticação
* validar autorização
* validar campos obrigatórios
* validar ownership
* ignorar ou rejeitar campos proibidos
* não permitir alteração de `id_usuario` pelo usuário final, salvo regra explícita

## Documentação

Depois de criar ou alterar o CRUD, sugira usar a skill:

```txt
ATUALIZAR-DOCUMENTACAO.md
```

Não execute essa skill automaticamente.

Apenas mencione que a documentação pode precisar ser atualizada.

## Critérios de aceite

Ao finalizar:

* migrations da entidade foram lidas
* CRUD foi criado apenas para operações solicitadas
* APIs seguem o padrão `/api/[entidade]/[acao][Entidade]`
* formulários usam `react-hook-form`
* formulários recebem `mode` e `initialValues`
* formulários usam `reset(initialValues ? initialValues : defaultValues)`
* telas usam `isLoading`
* telas usam `src/components/common/Loading.jsx`
* feedback usa `toast`
* delete usa confirmação com Dialog, se implementado
* rotas privadas usam `authAxios`
* rotas públicas/guest usam `axios`
* Navbar foi atualizada quando aplicável
* nenhuma operação não solicitada foi criada
* nenhum campo foi inventado
* o projeto continua sem erro de lint/build

## Resposta final esperada

Ao final, informe:

* migrations usadas como fonte
* arquivos criados
* arquivos alterados
* operações implementadas
* tipo de acesso configurado
* APIs criadas
* como testar manualmente
* sugestão para atualizar documentação usando `ATUALIZAR-DOCUMENTACAO.md`
