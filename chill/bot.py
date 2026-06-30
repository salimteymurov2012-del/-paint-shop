import asyncio
import logging
import os
import random
import re
from datetime import datetime, timedelta, timezone

from aiogram import Bot, Dispatcher, F
from aiogram.enums import ChatMemberStatus, ChatType
from aiogram.filters import Command
from aiogram.types import Message, ChatPermissions
from aiogram.exceptions import TelegramBadRequest

TOKEN = os.getenv("BOT_TOKEN", "8622914493:AAFN5oS2lL8UH1197Tuar98_aGXfWq_v_T0")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)

bot = Bot(token=TOKEN)
dp = Dispatcher()

# Кеш участников: {chat_id: {user_id: username}}
user_cache: dict[int, dict[int, str | None]] = {}

WHO_ANSWERS_RU = [
    "🌑 Наверное, это @{}",
    "🖤 Чил думает, что это @{}",
    "🌚 Скорее всего, это @{}",
    "⚫ Мой выбор — @{}",
    "🕷 100% это @{}",
    "🌘 По ощущениям это @{}",
    "🖤 Чил уверен: @{}",
]

THINKS_ANSWERS_RU = [
    "🖤 Чил думает про {}: {}",
    "🌑 Мне кажется, {} — {}",
    "🌚 Чил считает: {} — {}",
    "⚫ По версии Чила, {} — {}",
]

CALL_REPLIES_RU = [
    "🌑 Да-да, я тут.",
    "🖤 Чил на месте.",
    "🌚 Позвали меня?",
    "⚫ Я здесь. Что нужно?",
    "🕷 Чил слушает.",
]

SHIP_ANSWERS_RU = [
    "🖤 Рандомный шип\n\n@{} и @{} любят друг друга.",
    "🌑 Чил выбрал пару\n\n@{} и @{} созданы друг для друга.",
    "🌚 Рандомный шип дня\n\n@{} и @{} тайно влюблены.",
    "⚫ По версии Чила\n\n@{} и @{} слишком подходят друг другу.",
    "🕷 Тёмный шип активирован\n\n@{} и @{} уже почти пара.",
]

HELLO_TEXT = (
    "🖤 <b>Привет. Я Chill.</b>\n\n"
    "🌑 Что я умею:\n"
    "• <code>чил кто ...</code>\n"
    "• <code>чил думает @user текст</code>\n"
    "• <code>чил рандомный шип</code>\n"
    "• <code>/mute</code> ответом на сообщение\n"
    "• <code>/unmute</code>\n"
    "• <code>/ban</code>\n"
    "• <code>/unban</code>\n\n"
    "🌚 Примеры:\n"
    "• <code>чил кто подарит мне что-то</code>\n"
    "• <code>чил кто сегодня самый добрый</code>\n"
    "• <code>чил думает @user123 лучший</code>\n"
    "• <code>чил рандомный шип</code>"
)


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())


def is_admin_member(member_status: str) -> bool:
    return member_status in (ChatMemberStatus.ADMINISTRATOR, ChatMemberStatus.CREATOR)


async def user_is_admin(message: Message) -> bool:
    if message.chat.type not in (ChatType.GROUP, ChatType.SUPERGROUP):
        return False
    try:
        member = await bot.get_chat_member(message.chat.id, message.from_user.id)
        return is_admin_member(member.status)
    except Exception:
        return False


async def bot_is_admin(message: Message) -> bool:
    if message.chat.type not in (ChatType.GROUP, ChatType.SUPERGROUP):
        return False
    try:
        me = await bot.get_me()
        member = await bot.get_chat_member(message.chat.id, me.id)
        return is_admin_member(member.status)
    except Exception:
        return False


async def pick_random_user(message: Message):
    chat_id = message.chat.id
    candidates = []
    for uid, username in user_cache.get(chat_id, {}).items():
        if username:
            candidates.append(username)
    if candidates:
        return random.choice(candidates)
    return None


async def pick_two_random_users(message: Message):
    chat_id = message.chat.id
    candidates = []
    for uid, username in user_cache.get(chat_id, {}).items():
        if username:
            candidates.append(username)
    if len(candidates) >= 2:
        return random.sample(candidates, 2)
    return None


