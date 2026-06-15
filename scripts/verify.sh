#!/usr/bin/env bash
#
# KoalaWorld — Pre-push verification script
# Works on macOS, Linux, and Windows (Git Bash / WSL).
#
# Usage:  ./scripts/verify.sh
#         make verify          (equivalent)

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

fail()   { echo -e "${RED}FAIL${NC} $1"; exit 1; }
pass()   { echo -e "${GREEN}PASS${NC} $1"; }
info()   { echo -e "${CYAN}INFO${NC} $1"; }

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

info "KoalaWorld verification — $(date)"
echo ""

# ── Backend ──────────────────────────────────────────────────────────
info "Running Go vet..."
cd "$ROOT/backend"
go vet ./... || fail "go vet"

info "Running Go tests..."
go test ./... -count=1 || fail "go test"

info "Building Go backend..."
go build ./... || fail "go build"
pass "Backend checks passed"
echo ""

# ── Frontend ──────────────────────────────────────────────────────────
info "Installing frontend dependencies..."
cd "$ROOT/frontend"
npm ci --silent 2>/dev/null || npm install --silent 2>/dev/null || fail "npm install"

info "Running TypeScript type check..."
npm run typecheck || fail "typecheck"

info "Building frontend..."
npm run build || fail "frontend build"
pass "Frontend checks passed"
echo ""

# ── Docker (optional) ────────────────────────────────────────────────
if command -v docker &>/dev/null; then
  info "Verifying Docker build..."
  docker build -t koalaworld:verify "$ROOT" &>/dev/null || fail "Docker build"
  pass "Docker build passed"
  echo ""
else
  info "Docker not available — skipping Docker build check"
  echo ""
fi

echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}  All checks passed — ready to push!${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
