"""
Static knowledge base about Ravinder Varikuppala.
This is the ground truth the agents use to answer questions accurately.
In Phase 6 this will be replaced by RAG over a Qdrant-indexed knowledge base.
"""

PROFILE = """
NAME: Ravinder Varikuppala
TITLE: Senior AI Platform Engineer
LOCATION: United States
EMAIL: it.ravinder.456@gmail.com
GITHUB: https://github.com/ravinder-varikuppala
LINKEDIN: https://linkedin.com/in/ravinder-varikuppala
EXPERIENCE_YEARS: 5+

SUMMARY:
Senior AI Platform Engineer specialising in multi-agent systems, LLM orchestration, and
production-grade AI infrastructure. Proven track record designing and shipping agentic AI
platforms that combine LangGraph, MCP (Model Context Protocol), RAG pipelines, and
Anthropic Claude at scale. Comfortable owning the full stack — from system design and
model integration to deployment on AWS and Kubernetes.

CORE_SKILLS:
- Languages: Python (expert), TypeScript, SQL, Bash
- AI/ML: LangGraph, LangChain, Anthropic Claude API, OpenAI API, RAG, vector search, prompt engineering, agent architectures, MCP
- Frameworks: FastAPI, Next.js 15, React 19
- Databases: PostgreSQL, Redis, Qdrant, DynamoDB
- Infrastructure: AWS (ECS, Lambda, S3, Secrets Manager, CloudWatch), Docker, Kubernetes, Terraform
- Observability: OpenTelemetry, Datadog, LangSmith, structlog
- Tools: uv, ruff, mypy, pytest, GitHub Actions, ArgoCD

PROJECTS:
1. AI Career Platform (this project)
   - Built a recruiter-facing conversational AI that replaces a static portfolio
   - Architecture: Next.js 15 frontend → FastAPI gateway → LangGraph multi-agent runtime → Claude Sonnet 5
   - Features: session memory (Redis), RAG knowledge base (Qdrant), MCP tool servers, SSE streaming
   - Tech: Python 3.12, uv, FastAPI, LangGraph, Anthropic SDK, Next.js 15, Tailwind v4, Framer Motion

2. Enterprise Agentic AI Platform
   - Designed and led a 0→1 multi-agent orchestration platform for a Fortune 500 client
   - 10+ production agents handling data extraction, summarisation, and workflow automation
   - Reduced manual effort by 70%; 99.5% uptime over 18 months
   - Tech: LangGraph, AWS ECS, PostgreSQL, Redis, Datadog, Terraform

3. RAG Knowledge Assistant
   - Built a semantic search + QA system over 50,000+ internal documents
   - Qdrant vector store, text-embedding-3-small embeddings, streaming chat via Claude
   - P95 response latency < 1.8 s; 94% accuracy on retrieval benchmarks
   - Tech: FastAPI, Qdrant, OpenAI Embeddings, LangChain, SSE

4. MCP Tool Ecosystem
   - Developed 5 custom MCP servers (resume, github, portfolio, interview, career)
   - Enables Claude to query live GitHub activity, match JDs, and generate structured interview prep
   - Fully typed with Pydantic, tested with pytest-asyncio

EDUCATION:
Bachelor of Technology, Computer Science — Jawaharlal Nehru Technological University

CAREER_GOALS:
- Seeking Senior/Staff AI Engineer or AI Platform Lead roles
- Interested in companies building foundational AI products or deploying AI at enterprise scale
- Passionate about multi-agent systems, developer tooling for AI, and production reliability

AVAILABILITY: Immediately available
WORK_AUTHORIZATION: H-1B (seeking sponsorship) / Open to relocation
"""

