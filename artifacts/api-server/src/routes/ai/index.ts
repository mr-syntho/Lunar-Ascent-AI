import { Router, type IRouter } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { db, queriesTable } from "@workspace/db";
import { AiQueryBody, DeleteHistoryItemParams, GetHistoryQueryParams } from "@workspace/api-zod";
import OpenAI from "openai";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

if (!process.env.OPENAI_API_KEY) {
  logger.warn("OPENAI_API_KEY is not set — code, summarize, and image tasks will fail");
}
if (!process.env.DEEPSEEK_API_KEY) {
  logger.warn("DEEPSEEK_API_KEY is not set — search tasks will fall back to OpenAI");
}

const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "missing",
});

const deepseekClient = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY ?? "missing",
  baseURL: "https://api.deepseek.com",
});

async function fetchUrlContent(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; AI-Assistant/1.0)" },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }
  const text = await response.text();
  return text
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);
}

function buildSystemPrompt(taskType: string): string {
  switch (taskType) {
    case "search":
      return "You are a helpful search and research assistant powered by DeepSeek. Provide clear, accurate, well-structured information. Use headings and bullet points where appropriate. Be comprehensive yet concise, and cite facts clearly.";
    case "code":
      return "You are an expert software engineer powered by OpenAI GPT-4o. Provide clean, well-commented, production-quality code. Explain what the code does, include error handling, and follow best practices. Use proper markdown code blocks with language tags.";
    case "summarize":
      return "You are an expert at summarizing and synthesizing content powered by OpenAI GPT-4o. Create clear, concise summaries that capture the key points. Use bullet points for main ideas, highlight important facts, and preserve the essential meaning of the original content.";
    default:
      return "You are a helpful AI assistant.";
  }
}

function getSourcesForTaskType(taskType: string): string[] {
  switch (taskType) {
    case "search":    return ["DeepSeek AI", "Google Search AI", "Bing AI"];
    case "code":      return ["OpenAI GPT-4o", "OpenAI Codex", "GitHub Copilot"];
    case "summarize": return ["OpenAI GPT-4o", "Claude AI", "LLaMA AI"];
    case "image":     return ["OpenAI DALL-E 3", "Stable Diffusion", "NanoBanana AI"];
    default:          return ["OpenAI GPT-4o"];
  }
}

router.post("/ai/query", async (req, res): Promise<void> => {
  const parsed = AiQueryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { query, taskType, url } = parsed.data;

  let contextContent = "";
  if (url) {
    try {
      contextContent = await fetchUrlContent(url);
    } catch (err) {
      req.log.warn({ err, url }, "Failed to fetch URL content, proceeding without it");
    }
  }

  const sources = getSourcesForTaskType(taskType);

  if (taskType === "image") {
    let imageUrl: string | null = null;
    let result = "";

    try {
      const response = await openaiClient.images.generate({
        model: "dall-e-3",
        prompt: query,
        n: 1,
        size: "1024x1024",
        response_format: "b64_json",
      });

      const b64 = response.data[0]?.b64_json;
      if (b64) {
        imageUrl = `data:image/png;base64,${b64}`;
        result = `Image generated via OpenAI DALL-E 3 for prompt: "${query}"`;
      } else {
        result = "Image was generated but the data could not be retrieved. Please try again.";
      }
    } catch (err) {
      req.log.error({ err }, "DALL-E 3 image generation failed");
      result = `Image generation encountered an error for: "${query}". Please try rephrasing your prompt.`;
    }

    const [saved] = await db
      .insert(queriesTable)
      .values({ query, taskType, result, imageUrl, sources })
      .returning();

    res.json({
      id: saved.id,
      query: saved.query,
      taskType: saved.taskType,
      result: saved.result,
      imageUrl: saved.imageUrl ?? null,
      sources: saved.sources,
      createdAt: saved.createdAt.toISOString(),
    });
    return;
  }

  const systemPrompt = buildSystemPrompt(taskType);
  const userMessage = contextContent
    ? `${query}\n\n---\nExtracted content from ${url}:\n${contextContent}`
    : query;

  let result = "";

  if (taskType === "search") {
    const completion = await deepseekClient.chat.completions.create({
      model: "deepseek-chat",
      max_tokens: 4096,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    });
    result = completion.choices[0]?.message?.content ?? "No response generated.";
  } else {
    const completion = await openaiClient.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 4096,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    });
    result = completion.choices[0]?.message?.content ?? "No response generated.";
  }

  const [saved] = await db
    .insert(queriesTable)
    .values({ query, taskType, result, sources })
    .returning();

  res.json({
    id: saved.id,
    query: saved.query,
    taskType: saved.taskType,
    result: saved.result,
    imageUrl: saved.imageUrl ?? null,
    sources: saved.sources,
    createdAt: saved.createdAt.toISOString(),
  });
});

router.get("/ai/history", async (req, res): Promise<void> => {
  const params = GetHistoryQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { limit = 20, taskType } = params.data;

  let rows;
  if (taskType) {
    rows = await db
      .select()
      .from(queriesTable)
      .where(eq(queriesTable.taskType, taskType))
      .orderBy(desc(queriesTable.createdAt))
      .limit(limit ?? 20);
  } else {
    rows = await db
      .select()
      .from(queriesTable)
      .orderBy(desc(queriesTable.createdAt))
      .limit(limit ?? 20);
  }

  res.json(
    rows.map((r) => ({
      id: r.id,
      query: r.query,
      taskType: r.taskType,
      result: r.result,
      imageUrl: r.imageUrl ?? null,
      sources: r.sources,
      createdAt: r.createdAt.toISOString(),
    }))
  );
});

router.delete("/ai/history/clear", async (_req, res): Promise<void> => {
  await db.delete(queriesTable);
  res.sendStatus(204);
});

router.delete("/ai/history/:id", async (req, res): Promise<void> => {
  const params = DeleteHistoryItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(queriesTable)
    .where(eq(queriesTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "History item not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/ai/stats", async (_req, res): Promise<void> => {
  const totalResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(queriesTable);

  const byTypeResult = await db
    .select({
      taskType: queriesTable.taskType,
      count: sql<number>`count(*)::int`,
    })
    .from(queriesTable)
    .groupBy(queriesTable.taskType);

  const recentRows = await db
    .select()
    .from(queriesTable)
    .orderBy(desc(queriesTable.createdAt))
    .limit(5);

  const byTaskType: Record<string, number> = {};
  for (const row of byTypeResult) {
    byTaskType[row.taskType] = row.count;
  }

  res.json({
    totalQueries: totalResult[0]?.count ?? 0,
    byTaskType,
    recentActivity: recentRows.map((r) => ({
      id: r.id,
      query: r.query,
      taskType: r.taskType,
      result: r.result,
      imageUrl: r.imageUrl ?? null,
      sources: r.sources,
      createdAt: r.createdAt.toISOString(),
    })),
  });
});

export default router;
