## Contexto

<!-- Por que esta mudança existe. Qual problema resolve. -->

## O que mudou

<!-- Resumo objetivo das alterações, por arquivo ou por área. -->

## Como validar

<!-- Passos exatos para reproduzir o comportamento novo ou corrigido. -->

```bash
npm run dev:up
npm run dev:test
```

## Checklist

- [ ] `npm run lint` passa
- [ ] `npm test` passa
- [ ] Mudança de banco veio como migration numerada em `src/database/migrations`
- [ ] Nenhum segredo, `.env` ou arquivo local no diff
- [ ] Escopo único: o PR trata de um tema só
