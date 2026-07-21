# AnvilNote web Makefile
# A thin wrapper around pnpm so common workflows share one entry point.
# All comments are written in plain English without parentheses.

# Use pnpm as the package manager for every target.
PM := pnpm

# Treat these targets as commands rather than files on disk.
.PHONY: help install dev build start lint typecheck test check format clean reset

# Show this help message when make runs without a target.
.DEFAULT_GOAL := help

help: ## List all available targets with a short description
	@echo "AnvilNote web - available make targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "} {printf "  \033[1m%-12s\033[0m %s\n", $$1, $$2}'

install: ## Install all project dependencies from the lockfile
	$(PM) install

dev: ## Start the Next.js development server with hot reload
	$(PM) dev

build: ## Create an optimized production build
	$(PM) build

start: ## Serve the production build on the default port
	$(PM) start

lint: ## Run ESLint across the whole project
	$(PM) lint

typecheck: ## Run the TypeScript compiler in no-emit mode
	$(PM) exec tsc --noEmit

test: ## Run Node and component unit tests
	$(PM) test

# Run linting and type checking together as a quick quality gate.
check: lint typecheck ## Run lint and typecheck in sequence

format: ## Format the source tree with Prettier
	$(PM) exec prettier --write .

clean: ## Remove build output and local caches
	rm -rf .next out build coverage *.tsbuildinfo

# Wipe installed dependencies on top of the normal clean step.
reset: clean ## Remove node_modules in addition to build output
	rm -rf node_modules
