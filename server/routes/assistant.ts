import { Router, type IRouter } from "express";
import OpenAI from "openai";
import { AssistantChatBody, AssistantChatResponse } from "../../shared/schemas.js";

const router: IRouter = Router();

const SYSTEM_PROMPT = `أنت "المساعد الذكي" داخل تطبيق إدارة متوسطة (مدرسة). دورك الوحيد هو مساعدة الطاقم التربوي والإداري على تحليل مشاكل التلاميذ (تراجع في النتائج، غياب متكرر، إعادة السنة، صعوبات في مادة معينة، مشاكل سلوكية، توجيه...) وتقديم حلول تربوية وإدارية عملية وواضحة لها.

قواعد صارمة يجب اتباعها دون استثناء:
- أجب فقط عن الأسئلة المتعلقة بمشاكل التلاميذ وحلولها التربوية ومشاكل الموقع وإدارتها.
- إذا كان السؤال خارج هذا الموضوع (مثل: سياسة، رياضة، برمجة، طبخ، أخبار عامة، أو أي موضوع لا يتعلق بمشاكل التلاميذ وحلولها) فيجب أن تمتنع عن الإجابة بأدب، وتوضح أنه "يتعذر عليك" الإجابة عن أسئلة خارج نطاق مشاكل التلاميذ وحلولها، دون تقديم أي معلومة عن الموضوع المطروح.
- كن مختصراً وعملياً، وقدّم خطوات أو حلولاً واضحة ومرتبة عند الإمكان.
- أجب بنفس اللغة التي كتب بها المستخدم سؤاله.`;

router.post("/assistant/chat", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = AssistantChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "طلب غير صالح" });
    return;
  }

  if (!process.env.GROQ_API_KEY) {
    res.status(500).json({ error: "المساعد الذكي غير مُهيّأ بعد" });
    return;
  }

  try {
    const client = new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: "https://api.groq.com/openai/v1" });
    const completion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.4,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...parsed.data.messages.map(m => ({ role: m.role, content: m.content })),
      ],
    });
    const reply = completion.choices[0]?.message?.content?.trim() || "تعذّر الحصول على رد، حاول مجدداً.";
    res.json(AssistantChatResponse.parse({ reply }));
  } catch (err) {
    console.error("Assistant chat error:", err);
    res.status(502).json({ error: "تعذّر الاتصال بالمساعد الذكي، حاول مجدداً بعد قليل" });
  }
});

export default router;
