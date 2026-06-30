"""
🎭 АНОНИМКА — Анонимный чат-бот для Telegram
Профили, рейтинги, баны, жалобы, прослушка, валентинки, админ-панель
+ анонимка дня, темы дня, опросы, горячие сообщения, онлайн-эффект
+ выбор режима поиска: текстовый / голосовой
+ выбор района: Бузовна / Бильгя / 26 школа / Рандом
"""

import asyncio
import json
import os
import logging
import random
from datetime import datetime, timedelta

from aiogram import Bot, Dispatcher, F
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.enums import ContentType
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage

TOKEN = os.getenv("BOT_TOKEN", "8737864078:AAHWq7Djpg2wjTFMoCOsj25ZLNsMtjQbSeI")
ADMIN_ID = int(os.getenv("ADMIN_ID", "8550437617"))
DATA_FILE = "data.json"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(levelname)-7s │ %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("anon")

bot = Bot(token=TOKEN)
storage = MemoryStorage()
dp = Dispatcher(storage=storage)


class ProfileStates(StatesGroup):
    waiting_for_desc = State()


class ValentineStates(StatesGroup):
    waiting_for_username = State()
    waiting_for_message = State()


class DailyStates(StatesGroup):
    waiting_for_answer = State()


class AdminCreateStates(StatesGroup):
    waiting_custom_daily = State()
    waiting_custom_topic = State()
    waiting_custom_poll = State()


waiting_users: list[int] = []
waiting_filters: dict[int, dict] = {}
active_chats: dict[int, int] = {}
chat_modes: dict[int, str] = {}

admin_state: dict[int, int] = {}
admin_direct: dict[int, int] = {}
banned_users: set[int] = set()
known_users: set[int] = set()
users_db: dict[str, dict] = {}

stats = {
    "total_messages": 0,
    "total_sessions": 0,
    "total_valentines": 0,
    "daily_answers": 0,
    "hot_likes": 0,
}

daily_data = {
    "current_question": "",
    "current_topic": "",
    "question_date": "",
    "topic_date": "",
    "poll_date": "",
    "hot_date": "",
    "online_ping_at": "",
}

hot_messages: list[dict] = []
admin_mode: bool = True

DAILY_QUESTIONS = [
    "Кому из школы ты хотел бы написать анонимно?",
    "Кто тебе тайно нравится?",
    "Кого ты сегодня заметил, но сделал вид, что нет?",
    "Что ты хочешь сказать одному человеку, но боишься?",
    "Кто в последнее время стал тебе интересен?",
    "Какой слух ты слышал, но не знаешь правда ли это?",
    "Что произошло сегодня, о чём хочется рассказать?",
    "Кого ты считаешь самым загадочным человеком?",
    "Кто сегодня выглядел лучше всех?",
    "С кем ты хотел бы начать общаться?",
    "Кто тебя приятно удивил?",
    "Какое признание ты бы сделал, если бы никто не узнал?",
]

DAILY_TOPICS = [
    "признания",
    "симпатии",
    "странные мысли",
    "неловкие истории",
    "секреты",
    "драмы",
    "честные мнения",
    "слухи без имён",
    "добрые слова",
    "вопросы, которые стыдно задать",
]

AUTO_POLLS = [
    ("Сегодня будет активный вечер?", ["Да", "Нет", "Посмотрим"]),
    ("Что интереснее в анонимке?", ["Признания", "Опросы", "Драмы"]),
    ("Нужны более смелые вопросы дня?", ["Да", "Нет", "Иногда"]),
    ("Ты бы ответил на анонимку дня?", ["Да", "Нет", "Если тема норм"]),
    ("Какой формат чаще делать?", ["Вопрос дня", "Тема дня", "Топ анонимок"]),
]


def data_path() -> str:
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), DATA_FILE)


def now_dt() -> datetime:
    return datetime.now()


def today_key() -> str:
    return now_dt().strftime("%Y-%m-%d")


def save_data():
    payload = {
        "banned": list(banned_users),
        "known_users": list(known_users),
        "stats": stats,
        "users_db": users_db,
        "daily_data": daily_data,
        "hot_messages": hot_messages,
    }
    try:
        with open(data_path(), "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
    except Exception as e:
        log.error("Ошибка сохранения данных: %s", e)


def load_data():
    global stats, users_db, daily_data, hot_messages
    path = data_path()
    if not os.path.exists(path):
        return
    try:
        with open(path, "r", encoding="utf-8") as f:
            payload = json.load(f)

        banned_users.update(payload.get("banned", []))
        known_users.update(payload.get("known_users", []))
        stats.update(payload.get("stats", {}))
        users_db = payload.get("users_db", {})
        daily_data.update(payload.get("daily_data", {}))
        hot_messages = payload.get("hot_messages", [])

        log.info("Загружено: %d банов, %d профилей", len(banned_users), len(users_db))
    except Exception as e:
        log.error("Ошибка загрузки данных: %s", e)


def ensure_user(uid: int, username: str | None = None) -> dict:
    key = str(uid)
    if key not in users_db:
        users_db[key] = {
            "desc": "Описание не заполнено.",
            "username": "",
            "rating_sum": 0,
            "rating_count": 0,
            "last_seen": "",
            "daily_streak": 0,
            "last_daily_answer": "",
        }

    if username:
        users_db[key]["username"] = username.lstrip("@").lower()

    users_db[key]["last_seen"] = now_dt().isoformat(timespec="seconds")
    return users_db[key]


def touch_user(uid: int, username: str | None = None):
    ensure_user(uid, username)


def get_rating(uid: int) -> float:
    user_data = users_db.get(str(uid), {})
    r_sum = user_data.get("rating_sum", 0)
    r_count = user_data.get("rating_count", 0)
    if r_count == 0:
        return 5.0
    return round(r_sum / r_count, 1)


def find_user_by_username(username: str) -> int | None:
    username = username.lstrip("@").lower().strip()
    if not username:
        return None

    for uid_str, data in users_db.items():
        if data.get("username", "").lower() == username:
            return int(uid_str)

    return None


def user_label(uid: int) -> str:
    data = users_db.get(str(uid), {})
    username = data.get("username")
    if username:
        return f"@{username}"
    return f"ID: {uid}"


def user_label_with_id(uid: int) -> str:
    data = users_db.get(str(uid), {})
    username = data.get("username")
    if username:
        return f"@{username} ({uid})"
    return str(uid)


def get_active_pairs() -> list[tuple[int, int]]:
    seen: set[tuple[int, int]] = set()
    pairs: list[tuple[int, int]] = []

    for uid, partner in active_chats.items():
        if uid == ADMIN_ID or partner == ADMIN_ID:
            continue

        pair = (min(uid, partner), max(uid, partner))
        if pair not in seen:
            seen.add(pair)
            pairs.append(pair)

    return pairs


def online_effect_text() -> str:
    cutoff = now_dt() - timedelta(minutes=15)
    active_count = 0
    last_seen_dt = None

    for uid_str, data in users_db.items():
        if int(uid_str) in banned_users:
            continue

        raw = data.get("last_seen")
        if not raw:
            continue

        try:
            seen = datetime.fromisoformat(raw)
        except ValueError:
            continue

        if seen >= cutoff:
            active_count += 1

        if last_seen_dt is None or seen > last_seen_dt:
            last_seen_dt = seen

    if active_count <= 0:
        active_text = "сейчас тихо"
    elif active_count == 1:
        active_text = "примерно 1 человек"
    elif active_count <= 3:
        active_text = "примерно 2-3 человека"
    elif active_count <= 6:
        active_text = "примерно 4-6 человек"
    else:
        active_text = "больше 6 человек"

    if not last_seen_dt:
        last_text = "активности пока не было"
    else:
        diff = int((now_dt() - last_seen_dt).total_seconds() // 60)
        if diff <= 1:
            last_text = "только что"
        elif diff < 60:
            last_text = f"{diff} мин назад"
        else:
            last_text = "больше часа назад"

    return (
        f"👀 <b>Онлайн-эффект</b>\n\n"
        f"🟢 Сейчас: <b>{active_text}</b>\n"
        f"🕒 Последняя активность: <b>{last_text}</b>"
    )


def region_label(region: str) -> str:
    labels = {
        "buzovna": "🏡 Бузовна",
        "bilgah": "🌆 Бильгя",
        "school26": "🏫 26 школа",
        "random": "🎲 Рандом",
    }
    return labels.get(region, "🎲 Рандом")


def mode_label(mode: str) -> str:
    labels = {
        "text": "💬 Текстовый чат",
        "voice": "🎤 Голосовой чат",
    }
    return labels.get(mode, "💬 Текстовый чат")


def is_region_match(region1: str, region2: str) -> bool:
    if region1 == "random" or region2 == "random":
        return True
    return region1 == region2


def is_mode_match(mode1: str, mode2: str) -> bool:
    return mode1 == mode2


def get_user_waiting_filter(uid: int) -> dict:
    return waiting_filters.get(uid, {"mode": "text", "region": "random"})


def get_chat_mode(uid: int) -> str:
    return chat_modes.get(uid, "text")


def is_voice_allowed_content(msg: Message) -> bool:
    return msg.content_type in {
        ContentType.VOICE,
        ContentType.VIDEO_NOTE,
        ContentType.AUDIO,
    }


# ─────────────────────────── КЛАВИАТУРЫ ──────────────────────────

def main_menu(is_admin: bool = False) -> InlineKeyboardMarkup:
    rows = [
        [InlineKeyboardButton(text="🎭 Анонимка дня", callback_data="daily")],
        [
            InlineKeyboardButton(text="🔥 Горячее", callback_data="hot"),
            InlineKeyboardButton(text="👀 Онлайн", callback_data="online_effect"),
        ],
        [InlineKeyboardButton(text="🔍 Найти собеседника", callback_data="find")],
        [InlineKeyboardButton(text="💌 Валентинка", callback_data="valentine")],
        [InlineKeyboardButton(text="👤 Мой профиль", callback_data="my_profile")],
        [InlineKeyboardButton(text="📜 Правила", callback_data="rules")],
    ]

    if is_admin:
        rows.append([InlineKeyboardButton(text="🛡️ Админ-панель", callback_data="to_admin")])

    return InlineKeyboardMarkup(inline_keyboard=rows)


def daily_menu() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="✍️ Ответить анонимно", callback_data="answer_daily")],
        [
            InlineKeyboardButton(text="🔥 Топ дня", callback_data="hot"),
            InlineKeyboardButton(text="📊 Опрос", callback_data="quick_poll"),
        ],
        [InlineKeyboardButton(text="🔙 Назад", callback_data="back_to_menu")],
    ])


