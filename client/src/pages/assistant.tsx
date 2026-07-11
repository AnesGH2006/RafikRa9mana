import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Bot, Send, User, Sparkles, AlertCircle } from "lucide-react";

const BASE = import.meta.env.BASE_URL;

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as any } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

type ChatMessage = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "تلميذ متأخر دراسياً ومعدله ضعيف، ما الحل؟",
  "كيف أعالج مشكلة الغياب المتكرر عند تلميذ؟",
  "تلميذ يواجه صعوبة في مادة الرياضيات، ما الإجراءات المناسبة؟",
];

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || loading) return;
    setError(null);
    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch(`${BASE}api/assistant/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ messages: next.slice(-16) }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages(m => [...m, { role: "assistant", content: data.reply }]);
      } else {
        setError(data.error || "حدث خطأ غير متوقع");
      }
    } catch {
      setError("تعذّر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit"
      className="p-6 space-y-4 max-w-4xl mx-auto h-full flex flex-col">

      {/* Header */}
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}
        className="flex items-center gap-3">
        <span className="inline-flex w-9 h-9 rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-600 items-center justify-center shadow-lg shadow-fuchsia-500/30">
          <Bot className="w-5 h-5 text-white" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-foreground">المساعد الذكي</h1>
          <p className="text-xs text-muted-foreground">مختص فقط في مشاكل التلاميذ وحلولها التربوية</p>
        </div>
      </motion.div>

      {/* Chat panel */}
      <Card className="flex-1 border-0 shadow-md bg-gradient-to-br from-card to-muted/20 flex flex-col overflow-hidden min-h-[60vh]">
        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && (
              <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                className="h-full flex flex-col items-center justify-center text-center gap-4 py-10">
                <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="w-14 h-14 rounded-2xl bg-gradient-to-br from-fuchsia-100 to-pink-100 dark:from-fuchsia-950/30 dark:to-pink-950/30 flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-fuchsia-500" />
                </motion.div>
                <div>
                  <p className="font-semibold text-foreground">اسأل عن مشكلة تلميذ وسأقترح حلولاً</p>
                  <p className="text-xs text-muted-foreground mt-1">مثال: تراجع في النتائج، غياب متكرر، صعوبة في مادة، إعادة السنة...</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                  {SUGGESTIONS.map(s => (
                    <motion.button key={s} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                      onClick={() => send(s)}
                      className="text-xs px-3 py-1.5 rounded-full border bg-background hover:border-fuchsia-300 hover:text-fuchsia-600 transition-colors">
                      {s}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            <AnimatePresence initial={false}>
              {messages.map((m, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className={`flex items-start gap-2.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {m.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-600 flex items-center justify-center shrink-0 shadow-sm">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                    m.role === "user"
                      ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-se-sm"
                      : "bg-muted rounded-ss-sm text-foreground"
                  }`}>
                    {m.content}
                  </div>
                  {m.role === "user" && (
                    <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-600 flex items-center justify-center shrink-0 shadow-sm">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-muted rounded-2xl rounded-ss-sm px-4 py-3 flex gap-1">
                  {[0, 1, 2].map(i => (
                    <motion.span key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60"
                      animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }} />
                  ))}
                </div>
              </motion.div>
            )}

            {error && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {error}
              </motion.div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={e => { e.preventDefault(); send(input); }}
            className="flex items-center gap-2 border-t p-3 bg-background/60"
          >
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="اكتب مشكلة التلميذ هنا..."
              disabled={loading}
              className="flex-1 h-10 px-3 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-400/40 disabled:opacity-60"
            />
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
              <Button type="submit" size="icon" disabled={loading || !input.trim()}
                className="h-10 w-10 rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-600 hover:from-fuchsia-600 hover:to-pink-700 text-white border-0 shadow-md shadow-fuchsia-500/25">
                <Send className="w-4 h-4" />
              </Button>
            </motion.div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
