const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const config = require('./config');

// Структура для хранения истории взаимодействий
const sessionHistory = new Map();

// Функция для форматирования действия пользователя в удобочитаемый текст
function formatUserAction(action) {
  let formattedAction = '';
  
  if (action.type === 'click') {
    formattedAction = `Пользователь кликнул на элемент ${action.element}`;
    
    if (action.id) {
      formattedAction += ` с id="${action.id}"`;
    }
    
    if (action.class) {
      formattedAction += ` с классом "${action.class}"`;
    }
    
    if (action.text) {
      formattedAction += ` с текстом "${action.text}"`;
    }
    
    if (action.value) {
      formattedAction += ` со значением "${action.value}"`;
    }
    
    if (action.dataset) {
      const dataset = JSON.parse(action.dataset);
      for (const [key, value] of Object.entries(dataset)) {
        formattedAction += ` с data-${key}="${value}"`;
      }
    }
    
    if (action.position) {
      formattedAction += ` с позицией "${action.position}"`;
    }
  } else if (action.type === 'change') {
    formattedAction = `Пользователь изменил значение элемента ${action.element}`;
    
    if (action.id) {
      formattedAction += ` с id="${action.id}"`;
    }
    
    if (action.class) {
      formattedAction += ` с классом "${action.class}"`;
    }
    
    formattedAction += ` на "${action.value}"`;
  }
  
  return formattedAction;
}

// Форматирование истории действий для нейросети
function formatActionHistory(actions) {
  if (!actions || actions.length === 0) {
    return [];
  }
  
  return [{
    role: 'system',
    content: `История действий пользователя (от старых к новым):
    ${actions.map((item, index) => 
      `${index + 1}. ${formatUserAction(item.action)} (${item.timestamp})`
    ).join('\n')}`
  }];
}

// Форматирование комментариев пользователя для нейросети
function formatUserComments(comments) {
  if (!comments || comments.length === 0) {
    return [];
  }
  
  return comments.map(comment => ({
    role: 'user',
    content: `Комментарий пользователя (${comment.timestamp}): ${comment.text}`
  }));
}

// Функция для форматирования истории диалога
function formatDialogHistory(dialogHistory) {
  if (!dialogHistory || dialogHistory.length === 0) {
    return [];
  }
  
  return dialogHistory.map(message => ({
    role: message.role,
    content: message.content
  }));
}

// Функция для извлечения HTML-кода из ответа модели
function extractHtmlFromResponse(response) {
  const htmlRegex = /```html\n([\s\S]*?)```/g;
  const matches = [];
  let match;
  
  while ((match = htmlRegex.exec(response)) !== null) {
    matches.push(match[1]);
  }
  
  return matches.join('\n');
}

// Инициализация Express приложения
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Маршрут для получения списка доступных моделей
app.get('/api/models', (req, res) => {
  // Если платные модели отключены, фильтруем их из списка
  const models = config.availableModels.map(model => ({
    ...model,
    disabled: model.isPaid && !config.enablePaidModels
  }));
  
  res.json(models);
});

// Получение текущей истории
app.get('/api/history', (req, res) => {
  const sessionId = req.ip || 'default';
  const history = sessionHistory.get(sessionId) || { actions: [], comments: [], lastReset: null };
  res.json(history);
});