def hot_message_menu(hot_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🔥 Поддержать", callback_data=f"hot_like_{hot_id}")],
    ])


def chat_menu() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="⏭ Следующий", callback_data="next"),
            InlineKeyboardButton(text="🚪 Выйти", callback_data="leave"),
        ],
        [InlineKeyboardButton(text="⚠️ Пожаловаться", callback_data="report")],
    ])


def search_menu() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="❌ Отменить поиск", callback_data="cancel_search")],
    ])


def search_mode_menu() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="💬 Текстовый чат", callback_data="find_mode_text")],
        [InlineKeyboardButton(text="🎤 Голосовой чат", callback_data="find_mode_voice")],
        [InlineKeyboardButton(text="🔙 Назад", callback_data="back_to_menu")],
    ])


def search_region_menu(mode: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🏡 Бузовна", callback_data=f"find_region_{mode}_buzovna")],
        [InlineKeyboardButton(text="🌆 Бильгя", callback_data=f"find_region_{mode}_bilgah")],
        [InlineKeyboardButton(text="🏫 26 школа", callback_data=f"find_region_{mode}_school26")],
        [InlineKeyboardButton(text="🎲 Рандом", callback_data=f"find_region_{mode}_random")],
        [InlineKeyboardButton(text="🔙 Назад", callback_data="find")],
    ])


def cancel_menu() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="❌ Отмена", callback_data="back_to_menu")],
    ])


def admin_menu() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📊 Статистика", callback_data="admin_stats")],
        [InlineKeyboardButton(text="💬 Активные чаты", callback_data="admin_chats")],
        [InlineKeyboardButton(text="📋 Онлайн", callback_data="admin_online")],

        [InlineKeyboardButton(text="🎭 Авто анонимка дня", callback_data="admin_daily_now")],
        [InlineKeyboardButton(text="✍️ Своя анонимка дня", callback_data="admin_custom_daily")],

        [InlineKeyboardButton(text="🗓 Авто тема дня", callback_data="admin_topic_now")],
        [InlineKeyboardButton(text="📝 Своя тема дня", callback_data="admin_custom_topic")],

        [InlineKeyboardButton(text="📊 Авто опрос", callback_data="admin_poll_now")],
        [InlineKeyboardButton(text="🗳 Свой опрос", callback_data="admin_custom_poll")],

        [InlineKeyboardButton(text="🔥 Топ дня", callback_data="admin_hot_now")],
        [InlineKeyboardButton(text="👤 Режим участника", callback_data="to_user")],
    ])


def admin_chats_keyboard() -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = []

    for uid_a, uid_b in get_active_pairs():
        rows.append([
            InlineKeyboardButton(text=f"🎧 {user_label(uid_a)}", callback_data=f"adm_listen_{uid_a}"),
            InlineKeyboardButton(text=f"💬 {user_label(uid_a)}", callback_data=f"adm_chat_{uid_a}"),
        ])
        rows.append([
            InlineKeyboardButton(text=f"🎧 {user_label(uid_b)}", callback_data=f"adm_listen_{uid_b}"),
            InlineKeyboardButton(text=f"💬 {user_label(uid_b)}", callback_data=f"adm_chat_{uid_b}"),
        ])

    for uid in waiting_users:
        rows.append([
            InlineKeyboardButton(text=f"💬 Очередь: {user_label(uid)}", callback_data=f"adm_chat_{uid}"),
        ])

    if ADMIN_ID in admin_direct:
        rows.append([InlineKeyboardButton(text="🚪 Выйти из прямого чата", callback_data="adm_leave_direct")])
    elif ADMIN_ID in admin_state:
        rows.append([InlineKeyboardButton(text="🚪 Выйти из прослушки", callback_data="adm_leave_listen")])

    rows.append([InlineKeyboardButton(text="🔄 Обновить", callback_data="admin_chats")])
    rows.append([InlineKeyboardButton(text="🔙 Назад", callback_data="admin_back")])

    return InlineKeyboardMarkup(inline_keyboard=rows or [
        [InlineKeyboardButton(text="🔙 Назад", callback_data="admin_back")],
    ])


def rating_menu(partner_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="1 ⭐", callback_data=f"rate_{partner_id}_1"),
            InlineKeyboardButton(text="2 ⭐", callback_data=f"rate_{partner_id}_2"),
            InlineKeyboardButton(text="3 ⭐", callback_data=f"rate_{partner_id}_3"),
            InlineKeyboardButton(text="4 ⭐", callback_data=f"rate_{partner_id}_4"),
            InlineKeyboardButton(text="5 ⭐", callback_data=f"rate_{partner_id}_5"),
        ]
    ])


WELCOME = (
    "🏫🇦🇿 <b>АНОНИМКИ ШКОЛЫ №26 И БУЗОВНЫ</b>\n\n"
    "📫 @anonka26schoolaz\n\n"
    "💬 Место для общения учеников школы №26 и жителей Бузовны.\n\n"
    "🎭 Каждый день — новая анонимка дня\n"
    "🔥 Самые активные ответы попадают в топ\n"
    "📊 Иногда бот сам запускает опросы\n\n"
    "👇 Выбери действие в меню ниже"
)

RULES_TEXT = (
    "📜 <b>Правила АНОНИМКИ</b>\n\n"
    "😊 Уважай собеседника\n"
    "🚫 Без оскорблений и спама\n"
    "🔞 Без NSFW-контента\n"
    "🤝 Общайся по-человечески\n\n"
    "⚠️ За нарушения — <b>бан</b>"
)

ADMIN_WELCOME = (
    "🛡️ <b>Админ-панель</b>\n\n"
    "/stats — статистика\n"
    "/ban ID — забанить\n"
    "/unban ID — разбанить\n"
    "/broadcast ТЕКСТ — рассылка\n"
    "/send ID ТЕКСТ — личное сообщение по ID\n"
    "/daily — выпустить анонимку дня сейчас\n"
    "/topic — выпустить тему дня сейчас\n"
    "/poll — выпустить опрос сейчас\n"
    "/hot — топ-3 анонимки дня\n"
    "/online — онлайн-эффект\n\n"
    "<b>Чаты:</b>\n"
    "Кнопка <b>«Активные чаты»</b> — войти в чат или прослушку\n"
    "/chat ID — прямой чат\n"
    "/leave — выйти из чата или прослушки\n"
    "<code>join ID</code> — прослушка (текстом)\n"
    "<code>leave</code> — выйти из прослушки"
)


async def safe_send(uid: int, text: str, reply_markup=None, parse_mode="HTML") -> bool:
    if uid in banned_users:
        return False

    try:
        await bot.send_message(uid, text, reply_markup=reply_markup, parse_mode=parse_mode)
        return True
    except Exception:
        return False


async def broadcast_activity(text: str, reply_markup=None):
    sent = 0

    for uid in list(known_users):
        if uid == ADMIN_ID or uid in banned_users:
            continue

        ok = await safe_send(uid, text, reply_markup=reply_markup)

        if ok:
            sent += 1

        await asyncio.sleep(0.04)

    return sent


async def publish_daily_question(force: bool = False):
    day = today_key()

    if not force and daily_data.get("question_date") == day:
        return

    question = random.choice(DAILY_QUESTIONS)
    daily_data["current_question"] = question
    daily_data["question_date"] = day
    save_data()

    text = (
        "🎭 <b>Анонимка дня</b>\n\n"
        f"{question}\n\n"
        "Ответы будут опубликованы анонимно. Лучшие попадут в топ дня 🔥"
    )

    await broadcast_activity(text, reply_markup=daily_menu())
    await log_to_admin(f"🎭 Выпущена анонимка дня: {question}")


