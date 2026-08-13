# Desenvolvimento
dev-up:
	docker container stop kanban-app || true
	([ -d node_modules ] || npm ci) && docker compose up kanban-app-dev -d
	docker logs -f kanban-app-dev
dev-migrate:
	docker exec -it kanban-app-dev npm run db:migrate

# Produção
build:
	docker build --no-cache -t guismith/kanban-app:latest .
push:
	docker push guismith/kanban-app:latest
up:
	docker container stop kanban-app-dev || true
	docker compose pull
	docker compose up kanban-app -d
	docker logs -f kanban-app
migrate:
	docker exec -it kanban-app npm run db:migrate

# Derrubar containers
down:
	docker compose down

# DB
psql:
	docker exec -it kanban-db psql -U kanban -d kanban