// Сброс истории
app.post('/api/history/reset', (req, res) => {
  const sessionId = req.ip || 'default';
  sessionHistory.set(sessionId, { 
    actions: [], 
    comments: [], 
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
    
    // Ограничиваем историю диалога последними 20 сообщениями
    if (history.dialogHistory.length > 20) {
      history.dialogHistory = history.dialogHistory.slice(-20);
    }
    
    // Формирование запроса к OpenRouter
    const response = await axios.post(
      `${config.openRouterSettings.baseUrl}/chat/completions`,
      {
        model: modelId,
        messages: [
          {
            role: 'system',
            content: `Ты - помощник, который помогает модифицировать HTML интерфейс программы.
            Текущий алгоритм программы: ${systemPrompt}
            
            Текущий HTML интерфейса:
            ${currentHtml}
            
            Когда пользователь просит изменить интерфейс, отвечай, включая HTML-код изменений.
            
            ВАЖНО: Весь HTML-код должен быть в ОДНОМ блоке кода. Не разделяй HTML-код на несколько блоков.
            Используй ТОЛЬКО ОДИН блок с тройными обратными кавычками с указанием языка html для выделения HTML-кода.
            
            Пример правильного ответа:
            \`\`\`html
            <button id="sqrt-btn" style="background-color: #4CAF50; color: white; border: none; padding: 10px 15px; margin: 5px; border-radius: 4px; cursor: pointer;">√</button>
            \`\`\`
            
            Твой HTML-код должен содержать ПОЛНЫЙ код блока интерфейса, который будет автоматически применен.
            
            Важно: При создании HTML-кода убедись, что все интерактивные элементы имеют соответствующие атрибуты:
            - Для кнопок используй тег <button> с атрибутом id
            - Для кликабельных элементов добавляй атрибуты data-action или data-cell
            - Для ячеек в играх типа "крестики-нолики" добавляй атрибут data-cell с номером ячейки и класс "cell"
            - Для всех кликабельных элементов добавляй стиль cursor: pointer`
          },
          ...formatDialogHistory(history.dialogHistory)
        ],
        max_tokens: config.openRouterSettings.maxTokens
      },
      {
        headers: {
          'Authorization': `Bearer ${config.openRouterApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: config.openRouterSettings.timeout
      }
    );
    
    // Извлекаем ответ модели
    const modelResponse = response.data.choices[0].message.content;
    
    // Добавляем ответ модели в историю диалога
    history.dialogHistory.push({
      role: 'assistant',
      content: modelResponse,
      timestamp: new Date().toISOString()
    });
    
    // Сохраняем обновленную историю
    sessionHistory.set(sessionId, history);
    
    // Извлекаем HTML-код из ответа модели
    const htmlCode = extractHtmlFromResponse(modelResponse);
    
    // Возвращаем ответ клиенту
    res.json({
      response: modelResponse,
      html: htmlCode
    });
  } catch (error) {
    console.error('Ошибка при обработке диалога:', error);
    res.status(500).json({ 
      error: 'Ошибка при обработке диалога', 
      details: error.response?.data || error.message 
    });
  }
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
    // Формирование запроса к OpenRouter
    const response = await axios.post(
      `${config.openRouterSettings.baseUrl}/chat/completions`,
      {
        model: modelId,
        messages: [
          {
            role: 'system',
            content: `Ты - помощник, который генерирует HTML и CSS код для интерфейса программы на основе описания. 
            Генерируй только HTML и CSS код, без JavaScript. 
            Код должен быть полным, валидным и готовым к отображению.
            Не добавляй никаких пояснений или комментариев вне HTML.
            
            Важно: Если тебя просят создать игру или интерактивный интерфейс, убедись, что все интерактивные элементы имеют соответствующие атрибуты:
            - Для кнопок используй тег <button> с атрибутом id
            - Для кликабельных элементов добавляй атрибуты data-action или data-cell
            - Для ячеек в играх типа "крестики-нолики" добавляй атрибут data-cell с номером ячейки и класс "cell"
            - Для всех кликабельных элементов добавляй стиль cursor: pointer
            
            Это необходимо для правильной обработки взаимодействия пользователя с интерфейсом.`
          },
          {
            role: 'user',
            content: `Создай интерфейс для следующей программы: ${systemPrompt}`
          }
        ],
        max_tokens: config.openRouterSettings.maxTokens
      },
      {
        headers: {
          'Authorization': `Bearer ${config.openRouterApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: config.openRouterSettings.timeout
      }
    );
    
    // Извлечение HTML из ответа
    const generatedHtml = response.data.choices[0].message.content;
    
    res.json({ html: generatedHtml });
  } catch (error) {
    console.error('Ошибка при генерации интерфейса:', error);
    res.status(500).json({ 
      error: 'Ошибка при генерации интерфейса', 
      details: error.response?.data || error.message 
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
    // Получаем или создаем историю для текущей сессии
    const sessionId = req.ip || 'default';
    let history = sessionHistory.get(sessionId);
    if (!history) {
      history = { actions: [], comments: [], lastReset: null };
    }
    
    // Добавляем текущее действие в историю
    const parsedAction = JSON.parse(action);
    history.actions.push({
      action: parsedAction,
      timestamp: new Date().toISOString()
    });
    
    // Ограничиваем историю последними 20 действиями
    if (history.actions.length > 20) {
      history.actions = history.actions.slice(-20);
    }
    
    // Сохраняем обновленную историю
    sessionHistory.set(sessionId, history);
    
    // Формирование запроса к OpenRouter
    const response = await axios.post(
      `${config.openRouterSettings.baseUrl}/chat/completions`,
      {
        model: modelId,
        messages: [
          {
            role: 'system',
            content: `Ты - помощник, который модифицирует HTML и CSS код интерфейса программы на основе действий пользователя.
            Программа работает по следующему алгоритму: ${systemPrompt}
            
            Твоя задача - обновить HTML код в соответствии с действием пользователя и алгоритмом программы.
            Возвращай только HTML и CSS код, без JavaScript.
            Код должен быть полным, валидным и готовым к отображению.
            Не добавляй никаких пояснений или комментариев вне HTML.
            
            Перед обновлением HTML, внимательно проанализируй текущий HTML и определи:
            1. Какие элементы интерфейса присутствуют (кнопки, поля ввода, списки и т.д.)
            2. Какие значения содержат эти элементы
            3. Какие элементы активны/неактивны
            4. Какие данные отображаются пользователю
            
            Важно: При обновлении HTML сохраняй все атрибуты элементов, особенно:
            - Атрибуты id, class, data-* для всех элементов
            - Сохраняй атрибуты data-cell для всех ячеек
            - Для кнопок сохраняй атрибуты id и другие атрибуты
            - Для всех кликабельных элементов сохраняй стиль cursor: pointer
            `
          },
          // Добавляем историю действий пользователя
          ...formatActionHistory(history.actions),
          // Добавляем комментарии пользователя
          ...formatUserComments(history.comments),
          {
            role: 'user',
            content: `Текущий HTML интерфейса:
            
            ${currentHtml}
            
            Действие пользователя:
            ${formatUserAction(parsedAction)}
            
            Обнови HTML интерфейса в соответствии с этим действием и алгоритмом программы. 
            Убедись, что все элементы интерфейса сохраняют свои атрибуты и классы, чтобы они оставались кликабельными.
            `
          }
        ],
        max_tokens: config.openRouterSettings.maxTokens
      },
      {
        headers: {
          'Authorization': `Bearer ${config.openRouterApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: config.openRouterSettings.timeout
      }
    );
    
    // Извлечение обновленного HTML из ответа
    const updatedHtml = response.data.choices[0].message.content;
    
    res.json({ html: updatedHtml });
  } catch (error) {
    console.error('Ошибка при обработке действия:', error);
    res.status(500).json({ 
      error: 'Ошибка при обработке действия', 
      details: error.response?.data || error.message 
    });
  }
});

// Запуск сервера
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