async def publish_daily_topic(force: bool = False):
    day = today_key()

    if not force and daily_data.get("topic_date") == day:
        return

    topic = random.choice(DAILY_TOPICS)
    daily_data["current_topic"] = topic
    daily_data["topic_date"] = day
    save_data()

    text = (
        "🗓 <b>Тема дня</b>\n\n"
        f"Сегодня обсуждаем: <b>{topic}</b>\n\n"
        "Можно ответить через кнопку «Анонимка дня»."
    )

    await broadcast_activity(text, reply_markup=daily_menu())
    await log_to_admin(f"🗓 Выпущена тема дня: {topic}")


async def publish_auto_poll(force: bool = False):
    day = today_key()

    if not force and daily_data.get("poll_date") == day:
        return

    question, options = random.choice(AUTO_POLLS)
    daily_data["poll_date"] = day
    save_data()

    for uid in list(known_users):
        if uid == ADMIN_ID or uid in banned_users:
            continue

        try:
            await bot.send_poll(
                chat_id=uid,
                question=f"📊 {question}",
                options=options,
                is_anonymous=True,
            )
        except Exception:
            pass

        await asyncio.sleep(0.04)

    await log_to_admin(f"📊 Выпущен автоопрос: {question}")


def get_today_hot_messages() -> list[dict]:
    day = today_key()
    return [m for m in hot_messages if m.get("date") == day]


def hot_top_text() -> str:
    today = get_today_hot_messages()
    today.sort(key=lambda x: (x.get("likes", 0), x.get("created_at", "")), reverse=True)

    if not today:
        return (
            "🔥 <b>Горячие анонимки дня</b>\n\n"
            "Пока нет ответов. Будь первым — нажми «Анонимка дня» и ответь."
        )

    text = "🔥 <b>Топ-3 анонимки дня</b>\n\n"

    for i, item in enumerate(today[:3], start=1):
        body = item.get("text", "")

        if len(body) > 220:
            body = body[:220] + "..."

        text += f"{i}. {body}\n🔥 {item.get('likes', 0)}\n\n"

    return text.strip()


async def publish_hot_top(force: bool = False):
    day = today_key()

    if not force and daily_data.get("hot_date") == day:
        return

    daily_data["hot_date"] = day
    save_data()

    await broadcast_activity(hot_top_text(), reply_markup=daily_menu())


async def publish_online_ping(force: bool = False):
    current_hour = now_dt().strftime("%Y-%m-%d %H")

    if not force and daily_data.get("online_ping_at") == current_hour:
        return

    daily_data["online_ping_at"] = current_hour
    save_data()

    text = (
        f"{online_effect_text()}\n\n"
        "Зайди ответить на анонимку дня или найти собеседника 👇"
    )

    await broadcast_activity(text, reply_markup=main_menu())


async def daily_activity_loop():
    while True:
        try:
            current = now_dt()
            hour = current.hour

            if hour >= 12:
                await publish_daily_question()

            if hour >= 15:
                await publish_auto_poll()

            if hour >= 18:
                await publish_daily_topic()

            if hour >= 22:
                await publish_hot_top()

            if hour in (13, 17, 20):
                await publish_online_ping()

        except Exception as e:
            log.error("Ошибка daily_activity_loop: %s", e)

        await asyncio.sleep(60)


async def disconnect_pair(uid: int, notify_self=True, notify_partner=True):
    partner = active_chats.pop(uid, None)
    chat_modes.pop(uid, None)

    if partner is not None:
        active_chats.pop(partner, None)
        chat_modes.pop(partner, None)

    for admin_id, target in list(admin_direct.items()):
        if target == uid or target == partner:
            admin_direct.pop(admin_id, None)
            try:
                await bot.send_message(admin_id, "🚪 Прямой чат завершён (юзер вышел).", parse_mode="HTML")
            except Exception:
                pass

    if notify_self:
        if partner and partner != ADMIN_ID:
            await bot.send_message(
                uid,
                "🚪 Ты вышел из чата.\n\n⭐️ <b>Пожалуйста, оцени собеседника:</b>",
                reply_markup=rating_menu(partner),
                parse_mode="HTML",
            )
        else:
            await bot.send_message(uid, "🚪 Ты вышел из чата.", reply_markup=main_menu(), parse_mode="HTML")

    if partner and notify_partner and partner != ADMIN_ID:
        if uid != ADMIN_ID:
            await bot.send_message(
                partner,
                "🚪 Собеседник покинул чат.\n\n⭐️ <b>Пожалуйста, оцени собеседника:</b>",
                reply_markup=rating_menu(uid),
                parse_mode="HTML",
            )
        else:
            await bot.send_message(partner, "🚪 Собеседник покинул чат.", reply_markup=main_menu(), parse_mode="HTML")

    return partner


async def log_to_admin(text: str):
    try:
        await bot.send_message(ADMIN_ID, f"👁 {text}", parse_mode="HTML")
    except Exception:
        pass


def replace_ids_with_usernames(text: str) -> str:
    import re

    def replace_match(match):
        uid = int(match.group(1))
        label = user_label(uid)
        return f"{label} (<code>{uid}</code>)"

    return re.sub(r'<code>(\d+)</code>', replace_match, text)


async def forward_media(msg: Message, to_id: int):
    ct = msg.content_type

    try:
        if ct == ContentType.TEXT:
            await bot.send_message(to_id, f"👤 {msg.text}")

        elif ct == ContentType.PHOTO:
            caption = f"👤 {msg.caption}" if msg.caption else None
            await bot.send_photo(to_id, msg.photo[-1].file_id, caption=caption)

        elif ct == ContentType.STICKER:
            await bot.send_sticker(to_id, msg.sticker.file_id)

        elif ct == ContentType.VOICE:
            await bot.send_voice(to_id, msg.voice.file_id)

        elif ct == ContentType.VIDEO:
            caption = f"👤 {msg.caption}" if msg.caption else None
            await bot.send_video(to_id, msg.video.file_id, caption=caption)

        elif ct == ContentType.VIDEO_NOTE:
            await bot.send_video_note(to_id, msg.video_note.file_id)

        elif ct == ContentType.ANIMATION:
            caption = f"👤 {msg.caption}" if msg.caption else None
            await bot.send_animation(to_id, msg.animation.file_id, caption=caption)

        elif ct == ContentType.DOCUMENT:
            caption = f"👤 {msg.caption}" if msg.caption else None
            await bot.send_document(to_id, msg.document.file_id, caption=caption)

        elif ct == ContentType.AUDIO:
            caption = f"👤 {msg.caption}" if msg.caption else None
            await bot.send_audio(to_id, msg.audio.file_id, caption=caption)

        elif ct == ContentType.LOCATION:
            await bot.send_location(to_id, msg.location.latitude, msg.location.longitude)

        elif ct == ContentType.CONTACT:
            await bot.send_contact(to_id, msg.contact.phone_number, msg.contact.first_name)

        else:
            await bot.send_message(to_id, "👤 [неподдерживаемый формат]")

    except Exception as e:
        log.error("Ошибка пересылки медиа: %s", e)


async def connect_users(uid: int, partner: int, mode: str):
    active_chats[uid] = partner
    active_chats[partner] = uid

    chat_modes[uid] = mode
    chat_modes[partner] = mode

    waiting_filters.pop(uid, None)
    waiting_filters.pop(partner, None)

    stats["total_sessions"] += 1
    save_data()

    my_desc = users_db.get(str(uid), {}).get("desc", "Нет описания.")
    my_rating = get_rating(uid)

    partner_desc = users_db.get(str(partner), {}).get("desc", "Нет описания.")
    partner_rating = get_rating(partner)

    if mode == "voice":
        mode_text = (
            "🎤 <b>Режим: Голосовой чат</b>\n"
            "Отправляйте голосовые сообщения, кружки или audio.\n"
            "✍️ Обычный текст в этом режиме ограничен."
        )
    else:
        mode_text = "💬 <b>Режим: Текстовый чат</b>"

    await bot.send_message(
        uid,
        f"💬 <b>Собеседник найден!</b>\n\n"
        f"{mode_text}\n\n"
        f"📝 <b>О себе:</b> {partner_desc}\n"
        f"⭐ <b>Рейтинг:</b> {partner_rating}/5.0\n\n"
        f"Напиши что-нибудь 👇",
        reply_markup=chat_menu(),
        parse_mode="HTML",
    )

    await bot.send_message(
        partner,
        f"💬 <b>Собеседник найден!</b>\n\n"
        f"{mode_text}\n\n"
        f"📝 <b>О себе:</b> {my_desc}\n"
        f"⭐ <b>Рейтинг:</b> {my_rating}/5.0\n\n"
        f"Напиши что-нибудь 👇",
        reply_markup=chat_menu(),
        parse_mode="HTML",
    )

    log.info("Соединены: %s ↔ %s [%s]", uid, partner, mode)


