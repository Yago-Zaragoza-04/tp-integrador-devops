# Atajos para el ciclo local. Todos usan las mismas herramientas que el pipeline.
.PHONY: install lint format test test-e2e build up down logs load smoke test-docker

install:
	npm ci

lint:
	npm run lint

format:
	npm run format

test:
	npm run test:cov

test-e2e:
	npm run test:e2e

build:
	npm run build
	docker compose build

up:
	docker compose up --build -d

down:
	docker compose down -v

logs:
	docker compose logs -f api

load:
	docker compose --profile load up loadgen

smoke:
	node scripts/smoke-test.mjs http://localhost:3000

test-docker:
	docker compose --profile test run --rm --build test
