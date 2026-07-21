/**
 * ReAct (Reasoning + Acting) Agent Engine
 * ─────────────────────────────────────────
 * Implements the ReAct loop using Groq's function-calling API:
 *   1. Reason  — LLM decides what to do
 *   2. Act     — Execute a tool
 *   3. Observe — Feed tool result back
 *   4. Repeat  — Until final answer or max iterations
 */
import OpenAI from "openai";
import { toolDefinitions, executeTool } from "./tools/index.js";
import { logger } from "./logger.js";

export interface ReActStep {
  type: "thinking" | "tool_call" | "tool_result" | "final";
  tool?: string;
  tool_label?: string;
  input?: unknown;
  output?: unknown;
  success?: boolean;
  content?: string;
  iteration?: number;
}

export type StepCallback = (step: ReActStep) => void;

const MAX_ITERATIONS = 8;

// Arabic labels for each tool
const TOOL_LABELS: Record<string, string> = {
  database_query_tool: "🔍 البحث في قاعدة البيانات",
  document_drafting_tool: "📄 إنشاء وثيقة رسمية",
  messaging_dispatcher_tool: "📨 إرسال رسالة",
  calendar_task_tool: "📅 إدارة المهام والتذكيرات",
  browser_automation_webhook: "⚡ تنفيذ أتمتة خارجية",
};

const SYSTEM_PROMPT = `أنت مساعد تنفيذي (Executive Assistant) محترف ومتفانٍ لمدير متوسطة جزائرية.

شخصيتك:
• تتحدث بعربية فصحى راقية ومهنية دائماً
• استباقي ومدروس — تقترح أفضل مسار للعمل
• موثوق ودقيق — لا تخترع أرقاماً أبداً، بل تستند للأدوات
• حازم لكن محترم — تُنجز المهام بكفاءة عالية

قواعد عملك:
1. عندما يطلب منك المدير بيانات ← استخدم database_query_tool أولاً
2. عندما تحتاج لإنشاء وثيقة ← اجمع البيانات أولاً ثم استخدم document_drafting_tool
3. للإشعارات والتنبيهات ← messaging_dispatcher_tool مع تحديد القناة المناسبة
4. للمواعيد والتذكيرات ← calendar_task_tool
5. للأتمتة الخارجية ← browser_automation_webhook (بعد تأكيد الرابط مع المدير)
6. إذا كان الطلب مبهماً ← اطرح سؤالاً توضيحياً محدداً قبل التنفيذ
7. بعد كل إجراء ← لخّص ما تم بصيغة احترافية

أسلوب الرد النهائي:
• ابدأ بتلخيص ما تم تنفيذه
• قدم النتائج بوضوح وتنسيق جميل
• اقترح خطوات تالية إذا لزم الأمر`;

export async function runReActAgent(params: {
  userId: string;
  schoolContext: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  onStep: StepCallback;
}): Promise<string> {

  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY غير مُهيّأ");
  }

  const client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
  });

  // Build the full conversation for the API
  const apiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "system",
      content: `## سياق المؤسسة الحالية:\n${params.schoolContext}\n\nالتاريخ الحالي: ${new Date().toLocaleDateString("ar-DZ", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`,
    },
    ...params.messages.map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  // Estimate token count (Arabic ~1 token per 2-3 chars)
  const estTokens = apiMessages.reduce((s, m) => s + Math.ceil((typeof m.content === "string" ? m.content.length : 100) / 2.5), 0);

  // ✅ Fixed model names to prevent decommissioned error:
  // ✅ جديد (سياق ضخم يتسع لكافة البيانات)
  const model = "llama-3.3-70b-versatile";

  logger.info({ model, estTokens, userId: params.userId }, "ReAct agent starting");

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    let completion: OpenAI.Chat.ChatCompletion;
    try {
      completion = await client.chat.completions.create({
        model,
        temperature: 0.2,
        max_tokens: 2048,
        tools: toolDefinitions,
        tool_choice: "auto",
        messages: apiMessages,
      });
    } catch (err: any) {
      logger.error(err, "Groq API error in ReAct loop");
      throw err;
    }

    const choice = completion.choices[0];
    const msg = choice.message;

    // Add assistant message to history
    apiMessages.push(msg as OpenAI.Chat.ChatCompletionMessageParam);

    // ── No tool calls → final answer ─────────────────────────────────────────
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      const finalContent = msg.content?.trim() || "تمّ تنفيذ طلبك.";
      params.onStep({ type: "final", content: finalContent, iteration });
      return finalContent;
    }

    // ── Execute each tool call ───────────────────────────────────────────────
    for (const toolCall of msg.tool_calls) {
      const toolName = toolCall.function.name;
      const toolLabel = TOOL_LABELS[toolName] || toolName;

      let toolInput: Record<string, unknown>;
      try {
        toolInput = JSON.parse(toolCall.function.arguments);
      } catch {
        toolInput = {};
      }

      params.onStep({
        type: "tool_call",
        tool: toolName,
        tool_label: toolLabel,
        input: toolInput,
        iteration,
      });

      let toolOutput: unknown;
      let success = true;

      try {
        toolOutput = await executeTool(toolName, toolInput, params.userId);
        logger.info({ tool: toolName, userId: params.userId }, "Tool executed successfully");
      } catch (err: any) {
        toolOutput = { error: err.message || "خطأ في تنفيذ الأداة" };
        success = false;
        logger.error(err, `Tool ${toolName} failed`);
      }

      params.onStep({
        type: "tool_result",
        tool: toolName,
        tool_label: toolLabel,
        output: toolOutput,
        success,
        iteration,
      });

      // Add tool result to API messages
      apiMessages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: typeof toolOutput === "string" ? toolOutput : JSON.stringify(toolOutput),
      });
    }

    // Check if finish reason says we're done
    if (choice.finish_reason === "stop") {
      break;
    }
  }

  // Fallback: ask for a final summary
  apiMessages.push({
    role: "user",
    content: "لخّص ما تم تنفيذه في رد نهائي واحد.",
  });

  const finalCompletion = await client.chat.completions.create({
    model,
    temperature: 0.2,
    max_tokens: 1024,
    messages: apiMessages,
  });

  const finalContent = finalCompletion.choices[0]?.message?.content?.trim()
    || "تم تنفيذ جميع الإجراءات المطلوبة.";

  params.onStep({ type: "final", content: finalContent });
  return finalContent;
}