def find_partner_from_queue(uid: int, mode: str = "text", region: str = "random") -> int | None:
    for candidate in waiting_users[:]:
        if candidate == uid:
            continue

        if candidate in banned_users:
            waiting_users.remove(candidate)
            waiting_filters.pop(candidate, None)
            continue

        candidate_filter = get_user_waiting_filter(candidate)
        candidate_mode = candidate_filter.get("mode", "text")
        candidate_region = candidate_filter.get("region", "random")

        if is_mode_match(mode, candidate_mode) and is_region_match(region, candidate_region):
            waiting_users.remove(candidate)
            waiting_filters.pop(candidate, None)
            return candidate

    return None


async def admin_start_listen(target: int) -> str:
    if target not in active_chats:
        return "❌ Этот пользователь сейчас не в чате."

    if ADMIN_ID in admin_direct:
        return "❌ Сначала выйди из прямого чата: /leave"

    admin_state[ADMIN_ID] = target
    partner = active_chats.get(target)
    mode = get_chat_mode(target)

    return (
        f"🎧 Подключен к прослушке.\n"
        f"Юзер: {user_label_with_id(target)}\n"
        f"Собеседник: {user_label_with_id(partner) if partner else '—'}\n"
        f"Режим: {mode_label(mode)}\n\n"
        f"Пиши сообщения — они уйдут обоим как «🔮 Аноним».\n"
        f"Для выхода: /leave или кнопка в меню чатов."
    )


async def admin_start_direct_chat(target: int) -> str:
    if target == ADMIN_ID:
        return "❌ Нельзя подключиться к самому себе."

    if ADMIN_ID in admin_state:
        admin_state.pop(ADMIN_ID, None)

    if target in active_chats:
        old_partner = active_chats.pop(target)
        active_chats.pop(old_partner, None)
        chat_modes.pop(target, None)
        chat_modes.pop(old_partner, None)

        try:
            await bot.send_message(
                old_partner,
                "🚪 Собеседник покинул чат.",
                reply_markup=main_menu(),
                parse_mode="HTML",
            )
        except Exception:
            pass

    if target in waiting_users:
        waiting_users.remove(target)
    waiting_filters.pop(target, None)

    active_chats[ADMIN_ID] = target
    active_chats[target] = ADMIN_ID
    chat_modes[ADMIN_ID] = "text"
    chat_modes[target] = "text"
    admin_direct[ADMIN_ID] = target

    stats["total_sessions"] += 1
    save_data()

    try:
        await bot.send_message(
            target,
            "💬 <b>Собеседник найден!</b>",
            reply_markup=chat_menu(),
            parse_mode="HTML",
        )
    except Exception:
        pass

    return f"💬 Подключен к {user_label_with_id(target)}. Для выхода: /leave"


def admin_chats_text() -> str:
    pairs = get_active_pairs()

    lines = [
        "💬 <b>Активные чаты</b>\n",
        f"🟢 Пар в чате: <b>{len(pairs)}</b>",
        f"🔍 В очереди: <b>{len(waiting_users)}</b>\n",
    ]

    if pairs:
        lines.append("<b>Пары:</b>")

        for uid_a, uid_b in pairs:
            mode = get_chat_mode(uid_a)
            lines.append(f"• {user_label(uid_a)} ↔ {user_label(uid_b)} — {mode_label(mode)}")
    else:
        lines.append("Сейчас нет активных пар.")

    if waiting_users:
        lines.append("\n<b>В очереди:</b>")

        for uid in waiting_users:
            user_filter = get_user_waiting_filter(uid)
            mode = user_filter.get("mode", "text")
            region = user_filter.get("region", "random")
            lines.append(f"• {user_label(uid)} — {mode_label(mode)} — {region_label(region)}")

    lines.append("\n🎧 — прослушка (3-й голос)\n💬 — прямой чат с пользователем")

    return "\n".join(lines)


# ─────────────────────────── /start ──────────────────────────────

@dp.message(Command("start"))
async def cmd_start(msg: Message):
    global admin_mode

    uid = msg.from_user.id

    known_users.add(uid)
    ensure_user(uid, msg.from_user.username)
    save_data()

    if uid in banned_users:
        await msg.answer("🚫 Ты заблокирован.", parse_mode="HTML")
        return

    if uid == ADMIN_ID:
        if admin_mode:
            await msg.answer(ADMIN_WELCOME, reply_markup=admin_menu(), parse_mode="HTML")
        else:
            await msg.answer(WELCOME, reply_markup=main_menu(is_admin=True), parse_mode="HTML")
    else:
        await msg.answer(WELCOME, reply_markup=main_menu(), parse_mode="HTML")


# ─────────────────────────── АКТИВНОСТЬ ДНЯ ──────────────────────

@dp.callback_query(F.data == "daily")
async def cb_daily(call: CallbackQuery):
    await call.answer()

    touch_user(call.from_user.id, call.from_user.username)

    question = daily_data.get("current_question") or random.choice(DAILY_QUESTIONS)

    daily_data["current_question"] = question

    if not daily_data.get("question_date"):
        daily_data["question_date"] = today_key()

    save_data()

    topic = daily_data.get("current_topic")
    topic_line = f"\n\n🗓 <b>Тема дня:</b> {topic}" if topic else ""

    await call.message.answer(
        f"🎭 <b>Анонимка дня</b>\n\n{question}{topic_line}\n\n"
        "Ответь анонимно — лучшие ответы попадут в топ дня 🔥",
        reply_markup=daily_menu(),
        parse_mode="HTML",
    )


@dp.callback_query(F.data == "answer_daily")
async def cb_answer_daily(call: CallbackQuery, state: FSMContext):
    await call.answer()

    touch_user(call.from_user.id, call.from_user.username)

    await call.message.answer(
        "✍️ Напиши ответ на анонимку дня.\n\n"
        "Он будет опубликован без твоего имени.",
        reply_markup=cancel_menu(),
        parse_mode="HTML",
    )

    await state.set_state(DailyStates.waiting_for_answer)


@dp.message(DailyStates.waiting_for_answer)
async def process_daily_answer(msg: Message, state: FSMContext):
    uid = msg.from_user.id

    touch_user(uid, msg.from_user.username)

    if uid in banned_users:
        await state.clear()
        return

    if not msg.text:
        await msg.answer("❌ Ответ должен быть текстом.")
        return

    text = msg.text.strip()

    if len(text) > 700:
        await msg.answer("❌ Слишком длинно. До 700 символов.")
        return

    hot_id = 1

    if hot_messages:
        hot_id = max(int(x.get("id", 0)) for x in hot_messages) + 1

    item = {
        "id": hot_id,
        "user_id": uid,
        "text": text,
        "likes": 0,
        "liked_by": [],
        "date": today_key(),
        "created_at": now_dt().isoformat(timespec="seconds"),
    }

    hot_messages.append(item)

    user_data = ensure_user(uid, msg.from_user.username)

    if user_data.get("last_daily_answer") != today_key():
        user_data["daily_streak"] = int(user_data.get("daily_streak", 0)) + 1
        user_data["last_daily_answer"] = today_key()

    stats["daily_answers"] = stats.get("daily_answers", 0) + 1

    save_data()
    await state.clear()

    public_text = (
        f"🎭 <b>Новый анонимный ответ #{hot_id}</b>\n\n"
        f"{text}\n\n"
        f"🔥 Поддержи, если зашло."
    )

    await broadcast_activity(public_text, reply_markup=hot_message_menu(hot_id))

    await msg.answer(
        "✅ Ответ опубликован анонимно.",
        reply_markup=main_menu(),
        parse_mode="HTML",
    )

    await log_to_admin(f"🎭 Ответ на анонимку дня от {user_label_with_id(uid)}: {text}")


@dp.callback_query(F.data.startswith("hot_like_"))
async def cb_hot_like(call: CallbackQuery):
    await call.answer()

    uid = call.from_user.id

    touch_user(uid, call.from_user.username)

    try:
        hot_id = int(call.data.removeprefix("hot_like_"))
    except ValueError:
        return

    for item in hot_messages:
        if int(item.get("id", 0)) == hot_id:
            liked_by = item.setdefault("liked_by", [])

            if uid in liked_by:
                await call.answer("Ты уже поддержал 🔥")
                return

            liked_by.append(uid)
            item["likes"] = int(item.get("likes", 0)) + 1
            stats["hot_likes"] = stats.get("hot_likes", 0) + 1

            save_data()

            await call.answer(f"🔥 Теперь огней: {item['likes']}")
            return

    await call.answer("Сообщение не найдено")


@dp.callback_query(F.data == "hot")
async def cb_hot(call: CallbackQuery):
    await call.answer()

    touch_user(call.from_user.id, call.from_user.username)

    await call.message.answer(
        hot_top_text(),
        reply_markup=daily_menu(),
        parse_mode="HTML",
    )


@dp.callback_query(F.data == "online_effect")
async def cb_online_effect(call: CallbackQuery):
    await call.answer()

    touch_user(call.from_user.id, call.from_user.username)

    await call.message.answer(
        online_effect_text(),
        reply_markup=main_menu(),
        parse_mode="HTML",
    )


@dp.callback_query(F.data == "quick_poll")
async def cb_quick_poll(call: CallbackQuery):
    await call.answer()

    touch_user(call.from_user.id, call.from_user.username)

    question, options = random.choice(AUTO_POLLS)

    await call.message.answer_poll(
        question=f"📊 {question}",
        options=options,
        is_anonymous=True,
    )


