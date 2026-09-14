.PHONY: help install build test lint api-test workspace portal website-us website-br api prod-status

help:
	@echo "targets: install build test lint api-test | workspace portal website-us website-br api | prod-status"

install:
	npm ci --prefix apps/workspace
	npm ci --prefix apps/portal
	npm ci --prefix apps/website-us
	npm ci --prefix apps/website-br
	python3 -m venv services/api/.venv && services/api/.venv/bin/pip install -r services/api/requirements.txt

build: workspace portal website-us website-br api

workspace:
	npm run build --prefix apps/workspace

portal:
	npm run build --prefix apps/portal

website-us:
	npm run build --prefix apps/website-us

website-br:
	npm run build --prefix apps/website-br

api:
	cd services/api && alembic heads && python -m compileall -q app alembic

test:
	npm test --prefix apps/portal
	npm test --prefix apps/website-us
	cd services/api && DATABASE_URL="sqlite+aiosqlite:///:memory:" python -m pytest tests/unit -q

lint:
	npm run lint --prefix apps/workspace
	npm run lint --prefix apps/portal
	npm run lint --prefix apps/website-us
	npm run lint --prefix apps/website-br
	cd services/api && ruff check app tests && black --check app tests

api-test:
	cd services/api && DATABASE_URL="sqlite+aiosqlite:///:memory:" python -m pytest tests/unit -q

prod-status:
	docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "innexar|workspace|portal|website|mail|traefik" | head -n 20
