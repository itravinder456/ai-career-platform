# 🤖 Ravinder AI Career Platform

> An AI-powered portfolio where recruiters chat with an intelligent
> agent trained on my experience, projects, skills, and GitHub activity.

[![Live](https://img.shields.io/badge/Live-ravinder.dev-blue)](https://ravinder.dev)
[![Tech](https://img.shields.io/badge/Stack-Next.js%20%7C%20FastAPI%20%7C%20LangGraph-green)]()
[![AWS](https://img.shields.io/badge/Deployed-AWS%20ECS-orange)]()

---

## 🎯 What Is This?

Instead of a static portfolio, recruiters can:

- 💬 **Chat** with an AI trained on my entire career history
- 🔍 **Ask** about any project, skill, or experience
- 📋 **Paste a JD** and get instant match score
- 🎤 **Generate** interview questions based on my resume
- 📊 **Get** architecture explanations with diagrams

---

## 🏗️ Architecture

```
Next.js Frontend → FastAPI → LangGraph Agents → MCP Tools → RAG (Qdrant)
```

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for full details,
[docs/CODEBASE.md](./docs/CODEBASE.md) for a request-by-request walkthrough, or
[docs/services/](./docs/services/README.md) for a tradeoffs-and-gaps deep dive per service.

---

## 🛠️ Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14, TailwindCSS, Framer Motion |
| Backend | FastAPI, Python 3.11 |
| Agents | LangGraph, Multi-agent orchestration |
| Tools | MCP Protocol (5 servers) |
| Vector DB | Qdrant |
| Cache | Redis |
| Database | PostgreSQL |
| LLM | GPT-4 / Claude |
| Deploy | Vercel + AWS ECS |

---

## 🚀 Quick Start

```bash
git clone https://github.com/ravinder/ai-portfolio
cd ai-portfolio
docker-compose up -d
```

See [LOCAL_SETUP.md](./LOCAL_SETUP.md) for full setup guide.

---

## 📁 Structure

```
├── frontend/        # Next.js 14 app
├── backend/         # FastAPI + LangGraph
├── knowledge-base/  # RAG source documents
├── infrastructure/  # Docker + AWS
└── docs/           # Architecture docs
```

---

## 👤 About

Built by **Varikuppala Ravinder** — Senior AI Platform Engineer
specializing in RAG pipelines, LangGraph agents, and MCP tooling.

- 🌐 [ravinder.dev](https://ravinder.dev)
- 💼 [LinkedIn](https://linkedin.com/in/ravinder-varikuppala)
- 🐙 [GitHub](https://github.com/ravinder-varikuppala)