@dp.message(Command("daily"))
async def cmd_daily_user(msg: Message):
    touch_user(msg.from_user.id, msg.from_user.username)

    if msg.from_user.id == ADMIN_ID:
        await publish_daily_question(force=True)
        await msg.answer("✅ Анонимка дня выпущена.", parse_mode="HTML")
    else:
        await msg.answer(
            f"🎭 <b>Анонимка дня</b>\n\n{daily_data.get('current_question') or random.choice(DAILY_QUESTIONS)}",
            reply_markup=daily_menu(),
            parse_mode="HTML",
        )


@dp.message(Command("topic"))
async def cmd_topic_admin(msg: Message):
    if msg.from_user.id != ADMIN_ID:
        return

    await publish_daily_topic(force=True)
    await msg.answer("✅ Тема дня выпущена.", parse_mode="HTML")


@dp.message(Command("poll"))
async def cmd_poll_admin(msg: Message):
    if msg.from_user.id == ADMIN_ID:
        await publish_auto_poll(force=True)
        await msg.answer("✅ Опрос выпущен.", parse_mode="HTML")
    else:
        question, options = random.choice(AUTO_POLLS)
        await msg.answer_poll(
            question=f"📊 {question}",
            options=options,
            is_anonymous=True,
        )


@dp.message(Command("hot"))
async def cmd_hot_user(msg: Message):
    touch_user(msg.from_user.id, msg.from_user.username)

    await msg.answer(
        hot_top_text(),
        reply_markup=daily_menu(),
        parse_mode="HTML",
    )


@dp.message(Command("online"))
async def cmd_online_user(msg: Message):
    touch_user(msg.from_user.id, msg.from_user.username)

    await msg.answer(
        online_effect_text(),
        reply_markup=main_menu(),
        parse_mode="HTML",
    )


# ─────────────────────────── ПРОФИЛЬ ───────────────────────────

@dp.callback_query(F.data == "my_profile")
async def cb_my_profile(call: CallbackQuery):
    await call.answer()

    uid = call.from_user.id

    ensure_user(uid, call.from_user.username)

    u_desc = users_db.get(str(uid), {}).get("desc", "Описание не заполнено.")
    u_rating = get_rating(uid)
    u_name = users_db.get(str(uid), {}).get("username")
    streak = users_db.get(str(uid), {}).get("daily_streak", 0)

    username_line = f"🔗 <b>Username:</b> @{u_name}\n" if u_name else "🔗 <b>Username:</b> не указан в Telegram\n"

    text = (
        f"👤 <b>Твой анонимный профиль:</b>\n\n"
        f"{username_line}"
        f"📝 <b>Описание:</b> {u_desc}\n"
        f"⭐ <b>Рейтинг:</b> {u_rating}/5.0\n"
        f"🎭 <b>Ответов на анонимку дня подряд:</b> {streak}\n\n"
        f"<i>По username тебе могут прислать валентинку!</i>"
    )

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="✏️ Изменить описание", callback_data="edit_description")],
        [InlineKeyboardButton(text="🔙 Назад", callback_data="back_to_menu")],
    ])

    await call.message.edit_text(text, reply_markup=kb, parse_mode="HTML")


@dp.callback_query(F.data == "edit_description")
async def cb_edit_description(call: CallbackQuery, state: FSMContext):
    await call.answer()

    await call.message.answer(
        "✍️ Напиши новое описание (до 200 символов):",
        reply_markup=cancel_menu(),
    )

    await state.set_state(ProfileStates.waiting_for_desc)


@dp.message(ProfileStates.waiting_for_desc)
async def process_new_description(msg: Message, state: FSMContext):
    touch_user(msg.from_user.id, msg.from_user.username)

    if not msg.text:
        await msg.answer("❌ Описание должно быть текстом. Попробуй ещё раз:")
        return

    if len(msg.text) > 200:
        await msg.answer("❌ Слишком длинно! До 200 символов:")
        return

    uid = str(msg.from_user.id)

    ensure_user(msg.from_user.id, msg.from_user.username)

    users_db[uid]["desc"] = msg.text

    save_data()
    await state.clear()

    await msg.answer("✅ Описание обновлено!", reply_markup=main_menu())


@dp.callback_query(F.data == "back_to_menu")
async def cb_back_to_menu(call: CallbackQuery, state: FSMContext):
    await call.answer()

    touch_user(call.from_user.id, call.from_user.username)

    await state.clear()

    try:
        await call.message.edit_text(WELCOME, reply_markup=main_menu(), parse_mode="HTML")
    except Exception:
        await call.message.answer(WELCOME, reply_markup=main_menu(), parse_mode="HTML")


# ─────────────────────────── ВАЛЕНТИНКИ ──────────────────────────

@dp.callback_query(F.data == "valentine")
async def cb_valentine(call: CallbackQuery, state: FSMContext):
    await call.answer()

    uid = call.from_user.id

    touch_user(uid, call.from_user.username)

    if uid in banned_users:
        await call.message.answer("🚫 Ты заблокирован.", parse_mode="HTML")
        return

    if not call.from_user.username:
        await call.message.answer(
            "❌ Чтобы отправлять валентинки, нужен <b>@username</b> в настройках Telegram.\n"
            "Установи его и нажми /start снова.",
            parse_mode="HTML",
        )
        return

    ensure_user(uid, call.from_user.username)

    await call.message.answer(
        "💌 <b>Валентинка</b>\n\n"
        "Напиши <b>@username</b> получателя — только того, кто уже пользовался ботом.\n\n"
        "Пример: <code>@ivan_petrov</code>",
        reply_markup=cancel_menu(),
        parse_mode="HTML",
    )

    await state.set_state(ValentineStates.waiting_for_username)


@dp.message(ValentineStates.waiting_for_username)
async def process_valentine_username(msg: Message, state: FSMContext):
    touch_user(msg.from_user.id, msg.from_user.username)

    if not msg.text:
        await msg.answer("❌ Отправь username текстом, например: <code>@username</code>", parse_mode="HTML")
        return

    username = msg.text.strip()
    target_id = find_user_by_username(username)

    if not target_id:
        await msg.answer(
            "❌ Пользователь не найден.\n"
            "Он должен хотя бы раз нажать /start в боте и иметь @username.",
            reply_markup=cancel_menu(),
            parse_mode="HTML",
        )
        return

    if target_id == msg.from_user.id:
        await msg.answer("❌ Нельзя отправить валентинку самому себе.", reply_markup=cancel_menu())
        return

    if target_id in banned_users:
        await msg.answer("❌ Этот пользователь недоступен.", reply_markup=cancel_menu())
        return

    await state.update_data(
        valentine_target=target_id,
        valentine_username=username.lstrip("@").lower(),
    )

    await msg.answer(
        f"💌 Получатель: <b>@{username.lstrip('@')}</b>\n\n"
        "Теперь напиши текст валентинки (до 500 символов):",
        reply_markup=cancel_menu(),
        parse_mode="HTML",
    )

    await state.set_state(ValentineStates.waiting_for_message)


@dp.message(ValentineStates.waiting_for_message)
async def process_valentine_message(msg: Message, state: FSMContext):
    touch_user(msg.from_user.id, msg.from_user.username)

    if not msg.text:
        await msg.answer("❌ Валентинка должна быть текстом.", reply_markup=cancel_menu())
        return

    if len(msg.text) > 500:
        await msg.answer("❌ Слишком длинно! До 500 символов.", reply_markup=cancel_menu())
        return

    data = await state.get_data()

    target_id = data.get("valentine_target")
    username = data.get("valentine_username", "???")

    if not target_id:
        await state.clear()
        await msg.answer("❌ Ошибка. Начни заново.", reply_markup=main_menu())
        return

    try:
        await bot.send_message(
            target_id,
            f"💌 <b>Тебе пришла анонимная валентинка!</b>\n\n"
            f"{msg.text}\n\n"
            f"<i>Отправитель остаётся анонимным.</i>",
            parse_mode="HTML",
        )
    except Exception:
        await msg.answer(
            "❌ Не удалось доставить. Возможно, получатель заблокировал бота.",
            reply_markup=main_menu(),
        )
        await state.clear()
        return

    stats["total_valentines"] = stats.get("total_valentines", 0) + 1

    save_data()
    await state.clear()

    await msg.answer(
        f"✅ Валентинка отправлена пользователю <b>@{username}</b>!",
        reply_markup=main_menu(),
        parse_mode="HTML",
    )

    await log_to_admin(f"💌 Валентинка → @{username} (<code>{target_id}</code>)")


# ─────────────────────────── РЕЙТИНГ ─────────────────────────────

@dp.callback_query(F.data.startswith("rate_"))
async def cb_rate_user(call: CallbackQuery):
    touch_user(call.from_user.id, call.from_user.username)

    parts = call.data.split("_")
    partner_id = parts[1]
    score = int(parts[2])

    await call.answer("Оценка отправлена! 👍")

    if partner_id in users_db:
        users_db[partner_id]["rating_sum"] += score
        users_db[partner_id]["rating_count"] += 1
        save_data()

    await call.message.edit_text(
        "⭐️ Спасибо! Твоя оценка учтена.",
        reply_markup=main_menu(),
        parse_mode="HTML",
    )


