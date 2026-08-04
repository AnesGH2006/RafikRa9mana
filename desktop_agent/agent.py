#!/usr/bin/env python3
"""
وكيل سطح المكتب — CEM Desktop Agent
======================================
روبوت يرى شاشتك، يفكر بالذكاء الاصطناعي، ويتحكم بالماوس والكيبورد.

الاستخدام:
    python agent.py                    # وضع تفاعلي: اكتب المهمة
    python agent.py --task "..."       # مهمة مباشرة
    python agent.py --grades           # إدخال النقاط على موقع الوزارة

متطلبات:
    pip install -r requirements.txt
    GROQ_API_KEY=... (في .env أو متغير بيئة)
"""

import sys
import os
import time
import json
import base64
import argparse
import io
import signal
from pathlib import Path
from typing import Any

# ── المكتبات المطلوبة ────────────────────────────────────────────────────────
try:
    import pyautogui
    import PIL.ImageGrab
    import PIL.Image
    import PIL.ImageDraw
    import requests
    from dotenv import load_dotenv
except ImportError as e:
    print(f"\n❌ مكتبة مفقودة: {e}")
    print("شغّل الأمر:  pip install -r requirements.txt\n")
    sys.exit(1)

load_dotenv()

# ── الإعدادات ────────────────────────────────────────────────────────────────
GROQ_API_KEY   = os.getenv("GROQ_API_KEY", "")
REPLIT_API_URL = os.getenv("REPLIT_API_URL", "")   # مثال: https://your-app.replit.app
REPLIT_COOKIE  = os.getenv("REPLIT_SESSION", "")   # اختياري لجلب البيانات

VISION_MODEL   = "meta-llama/llama-4-scout-17b-16e-instruct"
MAX_STEPS      = 50           # أقصى عدد خطوات لكل مهمة
STEP_DELAY     = 1.5          # ثانية بين الخطوات
SCREENSHOT_W   = 1280         # عرض الصورة المرسلة للـ AI
LOG_DIR        = Path("logs")

# ── أمان: مفتاح الطوارئ ──────────────────────────────────────────────────────
pyautogui.FAILSAFE = True    # حرّك الماوس للزاوية العلوية اليسرى لإيقاف الوكيل

_paused = False

def _pause_handler(sig, frame):
    global _paused
    _paused = not _paused
    status = "⏸  متوقف مؤقتاً — اضغط Ctrl+C مرة ثانية للاستمرار" if _paused else "▶️  استمرار…"
    print(f"\n{status}\n")

signal.signal(signal.SIGINT, _pause_handler)

