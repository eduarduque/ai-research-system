// Standalone MCP server — run outside the Next.js bundler via `npm run mcp` (tsx),
// so this loads env vars itself and uses relative imports instead of the "@/*" alias.
import path from "path";
import dotenv from "dotenv";
// quiet: true is required, not cosmetic — dotenv v17 otherwise prints a promotional
// "tip" banner to stdout, which corrupts the MCP stdio JSON-RPC stream.
dotenv.config({ path: path.join(process.cwd(), ".env.local"), quiet: true });

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { getSources } from "../lib/db";
import { ingestUrl } from "../lib/ingest";
import { answerQuestion } from "../lib/ask";
import { generateBrief } from "../lib/briefs";
import { buildGraph } from "../lib/graph";

const server = new McpServer({
  name: "ai-research-system",
  version: "0.1.0",
});

function textResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function errorResult(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
}

server.registerTool(
  "ingest_url",
  {
    title: "Ingest URL",
    description: "Fetch an article/page by URL, extract its readable content, save it as a research source, and embed it for semantic search.",
    inputSchema: { url: z.string().url().describe("The URL of the article to ingest") },
  },
  async ({ url }) => {
    try {
      return textResult(await ingestUrl(url));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "ask_research",
  {
    title: "Ask Research",
    description: "Answer a question using retrieval-augmented generation over all previously ingested research sources.",
    inputSchema: { question: z.string().describe("The question to answer from saved research") },
  },
  async ({ question }) => {
    try {
      return textResult(await answerQuestion(question));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "generate_brief",
  {
    title: "Generate Brief",
    description: "Generate (or fetch the existing) structured research brief — summary, key ideas, entities, opportunities — for a saved source.",
    inputSchema: { source_id: z.string().describe("The id of the source to generate a brief for") },
  },
  async ({ source_id }) => {
    try {
      return textResult(await generateBrief(source_id));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "list_sources",
  {
    title: "List Sources",
    description: "List all research sources saved so far, most recently ingested first.",
    inputSchema: {},
  },
  async () => {
    try {
      return textResult(getSources());
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "get_research_graph",
  {
    title: "Get Research Graph",
    description: "Get the knowledge graph (nodes and edges) connecting sources to the topics and opportunities extracted from their briefs.",
    inputSchema: {},
  },
  async () => {
    try {
      return textResult(buildGraph());
    } catch (err) {
      return errorResult(err);
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ai-research-system MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error starting MCP server:", err);
  process.exit(1);
});