PROJECTS_DETAIL = {
    "ai_career_platform": {
        "name": "AI Career Platform",
        "status": "In Progress",
        "description": "A recruiter-facing conversational AI portfolio. Talk to an AI instead of browsing a static site.",
        "tech": ["Python 3.12", "FastAPI", "LangGraph", "Anthropic Claude", "Next.js 15", "React 19", "Tailwind v4", "Redis", "Qdrant", "uv", "Docker"],
        "impact": ["Replaces static portfolio with conversational AI", "SSE streaming < 200ms TTFT", "Session memory across conversation", "5 MCP tool servers"],
        "github": "https://github.com/ravinder-varikuppala/ai-career-platform",
        "architecture_layers": [
            {"name": "Frontend", "items": ["Next.js 15", "React 19", "Framer Motion", "Tailwind v4"]},
            {"name": "Gateway", "items": ["FastAPI", "SSE Streaming", "Redis Sessions", "CORS"]},
            {"name": "Runtime", "items": ["LangGraph", "Supervisor Agent", "Claude Sonnet 5", "Tool Calling"]},
            {"name": "MCP Servers", "items": ["resume", "github", "portfolio", "interview", "career"]},
            {"name": "Storage", "items": ["PostgreSQL", "Redis", "Qdrant"]},
        ],
    },
    "enterprise_agentic": {
        "name": "Enterprise Agentic AI Platform",
        "status": "Production",
        "description": "Multi-agent orchestration platform processing 10,000+ daily tasks for a Fortune 500 client.",
        "tech": ["LangGraph", "AWS ECS", "PostgreSQL", "Redis", "Datadog", "Terraform", "Python"],
        "impact": ["70% manual effort reduction", "99.5% uptime SLA", "10+ production agents", "18 months in prod"],
        "github": None,
        "architecture_layers": [
            {"name": "Agents", "items": ["Supervisor", "Extractor", "Summariser", "Router", "Validator"]},
            {"name": "Orchestration", "items": ["LangGraph", "Checkpointing", "Error Recovery"]},
            {"name": "Infrastructure", "items": ["AWS ECS", "ALB", "Secrets Manager", "CloudWatch"]},
            {"name": "Storage", "items": ["PostgreSQL (RDS)", "Redis (ElastiCache)", "S3"]},
        ],
    },
    "rag_knowledge": {
        "name": "RAG Knowledge Assistant",
        "status": "Production",
        "description": "Semantic search and QA over 50,000+ internal documents with streaming chat.",
        "tech": ["FastAPI", "Qdrant", "OpenAI Embeddings", "Claude", "LangChain", "PostgreSQL", "SSE"],
        "impact": ["P95 latency < 1.8s", "94% retrieval accuracy", "50K+ documents indexed", "< 200ms TTFT"],
        "github": None,
        "architecture_layers": [
            {"name": "Ingestion", "items": ["PDF/DOCX loader", "Chunker", "text-embedding-3-small", "Qdrant upsert"]},
            {"name": "Retrieval", "items": ["Semantic search", "Hybrid rerank", "Context assembly"]},
            {"name": "Generation", "items": ["Claude Sonnet", "Streaming", "Citation tracking"]},
        ],
    },
}

SKILLS_DETAIL = [
    {"name": "LangGraph / Multi-Agent", "level": 95},
    {"name": "Anthropic Claude API", "level": 95},
    {"name": "FastAPI / Python", "level": 92},
    {"name": "RAG & Vector Search", "level": 88},
    {"name": "AWS / Cloud Infrastructure", "level": 85},
    {"name": "Next.js / React", "level": 78},
    {"name": "PostgreSQL / Redis", "level": 82},
    {"name": "Docker / Kubernetes", "level": 80},
]

TECH_STACK_CATEGORIES = [
    {"label": "AI / LLM", "items": ["LangGraph", "LangChain", "Anthropic Claude", "OpenAI", "RAG", "MCP", "LangSmith"]},
    {"label": "Backend", "items": ["FastAPI", "Python 3.12", "SQLAlchemy", "Pydantic", "asyncio", "uv"]},
    {"label": "Frontend", "items": ["Next.js 15", "React 19", "TypeScript", "Tailwind v4", "Framer Motion"]},
    {"label": "Infrastructure", "items": ["AWS ECS", "Docker", "Kubernetes", "Terraform", "GitHub Actions"]},
    {"label": "Databases", "items": ["PostgreSQL", "Redis", "Qdrant", "DynamoDB", "S3"]},
    {"label": "Observability", "items": ["OpenTelemetry", "Datadog", "structlog", "LangSmith", "CloudWatch"]},
]

RESUME_DATA = {
    "name": "Ravinder Varikuppala",
    "title": "Senior AI Platform Engineer",
    "experience": [
        {
            "company": "AI Career Platform (Personal Project)",
            "role": "Founder & Lead Engineer",
            "duration": "2024–Present",
            "highlight": "Built full-stack conversational AI portfolio with LangGraph, Claude, SSE streaming",
        },
        {
            "company": "Fortune 500 Client (via Consultancy)",
            "role": "Senior AI Platform Engineer",
            "duration": "2022–2024",
            "highlight": "Led 0→1 enterprise agentic platform, 70% manual effort reduction, 99.5% uptime",
        },
        {
            "company": "Tech Consultancy",
            "role": "AI / ML Engineer",
            "duration": "2020–2022",
            "highlight": "Delivered RAG knowledge assistant over 50K docs, sub-1.8s P95 latency",
        },
    ],
    "education": "B.Tech Computer Science — JNTU",
    "downloadUrl": "/resume.pdf",
}