# ─────────────────────────── ПОИСК И ЧАТ ─────────────────────────

@dp.callback_query(F.data == "find")
async def cb_find(call: CallbackQuery):
    await call.answer()

    uid = call.from_user.id
    ensure_user(uid, call.from_user.username)

    if uid in banned_users:
        await call.message.answer("🚫 Ты заблокирован.", parse_mode="HTML")
        return

    if uid in active_chats:
        await call.message.answer("💬 Ты уже в чате.", reply_markup=chat_menu(), parse_mode="HTML")
        return

    if uid in waiting_users:
        current_filter = get_user_waiting_filter(uid)
        await call.message.answer(
            f"⏳ <b>Поиск уже идёт</b>\n\n"
            f"🧩 Режим: {mode_label(current_filter.get('mode', 'text'))}\n"
            f"📍 Фильтр: {region_label(current_filter.get('region', 'random'))}",
            reply_markup=search_menu(),
            parse_mode="HTML",
        )
        return

    await call.message.answer(
        "🔍 <b>Выбери формат общения:</b>\n\n"
        "💬 Обычный текстовый чат\n"
        "🎤 Голосовой чат сообщениями\n\n"
        "👇 Нажми на нужный вариант",
        reply_markup=search_mode_menu(),
        parse_mode="HTML",
    )


@dp.callback_query(F.data.startswith("find_mode_"))
async def cb_find_mode(call: CallbackQuery):
    await call.answer()

    uid = call.from_user.id
    ensure_user(uid, call.from_user.username)

    if uid in banned_users:
        await call.message.answer("🚫 Ты заблокирован.", parse_mode="HTML")
        return

    if uid in active_chats:
        await call.message.answer("💬 Ты уже в чате.", reply_markup=chat_menu(), parse_mode="HTML")
        return

    mode = call.data.removeprefix("find_mode_")

    await call.message.answer(
        f"📍 <b>Теперь выбери район</b>\n\n"
        f"🧩 Формат: {mode_label(mode)}\n\n"
        f"👇 Выбери, кого хочешь найти",
        reply_markup=search_region_menu(mode),
        parse_mode="HTML",
    )


@dp.callback_query(F.data.startswith("find_region_"))
async def cb_find_region(call: CallbackQuery):
    await call.answer()

    uid = call.from_user.id
    ensure_user(uid, call.from_user.username)

    if uid in banned_users:
        await call.message.answer("🚫 Ты заблокирован.", parse_mode="HTML")
        return

    if uid in active_chats:
        await call.message.answer("💬 Ты уже в чате.", reply_markup=chat_menu(), parse_mode="HTML")
        return

    data = call.data.removeprefix("find_region_")
    parts = data.split("_", maxsplit=1)

    if len(parts) != 2:
        await call.message.answer("❌ Ошибка выбора поиска.", parse_mode="HTML")
        return

    mode, region = parts

    if uid in waiting_users:
        waiting_users.remove(uid)

    waiting_filters[uid] = {
        "mode": mode,
        "region": region,
    }

    partner = find_partner_from_queue(uid, mode, region)

    if partner:
        await connect_users(uid, partner, mode)
        waiting_filters.pop(uid, None)
    else:
        waiting_users.append(uid)

        extra_text = ""
        if mode == "voice":
            extra_text = "\n\n🎤 В этом режиме лучше отправлять голосовые сообщения."

        await call.message.answer(
            f"🔍 <b>Ищем собеседника...</b>\n\n"
            f"🧩 Режим: {mode_label(mode)}\n"
            f"📍 Фильтр: {region_label(region)}"
            f"{extra_text}",
            reply_markup=search_menu(),
            parse_mode="HTML",
        )


@dp.callback_query(F.data == "next")
async def cb_next(call: CallbackQuery):
    await call.answer()

    touch_user(call.from_user.id, call.from_user.username)

    uid = call.from_user.id
    current_filter = get_user_waiting_filter(uid)

    mode = current_filter.get("mode", get_chat_mode(uid))
    region = current_filter.get("region", "random")

    if uid in active_chats:
        mode = get_chat_mode(uid)
        await disconnect_pair(uid)

    if mode not in ("text", "voice"):
        mode = "text"

    partner = find_partner_from_queue(uid, mode, region)

    waiting_filters[uid] = {
        "mode": mode,
        "region": region,
    }

    if partner:
        await connect_users(uid, partner, mode)
        waiting_filters.pop(uid, None)
    else:
        if uid not in waiting_users:
            waiting_users.append(uid)

        await call.message.answer(
            f"🔍 <b>Ищем нового собеседника...</b>\n\n"
            f"🧩 Режим: {mode_label(mode)}\n"
            f"📍 Фильтр: {region_label(region)}",
            reply_markup=search_menu(),
            parse_mode="HTML",
        )


@dp.callback_query(F.data == "leave")
async def cb_leave(call: CallbackQuery):
    await call.answer()

    touch_user(call.from_user.id, call.from_user.username)

    uid = call.from_user.id

    if uid in active_chats:
        await disconnect_pair(uid)
    elif uid in waiting_users:
        waiting_users.remove(uid)
        waiting_filters.pop(uid, None)

        await call.message.answer(
            "🚪 Поиск отменён.",
            reply_markup=main_menu(),
            parse_mode="HTML",
        )
    else:
        await call.message.answer(
            "Ты не в чате.",
            reply_markup=main_menu(),
            parse_mode="HTML",
        )


@dp.callback_query(F.data == "cancel_search")
async def cb_cancel_search(call: CallbackQuery):
    await call.answer()

    touch_user(call.from_user.id, call.from_user.username)

    uid = call.from_user.id

    if uid in waiting_users:
        waiting_users.remove(uid)
    waiting_filters.pop(uid, None)

    await call.message.answer(
        "❌ Поиск отменён.",
        reply_markup=main_menu(),
        parse_mode="HTML",
    )


@dp.callback_query(F.data == "report")
async def cb_report(call: CallbackQuery):
    await call.answer("⚠️ Жалоба отправлена!")

    touch_user(call.from_user.id, call.from_user.username)

    uid = call.from_user.id
    partner = active_chats.get(uid)

    if partner:
        text = (
            f"🚨 <b>ЖАЛОБА</b>\n"
            f"От: <code>{uid}</code>\n"
            f"На: <code>{partner}</code>\n"
            f"Для бана: <code>/ban {partner}</code>"
        )

        await log_to_admin(replace_ids_with_usernames(text))
        await call.message.answer("⚠️ Жалоба отправлена админу.", parse_mode="HTML")
    else:
        await call.message.answer("Ты не в чате.", parse_mode="HTML")


@dp.callback_query(F.data == "rules")
async def cb_rules(call: CallbackQuery):
    await call.answer()

    touch_user(call.from_user.id, call.from_user.username)

    await call.message.answer(RULES_TEXT, parse_mode="HTML")


# ─────────────────────────── АДМИН: КНОПКИ ───────────────────────

@dp.callback_query(F.data == "admin_back")
async def cb_admin_back(call: CallbackQuery):
    if call.from_user.id != ADMIN_ID:
        await call.answer("⛔")
        return

    await call.answer()

    await call.message.edit_text(
        ADMIN_WELCOME,
        reply_markup=admin_menu(),
        parse_mode="HTML",
    )


@dp.callback_query(F.data == "to_admin")
async def cb_to_admin(call: CallbackQuery):
    global admin_mode

    if call.from_user.id != ADMIN_ID:
        await call.answer("⛔")
        return

    await call.answer()

    admin_mode = True

    await call.message.edit_text(
        ADMIN_WELCOME,
        reply_markup=admin_menu(),
        parse_mode="HTML",
    )


@dp.callback_query(F.data == "to_user")
async def cb_to_user(call: CallbackQuery):
    global admin_mode

    if call.from_user.id != ADMIN_ID:
        await call.answer("⛔")
        return

    await call.answer()

    admin_mode = False

    await call.message.edit_text(
        WELCOME,
        reply_markup=main_menu(is_admin=True),
        parse_mode="HTML",
    )


@dp.callback_query(F.data == "admin_stats")
async def cb_admin_stats(call: CallbackQuery):
    if call.from_user.id != ADMIN_ID:
        await call.answer("⛔")
        return

    await call.answer()

    text = (
        f"📊 <b>Статистика</b>\n\n"
        f"👥 Всего юзеров: <b>{len(known_users)}</b>\n"
        f"🔍 В поиске: <b>{len(waiting_users)}</b>\n"
        f"💬 В чатах: <b>{len(get_active_pairs())}</b>\n"
        f"🚫 Заблокировано: <b>{len(banned_users)}</b>\n"
        f"📨 Сообщений: <b>{stats['total_messages']}</b>\n"
        f"🔗 Сессий: <b>{stats['total_sessions']}</b>\n"
        f"💌 Валентинок: <b>{stats.get('total_valentines', 0)}</b>\n"
        f"🎭 Ответов дня: <b>{stats.get('daily_answers', 0)}</b>\n"
        f"🔥 Реакций: <b>{stats.get('hot_likes', 0)}</b>"
    )

    await call.message.answer(text, parse_mode="HTML")


