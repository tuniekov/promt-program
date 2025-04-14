const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');

// Структура для хранения истории взаимодействий
const sessionHistory = new Map();

// Инициализация Express приложения
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Функция для извлечения HTML-кода из ответа модели
function extractHtmlFromResponse(response) {
  const htmlRegex = /```html\n([\s\S]*?)```/g;
  const matches = [];
  let match;
  
  while ((match = htmlRegex.exec(response)) !== null) {
    matches.push(match[1]);
  }
  
  // Возвращаем весь HTML-код в одном блоке
  return matches.join('\n');
}

// Маршрут для получения списка доступных моделей
app.get('/api/models', (req, res) => {
  // Если платные модели отключены, фильтруем их из списка
  const models = config.availableModels.map(model => ({
    ...model,
    disabled: model.isPaid && !config.enablePaidModels
  }));
  
  res.json(models);
});

// Маршрут для генерации начального интерфейса
app.post('/api/generate', async (req, res) => {
  try {
    const { systemPrompt, modelId } = req.body;
    
    if (!systemPrompt) {
      return res.status(400).json({ error: 'Системный промт обязателен' });
    }
    
    // Проверка, что выбранная модель доступна
    const selectedModel = config.availableModels.find(model => model.id === modelId);
    if (!selectedModel) {
      return res.status(400).json({ error: 'Выбранная модель недоступна' });
    }
    
    // Проверка, что платная модель не используется при отключенных платных моделях
    if (selectedModel.isPaid && !config.enablePaidModels) {
      return res.status(403).json({ 
        error: 'Платные модели отключены', 
        message: 'Для использования платных моделей установите ENABLE_PAID_MODELS=true в файле .env'
      });
    }
    
    // Имитация задержки запроса к API
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Генерация простого HTML на основе промта
    const generatedHtml = generateMockHtml(systemPrompt);
    
    res.json({ html: generatedHtml });
  } catch (error) {
    console.error('Ошибка при генерации интерфейса:', error);
    res.status(500).json({ 
      error: 'Ошибка при генерации интерфейса', 
      details: error.message 
    });
  }
});

// Получение текущей истории
app.get('/api/history', (req, res) => {
  const sessionId = req.ip || 'default';
  const history = sessionHistory.get(sessionId) || { actions: [], comments: [], dialogHistory: [], lastReset: null };
  res.json(history);
});

// Сброс истории
app.post('/api/history/reset', (req, res) => {
  const sessionId = req.ip || 'default';
  sessionHistory.set(sessionId, { 
    actions: [], 
    comments: [], 
    dialogHistory: [],
    lastReset: new Date().toISOString() 
  });
  res.json({ success: true, message: 'История успешно сброшена' });
});

// Добавление комментария
app.post('/api/history/comment', (req, res) => {
  const { comment } = req.body;
  const sessionId = req.ip || 'default';
  
  if (!comment) {
    return res.status(400).json({ error: 'Комментарий обязателен' });
  }
  
  let history = sessionHistory.get(sessionId);
  if (!history) {
    history = { actions: [], comments: [], dialogHistory: [], lastReset: null };
  }
  
  history.comments.push({
    text: comment,
    timestamp: new Date().toISOString()
  });
  
  sessionHistory.set(sessionId, history);
  res.json({ success: true, message: 'Комментарий добавлен' });
});