async def safe_reply(message: Message, text: str, **kwargs):
    try:
        await message.reply(text, **kwargs)
    except TelegramBadRequest:
        try:
            await message.answer(text, **kwargs)
        except TelegramBadRequest as e:
            logging.error("safe_reply failed: %s", e)


@dp.message(Command("start"))
async def cmd_start(message: Message):
    await message.answer(HELLO_TEXT, parse_mode="HTML")


@dp.message(Command("ban"))
async def cmd_ban(message: Message):
    if message.chat.type not in (ChatType.GROUP, ChatType.SUPERGROUP):
        await message.answer("🌑 Эта команда работает только в группе.")
        return
    if not await user_is_admin(message):
        await message.answer("🖤 Только админ может использовать /ban.")
        return
    if not await bot_is_admin(message):
        await message.answer("⚫ Мне нужны права администратора для бана.")
        return
    if not message.reply_to_message:
        await message.answer("🌚 Ответь командой /ban на сообщение пользователя.")
        return
    target = message.reply_to_message.from_user
    if target.is_bot:
        await message.answer("🕷 Бота банить не буду.")
        return
    try:
        await bot.ban_chat_member(message.chat.id, target.id)
        await message.answer(
            f"⛓ Пользователь {target.mention_html()} забанен.",
            parse_mode="HTML"
        )
    except TelegramBadRequest as e:
        await message.answer(f"⚫ Не удалось забанить: {e}")


@dp.message(Command("unban"))
async def cmd_unban(message: Message):
    if message.chat.type not in (ChatType.GROUP, ChatType.SUPERGROUP):
        await message.answer("🌑 Эта команда работает только в группе.")
        return
    if not await user_is_admin(message):
        await message.answer("🖤 Только админ может использовать /unban.")
        return
    if not await bot_is_admin(message):
        await message.answer("⚫ Мне нужны права администратора для разбана.")
        return
    parts = message.text.split(maxsplit=1) if message.text else []
    if len(parts) < 2:
        await message.answer("🌚 Использование: /unban USER_ID")
        return
    try:
        user_id = int(parts[1])
    except ValueError:
        await message.answer("⚫ Нужен числовой USER_ID.")
        return
    try:
        await bot.unban_chat_member(message.chat.id, user_id, only_if_banned=True)
        await message.answer(f"🖤 Пользователь <code>{user_id}</code> разбанен.", parse_mode="HTML")
    except TelegramBadRequest as e:
        await message.answer(f"⚫ Не удалось разбанить: {e}")


@dp.message(Command("mute"))
async def cmd_mute(message: Message):
    if message.chat.type not in (ChatType.GROUP, ChatType.SUPERGROUP):
        await message.answer("🌑 Эта команда работает только в группе.")
        return
    if not await user_is_admin(message):
        await message.answer("🖤 Только админ может использовать /mute.")
        return
    if not await bot_is_admin(message):
        await message.answer("⚫ Мне нужны права администратора для мута.")
        return
    if not message.reply_to_message:
        await message.answer("🌚 Ответь командой /mute на сообщение пользователя.")
        return
    target = message.reply_to_message.from_user
    if target.is_bot:
        await message.answer("🕷 Бота мутить не буду.")
        return
    parts = message.text.split(maxsplit=1) if message.text else []
    minutes = 10
    if len(parts) >= 2:
        try:
            minutes = max(1, min(10080, int(parts[1])))
        except ValueError:
            await message.answer("⚫ Укажи число минут, например: /mute 15")
            return
    until_date = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    try:
        await bot.restrict_chat_member(
            chat_id=message.chat.id,
            user_id=target.id,
            permissions=ChatPermissions(
                can_send_messages=False,
                can_send_audios=False,
                can_send_documents=False,
                can_send_photos=False,
                can_send_videos=False,
                can_send_video_notes=False,
                can_send_voice_notes=False,
                can_send_polls=False,
                can_send_other_messages=False,
                can_add_web_page_previews=False,
                can_change_info=False,
                can_invite_users=False,
                can_pin_messages=False,
            ),
            until_date=until_date
        )
        await message.answer(
            f"🔇 {target.mention_html()} получил мут на <b>{minutes}</b> минут.",
            parse_mode="HTML"
        )
    except TelegramBadRequest as e:
        await message.answer(f"⚫ Не удалось выдать мут: {e}")


