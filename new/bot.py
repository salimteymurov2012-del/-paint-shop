import asyncio
import time
import requests
import sqlite3

from aiogram import Bot, Dispatcher, F
from aiogram.types import Message, ReplyKeyboardMarkup, KeyboardButton
from aiogram.filters import Command

# ======================
# TOKENS
# ======================
BOT_TOKEN = "8810565116:AAEWEZJ4rwqxTlwz1GsiIaMogGyq49zeCSo"
GROQ_API_KEY = "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"

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

# ======================
# DB
# ======================
conn = sqlite3.connect("users.db")
cur = conn.cursor()

cur.execute("""
CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY,
    requests_used INTEGER DEFAULT 0
)
""")
conn.commit()

MAX_LIMIT = 45

# ======================
# MEMORY
# ======================
user_platform = {}
user_waiting = set()

# ======================
# KEYBOARDS
# ======================
menu_kb = ReplyKeyboardMarkup(
    keyboard=[
        [KeyboardButton(text="🎬 Создать контент")],
        [KeyboardButton(text="📊 Проверить сценарий")],
        [KeyboardButton(text="📅 Контент-план")],
        [KeyboardButton(text="#️⃣ Хештеги")],
        [KeyboardButton(text="📈 Анализ ниши")]
    ],
    resize_keyboard=True
)

platform_kb = ReplyKeyboardMarkup(
    keyboard=[
        [KeyboardButton(text="📺 YouTube")],
        [KeyboardButton(text="🎵 TikTok")],
        [KeyboardButton(text="📢 Telegram")],
        [KeyboardButton(text="🎮 Twitch")],
        [KeyboardButton(text="🐦 Twitter (X)")],
        [KeyboardButton(text="📸 Instagram")],
        [KeyboardButton(text="📘 Facebook")],
        [KeyboardButton(text="⬅️ Назад в меню")]
    ],
    resize_keyboard=True
)

# ======================
# DB FUNCS
# ======================
def get_user(uid):
    cur.execute("SELECT * FROM users WHERE user_id=?", (uid,))
    row = cur.fetchone()

    if not row:
        cur.execute("INSERT INTO users (user_id, requests_used) VALUES (?,0)", (uid,))
        conn.commit()
        return (uid, 0)

    return row


def add_request(uid):
    user = get_user(uid)
    new = user[1] + 1

    cur.execute("UPDATE users SET requests_used=? WHERE user_id=?", (new, uid))
    conn.commit()
    return new


def check_limit(uid):
    return get_user(uid)[1] < MAX_LIMIT

# ======================
# AI
# ======================
def ask_ai(prompt):
    r = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        },
        json={
            "model": "llama-3.1-8b-instant",
            "messages": [
                {"role": "system", "content": "Ты эксперт вирусного контента."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.9
        },
        timeout=30
    )
    return r.json()["choices"][0]["message"]["content"]

# ======================
# START
# ======================
@dp.message(Command("start"))
async def start(message: Message):
    get_user(message.from_user.id)
    await message.answer("🔥 Content AI V6.1", reply_markup=menu_kb)

# ======================
# MENU BUTTONS (ВАЖНО: ОТДЕЛЬНЫЕ HANDLER'Ы)
# ======================
@dp.message(F.text == "🎬 Создать контент")
async def create(message: Message):
    await message.answer("📱 Выбери платформу:", reply_markup=platform_kb)


@dp.message(F.text == "⬅️ Назад в меню")
async def back(message: Message):
    await message.answer("🏠 Меню:", reply_markup=menu_kb)


@dp.message(F.text.in_(["📊 Проверить сценарий"]))
async def scenario(message: Message):
    user_waiting.add(message.from_user.id)
    user_platform[message.from_user.id] = "scenario"
    await message.answer("✍️ Отправь сценарий")


@dp.message(F.text.in_(["📅 Контент-план"]))
async def plan(message: Message):
    user_waiting.add(message.from_user.id)
    user_platform[message.from_user.id] = "plan"
    await message.answer("✍️ Отправь тему для плана")


@dp.message(F.text.in_(["#️⃣ Хештеги"]))
async def tags(message: Message):
    user_waiting.add(message.from_user.id)
    user_platform[message.from_user.id] = "tags"
    await message.answer("✍️ Отправь тему видео")


@dp.message(F.text.in_(["📈 Анализ ниши"]))
async def niche(message: Message):
    user_waiting.add(message.from_user.id)
    user_platform[message.from_user.id] = "niche"
    await message.answer("✍️ Отправь нишу")

# ======================
# PLATFORM SELECT
# ======================
@dp.message(F.text.in_([
    "📺 YouTube", "🎵 TikTok", "📢 Telegram",
    "🎮 Twitch", "🐦 Twitter (X)",
    "📸 Instagram", "📘 Facebook"
]))
async def platform(message: Message):
    user_platform[message.from_user.id] = message.text
    user_waiting.add(message.from_user.id)
    await message.answer("✍️ Теперь напиши идею")

# ======================
# PROMPTS
# ======================
def build_prompt(uid, text):
    mode = user_platform.get(uid, "TikTok")

    if mode in ["📺 YouTube","🎵 TikTok","📢 Telegram","🎮 Twitch","🐦 Twitter (X)","📸 Instagram","📘 Facebook"]:
        return f"""
Платформа: {mode}

Идея: {text}

Сделай:
- сценарий
- хук
- монтаж
- удержание
- хештеги
- viral score
"""

    if mode == "scenario":
        return f"Проверь сценарий: {text}"

    if mode == "plan":
        return f"Контент-план на 7 дней: {text}"

    if mode == "tags":
        return f"Хештеги: {text}"

    if mode == "niche":
        return f"Анализ ниши: {text}"

    return text

# ======================
# MAIN FIXED HANDLER
# ======================
@dp.message()
async def handler(message: Message):
    uid = message.from_user.id
    text = message.text

    # ignore buttons
    if text in [
        "🎬 Создать контент","⬅️ Назад в меню","📊 Проверить сценарий",
        "📅 Контент-план","#️⃣ Хештеги","📈 Анализ ниши",
        "📺 YouTube","🎵 TikTok","📢 Telegram",
        "🎮 Twitch","🐦 Twitter (X)","📸 Instagram","📘 Facebook"
    ]:
        return

    if uid not in user_waiting:
        return

    if not check_limit(uid):
        await message.answer("❌ Лимит 45 исчерпан")
        return

    count = add_request(uid)

    await message.answer(f"⏳ Генерация... ({count}/45)")

    prompt = build_prompt(uid, text)

    try:
        result = ask_ai(prompt)
        await message.answer(result)
    except Exception as e:
        await message.answer("⚠️ Ошибка AI")
        print(e)

    user_waiting.remove(uid)

# ======================
# RUN
# ======================
async def main():
    print("🚀 V6.1 FIXED RUNNING")
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())