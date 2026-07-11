# Browser MCP Server — Инструкция по применению

Полная инструкция по установке и использованию MCP сервера для автоматизации браузера с анти-детекцией.

---

## Содержание

1. [Требования](#требования)
2. [Установка](#установка)
3. [Подключение к Claude Code](#подключение-к-claude-code)
4. [Подключение к Claude Desktop](#подключение-к-claude-desktop)
5. [Быстрый старт](#быстрый-старт)
6. [Основные команды](#основные-команды)
7. [Работа с профилями](#работа-с-профилями)
8. [Stealth Mode (анти-детекция)](#stealth-mode)
9. [Подключение к запущенному браузеру](#подключение-к-запущенному-браузеру)
10. [Примеры сценариев](#примеры-сценариев)
11. [Решение проблем](#решение-проблем)
12. [Часто задаваемые вопросы](#часто-задаваемые-вопросы)

---

## Требования

| Компонент | Минимальная версия |
|-----------|-------------------|
| Node.js | 18+ |
| npm | 8+ |
| Chrome/Chromium | Любой современный |

### Проверка

```bash
node --version      # Должно быть v18+
npm --version       # Должно быть 8+
which google-chrome # Или chromium, firefox, edge
```

---

## Установка

### Способ 1: Копирование файлов

```bash
# Скопируйте папку browser-mcp-template на свою машину
scp -r root@server:/root/browser-mcp-template ~/browser-mcp

# Перейдите в папку
cd ~/browser-mcp

# Установите зависимости
npm install
```

### Способ 2: Клонирование (если есть репозиторий)

```bash
git clone <repo-url> ~/browser-mcp
cd ~/browser-mcp
npm install
```

### Проверка установки

```bash
# Запустите тест
node -e "import('./index.js').then(() => console.log('OK'))"
# Должно вывести: Browser MCP Server running on stdio
```

---

## Подключение к Claude Code

### Автоматическое подключение

```bash
claude mcp add browser node ~/browser-mcp/index.js
```

### Ручное подключение

Добавьте в файл `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "browser": {
      "command": "node",
      "args": ["/root/browser-mcp/index.js"]
    }
  }
}
```

### Проверка

```bash
claude mcp list
# Должно показать: browser
```

---

## Подключение к Claude Desktop

### macOS

Файл: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "browser": {
      "command": "node",
      "args": ["/Users/ваше-имя/browser-mcp/index.js"]
    }
  }
}
```

### Windows

Файл: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "browser": {
      "command": "node",
      "args": ["C:\\Users\\ваше-имя\\browser-mcp\\index.js"]
    }
  }
}
```

### Linux

Файл: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "browser": {
      "command": "node",
      "args": ["/home/ваше-имя/browser-mcp/index.js"]
    }
  }
}
```

---

## Быстрый старт

После подключения MCP сервера, просто напишите в Claude:

```
Открой https://example.com и сделай скриншот
```

Или более сложная задача:

```
Зайди на GitHub, найди репозиторий kubernetes и получи список файлов
```

---

## Основные команды

### Навигация

```
Открой https://google.com
Перейди на https://github.com
```

### Клик и ввод

```
Кликни по кнопке "Sign In"
Введи "myuser" в поле username
```

### Скриншоты

```
Сделай скриншот текущей страницы
Сделай скриншот элемента .header
```

### Получение информации

```
Получи текст страницы
Получи HTML элемента .content
```

### JavaScript

```
Выполни JavaScript: document.title
Получи значение localStorage
```

---

## Полный список инструментов

### Навигация и управление

| Инструмент | Описание | Пример |
|------------|----------|--------|
| `browser_navigate` | Открыть URL | `browser_navigate(url="https://google.com")` |
| `browser_click` | Кликнуть | `browser_click(selector="#btn")` |
| `browser_type` | Ввести текст | `browser_type(selector="input", text="hello")` |
| `browser_screenshot` | Скриншот | `browser_screenshot()` |
| `browser_get_text` | Текст страницы | `browser_get_text()` |
| `browser_get_html` | HTML элемента | `browser_get_html(selector=".card")` |
| `browser_evaluate` | JavaScript | `browser_evaluate(script="document.title")` |
| `browser_wait` | Ожидание | `browser_wait(selector="#load")` |
| `browser_select` | Выбор опции | `browser_select(selector="select", value="1")` |
| `browser_scroll` | Прокрутка | `browser_scroll(direction="down")` |
| `browser_hover` | Наведение | `browser_hover(selector=".menu")` |
| `browser_upload` | Загрузка файла | `browser_upload(selector="input[type=file]")` |
| `browser_press` | Нажатие клавиши | `browser_press(key="Enter")` |

### Вкладки и информация

| Инструмент | Описание |
|------------|----------|
| `browser_list_tabs` | Список вкладок |
| `browser_switch_tab` | Переключить вкладку |
| `browser_get_info` | URL и заголовок |
| `browser_get_browser_info` | Информация о браузере |
| `browser_check_stealth` | Проверка stealth mode |
| `browser_close` | Закрыть браузер |

### Профили и куки

| Инструмент | Описание |
|------------|----------|
| `browser_auto_connect` | Автодетект профиля |
| `browser_list_profiles` | Список профилей |
| `browser_detect_active_profile` | Активный профиль |
| `browser_get_cookies` | Получить куки |
| `browser_set_cookie` | Установить куку |
| `browser_delete_cookie` | Удалить куку |
| `browser_connect` | К запущенному браузеру |
| `browser_start_with_debug` | Запуск с debug портом |

---

## Работа с профилями

### Автодетект (рекомендуется)

```javascript
// Сервер автоматически найдёт профиль с куками
browser_auto_connect({ url: "https://github.com" })
```

### Через навигацию

```javascript
// Автодетект
browser_navigate({ url: "https://github.com", profile: "auto" })

// Основной профиль
browser_navigate({ url: "https://github.com", profile: "default" })

// Чистая сессия
browser_navigate({ url: "https://github.com", profile: "none" })
```

### Кастомный профиль

```javascript
browser_navigate({
  url: "https://github.com",
  profile: "custom",
  profilePath: "/path/to/chrome/profile"
})
```

### Просмотр профилей

```javascript
// Список всех профилей
browser_list_profiles({ browser: "chrome" })

// Активный профиль
browser_detect_active_profile({ browser: "chrome" })
```

---

## Stealth Mode

Stealth mode включён **по умолчанию** и скрывает признаки автоматизации.

### Что маскируется

- `navigator.webdriver` → скрыт
- `chrome.runtime` → добавлен
- `navigator.plugins` → эмулируются
- `User-Agent` → маскируется
- `WebGL` → маскируется
- + 11 других проверок

### Проверка stealth

```javascript
browser_check_stealth()
```

### Тест на детекцию

```javascript
// Откройте сайт для тестирования
browser_navigate({ url: "https://bot.sannysoft.com/" })

// Все тесты должны быть "ok"
```

---

## Подключение к запущенному браузеру

Это самый мощный способ — подключаетесь к уже открытому Chrome с вашими куками, авторизацией и сессиями.

### Зачем это нужно

- Все ваши куки и авторизации уже загружены
- Нет проблем с капчей (браузер выглядит "нормальным")
- Можно работать с уже открытыми вкладками
- Браузер не закрывается при отключении

### Способ 1: Запуск Chrome с debug портом (рекомендуется)

#### Linux / macOS

```bash
# Запустите Chrome с отладочным портом
google-chrome --remote-debugging-port=9222

# Или Chromium
chromium --remote-debugging-port=9222

# Или Firefox
firefox --remote-debugging-port=9222
```

#### Windows

```cmd
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```

#### Подключение через Claude

```
Подключись к моему браузеру на порту 9222
```

Или напрямую:

```javascript
browser_connect({ port: 9222 })
```

### Способ 2: Запуск через MCP

```javascript
// Запустить Chrome с debug портом и профилем
browser_start_with_debug({
  browser: "chrome",
  port: 9222,
  profile: "default",    // использовать ваш профиль
  headless: false         // показать окно браузера
})

// Подключиться
browser_connect({ port: 9222 })
```

### Способ 3: Подключение к уже запущенному Chrome

Если Chrome уже открыт **без** debug порта:

1. Закройте Chrome
2. Запустите с debug портом:
   ```bash
   google-chrome --remote-debugging-port=9222
   ```
3. Подключитесь:
   ```javascript
   browser_connect({ port: 9222 })
   ```

### Способ 4: Через SSH туннель (удалённый доступ)

Если браузер на другом сервере:

```bash
# На локальной машине - пробросить порт
ssh -L 9222:localhost:9222 user@remote-server

# Теперь подключиться
browser_connect({ port: 9222 })
```

### Доступные порты

| Порт | Описание |
|------|----------|
| 9222 | Стандартный debug порт Chrome |
| 9223 | Запасной порт |
| 9229 | Порт Node.js debugger |

### Что можно делать после подключения

```javascript
// Получить список открытых вкладок
browser_list_tabs()

// Переключиться на вкладку
browser_switch_tab({ index: 0 })

// Открыть новую страницу
browser_navigate({ url: "https://github.com" })

// Работать с текущей страницей
browser_click({ selector: ".btn" })
browser_type({ selector: "#search", text: "query" })

// Сделать скриншот
browser_screenshot()

// Получить куки
browser_get_cookies({ url: "https://github.com" })
```

### Важно

- При `browser_close()` сервер **отключается**, но **НЕ закрывает** браузер
- Вы можете продолжать работу в браузере вручную
- Debug порт работает только на localhost (безопасность)
- Для удалённого доступа используйте SSH туннель

### Устранение проблем

#### "Connection refused"

```bash
# Проверьте что debug порт открыт
curl http://localhost:9222/json/version
```

#### "Address already in use"

```bash
# Найдите процесс на порту
lsof -i :9222

# Убейте его
kill -9 <PID>
```

#### Chrome не запускается с debug портом

```bash
# Убедитесь что Chrome закрыт полностью
pkill -f chrome

# Запустите заново
google-chrome --remote-debugging-port=9222
```

---

## Примеры сценариев

### 1. Автоматизация GitHub

```
Зайди на GitHub с моим профилем, найди мой репозиторий и создай новый issue с заголовком "Bug report"
```

### 2. Сбор данных

```
Открой https://news.ycombinator.com, получи заголовки первых 10 новостей
```

### 3. Тестирование сайта

```
Открой мой сайт http://localhost:3000, проверь что форма работает: введи email и нажми Submit
```

### 4. Скриншоты для документации

```
Сделай скриншот главной страницы https://docs.python.org в разных размерах окна
```

### 5. Парсинг данных

```
Зайди на сайт.stackoverflow.com, найди вопросы по тегу "javascript" и получи их заголовки и ссылки
```

### 6. Работа с формами

```
Зайди на https://httpbin.org/forms/post, заполни все поля формы и отправь
```

---

## Решение проблем

### Ошибка: "No browser found"

```bash
# Установите Chrome/Chromium
sudo apt install chromium-browser

# Или укажите путь
export PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium-browser"
```

### Ошибка: "No profile directory found"

```bash
# Укажите путь к профилю
export BROWSER_PROFILE_PATH="~/.config/google-chrome"
```

### Ошибка: "Cannot find module"

```bash
# Переустановите зависимости
cd ~/browser-mcp
rm -rf node_modules
npm install
```

### Браузер не запускается (headless сервер)

```bash
# Убедитесь что установлены зависимости
sudo apt install chromium-browser

# Или используйте puppeteer для скачивания Chromium
npx puppeteer browsers install chrome
```

### Капча не обходится

1. Используйте реальный профиль: `browser_auto_connect()`
2. Подключайтесь к уже открытому браузеру: `browser_connect()`
3. Добавьте задержки между действиями

---

## Часто задаваемые вопросы

### Где запускается браузер?

На той же машине, где установлен MCP сервер. Данные не отправляются на внешние серверы.

### Можно ли использовать удалённо?

Да, через SSH:
```bash
ssh -L 9222:localhost:9222 user@server
browser_connect({ port: 9222 })
```

### Поддерживается ли Firefox?

Да, но с базовым функционалом. Рекомендуется Chrome/Chromium.

### Как обойти Cloudflare?

1. Используйте `browser_auto_connect()` с реальным профилем
2. Или `browser_connect()` к уже авторизованному браузеру

### Как сохранить сессию?

Используйте `profile="default"` или `profile="auto"` — куки сохраняются в профиле.

### Работает ли с VPN?

Да, браузер использует системные настройки сети.

---

## Переменные окружения

| Переменная | Описание | Пример |
|------------|----------|--------|
| `PUPPETEER_EXECUTABLE_PATH` | Путь к браузеру | `/usr/bin/chromium` |
| `BROWSER_PROFILE_PATH` | Путь к профилям | `~/.config/google-chrome` |

---

## Лицензия

MIT
