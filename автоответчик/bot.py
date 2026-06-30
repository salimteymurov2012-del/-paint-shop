from telethon import TelegramClient, events

api_id = 30622100 # сюда свой api_id
api_hash = "85c47c801bd6907787051fa39b748700"

client = TelegramClient("session", api_id, api_hash)

TEXT = """
Привет 👋

Сейчас я не могу ответить, скорее всего занят 🐍💻

Оставь сообщение, и я отвечу, как только освобожусь ⚡
"""

answered = set()

@client.on(events.NewMessage(incoming=True))
async def handler(event):
    if event.is_private and not event.out:
        user_id = event.sender_id

        if user_id not in answered:
            await event.reply(TEXT)
            answered.add(user_id)

client.start()
print("Автоответчик запущен!")
client.run_until_disconnected()