@dp.callback_query(F.data == "admin_online")
async def cb_admin_online(call: CallbackQuery):
    if call.from_user.id != ADMIN_ID:
        await call.answer("⛔")
        return

    await call.answer()

    online = len(waiting_users) + len(active_chats)

    text = (
        f"{online_effect_text()}\n\n"
        f"🟢 Активных пар: <b>{len(get_active_pairs())}</b>\n"
        f"🔍 В очереди: <b>{len(waiting_users)}</b>\n"
        f"📡 Технически онлайн: <b>{online}</b>"
    )

    await call.message.answer(text, parse_mode="HTML")


@dp.callback_query(F.data == "admin_daily_now")
async def cb_admin_daily_now(call: CallbackQuery):
    if call.from_user.id != ADMIN_ID:
        await call.answer("⛔")
        return

    await call.answer("🎭 Выпускаю")

    await publish_daily_question(force=True)

    await call.message.answer(
        "✅ Анонимка дня отправлена пользователям.",
        parse_mode="HTML",
    )


@dp.callback_query(F.data == "admin_topic_now")
async def cb_admin_topic_now(call: CallbackQuery):
    if call.from_user.id != ADMIN_ID:
        await call.answer("⛔")
        return

    await call.answer("🗓 Выпускаю")

    await publish_daily_topic(force=True)

    await call.message.answer(
        "✅ Авто тема дня отправлена пользователям.",
        parse_mode="HTML",
    )


@dp.callback_query(F.data == "admin_poll_now")
async def cb_admin_poll_now(call: CallbackQuery):
    if call.from_user.id != ADMIN_ID:
        await call.answer("⛔")
        return

    await call.answer("📊 Выпускаю")

    await publish_auto_poll(force=True)

    await call.message.answer(
        "✅ Опрос отправлен пользователям.",
        parse_mode="HTML",
    )


@dp.callback_query(F.data == "admin_hot_now")
async def cb_admin_hot_now(call: CallbackQuery):
    if call.from_user.id != ADMIN_ID:
        await call.answer("⛔")
        return

    await call.answer("🔥 Показываю")

    await call.message.answer(hot_top_text(), parse_mode="HTML")


# ─────────────────────────── АДМИН: СВОИ СОБЫТИЯ ─────────────────

@dp.callback_query(F.data == "admin_custom_daily")
async def cb_admin_custom_daily(call: CallbackQuery, state: FSMContext):
    if call.from_user.id != ADMIN_ID:
        await call.answer("⛔")
        return

    await call.answer()

    await call.message.answer(
        "✍️ Напиши свою <b>Анонимку дня</b>.\n\n"
        "Пример:\n"
        "<code>Кому ты давно хотел что-то сказать?</code>",
        reply_markup=cancel_menu(),
        parse_mode="HTML",
    )

    await state.set_state(AdminCreateStates.waiting_custom_daily)


@dp.message(AdminCreateStates.waiting_custom_daily)
async def process_admin_custom_daily(msg: Message, state: FSMContext):
    if msg.from_user.id != ADMIN_ID:
        return

    if not msg.text:
        await msg.answer("❌ Нужен текст.")
        return

    question = msg.text.strip()

    if len(question) > 500:
        await msg.answer("❌ Слишком длинно. До 500 символов.")
        return

    daily_data["current_question"] = question
    daily_data["question_date"] = today_key()

    save_data()

    text = (
        "🎭 <b>Анонимка дня</b>\n\n"
        f"{question}\n\n"
        "Ответы будут опубликованы анонимно. Лучшие попадут в топ дня 🔥"
    )

    sent = await broadcast_activity(text, reply_markup=daily_menu())

    await state.clear()

    await msg.answer(
        f"✅ Своя анонимка дня отправлена.\n"
        f"👥 Получили: {sent}",
        parse_mode="HTML",
    )


@dp.callback_query(F.data == "admin_custom_topic")
async def cb_admin_custom_topic(call: CallbackQuery, state: FSMContext):
    if call.from_user.id != ADMIN_ID:
        await call.answer("⛔")
        return

    await call.answer()

    await call.message.answer(
        "🗓 Напиши свою <b>Тему дня</b>.\n\n"
        "Пример:\n"
        "<code>Сегодня обсуждаем тайные симпатии</code>",
        reply_markup=cancel_menu(),
        parse_mode="HTML",
    )

    await state.set_state(AdminCreateStates.waiting_custom_topic)


@dp.message(AdminCreateStates.waiting_custom_topic)
async def process_admin_custom_topic(msg: Message, state: FSMContext):
    if msg.from_user.id != ADMIN_ID:
        return

    if not msg.text:
        await msg.answer("❌ Нужен текст.")
        return

    topic = msg.text.strip()

    if len(topic) > 500:
        await msg.answer("❌ Слишком длинно. До 500 символов.")
        return

    daily_data["current_topic"] = topic
    daily_data["topic_date"] = today_key()

    save_data()

    text = (
        "🗓 <b>Тема дня</b>\n\n"
        f"{topic}\n\n"
        "Можешь ответить через «Анонимку дня» 🎭"
    )

    sent = await broadcast_activity(text, reply_markup=daily_menu())

    await state.clear()

    await msg.answer(
        f"✅ Своя тема дня отправлена.\n"
        f"👥 Получили: {sent}",
        parse_mode="HTML",
    )


@dp.callback_query(F.data == "admin_custom_poll")
async def cb_admin_custom_poll(call: CallbackQuery, state: FSMContext):
    if call.from_user.id != ADMIN_ID:
        await call.answer("⛔")
        return

    await call.answer()

    await call.message.answer(
        "🗳 Напиши свой опрос в формате:\n\n"
        "<code>Вопрос? | Вариант 1 | Вариант 2</code>\n\n"
        "Можно 2 или 3 варианта.\n\n"
        "Пример:\n"
        "<code>Кто сегодня активничает? | Я | Не я | Позже</code>",
        reply_markup=cancel_menu(),
        parse_mode="HTML",
    )

    await state.set_state(AdminCreateStates.waiting_custom_poll)


@dp.message(AdminCreateStates.waiting_custom_poll)
async def process_admin_custom_poll(msg: Message, state: FSMContext):
    if msg.from_user.id != ADMIN_ID:
        return

    if not msg.text:
        await msg.answer("❌ Нужен текст.")
        return

    parts = [x.strip() for x in msg.text.split("|") if x.strip()]

    if len(parts) < 3:
        await msg.answer(
            "❌ Формат неверный.\n\n"
            "Нужно так:\n"
            "<code>Вопрос? | Вариант 1 | Вариант 2</code>",
            parse_mode="HTML",
        )
        return

    question = parts[0]
    options = parts[1:4]

    if len(question) > 300:
        await msg.answer("❌ Вопрос слишком длинный. До 300 символов.")
        return

    sent = 0
    failed = 0

    for uid in list(known_users):
        if uid == ADMIN_ID or uid in banned_users:
            continue

        try:
            await bot.send_poll(
                chat_id=uid,
                question=f"📊 {question}",
                options=options,
                is_anonymous=True,
            )
            sent += 1
        except Exception:
            failed += 1

        await asyncio.sleep(0.04)

    daily_data["poll_date"] = today_key()

    save_data()
    await state.clear()

    await msg.answer(
        f"✅ Свой опрос отправлен.\n"
        f"👥 Получили: {sent}\n"
        f"❌ Ошибки: {failed}",
        parse_mode="HTML",
    )


@dp.callback_query(F.data == "admin_chats")
async def cb_admin_chats(call: CallbackQuery):
    if call.from_user.id != ADMIN_ID:
        await call.answer("⛔")
        return

    await call.answer()

    text = admin_chats_text()
    kb = admin_chats_keyboard()

    try:
        await call.message.edit_text(text, reply_markup=kb, parse_mode="HTML")
    except Exception:
        await call.message.answer(text, reply_markup=kb, parse_mode="HTML")


@dp.callback_query(F.data.startswith("adm_listen_"))
async def cb_admin_listen(call: CallbackQuery):
    if call.from_user.id != ADMIN_ID:
        await call.answer("⛔")
        return

    target = int(call.data.removeprefix("adm_listen_"))

    result = await admin_start_listen(target)

    await call.answer("🎧 Подключено" if result.startswith("🎧") else "❌")
    await call.message.answer(result, parse_mode="HTML")


@dp.callback_query(F.data.startswith("adm_chat_"))
async def cb_admin_chat_btn(call: CallbackQuery):
    if call.from_user.id != ADMIN_ID:
        await call.answer("⛔")
        return

    target = int(call.data.removeprefix("adm_chat_"))

    result = await admin_start_direct_chat(target)

    await call.answer("💬 Подключено" if result.startswith("💬") else "❌")
    await call.message.answer(result, parse_mode="HTML")