@dp.message(Command("unmute"))
async def cmd_unmute(message: Message):
    if message.chat.type not in (ChatType.GROUP, ChatType.SUPERGROUP):
        await message.answer("🌑 Эта команда работает только в группе.")
        return
    if not await user_is_admin(message):
        await message.answer("🖤 Только админ может использовать /unmute.")
        return
    if not await bot_is_admin(message):
        await message.answer("⚫ Мне нужны права администратора для снятия мута.")
        return
    if not message.reply_to_message:
        await message.answer("🌚 Ответь командой /unmute на сообщение пользователя.")
        return
    target = message.reply_to_message.from_user
    try:
        await bot.restrict_chat_member(
            chat_id=message.chat.id,
            user_id=target.id,
            permissions=ChatPermissions(
                can_send_messages=True,
                can_send_audios=True,
                can_send_documents=True,
                can_send_photos=True,
                can_send_videos=True,
                can_send_video_notes=True,
                can_send_voice_notes=True,
                can_send_polls=True,
                can_send_other_messages=True,
                can_add_web_page_previews=True,
                can_change_info=False,
                can_invite_users=True,
                can_pin_messages=False,
            )
        )
        await message.answer(
            f"🔊 Мут снят с {target.mention_html()}.",
            parse_mode="HTML"
        )
    except TelegramBadRequest as e:
        await message.answer(f"⚫ Не удалось снять мут: {e}")


@dp.message(F.text)
async def chill_text_handler(message: Message):
    try:
        raw_text = message.text or ""

        if message.from_user and not message.from_user.is_bot:
            chat_id = message.chat.id
            if chat_id not in user_cache:
                user_cache[chat_id] = {}
            user_cache[chat_id][message.from_user.id] = message.from_user.username

        text = normalize_text(raw_text)

        # 1. СНАЧАЛА проверяем "чил рандомный шип"
        if text.startswith("чил рандомный шип"):
            pair = await pick_two_random_users(message)
            if pair:
                u1, u2 = pair
                await safe_reply(message, random.choice(SHIP_ANSWERS_RU).format(u1, u2))
            else:
                await safe_reply(message, random.choice([
                    "🌑 Недостаточно людей для шипа. Наберитесь товарищей.",
                    "🖤 Чил не нашёл пару. Добавьте участников в чат.",
                    "🌚 Для шипа нужно минимум двое с юзернеймами.",
                ]))
            return

        # 2. Потом просто "чил"
        if text == "чил":
            await safe_reply(message, random.choice(CALL_REPLIES_RU))
            return

        # 3. "чил кто ..."
        if text.startswith("чил кто "):
            username = await pick_random_user(message)
            if username:
                await safe_reply(message, random.choice(WHO_ANSWERS_RU).format(username))
            else:
                await safe_reply(message, random.choice([
                    "🌑 Никого не смог выбрать. Пусть это будет тайной.",
                    "🖤 Сегодня Чил не определился.",
                    "🌚 Слишком сложный вопрос даже для Чила.",
                ]))
            return

        # 4. "чил думает @user ..."
        think_ru = re.match(r"^чил думает\s+(@[\w\d_]{2,})\s+(.+)$", raw_text.strip(), re.IGNORECASE)
        if think_ru:
            user_tag = think_ru.group(1)
            thought = think_ru.group(2).strip()
            await safe_reply(message, random.choice(THINKS_ANSWERS_RU).format(user_tag, thought))
            return

        # 5. Любое другое упоминание "чил"
        if "чил" in text:
            await safe_reply(message, random.choice([
                "🌑 Я тут.",
                "🖤 Чил смотрит на вас.",
                "🌚 Да? Что случилось?",
                "⚫ Позвали Чила?",
                "🕷 Чил слушает.",
            ]))
    except Exception as e:
        logging.error("Unhandled error in chill_text_handler: %s", e, exc_info=True)


async def main():
    me = await bot.get_me()
    logging.info("Bot started: @%s", me.username)
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())