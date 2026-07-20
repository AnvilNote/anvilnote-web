# AnvilNote web Makefile
# A thin wrapper around pnpm so common workflows share one entry point.
# All comments are written in plain English without parentheses.

# Use pnpm as the package manager for every target.
PM := pnpm

# Treat these targets as commands rather than files on disk.
.PHONY: help install dev dev-web dev-desktop build build-web build-desktop start start-web start-desktop lint typecheck test check format clean reset

# Show this help message when make runs without a target.
.DEFAULT_GOAL := help

help: ## List all available targets with a short description
	@echo "AnvilNote web - available make targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "} {printf "  \033[1m%-12s\033[0m %s\n", $$1, $$2}'

install: ## Install all project dependencies from the lockfile
	$(PM) install


# Desktop is the default local workflow. Use the explicit public-web targets
# when working on the marketing, legal, or download site.
dev: ## Start the full desktop-mode Next.js development server
	$(PM) dev

dev-web: ## Start the public website development server
	$(PM) dev:web

dev-desktop: ## Start the full desktop-mode development server
	$(PM) dev:desktop

build: ## Create an optimized desktop-mode production build
	$(PM) build

build-web: ## Create a public website production build
	$(PM) build:web

build-desktop: ## Create a full desktop-mode production build
	$(PM) build:desktop

start: ## Serve the desktop-mode standalone production build
	$(PM) start

start-web: ## Serve the public website standalone production build
	$(PM) start:web

start-desktop: ## Serve the desktop-mode standalone production build
	$(PM) start:desktop

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
