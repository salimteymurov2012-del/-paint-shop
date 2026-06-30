import asyncio
import random
from aiogram import Bot, Dispatcher, F
from aiogram.filters import Command
from aiogram.types import Message

TOKEN = "8841553625:AAFIi5MnuluDdEv2nIQeYdauK4ta683IQ0c"

bot = Bot(token=TOKEN)
dp = Dispatcher()

# ---------------- STORAGE (в памяти) ----------------
turtles = {}  # user_id -> size


def get_size(user_id: int):
    return turtles.get(user_id, 0)


def set_size(user_id: int, size: int):
    turtles[user_id] = size


# ---------------- START ----------------
@dp.message(Command("start"))
async def start(message: Message):
    await message.answer(
        "🐢 <b>Добро пожаловать в Черепаху!</b>\n\n"
        "📌 команды:\n"
        "/turtle — твоя черепаха\n"
        "/grow — вырастить черепаху\n"
        "/reset — сбросить рост",
        parse_mode="HTML"
    )


# ---------------- TURTLE INFO ----------------
@dp.message(Command("turtle"))
async def turtle(message: Message):
    user_id = message.from_user.id
    size = get_size(user_id)

    await message.answer(
        f"🐢 Твоя черепаха:\n"
        f"📏 Размер: {size} см"
    )


# ---------------- GROW ----------------
@dp.message(Command("grow"))
async def grow(message: Message):
    user_id = message.from_user.id

    grow_amount = random.randint(1, 10)
    new_size = get_size(user_id) + grow_amount

    set_size(user_id, new_size)

    await message.answer(
        f"🐢 Черепаха выросла!\n"
        f"+{grow_amount} см 📈\n"
        f"📏 Теперь: {new_size} см"
    )


# ---------------- RESET ----------------
@dp.message(Command("reset"))
async def reset(message: Message):
    user_id = message.from_user.id
    set_size(user_id, 0)

    await message.answer("🔄 Черепаха сброшена до 0 см 🐢")


# ---------------- RUN ----------------
async def main():
    print("🐢 Черепаха бот запущен")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())