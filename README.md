## 🚀 KoalaWorld Local Development Setup

This project skeleton consists of two main components: a Go backend and a Three.js frontend.

### Backend (Go)
The Go server runs on `http://localhost:8080`.
To build and run the backend:
`cd backend/cmd/koalaworld && go run main.go`

### Frontend (Vite + Three.js)
The frontend must be built first to serve assets.
To install dependencies and start the dev server:
`cd frontend && npm install && npm run dev` (assuming a standard Vite setup script, which I should verify/add to package.json later if needed for running checks).

---