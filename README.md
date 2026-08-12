# Instalação

## 1. Clonar repositório
``` bash
git clone https://github.com/GuiSmithMhnet/kanban.git
```
---
## 2. Criar rede compartilhada
**OBS:** Ignorar se não for usar `docker`
``` bash
docker network create kanban-shared-services
```
---
## 3. Clonar repositório de arquivos
Segue repositório: https://github.com/GuiSmithMhnet/OperaFR
**Observações:**
 1. Use outra pasta
---
## 4. Criar .env
``` bash
cp .env.example .env
```
**Observações:**
 1. Preencha a chave `OPERA_API_KEY` de acordo com a chave `USER_API_KEY` do repositório de arquivos.
 2. Caso não vá usar docker no repositório de arquivos, altere a chave `OPERA_LINK` no .env
---
## 5. Gerar os segredos no `.env`
Preencha `JWT_SECRET` com um valor aleatório:
``` bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
Se for usar login com Google, gere também o `NEXTAUTH_SECRET`:
``` bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```
**Observações:**
 1. Nunca reutilize um segredo de exemplo: quem conhecer o valor consegue forjar tokens de qualquer usuário.
 2. Defina `NEXTAUTH_URL` e `PRODUCTION_URL` com a URL do seu ambiente (em desenvolvimento, `http://localhost:3000`).
---
## 6. Suba o projeto:
No docker:
``` bash
docker compose up kanban-app -d --build
```
Sem docker:
```
npm install
npm run build
npm start
```
---
## 7. Fim
Acesse pela porta definida no docker-compose.yml do projeto (3001)