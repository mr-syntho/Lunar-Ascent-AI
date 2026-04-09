import { Router, type IRouter } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { db, queriesTable } from "@workspace/db";
import { AiQueryBody, DeleteHistoryItemParams, GetHistoryQueryParams } from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { generateImageBuffer } from "@workspace/integrations-openai-ai-server/image";

const router: IRouter = Router();

async function fetchUrlContent(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; AI-Assistant/1.0)" },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }
  const text = await response.text();
  const cleaned = text
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);
  return cleaned;
}

function buildSystemPrompt(taskType: string): string {
  switch (taskType) {
    case "search":
      return "You are a helpful search assistant. Provide clear, accurate, and well-structured information in response to the user's query. Use bullet points and headings where appropriate. Cite information clearly and be comprehensive but concise.";
    case "code":
      return "You are an expert software engineer and coding assistant. Provide clean, well-commented, production-quality code. Always explain what the code does, include error handling, and follow best practices. Format code properly with appropriate markdown code blocks.";
    case "summarize":
      return "You are an expert at summarizing and synthesizing information. Create clear, concise summaries that capture the key points. Use bullet points for main ideas, highlight important facts, and maintain the essential meaning of the original content.";
    case "image":
      return "You are a creative image generation assistant. Help the user refine their prompt and provide useful context. Note that an image has been generated based on the query.";
    default:
      return "You are a helpful AI assistant.";
  }
}

function getSourcesForTaskType(taskType: string): string[] {
  switch (taskType) {
    case "search":
      return ["Google Search AI", "Deepseek AI", "Bing AI"];
    case "code":
      return ["OpenAI Codex", "Claude Code", "GitHub Copilot"];
    case "summarize":
      return ["GPT AI", "Claude AI", "LLaMA AI"];
    case "image":
      return ["DALL-E AI", "Stable Diffusion", "NanoBanana AI"];
    default:
      return ["OpenAI GPT"];
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
      req.log.warn({ err, url }, "Failed to fetch URL content");
    }
  }

  const sources = getSourcesForTaskType(taskType);

  if (taskType === "image") {
    let imageUrl: string | null = null;
    let result = "";

    try {
      const imageBuffer = await generateImageBuffer(query, "1024x1024");
      const b64 = imageBuffer.toString("base64");
      imageUrl = `data:image/png;base64,${b64}`;
      result = `Image generated successfully for prompt: "${query}"`;
    } catch (err) {
      req.log.error({ err }, "Failed to generate image");
      result = `Image generation was requested for: "${query}". The image generation service encountered an error. Please try again with a different prompt.`;
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
      imageUrl: saved.imageUrl,
      sources: saved.sources,
      createdAt: saved.createdAt.toISOString(),
    });
    return;
  }

  const systemPrompt = buildSystemPrompt(taskType);
  const userMessage = contextContent
    ? `${query}\n\n---\nContent extracted from ${url}:\n${contextContent}`
    : query;

  const completion = await openai.chat.completions.create({
    model: taskType === "code" ? "gpt-5.2" : "gpt-5.2",
    max_completion_tokens: 8192,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  });

  const result = completion.choices[0]?.message?.content ?? "No response generated.";

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

  const query = db
    .select()
    .from(queriesTable)
    .orderBy(desc(queriesTable.createdAt))
    .limit(limit ?? 20);

  let rows;
  if (taskType) {
    rows = await db
      .select()
      .from(queriesTable)
      .where(eq(queriesTable.taskType, taskType))
      .orderBy(desc(queriesTable.createdAt))
      .limit(limit ?? 20);
  } else {
    rows = await query;
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