// Маршрут для диалога с моделью
app.post('/api/dialog', async (req, res) => {
  try {
    const { systemPrompt, modelId, message, currentHtml } = req.body;
    
    if (!systemPrompt || !message || !currentHtml) {
      return res.status(400).json({ error: 'Не все обязательные поля заполнены' });
    }
    
    // Проверка, что выбранная модель доступна
    const selectedModel = config.availableModels.find(model => model.id === modelId);
    if (!selectedModel) {
      return res.status(400).json({ error: 'Выбранная модель недоступна' });
    }
    // Проверка, что платная модель не используется при отключенных платных моделях
    if (selectedModel.isPaid && !config.enablePaidModels) {
      return res.status(403).json({ 
        error: 'Платные модели отключены', 
        message: 'Для использования платных моделей установите ENABLE_PAID_MODELS=true в файле .env'
      });
    }
    // Получаем или создаем историю для текущей сессии
    const sessionId = req.ip || 'default';
    let history = sessionHistory.get(sessionId);
    if (!history) {
      history = { actions: [], comments: [], dialogHistory: [], lastReset: null };
    }
    
    // Добавляем сообщение пользователя в историю диалога
    if (!history.dialogHistory) {
      history.dialogHistory = [];
    }
    
    history.dialogHistory.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    });
    
    // Имитация задержки запроса к API
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Генерация ответа на основе сообщения пользователя
    let modelResponse = '';
    let htmlCode = '';
    
    // Простая логика для генерации ответа на основе ключевых слов
    const messageLower = message.toLowerCase();
    
    if (messageLower.includes('добавь кнопку') || messageLower.includes('добавить кнопку')) {
      const buttonName = messageLower.includes('кнопку для') 
        ? message.match(/кнопку для\s+([а-яА-Яa-zA-Z0-9\s]+)/i)?.[1] || 'действия'
        : 'Новая кнопка';
      
      modelResponse = `Я добавлю кнопку для ${buttonName}. Вот HTML-код:

\`\`\`html
<button id="new-button" style="background-color: #4CAF50; color: white; border: none; padding: 10px 15px; margin: 5px; border-radius: 4px; cursor: pointer;">${buttonName}</button>
\`\`\`

Кнопка добавлена в интерфейс. Теперь вы можете использовать её.`;

      htmlCode = `<button id="new-button" style="background-color: #4CAF50; color: white; border: none; padding: 10px 15px; margin: 5px; border-radius: 4px; cursor: pointer;">${buttonName}</button>`;
    }
    else if (messageLower.includes('изменить цвет') || messageLower.includes('поменять цвет')) {
      const color = messageLower.includes('на ') 
        ? message.match(/на\s+([а-яА-Яa-zA-Z]+)/i)?.[1] || 'синий'
        : 'синий';
      
      let colorCode = '#3498db'; // синий по умолчанию
      
      if (color.toLowerCase().includes('красн')) colorCode = '#e74c3c';
      else if (color.toLowerCase().includes('зелен')) colorCode = '#2ecc71';
      else if (color.toLowerCase().includes('желт')) colorCode = '#f1c40f';
      else if (color.toLowerCase().includes('оранж')) colorCode = '#e67e22';
      else if (color.toLowerCase().includes('фиолет')) colorCode = '#9b59b6';
      
      modelResponse = `Я изменю цвет на ${color}. Вот HTML-код для обновления стиля:

\`\`\`html
<style>
  .container {
    background-color: ${colorCode};
    color: white;
  }
</style>
\`\`\`

Цвет контейнера изменен на ${color}.`;

      htmlCode = `<style>
  .container {
    background-color: ${colorCode};
    color: white;
  }
</style>`;
    }
    else if (messageLower.includes('добавь заголовок') || messageLower.includes('добавить заголовок')) {
      const title = messageLower.includes('заголовок "') 
        ? message.match(/заголовок\s+"([^"]+)"/i)?.[1] || 'Новый заголовок'
        : 'Новый заголовок';
      
      modelResponse = `Я добавлю заголовок "${title}". Вот HTML-код:

\`\`\`html
<h2 style="color: #333; margin-top: 20px;">${title}</h2>
\`\`\`

Заголовок добавлен в интерфейс.`;

      htmlCode = `<h2 style="color: #333; margin-top: 20px;">${title}</h2>`;
    }
    else {
      modelResponse = `Я понимаю ваш запрос, но не могу сгенерировать подходящий HTML-код для него. Пожалуйста, попробуйте более конкретный запрос, например:
      
- Добавь кнопку для [действия]
- Измени цвет на [цвет]
- Добавь заголовок "[текст]"

Это поможет мне лучше понять, что вы хотите изменить в интерфейсе.`;
    }
    
    // Добавляем ответ модели в историю диалога
    history.dialogHistory.push({
      role: 'assistant',
      content: modelResponse,
      timestamp: new Date().toISOString()
    });
    
    // Сохраняем обновленную историю
    sessionHistory.set(sessionId, history);
    
    // Возвращаем ответ клиенту
    res.json({
      response: modelResponse,
      html: htmlCode
    });
  } catch (error) {
    console.error('Ошибка при обработке диалога:', error);
    res.status(500).json({ 
      error: 'Ошибка при обработке диалога', 
      details: error.message 
    });
  }
});

