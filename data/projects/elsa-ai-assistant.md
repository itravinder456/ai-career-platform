# Elsa AI Assistant — Enterprise AI Platform

Elsa is the flagship enterprise AI platform built at EPAM Systems (2024–present), combining
retrieval-augmented generation, MCP tooling, and multi-agent orchestration into a single
production system.

## Architecture

The platform is built around a LangGraph planner-executor multi-agent core: a supervisor agent
coordinates specialized sub-agents for RAG retrieval, Jira automation, analytics, and
summarization. Each sub-agent has a narrow responsibility and reports back to the supervisor,
which composes the final response.

Around that agent core sits:

- A real-time streaming frontend (Next.js) that renders agent responses via SSE as they generate.
- An API gateway and MCP (Model Context Protocol) layer, giving agents autonomous access to
  internal tools — creating Jira tickets, triggering triage workflows, and invoking internal
  APIs without human intervention.
- A RAG retrieval layer over ChromaDB, indexing millions of internal documents. Retrieval
  accuracy improved 30–40% through optimized chunking, metadata enrichment, and vector indexing
  strategies, with response latency held under 2 seconds even at that scale.
- Kafka-based async event ingestion, so document updates and agent activity feed the system
  continuously rather than through batch reprocessing.
- Session-aware multi-turn conversation, an audit dashboard, and role-based access control (RBAC).

## Reliability

Production-grade guardrails, retry logic, and fallback strategies were built in specifically to
reduce hallucination-related failures once the system was live and handling real user traffic —
not just to pass a demo.

## Outcomes

- 35% reduction in Jira ticket creation time.
- 40% improvement in query resolution accuracy.
- Sub-2-second RAG response latency at enterprise scale.
- Contributed to a broader 40% reduction in manual workflows across the platform.

## Stack

Python, FastAPI, LangGraph, Node.js, Next.js, ChromaDB, Kafka, AWS ECS, Docker.

## Recognition

Work on this platform contributed to EPAM's Ace of Delivery Award and Client Hero Award.
