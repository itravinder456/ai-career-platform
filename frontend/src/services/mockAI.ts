import { Message, Widget } from "@/types/chat";
import { generateId } from "@/lib/utils";

interface MockResponse {
  content: string;
  widgets?: Widget[];
}

const RESPONSES: Record<string, MockResponse> = {
  default: {
    content:
      "I'm Ravinder's AI assistant. I know everything about his career — projects, architecture decisions, GitHub activity, and skills. What would you like to explore?",
  },
  intro: {
    content:
      "Ravinder is a Senior AI Platform Engineer with 6+ years of experience building production-grade agentic AI systems. He specialises in RAG pipelines, LangGraph multi-agent orchestration, and MCP tooling. His most notable work is ELSA — an AI assistant serving 200+ enterprise users with 40% productivity gains.",
    widgets: [
      {
        type: "tech_stack",
        data: {
          categories: [
            { label: "AI / Agents", items: ["LangGraph", "MCP", "RAG", "Claude", "LangChain"] },
            { label: "Backend", items: ["FastAPI", "Python", "PostgreSQL", "Redis"] },
            { label: "Cloud", items: ["AWS ECS", "S3", "API Gateway", "CloudFormation"] },
            { label: "Frontend", items: ["Next.js", "TypeScript", "React"] },
          ],
        },
      },
    ],
  },
  project: {
    content:
      "ELSA is Ravinder's flagship project — an enterprise AI assistant built on a multi-agent architecture. The system handles 1,000+ daily queries with P95 latency under 800ms. Here's the architecture:",
    widgets: [
      {
        type: "project_card",
        data: {
          name: "ELSA — Enterprise AI Assistant",
          description:
            "Multi-agent AI platform serving 200+ enterprise users. Built with LangGraph supervisor pattern, MCP tool servers, and a RAG pipeline over internal knowledge bases.",
          impact: ["200+ active users", "40% productivity gain", "1,000+ daily queries", "<800ms P95"],
          tech: ["LangGraph", "FastAPI", "Qdrant", "Redis", "Claude", "MCP"],
          github: "https://github.com/ravinder-varikuppala/elsa",
          status: "Production",
        },
      },
      {
        type: "architecture",
        data: {
          layers: [
            { name: "Frontend", items: ["Next.js", "React", "SSE Streaming"] },
            { name: "API Gateway", items: ["FastAPI", "Rate Limiting", "Auth"] },
            { name: "Agent Runtime", items: ["LangGraph", "Supervisor", "Sub-agents"] },
            { name: "Tool Layer", items: ["MCP Servers", "Resume", "GitHub", "Portfolio"] },
            { name: "Data Layer", items: ["Qdrant (RAG)", "Redis (Sessions)", "PostgreSQL"] },
          ],
        },
      },
    ],
  },
  rag: {
    content:
      "Ravinder has deep expertise in RAG systems. He built a production RAG pipeline with semantic chunking, cross-encoder reranking, and hybrid search. The system handles multi-modal documents and achieves 94% retrieval precision.",
    widgets: [
      {
        type: "architecture",
        data: {
          layers: [
            { name: "Ingestion", items: ["PDF Loader", "Semantic Chunker", "Metadata Extractor"] },
            { name: "Embedding", items: ["text-embedding-3-small", "Batch Processing"] },
            { name: "Storage", items: ["Qdrant", "1536-dim vectors", "Payload filters"] },
            { name: "Retrieval", items: ["Hybrid Search", "Cross-encoder Rerank", "Top-k"] },
            { name: "Generation", items: ["Claude", "Citations", "Streaming"] },
          ],
        },
      },
      {
        type: "tech_stack",
        data: {
          categories: [
            { label: "Vector DB", items: ["Qdrant", "Hybrid Search"] },
            { label: "Embeddings", items: ["OpenAI ada-002", "text-embedding-3"] },
            { label: "Reranking", items: ["Cross-encoder", "Cohere Rerank"] },
            { label: "LLM", items: ["Claude Sonnet", "GPT-4"] },
          ],
        },
      },
    ],
  },
  skills: {
    content:
      "Here's a breakdown of Ravinder's technical skills across AI engineering, backend systems, and cloud infrastructure:",
    widgets: [
      {
        type: "skill_graph",
        data: {
          skills: [
            { name: "LangGraph / Agents", level: 95 },
            { name: "RAG Pipelines", level: 92 },
            { name: "MCP Protocol", level: 90 },
            { name: "FastAPI / Python", level: 90 },
            { name: "AWS / Cloud", level: 82 },
            { name: "Next.js / React", level: 75 },
            { name: "PostgreSQL", level: 80 },
            { name: "Docker / K8s", level: 78 },
          ],
        },
      },
    ],
  },
  resume: {
    content:
      "Here's Ravinder's resume. You can also download the PDF directly.",
    widgets: [
      {
        type: "resume_preview",
        data: {
          name: "Varikuppala Ravinder",
          title: "Senior AI Platform Engineer",
          experience: [
            { company: "TCS", role: "AI Platform Engineer", duration: "2022 – Present", highlight: "Built ELSA AI assistant, 200+ users" },
            { company: "Infosys", role: "Software Engineer", duration: "2019 – 2022", highlight: "Backend microservices, API design" },
          ],
          education: "B.Tech Computer Science",
          downloadUrl: "/resume",
        },
      },
    ],
  },
};

function classify(input: string): string {
  const q = input.toLowerCase();
  if (q.match(/who|yourself|about|introduce|background/)) return "intro";
  if (q.match(/elsa|project|complex|flagship|build/)) return "project";
  if (q.match(/rag|retrieval|vector|embedding|qdrant/)) return "rag";
  if (q.match(/skill|know|expertise|experience|tech/)) return "skills";
  if (q.match(/resume|cv|download/)) return "resume";
  return "default";
}

export async function mockStream(
  input: string,
  onToken: (token: string) => void,
  onComplete: (widgets?: Widget[]) => void
): Promise<void> {
  const key = classify(input);
  const response = RESPONSES[key] ?? RESPONSES.default;
  const words = response.content.split(" ");

  for (const word of words) {
    await new Promise((r) => setTimeout(r, 28 + Math.random() * 30));
    onToken(word + " ");
  }

  onComplete(response.widgets);
}

export function getGreeting(): Message {
  return {
    id: generateId(),
    role: "assistant",
    content: "",
    widgets: undefined,
    isStreaming: false,
    timestamp: new Date(),
  };
}

export const GREETING_TEXT =
  "Hello 👋 I'm Ravinder's AI. I know everything about his experience, projects, architecture decisions, and skills. What would you like to know?";

export const SUGGESTIONS = [
  "Tell me about yourself",
  "Explain your most complex project",
  "What's your RAG expertise?",
  "Show me your skills",
  "Can I see your resume?",
];
