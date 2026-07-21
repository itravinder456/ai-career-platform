"""add projects experiences skills documents

Revision ID: 98c797969bcf
Revises: 39abf09e55fe
Create Date: 2026-07-21 00:00:00.000000

Reintroduces projects/experiences/skills as the SOLE source of truth this
time (previously dropped in 39abf09e55fe because they duplicated prose that
lived in data/projects/*.md and drifted out of sync). data/projects/*.md is
retired as part of this change (see services/ingestion's loader rewrite) —
its content is migrated into the seed rows below, verbatim from the source
files. Experience/skills seed rows are transcribed from the real resume PDF
(services/ingestion/app/readers/pdf.py::read_pdf_file, run once here at
migration-authoring time — not a runtime dependency).

Also adds a generic `documents` table for blogs/certificates/resume text —
see docs/ARCHITECTURE.md's Content model section.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '98c797969bcf'
down_revision: Union[str, Sequence[str], None] = '39abf09e55fe'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'projects',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('slug', sa.String(length=200), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('summary', sa.String(length=500), nullable=False),
        sa.Column('description', sa.String(length=4000), nullable=True),
        sa.Column('tech_stack', postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column('impact', postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column('repo_url', sa.String(length=500), nullable=True),
        sa.Column('demo_url', sa.String(length=500), nullable=True),
        sa.Column('image_url', sa.String(length=500), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('featured', sa.Boolean(), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug'),
    )
    op.create_table(
        'experiences',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('company', sa.String(length=200), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('location', sa.String(length=200), nullable=True),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('summary', sa.String(length=2000), nullable=True),
        sa.Column('achievements', postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column('tech_stack', postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column('display_order', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_table(
        'skills',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('category', sa.String(length=50), nullable=False),
        sa.Column('proficiency', sa.Integer(), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_table(
        'documents',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('doc_type', sa.String(length=50), nullable=False),
        sa.Column('title', sa.String(length=300), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('asset_url', sa.String(length=500), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    # ── Seed: projects, migrated verbatim from data/projects/*.md ──────────────
    op.execute(
        """
        INSERT INTO projects
            (slug, name, summary, description, tech_stack, impact, repo_url, demo_url,
             image_url, status, featured, start_date, end_date, display_order)
        VALUES
        (
            'elsa-ai-assistant',
            'Elsa AI Assistant — Enterprise AI Platform',
            'Flagship enterprise AI platform built at EPAM Systems (2024-present): a LangGraph planner-executor multi-agent core combining RAG, MCP tooling, and multi-agent orchestration into a single production system.',
            'Built around a LangGraph planner-executor multi-agent core: a supervisor agent coordinates specialized sub-agents for RAG retrieval, Jira automation, analytics, and summarization, each reporting back to the supervisor which composes the final response. Around that core sits a real-time streaming Next.js frontend rendering agent responses via SSE, an API gateway and MCP layer giving agents autonomous access to internal tools (creating Jira tickets, triggering triage workflows, invoking internal APIs without human intervention), a RAG retrieval layer over ChromaDB indexing millions of internal documents, Kafka-based async event ingestion so document updates and agent activity feed the system continuously, session-aware multi-turn conversation, an audit dashboard, and role-based access control. Production-grade guardrails, retry logic, and fallback strategies were built in specifically to reduce hallucination-related failures once the system was live and handling real user traffic.',
            ARRAY['Python','FastAPI','LangGraph','Node.js','Next.js','ChromaDB','Kafka','AWS ECS','Docker'],
            ARRAY['35% reduction in Jira ticket creation time','40% improvement in query resolution accuracy','Sub-2-second RAG response latency at enterprise scale','Contributed to a broader 40% reduction in manual workflows across the platform','Contributed to EPAM''s Ace of Delivery Award and Client Hero Award'],
            NULL, NULL, NULL,
            'Production', true, '2024-01-01', NULL, 0
        ),
        (
            'ai-web-agent',
            'AI Web Agent for Intelligent Search & Data Extraction',
            'Autonomous web agent for multi-source search and data synthesis, combining LLM-based planning with Scrapy-powered data pipelines to produce cited, structured responses instead of raw scraped text.',
            'The agent uses LLM-based decision workflows to plan and direct its own search strategy across multiple sources, combined with Scrapy-powered data pipelines to extract and structure the results.',
            ARRAY['Python','LLM APIs','FastAPI','Scrapy','Next.js'],
            ARRAY[]::varchar[],
            NULL, NULL, NULL,
            'Personal Project', true, NULL, NULL, 1
        ),
        (
            'enterprise-platforms',
            'Healthcare & Enterprise Platforms',
            'A set of full-stack systems combining real-time frontend dashboards with backend REST APIs and dedicated data-processing microservices tailored to each domain — fleet tracking, EMR, location intelligence, and package tracking.',
            'Fleet Manager: an IoT monitoring platform for fleet and vehicle tracking. Ayurway: an EMR (Electronic Medical Records) system for healthcare providers. iDestination: a location-intelligence platform. Notifii: an enterprise package tracking system.',
            ARRAY[]::varchar[],
            ARRAY[]::varchar[],
            NULL, NULL, NULL,
            'Production', false, NULL, NULL, 2
        )
        """
    )

    # ── Seed: experiences, transcribed from the real resume (dates are
    # year-only in the source, approximated to Jan 1 / Dec 31) ─────────────────
    op.execute(
        """
        INSERT INTO experiences
            (company, title, location, start_date, end_date, summary, achievements, tech_stack, display_order)
        VALUES
        (
            'EPAM Systems', 'Senior Software Engineer', NULL, '2024-01-01', NULL, NULL,
            ARRAY[
                'Designed end-to-end system architecture for enterprise AI platforms - defining service boundaries, agent state management, tool routing patterns, and cloud infrastructure across the full stack',
                'Architected LangGraph planner-executor multi-agent systems with a supervisor coordinating specialised sub-agents for retrieval, Jira automation, analytics, and summarisation',
                'Built MCP tool servers enabling agents to autonomously create Jira tickets, trigger triage workflows, and invoke internal APIs without human intervention',
                'Designed RAG pipelines over millions of documents - improving retrieval accuracy by 30-40% and cutting response latency through optimised chunking, metadata enrichment, and vector indexing strategies',
                'Built real-time agent streaming interfaces, analytics dashboards, and audit trail views with seamless backend integration',
                'Led development of Elsa AI Assistant - flagship enterprise AI platform combining RAG, MCP tooling, and multi-agent orchestration',
                'Implemented production-grade guardrails, retry logic, and fallback strategies reducing hallucination-related failures in live environments',
                'Established AI platform engineering standards, conducted architecture reviews, and designed secure CI/CD pipelines on AWS'
            ],
            ARRAY['Python','FastAPI','LangGraph','Node.js','Next.js','ChromaDB','Kafka','AWS','Docker'],
            0
        ),
        (
            'LTIMindtree', 'Specialist - Software Engineering', NULL, '2022-01-01', '2023-12-31', NULL,
            ARRAY[
                'Architected data-intensive microservices with clear service boundaries, API contracts, and data flow patterns serving enterprise clients at scale',
                'Built full-stack features across frontend and backend layers - data transformation pipelines improved throughput by 20-30% and reduced end-to-end latency for downstream consumers',
                'Led system design reviews and drove production deployments across multiple client engagements'
            ],
            ARRAY[]::varchar[],
            1
        ),
        (
            'DevRabbit IT Solutions', 'Senior Developer', NULL, '2019-01-01', '2021-12-31', NULL,
            ARRAY[
                'Delivered full-stack applications end-to-end - owning frontend, backend, and data layer across the complete delivery lifecycle for enterprise clients',
                'Designed RESTful APIs and reusable component libraries reducing codebase complexity and cutting feature delivery time by ~20%',
                'Introduced automation scripts for build tooling and data processing, establishing a clean polyglot architecture pattern'
            ],
            ARRAY[]::varchar[],
            2
        )
        """
    )

    # ── Seed: skills, transcribed from the resume's Technical Skills section ──
    op.execute(
        """
        INSERT INTO skills (name, category, proficiency, display_order) VALUES
        ('RAG', 'AI / LLM', NULL, 0),
        ('GPT-4/Claude integration', 'AI / LLM', NULL, 1),
        ('LangGraph multi-agent orchestration', 'AI / LLM', NULL, 2),
        ('MCP Servers', 'AI / LLM', NULL, 3),
        ('Tool & Function Calling', 'AI / LLM', NULL, 4),
        ('Vector Search', 'AI / LLM', NULL, 5),
        ('Embeddings', 'AI / LLM', NULL, 6),
        ('Prompt Engineering', 'AI / LLM', NULL, 7),
        ('Guardrails & Fallback Strategies', 'AI / LLM', NULL, 8),
        ('Distributed Systems', 'Architecture', NULL, 9),
        ('Microservices', 'Architecture', NULL, 10),
        ('Event-Driven Architecture', 'Architecture', NULL, 11),
        ('API Gateway Patterns', 'Architecture', NULL, 12),
        ('Planner-Executor Agent Design', 'Architecture', NULL, 13),
        ('BFF Pattern', 'Architecture', NULL, 14),
        ('System Design & Review', 'Architecture', NULL, 15),
        ('FastAPI (Python)', 'Backend', NULL, 16),
        ('Node.js', 'Backend', NULL, 17),
        ('Express.js', 'Backend', NULL, 18),
        ('REST & WebSocket APIs', 'Backend', NULL, 19),
        ('React.js', 'Frontend', NULL, 20),
        ('Next.js (SSR/SSG/ISR)', 'Frontend', NULL, 21),
        ('TypeScript', 'Frontend', NULL, 22),
        ('Real-time UI (WebSockets)', 'Frontend', NULL, 23),
        ('Analytics & Audit Dashboards', 'Frontend', NULL, 24),
        ('MySQL', 'Data & Cloud', NULL, 25),
        ('MongoDB', 'Data & Cloud', NULL, 26),
        ('ChromaDB', 'Data & Cloud', NULL, 27),
        ('Apache Kafka', 'Data & Cloud', NULL, 28),
        ('AWS (ECS, Lambda, API Gateway, CloudFormation)', 'Data & Cloud', NULL, 29),
        ('Docker', 'Data & Cloud', NULL, 30),
        ('CI/CD (GitHub Actions through OIDC)', 'Data & Cloud', NULL, 31)
        """
    )

    # ── Seed: resume text (pypdf-extracted at migration-authoring time via
    # services/ingestion/app/readers/pdf.py::read_pdf_file — not re-run at
    # ingestion time going forward; see services/ingestion changes) ────────────
    op.execute(
        """
        INSERT INTO documents (doc_type, title, body, asset_url, display_order)
        VALUES (
            'resume',
            'Varikuppala Ravinder — Senior AI Platform Engineer (Resume)',
            $body$VARIKUPPALA RAVINDER
Senior AI Platform Engineer | LLM Agents | RAG | MCP Tooling | System Architecture | AWS
+91 9515295330 | it.ravinder.456@gmail.com | Hyderabad, India | linkedin | Github

CAREER SUMMARY
Senior AI Platform Engineer with 6+ years architecting production LLM systems, multi-agent pipelines, and full-stack
distributed platforms. Delivered 40% reduction in manual workflows, 30-40% retrieval accuracy improvement, and
sub-2s RAG response latency at enterprise scale. Deep expertise in end-to-end system architecture from agent
orchestration and RAG design to frontend delivery and cloud infrastructure.

TECHNICAL SKILLS
AI / LLM: RAG, GPT-4/Claude integration, LangGraph multi-agent orchestration, MCP Servers, Tool & Function
Calling, Vector Search, Embeddings, Prompt Engineering, Guardrails & Fallback Strategies
Architecture: Distributed Systems, Microservices, Event-Driven Architecture, API Gateway Patterns, Planner-
Executor Agent Design, BFF Pattern, System Design & Review
Backend: FastAPI (Python), Node.js, Express.js, REST & WebSocket APIs
Frontend: React.js, Next.js (SSR/SSG/ISR), TypeScript, Real-time UI (WebSockets), Analytics & Audit Dashboards
Data & Cloud: MySQL, MongoDB, ChromaDB, Apache Kafka, AWS (ECS, Lambda, API Gateway, CloudFormation),
Docker, CI/CD (GitHub Actions through OIDC)

WORK EXPERIENCE
Senior Software Engineer | EPAM Systems 2024-Present
- Designed end-to-end system architecture for enterprise AI platforms - defining service boundaries, agent
state management, tool routing patterns, and cloud infrastructure across the full stack
- Architected LangGraph planner-executor multi-agent systems with a supervisor coordinating specialised
sub-agents for retrieval, Jira automation, analytics, and summarisation
- Built MCP tool servers enabling agents to autonomously create Jira tickets, trigger triage workflows, and
invoke internal APIs without human intervention
- Designed RAG pipelines over millions of documents - improving retrieval accuracy by 30-40% and cutting
response latency through optimised chunking, metadata enrichment, and vector indexing strategies
- Built real-time agent streaming interfaces, analytics dashboards, and audit trail views with seamless
backend integration
- Led development of Elsa AI Assistant - flagship enterprise AI platform combining RAG, MCP tooling, and
multi-agent orchestration
- Implemented production-grade guardrails, retry logic, and fallback strategies reducing hallucination-
related failures in live environments
- Established AI platform engineering standards, conducted architecture reviews, and designed secure CI/CD
pipelines on AWS

Specialist - Software Engineering | LTIMindtree 2022-2024
- Architected data-intensive microservices with clear service boundaries, API contracts, and data flow
patterns serving enterprise clients at scale
- Built full-stack features across frontend and backend layers, data transformation pipelines improved
throughput by 20-30% and reduced end-to-end latency for downstream consumers
- Led system design reviews and drove production deployments across multiple client engagements

Senior Developer | DevRabbit IT Solutions 2019-2022
- Delivered full-stack applications end-to-end - owning frontend, backend, and data layer across the
complete delivery lifecycle for enterprise clients
- Designed RESTful APIs and reusable component libraries reducing codebase complexity and cutting feature
delivery time by ~20%
- Introduced automation scripts for build tooling and data processing, establishing a clean polyglot
architecture pattern

PROJECTS
Elsa AI Assistant - Enterprise AI Platform
Production-grade enterprise AI assistant with a real-time streaming frontend, API gateway and MCP layer, and a
LangGraph multi-agent core. A supervisor agent orchestrates specialized sub-agents for RAG retrieval (ChromaDB),
Jira automation, analytics, and summarization. Features session-aware multi-turn conversation, SSE streaming,
audit dashboard, RBAC, and async event ingestion for document updates and agent activity.
Outcomes: 35% reduction in Jira ticket creation time - 40% improvement in query resolution accuracy - Sub-2s RAG
response latency
Stack: Python - FastAPI - LangGraph - Node.js - Next.js - ChromaDB - Kafka - AWS ECS - Docker

AI Web Agent for Intelligent Search & Data Extraction
Autonomous web agent for multi-source search and data synthesis, using LLM-based decision workflows and
Scrapy-powered data pipelines to generate structured, cited responses.
Stack: Python - LLM APIs - FastAPI - Scrapy - Next.js

Healthcare & Enterprise Platforms
Fleet Manager (IoT monitoring) - Ayurway (EMR system) - iDestination (location intelligence) - Notifii (enterprise
package tracking) - full-stack systems with real-time dashboards, REST APIs, and data processing microservices.

ACHIEVEMENTS
- Ace of Delivery Award - EPAM
- Client Hero Award - EPAM
- Fearless Problem Solver Award (3x) - EPAM & LTIMindtree
- A-TEAM SPOT ON Award - LTIMindtree
- Super Crew Award - LTIMindtree

EDUCATION AND CERTIFICATION
Bachelor of Technology (CSE) | Guru Nanak Institutions Technical Campus, JNTU 2019
Diploma (CSE) | Govt Polytechnic Masabtank, SBTET 2016$body$,
            '/resume',
            0
        )
        """
    )


def downgrade() -> None:
    op.drop_table('documents')
    op.drop_table('skills')
    op.drop_table('experiences')
    op.drop_table('projects')