@dp.callback_query(F.data == "adm_leave_direct")
async def cb_admin_leave_direct(call: CallbackQuery):
    if call.from_user.id != ADMIN_ID:
        await call.answer("⛔")
        return

    await call.answer()

    if ADMIN_ID in admin_direct:
        target = admin_direct.pop(ADMIN_ID)

        active_chats.pop(ADMIN_ID, None)
        active_chats.pop(target, None)
        chat_modes.pop(ADMIN_ID, None)
        chat_modes.pop(target, None)

        await call.message.answer(
            f"🚪 Вышел из чата с {user_label(target)}.",
            parse_mode="HTML",
        )

        try:
            await bot.send_message(
                target,
                "🚪 Собеседник покинул чат.",
                reply_markup=main_menu(),
                parse_mode="HTML",
            )
        except Exception:
            pass
    else:
        await call.message.answer("Ты не в прямом чате.", parse_mode="HTML")


@dp.callback_query(F.data == "adm_leave_listen")
async def cb_admin_leave_listen(call: CallbackQuery):
    if call.from_user.id != ADMIN_ID:
        await call.answer("⛔")
        return

    await call.answer()

    if ADMIN_ID in admin_state:
        admin_state.pop(ADMIN_ID)
        await call.message.answer("🚪 Вышел из прослушки.", parse_mode="HTML")
    else:
        await call.message.answer("Ты не в прослушке.", parse_mode="HTML")


# ─────────────────────────── АДМИН: КОМАНДЫ ──────────────────────

@dp.message(F.text.startswith("/stats"), F.from_user.id == ADMIN_ID)
async def cmd_stats(msg: Message):
    text = (
        f"📊 <b>Статистика</b>\n\n"
        f"👥 Всего: <b>{len(known_users)}</b>\n"
        f"🔍 В поиске: <b>{len(waiting_users)}</b>\n"
        f"💬 В чатах: <b>{len(get_active_pairs())}</b>\n"
        f"🚫 Баны: <b>{len(banned_users)}</b>\n"
        f"💌 Валентинок: <b>{stats.get('total_valentines', 0)}</b>\n"
        f"🎭 Ответов дня: <b>{stats.get('daily_answers', 0)}</b>\n"
        f"🔥 Реакций: <b>{stats.get('hot_likes', 0)}</b>"
    )

    await msg.answer(text, parse_mode="HTML")


@dp.message(F.text.startswith("/ban"), F.from_user.id == ADMIN_ID)
async def cmd_ban(msg: Message):
    parts = msg.text.split()

    if len(parts) < 2:
        return

    try:
        target = int(parts[1])
    except ValueError:
        return

    banned_users.add(target)
    save_data()

    if target in active_chats:
        await disconnect_pair(target, notify_self=False, notify_partner=True)
        await bot.send_message(target, "🚫 Ты заблокирован администратором.", parse_mode="HTML")

    if target in waiting_users:
        waiting_users.remove(target)
    waiting_filters.pop(target, None)

    await msg.answer(f"✅ <code>{target}</code> забанен.", parse_mode="HTML")


@dp.message(F.text.startswith("/unban"), F.from_user.id == ADMIN_ID)
async def cmd_unban(msg: Message):
    parts = msg.text.split()

    if len(parts) < 2:
        return

    try:
        target = int(parts[1])
    except ValueError:
        return

    banned_users.discard(target)

    save_data()

    await msg.answer(f"✅ <code>{target}</code> разбанен.", parse_mode="HTML")


@dp.message(F.text.startswith("/broadcast"), F.from_user.id == ADMIN_ID)
async def cmd_broadcast(msg: Message):
    text = msg.text.removeprefix("/broadcast").strip()

    if not text:
        return

    sent, failed = 0, 0

    for uid in known_users:
        if uid == ADMIN_ID:
            continue

        try:
            await bot.send_message(uid, f"📢 {text}", parse_mode="HTML")
            sent += 1
        except Exception:
            failed += 1

    await msg.answer(
        f"📢 Рассылка завершена.\n✅ Успешно: {sent}\n❌ Ошибки: {failed}",
        parse_mode="HTML",
    )


@dp.message(F.text.startswith("/send"), F.from_user.id == ADMIN_ID)
async def cmd_admin_send_dm(msg: Message):
    parts = msg.text.split(maxsplit=2)

    if len(parts) < 3:
        await msg.answer("Использование: <code>/send USER_ID ТЕКСТ</code>", parse_mode="HTML")
        return

    try:
        target = int(parts[1])
        text_to_send = parts[2]
    except ValueError:
        await msg.answer("❌ Некорректный ID.", parse_mode="HTML")
        return

    try:
        await bot.send_message(
            target,
            f"📩 <b>Вам пришло личное сообщение:</b>\n\n{text_to_send}",
            parse_mode="HTML",
        )

        await msg.answer(f"✅ Отправлено пользователю <code>{target}</code>.", parse_mode="HTML")
    except Exception as e:
        await msg.answer(f"❌ Ошибка: {e}", parse_mode="HTML")


@dp.message(F.text.startswith("/chat"), F.from_user.id == ADMIN_ID)
async def cmd_admin_chat(msg: Message):
    parts = msg.text.split()

    if len(parts) < 2:
        return

    try:
        target = int(parts[1])
    except ValueError:
        return

    result = await admin_start_direct_chat(target)

    await msg.answer(result, parse_mode="HTML")


@dp.message(F.text == "/leave", F.from_user.id == ADMIN_ID)
async def cmd_admin_leave(msg: Message):
    if ADMIN_ID in admin_direct:
        target = admin_direct.pop(ADMIN_ID)

        active_chats.pop(ADMIN_ID, None)
        active_chats.pop(target, None)
        chat_modes.pop(ADMIN_ID, None)
        chat_modes.pop(target, None)

        await msg.answer(f"🚪 Вышел из чата с {user_label(target)}.", parse_mode="HTML")

        try:
            await bot.send_message(
                target,
                "🚪 Собеседник покинул чат.",
                reply_markup=main_menu(),
                parse_mode="HTML",
            )
        except Exception:
            pass

    elif ADMIN_ID in admin_state:
        admin_state.pop(ADMIN_ID)
        await msg.answer("🚪 Вышел из прослушки.", parse_mode="HTML")
    else:
        await msg.answer("Ты не в чате.", parse_mode="HTML")


@dp.message(F.from_user.id == ADMIN_ID)
async def admin_handler(msg: Message):
    text = msg.text or ""

    if ADMIN_ID in admin_direct:
        target = admin_direct[ADMIN_ID]

        if target in active_chats and active_chats[target] == ADMIN_ID:
            await forward_media(msg, target)
            stats["total_messages"] += 1
        else:
            admin_direct.pop(ADMIN_ID, None)

        return

    if text.startswith("join "):
        try:
            uid = int(text.split()[1])
            result = await admin_start_listen(uid)
            await msg.answer(result, parse_mode="HTML")
        except (ValueError, IndexError):
            pass

        return

    if text == "leave":
        if ADMIN_ID in admin_state:
            admin_state.pop(ADMIN_ID)
            await msg.answer("🚪 Вышел из прослушки.", parse_mode="HTML")

        return

    if ADMIN_ID in admin_state:
        chat_user = admin_state[ADMIN_ID]
        partner = active_chats.get(chat_user)

        if partner and partner != ADMIN_ID:
            out = f"👤 Аноним: {text}"
            await bot.send_message(chat_user, out)
            await bot.send_message(partner, out)
        else:
            admin_state.pop(ADMIN_ID, None)

        return


# ─────────────────────────── ОСНОВНОЙ ХЕНДЛЕР ────────────────────

@dp.message()
async def chat_handler(msg: Message):
    uid = msg.from_user.id

    if uid == ADMIN_ID:
        return

    if uid in banned_users:
        return

    known_users.add(uid)
    ensure_user(uid, msg.from_user.username)

    if uid not in active_chats:
        await msg.answer(
            "Нажми <b>«Найти собеседника»</b>, чтобы начать 👇",
            reply_markup=main_menu(),
            parse_mode="HTML",
        )

        save_data()
        return

    partner = active_chats[uid]
    mode = get_chat_mode(uid)

    if mode == "voice":
        if msg.text:
            await msg.answer(
                "🎤 <b>Сейчас у тебя голосовой чат</b>\n\n"
                "В этом режиме обычный текст отключён.\n"
                "Отправь:\n"
                "• голосовое сообщение\n"
                "• кружок\n"
                "• audio\n\n"
                "Или нажми «⏭ Следующий» / «🚪 Выйти».",
                parse_mode="HTML",
            )
            return

        if not is_voice_allowed_content(msg):
            await msg.answer(
                "🎤 <b>Голосовой режим</b>\n\n"
                "Можно отправлять только:\n"
                "• voice\n"
                "• video note\n"
                "• audio",
                parse_mode="HTML",
            )
            return

    await forward_media(msg, partner)

    stats["total_messages"] += 1

    if stats["total_messages"] % 20 == 0:
        save_data()

    if msg.text and partner != ADMIN_ID:
        text = f"<code>{uid}</code> → <code>{partner}</code>: {msg.text}"
        await log_to_admin(replace_ids_with_usernames(text))


# ─────────────────────────── ЗАПУСК ──────────────────────────────

async def main():
    load_data()
    log.info("🎭 Бот АНОНИМКА запущен")
    asyncio.create_task(daily_activity_loop())
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())