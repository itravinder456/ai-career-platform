# 🛠️ Local Development Setup

## Prerequisites

```bash
node >= 18.0.0
python >= 3.11
docker + docker-compose
git
```

---

## 1. Clone & Setup

```bash
git clone https://github.com/ravinder/ai-portfolio.git
cd ai-portfolio
```

---

## 2. Environment Variables

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Backend (.env)
```env
# LLM
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Databases
QDRANT_URL=http://localhost:6333
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://postgres:password@localhost:5432/portfolio

# Auth
ADMIN_SECRET_KEY=your-secret-key
JWT_SECRET=your-jwt-secret

# Observability
LANGCHAIN_API_KEY=ls-...
LANGCHAIN_PROJECT=ravinder-portfolio
LANGCHAIN_TRACING_V2=true

# GitHub
GITHUB_TOKEN=ghp_...
GITHUB_USERNAME=ravinder-varikuppala
```

---

## 3. Start with Docker

```bash
# Start all services
docker-compose up -d

# Check services running
docker-compose ps

# View logs
docker-compose logs -f backend
```

---

## 4. Frontend Setup

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

---

## 5. Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
# → http://localhost:8000
```

---

## 6. Ingest Knowledge Base

```bash
cd backend
python -m ingestion.pipeline --source ../knowledge-base/
# This embeds all docs into Qdrant
```

---

## 7. Verify Setup

```bash
# Check health
curl http://localhost:8000/health

# Test chat
curl -X POST http://localhost:8000/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "Tell me about Ravinder", "session_id": "test"}'
```

---

## Services Running

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:3000 | Next.js app |
| Backend | http://localhost:8000 | FastAPI |
| Qdrant UI | http://localhost:6333/dashboard | Vector DB |
| API Docs | http://localhost:8000/docs | Swagger |