# ── أدوات الشاشة ──────────────────────────────────────────────────────────────
def screenshot_b64(draw_cursor: bool = True) -> str:
    """التقط الشاشة وأعدها base64 بحجم مناسب."""
    img: PIL.Image.Image = PIL.ImageGrab.grab()

    # ارسم مؤشر الماوس على الصورة حتى يراه الـ AI
    if draw_cursor:
        mx, my = pyautogui.position()
        draw = PIL.ImageDraw.Draw(img)
        r = 8
        draw.ellipse([mx - r, my - r, mx + r, my + r], outline="red", width=3)
        draw.line([mx - 18, my, mx + 18, my], fill="red", width=2)
        draw.line([mx, my - 18, mx, my + 18], fill="red", width=2)

    # تصغير لتوفير tokens
    w, h = img.size
    new_w = SCREENSHOT_W
    new_h = int(h * new_w / w)
    img = img.resize((new_w, new_h), PIL.Image.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode()

def screen_size() -> tuple[int, int]:
    return pyautogui.size()

# ── منطق تحجيم الإحداثيات ────────────────────────────────────────────────────
def scale_coords(x: int, y: int) -> tuple[int, int]:
    """الـ AI يرى صورة بعرض SCREENSHOT_W، بينما الشاشة قد تكون أكبر."""
    sw, sh = pyautogui.size()
    scale_x = sw / SCREENSHOT_W
    scale_y = sh / (SCREENSHOT_W * sh // sw)
    return int(x * scale_x), int(y * scale_y)

# ── Groq Vision ───────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """\
أنت وكيل تحكم بالكمبيوتر. مهمتك: تنفيذ المهمة المطلوبة خطوة بخطوة عبر التحكم بالماوس والكيبورد.

في كل خطوة تستلم:
- صورة لحالة الشاشة الحالية (المؤشر الأحمر يشير للموضع الحالي)
- سجل الخطوات السابقة
- المهمة المطلوبة

أعِد JSON فقط — لا نص قبله ولا بعده — بهذا الشكل الدقيق:

{"action": "...", ...fields..., "thought": "تفكيرك هنا بالعربية"}

الأفعال المتاحة:
  click        {"action":"click","x":int,"y":int}
  right_click  {"action":"right_click","x":int,"y":int}
  double_click {"action":"double_click","x":int,"y":int}
  type         {"action":"type","text":"النص"}          — يكتب النص في المكان الحالي
  key          {"action":"key","keys":"ctrl+a"}         — مثلاً: enter, tab, escape, ctrl+c
  scroll       {"action":"scroll","x":int,"y":int,"amount":int}  — موجب=أسفل سالب=أعلى
  move         {"action":"move","x":int,"y":int}
  wait         {"action":"wait","seconds":float}        — انتظر تحميل أو استجابة
  screenshot   {"action":"screenshot"}                  — خذ صورة بدون فعل (للمراجعة)
  done         {"action":"done","result":"وصف النتيجة"} — اكتملت المهمة
  fail         {"action":"fail","reason":"السبب"}       — تعذّر إتمام المهمة

قواعد مهمة:
- الإحداثيات تناسب صورة عرضها 1280 بكسل
- قبل الكتابة، اضغط على حقل الإدخال المناسب
- إذا رأيت صفحة تحميل، استخدم wait
- لا تفترض — راجع الشاشة بعد كل فعل
- إذا لم تتأكد من الموضع الصحيح، استخدم screenshot أولاً
"""

def ask_ai(img_b64: str, task: str, history: list[str]) -> dict[str, Any]:
    """اسأل الـ AI عن الخطوة التالية."""
    if not GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY غير مضبوط. أضفه في ملف .env")

    history_text = "\n".join(f"  {i+1}. {h}" for i, h in enumerate(history[-8:])) or "  (لا توجد خطوات سابقة)"

    user_content = [
        {
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}
        },
        {
            "type": "text",
            "text": f"المهمة: {task}\n\nالخطوات السابقة:\n{history_text}\n\nما هي الخطوة التالية؟"
        }
    ]

    resp = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
        json={
            "model": VISION_MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": user_content},
            ],
            "max_tokens": 512,
            "temperature": 0.1,
        },
        timeout=30,
    )
    resp.raise_for_status()

    content: str = resp.json()["choices"][0]["message"]["content"].strip()

    # استخرج JSON حتى لو الـ AI أضاف نصاً إضافياً
    start = content.find("{")
    end   = content.rfind("}") + 1
    if start == -1 or end == 0:
        raise ValueError(f"لم يُعِد الـ AI JSON صالحاً:\n{content}")

    return json.loads(content[start:end])

# ── تنفيذ الأفعال ─────────────────────────────────────────────────────────────
def execute(action: dict[str, Any]) -> str:
    """نفّذ الفعل وأعِد وصفاً للسجل."""
    act = action.get("action", "")

    if act == "click":
        x, y = scale_coords(action["x"], action["y"])
        pyautogui.click(x, y)
        return f"نقر على ({action['x']}, {action['y']})"

    elif act == "right_click":
        x, y = scale_coords(action["x"], action["y"])
        pyautogui.rightClick(x, y)
        return f"نقر يمين على ({action['x']}, {action['y']})"

    elif act == "double_click":
        x, y = scale_coords(action["x"], action["y"])
        pyautogui.doubleClick(x, y)
        return f"نقر مزدوج على ({action['x']}, {action['y']})"

    elif act == "type":
        text = action.get("text", "")
        # تأخير صغير بين الحروف للمواقع البطيئة
        pyautogui.typewrite(text, interval=0.04) if text.isascii() else _type_arabic(text)
        return f"كتب: {text[:60]}{'…' if len(text) > 60 else ''}"

    elif act == "key":
        keys = action.get("keys", "")
        pyautogui.hotkey(*keys.split("+"))
        return f"ضغط: {keys}"

    elif act == "scroll":
        x, y = scale_coords(action["x"], action["y"])
        pyautogui.scroll(action.get("amount", 3), x=x, y=y)
        return f"تمرير ({action.get('amount',3)}) في ({action['x']}, {action['y']})"

    elif act == "move":
        x, y = scale_coords(action["x"], action["y"])
        pyautogui.moveTo(x, y, duration=0.3)
        return f"تحريك الماوس إلى ({action['x']}, {action['y']})"

    elif act == "wait":
        secs = float(action.get("seconds", 1.5))
        time.sleep(min(secs, 10))
        return f"انتظر {secs} ثانية"

    elif act == "screenshot":
        return "لقطة شاشة للمراجعة"

    elif act == "done":
        return f"✅ اكتملت المهمة: {action.get('result', '')}"

    elif act == "fail":
        return f"❌ فشلت المهمة: {action.get('reason', '')}"

    else:
        return f"⚠️ فعل غير معروف: {act}"

def _type_arabic(text: str):
    """كتابة النص العربي عبر الحافظة (أسرع وأدق)."""
    import subprocess, platform
    if platform.system() == "Windows":
        import win32clipboard  # type: ignore
        win32clipboard.OpenClipboard()
        win32clipboard.EmptyClipboard()
        win32clipboard.SetClipboardText(text, win32clipboard.CF_UNICODETEXT)
        win32clipboard.CloseClipboard()
    else:
        subprocess.run(["xclip", "-selection", "clipboard"], input=text.encode(), check=False)
    pyautogui.hotkey("ctrl", "v")
    time.sleep(0.1)

# ── حلقة الوكيل الرئيسية ─────────────────────────────────────────────────────
def run_agent(task: str, dry_run: bool = False) -> str:
    """شغّل الوكيل حتى اكتمال المهمة أو الوصول للحد الأقصى."""
    LOG_DIR.mkdir(exist_ok=True)
    log_file = LOG_DIR / f"session_{int(time.time())}.jsonl"

    print(f"\n🤖 الوكيل يبدأ المهمة:\n   {task}\n")
    print("⚠️  لإيقاف الوكيل فوراً: حرّك الماوس للزاوية العلوية اليسرى من الشاشة\n")
    print("─" * 60)

    history: list[str] = []

    for step in range(1, MAX_STEPS + 1):
        # انتظر إذا كان متوقفاً
        while _paused:
            time.sleep(0.5)

        print(f"\n[خطوة {step}/{MAX_STEPS}]", end=" ", flush=True)

        # 1. التقط الشاشة
        img_b64 = screenshot_b64()

        # 2. اسأل الـ AI
        try:
            action = ask_ai(img_b64, task, history)
        except Exception as e:
            print(f"❌ خطأ في الـ AI: {e}")
            time.sleep(3)
            continue

        thought = action.get("thought", "")
        act_name = action.get("action", "?")

        print(f"{act_name.upper()}", end="")
        if thought:
            print(f" — {thought}", end="")
        print()

        # 3. سجّل
        log_entry = {"step": step, "action": action, "timestamp": time.time()}
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(log_entry, ensure_ascii=False) + "\n")

        # 4. تحقق من الانتهاء
        if act_name in ("done", "fail"):
            result = action.get("result") or action.get("reason", "")
            print(f"\n{'✅' if act_name == 'done' else '❌'} {result}")
            print(f"\n📄 السجل: {log_file}")
            return result

        # 5. نفّذ الفعل
        if not dry_run:
            try:
                desc = execute(action)
                history.append(f"{act_name}: {desc}")
            except pyautogui.FailSafeException:
                print("\n🛑 تم إيقاف الوكيل (FailSafe)")
                break
            except Exception as e:
                print(f"  ⚠️ خطأ في التنفيذ: {e}")
                history.append(f"خطأ: {e}")
        else:
            history.append(f"[dry-run] {act_name}")

        # 6. انتظر قليلاً
        time.sleep(STEP_DELAY)

    return "❌ الوكيل وصل للحد الأقصى من الخطوات"

# ── وضع إدخال النقاط (Ministry integration) ──────────────────────────────────
def fetch_grades_task() -> str:
    """اجلب النقاط من سيرفر Replit وأنشئ مهمة إدخالها."""
    if not REPLIT_API_URL:
        print("⚠️  REPLIT_API_URL غير مضبوط. استخدم --task لتحديد المهمة يدوياً.")
        return ""

    print(f"📡 جلب البيانات من {REPLIT_API_URL}…")
    try:
        sess = requests.Session()
        if REPLIT_COOKIE:
            sess.cookies.set("connect.sid", REPLIT_COOKIE)

        # جلب الأقسام
        r = sess.get(f"{REPLIT_API_URL}/api/timetable/classes", timeout=10)
        classes = r.json() if r.ok else []

        # جلب نتائج أول قسم كمثال
        if not classes:
            return "لا يوجد أقسام في قاعدة البيانات"

        cls = classes[0]
        r2 = sess.get(f"{REPLIT_API_URL}/api/results?classe={cls}", timeout=10)
        results = r2.json() if r2.ok else []

        lines = [f"ادخل نقاط الفصل 1 للقسم {cls} على موقع الوزارة:"]
        for row in results[:30]:  # أول 30 تلميذ
            name = row.get("student", {}).get("nomPrenom", "")
            avg  = row.get("t1Avg") or row.get("annualAvg") or ""
            if name and avg:
                lines.append(f"  - {name}: {avg}")

        return "\n".join(lines)
    except Exception as e:
        return f"خطأ في جلب البيانات: {e}"

# ── الواجهة الرئيسية ──────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="وكيل سطح المكتب — CEM Desktop Agent")
    parser.add_argument("--task",    type=str, help="المهمة المطلوبة")
    parser.add_argument("--grades",  action="store_true", help="وضع إدخال النقاط على موقع الوزارة")
    parser.add_argument("--dry-run", action="store_true", help="عرض الخطوات بدون تنفيذ فعلي")
    parser.add_argument("--steps",   type=int, default=MAX_STEPS, help=f"أقصى خطوات (افتراضي {MAX_STEPS})")
    args = parser.parse_args()

    global MAX_STEPS
    MAX_STEPS = args.steps

    # اختر المهمة
    if args.grades:
        task = fetch_grades_task()
        if not task:
            task = input("اكتب المهمة يدوياً: ").strip()
    elif args.task:
        task = args.task
    else:
        print("\n" + "═" * 60)
        print("         🤖  وكيل سطح المكتب — CEM Agent")
        print("═" * 60)
        print("أمثلة:")
        print("  • افتح جوجل وابحث عن نتائج شهادة التعليم المتوسط 2026")
        print("  • ادخل على موقع الوزارة وسجّل الدخول بالمعرّف ... والرمز ...")
        print("  • افتح Excel وأنشئ جدول درجات الفصل الأول")
        print()
        task = input("اكتب المهمة: ").strip()
        if not task:
            print("❌ لم تكتب مهمة.")
            sys.exit(1)

    if not GROQ_API_KEY:
        print("\n❌ GROQ_API_KEY غير مضبوط!")
        print("   أنشئ ملف .env وأضف:")
        print("   GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxx")
        print("\n   احصل على مفتاح مجاني من: https://console.groq.com\n")
        sys.exit(1)

    run_agent(task, dry_run=args.dry_run)

if __name__ == "__main__":
    main()
