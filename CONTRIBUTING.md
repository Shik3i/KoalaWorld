# Contributing to KoalaWorld

We love your input! We want to make contributing as easy and transparent as possible.

## Development Process

1. Fork the repo and create your branch from `main`.
2. Make your changes.
3. Run the tests:
   ```bash
   cd backend && go test ./... -v
   cd frontend && npm run typecheck
   ```
4. Ensure the Docker build still works:
   ```bash
   docker build -t koalaworld .
   ```
5. Submit a pull request.

## Code Style

- **Go**: Follow standard `go fmt` conventions. Run `go vet ./...` before committing.
- **TypeScript**: The project uses strict TypeScript. Run `npm run typecheck` before committing.
- **Commits**: Write clear, concise commit messages.

## Pull Request Process

1. Update documentation (docs/) if you add or change features.
2. Add or update tests as needed.
3. Ensure the CI pipeline passes all checks.
4. A maintainer will review your PR.

## Reporting Issues

Report bugs and suggest features via [GitHub Issues](https://github.com/Shik3i/KoalaWorld/issues).

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
