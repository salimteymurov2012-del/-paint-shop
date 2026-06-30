import os
from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    ContextTypes,
    filters,
)

from config import TOKEN

TEMP_DIR = "temp"
os.makedirs(TEMP_DIR, exist_ok=True)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = """
🤖 Добро пожаловать!

Я — AI бот для анализа внешности.

📸 Отправь мне фотографию лица.

Я:
⭐ Оценю внешность
🧠 Проанализирую черты лица
🏆 Определю категорию
📊 Покажу результат
"""

    await update.message.reply_text(text)


async def photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    photo = update.message.photo[-1]

    file = await photo.get_file()

    filename = f"{update.effective_user.id}.jpg"

    filepath = os.path.join(TEMP_DIR, filename)

    await file.download_to_drive(filepath)

    await update.message.reply_text(
        "📸 Фото получено!\n\n"
        "⏳ Запускаю анализ..."
    )

    # Пока временный ответ
    await update.message.reply_text(
        "⚠️ Анализ ИИ ещё не подключён.\n"
        "На следующем этапе добавим настоящий анализ лица."
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "/start - запуск\n"
        "Отправь фото лица для анализа."
    )


def main():
    app = Application.builder().token(TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(MessageHandler(filters.PHOTO, photo))

    print("🤖 Бот успешно запущен!")

    app.run_polling()


if __name__ == "__main__":
    main()