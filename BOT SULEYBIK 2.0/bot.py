import asyncio
import random
import logging

from aiogram import Bot, Dispatcher, F
from aiogram.filters import Command
from aiogram.types import Message

TOKEN = "8853984062:AAEIp8lTzo-sP7OvjENh7O2MbecMVLaH7GE"

logging.basicConfig(level=logging.INFO)

bot = Bot(token=TOKEN)
dp = Dispatcher()

# ---------------- USERS ----------------
users = {}  # chat_id -> set(user_id)

def add_user(chat_id: int, user_id: int):
    if chat_id not in users:
        users[chat_id] = set()
    users[chat_id].add(user_id)


def get_users(chat_id: int):
    return list(users.get(chat_id, []))


# ---------------- START ----------------
@dp.message(Command("start"))
async def start(message: Message):
    add_user(message.chat.id, message.from_user.id)

    await message.answer(
        "🤖 СУЛЕЙБИК 2.0 ЗАПУЩЕН 🔥\n\n"
        "📌 команды:\n"
        "👉 сулейбик кто я\n"
        "👉 сулейбик кто из нас ...\n"
    )


# ---------------- ALL TEXT HANDLER ----------------
@dp.message(F.text)
async def handler(message: Message):
    if not message.text:
        return

    add_user(message.chat.id, message.from_user.id)

    text = message.text.lower()

    # 👤 who am i
    if text.startswith("сулейбик кто я"):
        await message.answer(
            f"👤 профиль\n\n"
            f"🆔 {message.from_user.id}\n"
            f"🙂 {message.from_user.first_name}"
        )
        return

    # 🔮 who from us
    if text.startswith("сулейбик кто из нас"):
        query = text.replace("сулейбик кто из нас", "").strip()

        if not query:
            await message.answer("❗ пример: сулейбик кто из нас самый смешной")
            return

        users_list = get_users(message.chat.id)

        if not users_list:
            await message.answer("😴 нет игроков в чате")
            return

        chosen = random.choice(users_list)

        await message.answer(
            f"🔮 СУЛЕЙБИК ВЫБРАЛ\n"
            f"👉 user_id: {chosen} {query}"
        )
        return


# ---------------- MAIN ----------------
async def main():
    print("BOT STARTED 🚀")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())