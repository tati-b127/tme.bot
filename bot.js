import TelegramBot from "node-telegram-bot-api";
import schedule from "node-schedule";
import { Calendar } from "telegram-inline-calendar";
const token = "6344260643:AAEWbRxA-qilqp1GoAfNavHZ0pst08DRgX8";
const bot = new TelegramBot(token, { polling: true });

// Хранилище задач
const tasks = [];
function sendMenu(chatId) {
  const message = `Выбери одну из опций ниже:`;

  const options = {
    reply_markup: {
      keyboard: [
        ["Новая задача"],
        ["Список задач"],
        ["Сортировка по датам"],
        ["Напомнить о важном"],
      ],
      one_time_keyboard: true,
    },
  };

  bot.sendMessage(chatId, message, options);
}
// Обработчик команды /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const message = `Привет! Я твой кот-помощник. Я могу помочь тебе управлять задачами.`;

  bot.sendMessage(chatId, message);
  sendMenu(chatId);
});

// Обработчик кнопок
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const messageText = msg.text;

  if (messageText === "Новая задача") {
    bot.sendMessage(chatId, "Введите название задачи:");
    bot.once("message", (newTaskMsg) => {
      const newTask = {
        task: newTaskMsg.text,
        date: new Date().toLocaleString(),
        done: false,
      };
      tasks.push(newTask);
      bot.sendMessage(chatId, `Задача "${newTask.task}" добавлена.`);
      // Возвращаем меню после добавления задачи
      sendMenu(chatId);
    });
  } else if (messageText === "Список задач") {
    if (tasks.length === 0) {
      bot.sendMessage(chatId, "Список задач пуст.");
      sendMenu(chatId);
    } else {
      const opt = {
        reply_markup: {
          inline_keyboard: tasks.map((task, index) => [
            {
              text: `${index + 1}. ${task.task} ${task.done ? "✅" : "🕗"}`,
              callback_data: index.toString(),
            },
            { text: "🗑️", callback_data: `delete:${index}` },
          ]),
        },
      };

      bot.sendMessage(chatId, "Список задач:", opt);
      sendMenu(chatId);
    }
  } else if (messageText === "Сортировка по датам") {
    if (tasks.length === 0) {
      bot.sendMessage(chatId, "Список задач пуст.");
      sendMenu(chatId);
    } else {
      const sortedTasks = [...tasks].sort(
        (a, b) => new Date(a.date) - new Date(b.date)
      );

      const opt = {
        reply_markup: {
          inline_keyboard: sortedTasks.map((task, index) => [
            {
              text: `${index + 1}. ${task.task} ${task.done ? "✅" : "🕗"}`,
              callback_data: index.toString(),
            },
            { text: "🗑️", callback_data: `delete:${index}` },
          ]),
        },
      };

      bot.sendMessage(chatId, "Отсортированные задачи:", opt);
      sendMenu(chatId);
      //   const message = `Выбери одну из опций ниже:`;

      //   const options = {
      //     reply_markup: {
      //       keyboard: [
      //         ["Новая задача"],
      //         ["Список задач"],
      //         ["Сортировка по датам"],
      //       ],
      //       one_time_keyboard: true,
      //     },
      //   };
      //   bot.sendMessage(chatId, message, options);
    }
  } else if (messageText === "Напомнить о важном") {
    bot
      .sendMessage(chatId, "Введите о чем вам нужно напомнить:")
      .then(() => {
        bot.once("message", (reminderTextMsg) => {
          const reminder = {
            text: reminderTextMsg.text,
            date: "",
            remindBefore: 0,
          };

          const calendar = new Calendar(bot, {
            date_format: "DD-MM-YYYY, hh:mm A",
            language: "en",
            start_week_day: 1,
            time_selector_mod: true,
            time_range: "07:00-23:59",
            time_step: "60m",
          });

          bot
            .sendMessage(chatId, "Выберите дату и время для напоминания:")
            .then(() => {
              calendar.startNavCalendar(msg);
            })
            .catch((error) => {
              console.error("Error sending message:", error);
            });

          bot.on("callback_query", (query) => {
            if (
              query.message.message_id ==
              calendar.chats.get(query.message.chat.id)
            ) {
              const res = calendar.clickButtonCalendar(query);
              if (res !== -1) {
                bot.sendMessage(chatId, "Вы выбрали: " + res);
                console.log(res);
                reminder.date = res;
                const remindOptions = {
                  reply_markup: {
                    inline_keyboard: [
                      [
                        { text: "5 минут", callback_data: "remind:5" },
                        { text: "10 минут", callback_data: "remind:10" },
                        { text: "30 минут", callback_data: "remind:30" },
                        { text: "1 час", callback_data: "remind:60" },
                      ],
                    ],
                  },
                };

                bot
                  .sendMessage(
                    chatId,
                    "Выберите время за которое мне вас оповестить:",
                    remindOptions
                  )
                  .catch((error) => {
                    console.error("Error in awaitDate:", error);
                  });
              }
            }
          });

          bot.on("callback_query", (query) => {
            const remindTime = parseInt(query.data.split(":")[1]);
            if (!isNaN(remindTime)) {
              reminder.remindBefore = remindTime;

              const reminderMessage = `Я вас оповещу по вашему напоминанию "${reminder.text}" за ${remindTime} минут, ${reminder.date}`;
              bot.sendMessage(chatId, reminderMessage, {
                reply_markup: {
                  inline_keyboard: [
                    [
                      {
                        text: "Спасибо",
                        callback_data: "thank_you",
                      },
                    ],
                  ],
                },
              });
              console.log(reminder.date);
              const remindDate = new Date(
                new Date(reminder.date) - remindTime * 60000
              );

              schedule.scheduleJob(remindDate, () => {
                bot.sendMessage(chatId, `Напоминание: "${reminder.text}"`);
              });
            }
          });
        });
      })
      .catch((error) => {
        console.error("Error sending message:", error);
      });
  }
});
bot.on("callback_query", (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data.startsWith("delete:")) {
    const indexToDelete = parseInt(data.split(":")[1]);
    if (indexToDelete >= 0 && indexToDelete < tasks.length) {
      tasks.splice(indexToDelete, 1);
      bot.editMessageText("Задача удалена.", {
        chat_id: chatId,
        message_id: query.message.message_id,
      });
    }
  } else {
    const taskIndex = parseInt(data);
    if (taskIndex >= 0 && taskIndex < tasks.length) {
      tasks[taskIndex].done = !tasks[taskIndex].done;
      const newText = `${taskIndex + 1}. ${tasks[taskIndex].task} ${
        tasks[taskIndex].done ? "✅" : "🕗"
      }`;
      bot.editMessageText(newText, {
        chat_id: chatId,
        message_id: query.message.message_id,
        reply_markup: {
          inline_keyboard: tasks.map((task, index) => [
            {
              text: `${index + 1}. ${task.task} ${task.done ? "✅" : "🕗"}`,
              callback_data: index.toString(),
            },
            { text: "🗑️", callback_data: `delete:${index}` },
          ]),
        },
      });
    }
  }
});

// Запуск бота
bot.on("polling_error", (error) => {
  console.error(error);
});
console.error("Я тут!");