// Маршрут для обработки действий пользователя
app.post('/api/interact', async (req, res) => {
  try {
    const { systemPrompt, modelId, currentHtml, action } = req.body;
    
    if (!systemPrompt || !currentHtml || !action) {
      return res.status(400).json({ error: 'Не все обязательные поля заполнены' });
    }
    
    // Проверка, что выбранная модель доступна
    const selectedModel = config.availableModels.find(model => model.id === modelId);
    if (!selectedModel) {
      return res.status(400).json({ error: 'Выбранная модель недоступна' });
    }
    // Проверка, что платная модель не используется при отключенных платных моделях
    if (selectedModel.isPaid && !config.enablePaidModels) {
      return res.status(403).json({ 
        error: 'Платные модели отключены', 
        message: 'Для использования платных моделей установите ENABLE_PAID_MODELS=true в файле .env'
      });
    }
    // Имитация задержки запроса к API
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Обработка действия пользователя
    const updatedHtml = handleMockAction(systemPrompt, currentHtml, JSON.parse(action));
    
    res.json({ html: updatedHtml });
  } catch (error) {
    console.error('Ошибка при обработке действия:', error);
    res.status(500).json({ 
      error: 'Ошибка при обработке действия', 
      details: error.message 
    });
  }
});

// Функция для генерации мок-HTML на основе промта
function generateMockHtml(prompt) {
  // Простая логика для генерации HTML на основе ключевых слов в промте
  let html = `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Сгенерированный интерфейс</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        h1 {
            color: #333;
            text-align: center;
        }
        button {
            background-color: #4CAF50;
            color: white;
            border: none;
            padding: 10px 15px;
            margin: 5px;
            border-radius: 4px;
            cursor: pointer;
        }
        button:hover {
            background-color: #45a049;
        }
        input, textarea {
            width: 100%;
            padding: 10px;
            margin: 10px 0;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        .result {
            margin-top: 20px;
            padding: 15px;
            background-color: #f9f9f9;
            border-radius: 4px;
            border: 1px solid #ddd;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Интерфейс программы</h1>`;

  // Добавление элементов в зависимости от ключевых слов в промте
  const promptLower = prompt.toLowerCase();
  
  // Калькулятор
  if (promptLower.includes('калькулятор')) {
    html += `
        <div>
            <input type="number" id="num1" placeholder="Первое число">
            <input type="number" id="num2" placeholder="Второе число">
            <div>
                <button id="add">Сложить</button>
                <button id="subtract">Вычесть</button>
                <button id="multiply">Умножить</button>
                <button id="divide">Разделить</button>
            </div>
            <div class="result" id="result">Результат: </div>
        </div>`;
  }
  
  // Список задач
  else if (promptLower.includes('список') || promptLower.includes('задач') || promptLower.includes('todo')) {
    html += `
        <div>
            <input type="text" id="task-input" placeholder="Введите задачу...">
            <button id="add-task">Добавить задачу</button>
            <ul id="task-list">
                <li>Пример задачи 1</li>
                <li>Пример задачи 2</li>
            </ul>
        </div>`;
  }
  
  // Форма обратной связи
  else if (promptLower.includes('форма') || promptLower.includes('обратная связь') || promptLower.includes('контакт')) {
    html += `
        <div>
            <h2>Форма обратной связи</h2>
            <input type="text" id="name" placeholder="Ваше имя">
            <input type="email" id="email" placeholder="Ваш email">
            <textarea id="message" placeholder="Ваше сообщение" rows="5"></textarea>
            <button id="send">Отправить</button>
            <div class="result" id="form-result"></div>
        </div>`;
  }
  
  // Игра
  else if (promptLower.includes('игра') || promptLower.includes('угадай')) {
    html += `
        <div>
            <h2>Угадай число</h2>
            <p>Я загадал число от 1 до 100. Попробуйте угадать!</p>
            <input type="number" id="guess" placeholder="Ваш вариант">
            <button id="check-guess">Проверить</button>
            <div class="result" id="game-result"></div>
        </div>`;
  }
  
  // По умолчанию - простой интерфейс
  else {
    html += `
        <div>
            <h2>Демонстрационный интерфейс</h2>
            <p>Это демонстрационный интерфейс, сгенерированный на основе вашего промта.</p>
            <input type="text" id="input" placeholder="Введите текст...">
            <button id="action-button">Выполнить действие</button>
            <div class="result" id="demo-result"></div>
        </div>`;
  }
  
  html += `
    </div>
</body>
</html>`;

  return html;
}

