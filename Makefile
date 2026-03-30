COMPOSE=docker compose

.PHONY: up down build logs test

up:
	$(COMPOSE) up --build

down:
	$(COMPOSE) down -v

build:
	$(COMPOSE) build

logs:
	$(COMPOSE) logs -f

test:
	@echo "Run Spring tests with Maven and frontend checks with npm when toolchains are available."
