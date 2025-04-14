# Концепция промпт-программы
Развитие нейросетей сделало возможными некоторые ранее сложные вещи. Сейчас хочу показать такую вещь как промпт-программа.
В классическом программировании мы пишем какой-то код и компьютер его компилирует и выполняет. 
В вайб програмировании мы пишем инструкции на естественном языке и нейросеть превращяет их в классический код, который затем компилируется и выполняется.
Но зачем нам классический код, когда нейросеть может сама выпонить алгоритм заданный на естественном языке?
Конечно, сейчас, это дорого, но поразвлекаться можно. 
Пока звучит, наверно, не очень понятно. Давайте перейдем к реализации.

## Реализация для сайта
На страничке сайта, выводим 2 области:
1. Форма системного промпта, в который пользователь записываем алгоритм программы на естественном языке.
2. Область, в которую нейросеть генерирует интерфейс программы в html.

Пользователь забивает в форму, то что он хочет от программы, а нейросеть генерирует в область интерфейса код html и css. 
При кликах, вводах и других действиях пользователя в интерфейсе все его действия отправляются нейросети. 
А она модифицирует сответствующим образом область интерфейса, выполняя алгоритм программы.

Для безопасности, чтобы сайт продолжал работать, если нейросеть ошибется нужно ограничить взаимодействие нейросети только областью интерфейса.
Так же должна быть возможность остановить нейросеть и перегенирировать интерфейс.

Для сервера будем использовать node.js. Действия пользовавателя js скриптом отправляются на сервер. Сервер хранит ключи доступа к моделям нейросетей.
Используем openrouter.ai.
Пользователь может вебрать модель нейросети из разрешенных в конфиге сервера.

# промпт-программа: Развлекательно-познавательный проект

## Установка

### Предварительные требования
- Node.js (версия 14 или выше)
- npm (обычно устанавливается вместе с Node.js)
- Ключ API от [OpenRouter](https://openrouter.ai) (для доступа к моделям нейросетей)

### Шаги установки

1. Клонируйте репозиторий:
```bash
git clone https://github.com/ваш-аккаунт/promt-program.git
cd promt-program
```

2. Установите зависимости:
```bash
npm install
```

3. Настройте переменные окружения:
```bash
cp .env.example .env
```

4. Откройте файл `.env` и добавьте ваш API ключ от OpenRouter:
```
PORT=3000
OPENROUTER_API_KEY=ваш_ключ_api
```

## Запуск

### Запуск с реальным API (требуется ключ OpenRouter)
```bash
npm start
```

### Запуск с мок-сервером (без API ключа, для тестирования)
```bash
npm run dev
```

После запуска откройте браузер и перейдите по адресу `http://localhost:3000`

## Примеры промптов

### Калькулятор
```
Создай простой калькулятор с возможностью сложения, вычитания, умножения и деления двух чисел.
```

### Крестики-нолики
```
Создай игру "Крестики-нолики" на поле 3x3. Игрок ходит крестиками, компьютер - ноликами.
```

### Список задач
```
Создай список задач с возможностью добавления новых задач, отметки выполненных и удаления задач.
```

## Структура проекта

- `src/server.js` - основной сервер для работы с реальным API OpenRouter
- `src/mock-server.js` - мок-сервер для тестирования без API ключа
- `src/config.js` - конфигурация приложения и список доступных моделей
- `public/index.html` - основная HTML страница
- `public/styles.css` - стили приложения
- `public/script.js` - клиентский JavaScript

## Настройка

### Изменение списка доступных моделей

Список доступных моделей можно изменить в файле `src/config.js`. По умолчанию используются бесплатные модели или модели с бесплатной квотой.

### Изменение порта

Порт, на котором запускается сервер, можно изменить в файле `.env` (по умолчанию 3000).

### Настройка параметров запросов

Параметры запросов к OpenRouter (таймаут, максимальное количество токенов) можно изменить в файле `src/config.js`.

## Управление историей и комментарии

В интерфейсе приложения есть возможность:
- Сбросить историю взаимодействий с нейросетью
- Добавить комментарий для нейросети, чтобы уточнить или изменить поведение программы

## Лицензия

MIT