// Функция для обработки действий пользователя
function handleMockAction(prompt, currentHtml, action) {
  // Простая логика для обновления HTML на основе действия пользователя
  let updatedHtml = currentHtml;
  
  // Обработка действий для калькулятора
  if (action.type === 'click' && ['add', 'subtract', 'multiply', 'divide'].includes(action.id)) {
    // Извлекаем DOM из HTML
    const parser = new (require('jsdom').JSDOM)(currentHtml);
    const document = parser.window.document;
    
    // Получаем значения и выполняем операцию
    const num1 = parseFloat(document.getElementById('num1').value) || 0;
    const num2 = parseFloat(document.getElementById('num2').value) || 0;
    
    let result = 0;
    switch (action.id) {
      case 'add': result = num1 + num2; break;
      case 'subtract': result = num1 - num2; break;
      case 'multiply': result = num1 * num2; break;
      case 'divide': result = num2 !== 0 ? num1 / num2 : 'Ошибка: деление на ноль'; break;
    }
    
    // Обновляем результат
    document.getElementById('result').textContent = `Результат: ${result}`;
    
    // Получаем обновленный HTML
    updatedHtml = parser.serialize();
  }
  
  // Обработка действий для списка задач
  else if (action.type === 'click' && action.id === 'add-task') {
    // Извлекаем DOM из HTML
    const parser = new (require('jsdom').JSDOM)(currentHtml);
    const document = parser.window.document;
    
    // Получаем значение ввода
    const taskInput = document.getElementById('task-input');
    const taskText = taskInput.value.trim();
    
    if (taskText) {
      // Создаем новый элемент списка
      const taskList = document.getElementById('task-list');
      const newTask = document.createElement('li');
      newTask.textContent = taskText;
      taskList.appendChild(newTask);
      
      // Очищаем поле ввода
      taskInput.value = '';
    }
    
    // Получаем обновленный HTML
    updatedHtml = parser.serialize();
  }
  
  // Обработка действий для формы обратной связи
  else if (action.type === 'click' && action.id === 'send') {
    // Извлекаем DOM из HTML
    const parser = new (require('jsdom').JSDOM)(currentHtml);
    const document = parser.window.document;
    
    // Получаем значения полей
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const message = document.getElementById('message').value.trim();
    
    // Проверяем заполнение полей
    if (name && email && message) {
      document.getElementById('form-result').textContent = 'Сообщение успешно отправлено!';
    } else {
      document.getElementById('form-result').textContent = 'Пожалуйста, заполните все поля.';
    }
    
    // Получаем обновленный HTML
    updatedHtml = parser.serialize();
  }
  
  // Обработка действий для игры "Угадай число"
  else if (action.type === 'click' && action.id === 'check-guess') {
    // Извлекаем DOM из HTML
    const parser = new (require('jsdom').JSDOM)(currentHtml);
    const document = parser.window.document;
    
    // Получаем значение ввода
    const guessInput = document.getElementById('guess');
    const guess = parseInt(guessInput.value);
    
    // Генерируем "загаданное" число (для демонстрации используем псевдослучайное число)
    const secretNumber = Math.floor((guess + 10) % 100) + 1;
    
    // Проверяем угадал ли пользователь
    let resultText = '';
    if (isNaN(guess)) {
      resultText = 'Пожалуйста, введите число.';
    } else if (guess === secretNumber) {
      resultText = 'Поздравляем! Вы угадали число!';
    } else if (guess < secretNumber) {
      resultText = 'Загаданное число больше.';
    } else {
      resultText = 'Загаданное число меньше.';
    }
    
    document.getElementById('game-result').textContent = resultText;
    
    // Получаем обновленный HTML
    updatedHtml = parser.serialize();
  }
  
  // Обработка действий для демонстрационного интерфейса
  else if (action.type === 'click' && action.id === 'action-button') {
    // Извлекаем DOM из HTML
    const parser = new (require('jsdom').JSDOM)(currentHtml);
    const document = parser.window.document;
    
    // Получаем значение ввода
    const input = document.getElementById('input').value.trim();
    
    // Обновляем результат
    if (input) {
      document.getElementById('demo-result').textContent = `Вы ввели: ${input}`;
    } else {
      document.getElementById('demo-result').textContent = 'Пожалуйста, введите текст.';
    }
    
    // Получаем обновленный HTML
    updatedHtml = parser.serialize();
  }
  
  return updatedHtml;
}

// Запуск сервера
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`Мок-сервер запущен на порту ${PORT}`);
});
