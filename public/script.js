document.addEventListener('DOMContentLoaded', () => {
    // Элементы DOM
    const systemPromptTextarea = document.getElementById('system-prompt');
    const modelSelect = document.getElementById('model-select');
    const generateBtn = document.getElementById('generate-btn');
    const stopBtn = document.getElementById('stop-btn');
    const regenerateBtn = document.getElementById('regenerate-btn');
    const statusDiv = document.getElementById('status');
    const interfaceFrame = document.getElementById('interface-frame');
    const resetHistoryBtn = document.getElementById('reset-history-btn');
    const dialogHistory = document.getElementById('dialog-history');
    const userMessageTextarea = document.getElementById('user-message');
    const sendMessageBtn = document.getElementById('send-message-btn');
    
    // Состояние приложения
    let isGenerating = false;
    let currentSystemPrompt = '';
    let currentModelId = '';
    let abortController = null;
    
    // Загрузка списка моделей и истории диалога при загрузке страницы
    loadModels();
    loadDialogHistory();
    
    // Обработчики событий
    generateBtn.addEventListener('click', handleGenerate);
    stopBtn.addEventListener('click', handleStop);
    regenerateBtn.addEventListener('click', handleRegenerate);
    resetHistoryBtn.addEventListener('click', handleResetHistory);
    sendMessageBtn.addEventListener('click', handleSendMessage);
    
    // Обработка нажатия Enter в поле сообщения
    userMessageTextarea.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSendMessage();
        }
    });
    
    // Функция загрузки истории диалога
    async function loadDialogHistory() {
        try {
            const response = await fetch('/api/history');
            if (!response.ok) {
                throw new Error(i18n('error_loading_history', 'Ошибка при загрузке истории'));
            }
            
            const history = await response.json();
            
            // Если есть история диалога, отображаем ее
            if (history.dialogHistory && history.dialogHistory.length > 0) {
                history.dialogHistory.forEach(message => {
                    addMessageToHistory(message.role, message.content);
                });
            }
        } catch (error) {
            console.error(i18n('error_loading_history', 'Ошибка при загрузке истории диалога:'), error);
        }
    }
    
    // Функция загрузки списка моделей
    async function loadModels() {
        try {
            setStatus(i18n('status_loading_models', 'Загрузка списка моделей...'), 'loading');
            
            const response = await fetch('/api/models');
            if (!response.ok) {
                throw new Error(i18n('error_loading_models', 'Ошибка при загрузке моделей'));
            }
            
            const models = await response.json();
            
            // Очистка и заполнение выпадающего списка
            modelSelect.innerHTML = '';
            
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = `${model.name} - ${model.description}`;
                
                // Если модель отключена, делаем ее недоступной для выбора
                if (model.disabled) {
                    option.disabled = true;
                    option.textContent += ' ' + i18n('status_model_unavailable', '(Недоступно)');
                }
                
                modelSelect.appendChild(option);
            });
            
            // Выбор первой модели по умолчанию
            if (models.length > 0) {
                modelSelect.value = models[0].id;
            }
            
            setStatus(i18n('status_ready', ''), '');
        } catch (error) {
            console.error(i18n('error_loading_models', 'Ошибка при загрузке моделей:'), error);
            setStatus(i18n('error_loading_models', 'Ошибка при загрузке моделей: ') + error.message, 'error');
        }
    }
    
    // Функция генерации интерфейса
    async function handleGenerate() {
        const systemPrompt = systemPromptTextarea.value.trim();
        const modelId = modelSelect.value;
        
        if (!systemPrompt) {
            setStatus(i18n('error_empty_prompt', 'Пожалуйста, введите системный промт'), 'error');
            return;
        }
        
        if (!modelId) {
            setStatus(i18n('error_select_model', 'Пожалуйста, выберите модель'), 'error');
            return;
        }
        
        try {
            setGeneratingState(true);
            setStatus(i18n('status_generating', 'Генерация интерфейса...'), 'loading');
            
            // Сохранение текущего промта и модели
            currentSystemPrompt = systemPrompt;
            currentModelId = modelId;
            
            // Создание нового AbortController для возможности отмены запроса
            abortController = new AbortController();
            
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ systemPrompt, modelId }),
                signal: abortController.signal
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || i18n('error_generation', 'Ошибка при генерации интерфейса'));
            }
            
            const data = await response.json();
            
            // Обновление iframe с сгенерированным HTML
            updateInterface(data.html);
            
            setStatus(i18n('status_generation_success', 'Интерфейс успешно сгенерирован'), 'success');
            setGeneratingState(false, true); // Включаем кнопку регенерации
        } catch (error) {
            if (error.name === 'AbortError') {
                setStatus(i18n('status_generation_canceled', 'Генерация интерфейса отменена'), 'error');
            } else {
                console.error(i18n('error_generation', 'Ошибка при генерации интерфейса:'), error);
                setStatus(i18n('error_generation', 'Ошибка при генерации интерфейса: ') + error.message, 'error');
            }
            setGeneratingState(false);
        }
    }
    
    // Функция остановки генерации
    function handleStop() {
        if (abortController) {
            abortController.abort();
            abortController = null;
        }
        setGeneratingState(false);
    }
    
    // Функция регенерации интерфейса
    function handleRegenerate() {
        if (currentSystemPrompt && currentModelId) {
            systemPromptTextarea.value = currentSystemPrompt;
            modelSelect.value = currentModelId;
            handleGenerate();
        }
    }
    
    // Функция обновления интерфейса
    function updateInterface(html) {
        // Получаем документ внутри iframe
        const frameDoc = interfaceFrame.contentDocument || interfaceFrame.contentWindow.document;
        
        // Очищаем содержимое iframe
        frameDoc.open();
        frameDoc.write(html);
        frameDoc.close();
        
        // Добавляем обработчики событий для элементов внутри iframe
        setupFrameEventListeners();
    }
    
    // Функция настройки обработчиков событий для элементов внутри iframe
    function setupFrameEventListeners() {
        const frameDoc = interfaceFrame.contentDocument || interfaceFrame.contentWindow.document;
        
        // Добавляем обработчики для всех интерактивных элементов
        const interactiveElements = frameDoc.querySelectorAll('button, input, select, textarea, a');
        
        interactiveElements.forEach(element => {
            // Для кнопок и ссылок - обработка клика
            if (element.tagName === 'BUTTON' || element.tagName === 'A') {
                element.addEventListener('click', (event) => {
                    event.preventDefault(); // Предотвращаем стандартное поведение
                    handleUserAction({
                        type: 'click',
                        element: element.tagName.toLowerCase(),
                        id: element.id,
                        class: element.className,
                        text: element.textContent.trim(),
                        value: element.value
                    });
                });
            }
            
            // Для полей ввода - обработка изменения значения
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT') {
                element.addEventListener('change', () => {
                    handleUserAction({
                        type: 'change',
                        element: element.tagName.toLowerCase(),
                        id: element.id,
                        class: element.className,
                        value: element.value
                    });
                });
            }
        });
        
        // Добавляем обработчики для элементов игры "крестики-нолики" и других кликабельных элементов
        const clickableElements = frameDoc.querySelectorAll('div, td, th, span, li');
        
        clickableElements.forEach(element => {
            // Проверяем, есть ли у элемента атрибуты, указывающие на то, что он кликабельный
            const isClickable = 
                element.hasAttribute('data-cell') || // Для ячеек крестиков-ноликов
                element.hasAttribute('data-action') || // Для элементов с действиями
                element.classList.contains('cell') || // Для ячеек с классом cell
                element.classList.contains('clickable') || // Для элементов с классом clickable
                element.style.cursor === 'pointer'; // Для элементов с курсором pointer
            
            if (isClickable) {
                element.addEventListener('click', (event) => {
                    event.preventDefault(); // Предотвращаем стандартное поведение
                    handleUserAction({
                        type: 'click',
                        element: element.tagName.toLowerCase(),
                        id: element.id,
                        class: element.className,
                        text: element.textContent.trim(),
                        dataset: JSON.stringify(element.dataset), // Добавляем data-атрибуты
                        position: element.hasAttribute('data-cell') ? element.getAttribute('data-cell') : null // Позиция ячейки для крестиков-ноликов
                    });
                });
            }
        });
    }
    
    // Функция обработки действий пользователя
    async function handleUserAction(action) {
        if (isGenerating) return;
        
        try {
            setGeneratingState(true);
            setStatus(i18n('status_processing_action', 'Обработка действия...'), 'loading');
            
            // Получаем текущий HTML интерфейса
            const frameDoc = interfaceFrame.contentDocument || interfaceFrame.contentWindow.document;
            const currentHtml = frameDoc.documentElement.outerHTML;
            
            // Создание нового AbortController для возможности отмены запроса
            abortController = new AbortController();
            
            const response = await fetch('/api/interact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    systemPrompt: currentSystemPrompt,
                    modelId: currentModelId,
                    currentHtml: currentHtml,
                    action: JSON.stringify(action)
                }),
                signal: abortController.signal
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || i18n('error_action_processing', 'Ошибка при обработке действия'));
            }
            
            const data = await response.json();
            
            // Обновление iframe с обновленным HTML
            updateInterface(data.html);
            
            setStatus(i18n('status_action_processed', 'Действие обработано'), 'success');
            setGeneratingState(false, true); // Включаем кнопку регенерации
        } catch (error) {
            if (error.name === 'AbortError') {
                setStatus(i18n('status_action_canceled', 'Обработка действия отменена'), 'error');
            } else {
                console.error(i18n('error_action_processing', 'Ошибка при обработке действия:'), error);
                setStatus(i18n('error_action_processing', 'Ошибка при обработке действия: ') + error.message, 'error');
            }
            setGeneratingState(false, true); // Включаем кнопку регенерации
        }
    }
    
    // Функция установки состояния генерации
    function setGeneratingState(generating, enableRegenerate = false) {
        isGenerating = generating;
        
        // Управление состоянием кнопок
        generateBtn.disabled = generating;
        stopBtn.disabled = !generating;
        regenerateBtn.disabled = !(enableRegenerate && !generating);
    }
    
    // Функция сброса истории
    async function handleResetHistory() {
        try {
            setStatus(i18n('status_resetting_history', 'Сброс истории...'), 'loading');
            
            const response = await fetch('/api/history/reset', {
                method: 'POST'
            });
            
            if (!response.ok) {
                throw new Error(i18n('error_history_reset', 'Ошибка при сбросе истории'));
            }
            
            // Очищаем историю диалога
            dialogHistory.innerHTML = '';
            
            setStatus(i18n('status_history_reset', 'История успешно сброшена'), 'success');
        } catch (error) {
            console.error(i18n('error_history_reset', 'Ошибка при сбросе истории:'), error);
            setStatus(i18n('error_history_reset', 'Ошибка при сбросе истории: ') + error.message, 'error');
        }
    }
    
    // Функция отправки сообщения в диалоге
    async function handleSendMessage() {
        const message = userMessageTextarea.value.trim();
        
        if (!message) {
            setStatus(i18n('error_empty_message', 'Пожалуйста, введите сообщение'), 'error');
            return;
        }
        
        if (!currentSystemPrompt || !currentModelId) {
            setStatus(i18n('error_generate_first', 'Сначала сгенерируйте интерфейс'), 'error');
            return;
        }
        
        try {
            setGeneratingState(true);
            setStatus(i18n('status_sending_message', 'Отправка сообщения...'), 'loading');
            
            // Добавляем сообщение пользователя в историю диалога
            addMessageToHistory('user', message);
            
            // Получаем текущий HTML интерфейса
            const frameDoc = interfaceFrame.contentDocument || interfaceFrame.contentWindow.document;
            const currentHtml = frameDoc.documentElement.outerHTML;
            
            // Очищаем поле ввода
            userMessageTextarea.value = '';
            
            // Создание нового AbortController для возможности отмены запроса
            abortController = new AbortController();
            
            const response = await fetch('/api/dialog', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    systemPrompt: currentSystemPrompt,
                    modelId: currentModelId,
                    message: message,
                    currentHtml: currentHtml
                }),
                signal: abortController.signal
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || i18n('error_message_processing', 'Ошибка при обработке сообщения'));
            }
            
            const data = await response.json();
            
            // Добавляем ответ модели в историю диалога
            addMessageToHistory('assistant', data.response);
            
            // Если в ответе есть HTML-код, обновляем интерфейс
            if (data.html) {
                // Получаем текущий HTML интерфейса
                const frameDoc = interfaceFrame.contentDocument || interfaceFrame.contentWindow.document;
                const currentHtml = frameDoc.documentElement.outerHTML;
                
                // Вставляем HTML-код в текущий интерфейс
                const updatedHtml = injectHtmlIntoInterface(currentHtml, data.html);
                
                // Обновляем интерфейс
                updateInterface(updatedHtml);
            }
            
            setStatus(i18n('status_message_processed', 'Сообщение обработано'), 'success');
            setGeneratingState(false, true);
        } catch (error) {
            if (error.name === 'AbortError') {
                setStatus(i18n('status_message_canceled', 'Обработка сообщения отменена'), 'error');
            } else {
                console.error(i18n('error_message_processing', 'Ошибка при обработке сообщения:'), error);
                setStatus(i18n('error_message_processing', 'Ошибка при обработке сообщения: ') + error.message, 'error');
            }
            setGeneratingState(false, true);
        }
    }
    
    // Функция добавления сообщения в историю диалога
    function addMessageToHistory(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `dialog-message ${role}`;
        
        // Форматирование содержимого сообщения
        let formattedContent = content;
        
        // Заменяем блоки кода на отформатированные блоки
        formattedContent = formattedContent.replace(/```html\n([\s\S]*?)```/g, (match, code) => {
            return `<pre><code class="html-code">${escapeHtml(code)}</code></pre>`;
        });
        
        // Заменяем обычные блоки кода
        formattedContent = formattedContent.replace(/```([\s\S]*?)```/g, (match, code) => {
            return `<pre><code>${escapeHtml(code)}</code></pre>`;
        });
        
        // Заменяем переносы строк на <br>
        formattedContent = formattedContent.replace(/\n/g, '<br>');
        
        messageDiv.innerHTML = formattedContent;
        dialogHistory.appendChild(messageDiv);
        
        // Прокручиваем историю диалога вниз
        dialogHistory.scrollTop = dialogHistory.scrollHeight;
    }
    
    // Функция для вставки HTML-кода в текущий интерфейс
    function injectHtmlIntoInterface(currentHtml, htmlToInject) {
        // Создаем временный DOM-элемент для работы с HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = currentHtml;
        
        // Находим тег body
        const body = tempDiv.querySelector('body');
        
        if (body) {
            // Вставляем HTML-код в конец body
            body.innerHTML += htmlToInject;
            return tempDiv.innerHTML;
        }
        
        return currentHtml;
    }
    
    // Функция для экранирования HTML
    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
    
    // Функция установки статуса
    function setStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.className = 'status';
        
        if (type) {
            statusDiv.classList.add(type);
        }
    }
});
