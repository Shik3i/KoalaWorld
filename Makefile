.PHONY: all test test-backend test-frontend verify build clean

all: verify

# Run all tests, linting, and type checks.
test: test-backend test-frontend

test-backend:
	cd backend && go vet ./... && go test ./... -count=1

test-frontend:
	cd frontend && npm run typecheck && npm run build

# Alias for test — run before every push.
verify: test

# Build production binaries.
build:
	cd backend && go build -o bin/koalaworld ./cmd/koalaworld
	cd frontend && npm run build

# Remove build artifacts and local databases.
clean:
	rm -rf backend/bin/ backend/web/ frontend/dist/
	find . -name '*.db' -path './backend/data/*' -delete 2>/dev/null; true
	find . -name '*.db-wal' -delete 2>/dev/null; true
	find . -name '*.db-shm' -delete 2>/dev/null; true
