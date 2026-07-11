# Browser MCP Server Template

Шаблон MCP сервера для автоматизации браузера. Работает с любой LLM, поддерживающей MCP (Claude, GPT, Gemini, Mistral и др.).

## Возможности

| Функция | Описание |
|---------|----------|
| **Stealth Mode** | Анти-детекция через puppeteer-extra-plugin-stealth |
| **Авто-профиль** | Автоматический поиск профиля с куками |
| **Подключение** | К подключению к уже запущенному браузеру |
| **16 evasions** | Маскировка под обычный браузер |

### Stealth Mode (защита от капчи)

Сервер использует `puppeteer-extra-plugin-stealth` для обхода проверок на автоматизацию:

- Скрывает `navigator.webdriver`
- Добавляет `chrome.runtime`
- Эмулирует plugins, languages, permissions
- Маскирует User-Agent
- И многое другое

```javascript
// Проверить stealth mode
browser_check_stealth()

// Тест на bot.sannysoft.com
browser_navigate({ url: "https://bot.sannysoft.com/" })
```

## Поддерживаемые браузеры

| Браузер | Статус | Примечание |
|---------|--------|------------|
| Google Chrome | ✅ | Рекомендуется |
| Chromium | ✅ | |
| Microsoft Edge | ✅ | |
| Brave | ✅ | |
| Opera | ✅ | |
| Firefox | ⚠️ | Базовая поддержка |

Автоматически находит установленный браузер. Приоритет: Chrome > Chromium > Edge > Brave > Opera > Firefox.

## Установка

```bash
cd /root/browser-mcp-template
npm install

# Установить Chrome/Chromium (если нужно)
npx puppeteer browsers install chrome
```

### Указание конкретного браузера

Через переменную окружения:
```bash
export PUPPETEER_EXECUTABLE_PATH="/usr/bin/firefox"
```

## Использование

### Claude Desktop

Добавить в `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "browser": {
      "command": "node",
      "args": ["/root/browser-mcp-template/index.js"]
    }
  }
}
```

### Claude Code (CLI)

```bash
claude mcp add browser node /root/browser-mcp-template/index.js
```

### Cursor / Windsurf / VS Code

Добавить в настройки MCP:

```json
{
  "mcpServers": {
    "browser": {
      "command": "node",
      "args": ["/path/to/browser-mcp-template/index.js"]
    }
  }
}
```

## Доступные инструменты

### Навигация и управление

| Инструмент | Описание |
|------------|----------|
| `browser_navigate` | Открыть URL (с выбором браузера и профиля) |
| `browser_click` | Кликнуть по элементу |
| `browser_type` | Ввести текст в поле |
| `browser_screenshot` | Сделать скриншот |
| `browser_get_text` | Получить текст элемента |
| `browser_get_html` | Получить HTML элемента |
| `browser_evaluate` | Выполнить JavaScript |
| `browser_wait` | Ждать элемент или время |
| `browser_select` | Выбрать опцию в dropdown |
| `browser_scroll` | Прокрутить страницу |
| `browser_hover` | Навести курсор на элемент |
| `browser_upload` | Загрузить файл |
| `browser_press` | Нажать клавишу |

### Вкладки и информация

| Инструмент | Описание |
|------------|----------|
| `browser_list_tabs` | Список открытых вкладок |
| `browser_switch_tab` | Переключить вкладку |
| `browser_get_info` | URL и заголовок страницы |
| `browser_get_browser_info` | Информация о браузере |
| `browser_check_stealth` | Проверить stealth mode |
| `browser_close` | Закрыть браузер |

### Профили и куки

| Инструмент | Описание |
|------------|----------|
| `browser_auto_connect` | Автодетект профиля с куками и запуск браузера |
| `browser_list_profiles` | Список доступных профилей браузера |
| `browser_detect_active_profile` | Определить какой профиль используется |
| `browser_get_cookies` | Получить куки текущей сессии |
| `browser_set_cookie` | Установить куки |
| `browser_delete_cookie` | Удалить куки |
| `browser_connect` | Подключиться к уже запущенному браузеру |
| `browser_start_with_debug` | Запустить браузер с отладочным портом |

## Работа с профилями

### Автодетект профиля (самый простой способ!)

```javascript
// Автоматически найдет профиль с куками и запустит браузер
browser_auto_connect({
  browser: "chrome",
  url: "https://github.com"  // опционально
})

// Или через browser_navigate с profile="auto"
browser_navigate({
  url: "https://github.com",
  profile: "auto"  // автодетект профиля
})
```

Сервер автоматически:
1. Ищет профили Chrome/Firefox/Edge/Brave в стандартных путях
2. Читает `Local State` чтобы найти последний использованный профиль
3. Проверяет наличие Cookies файлов
4. Запускает браузер с найденным профилем

### Подключение к уже запущенному браузеру (самый простой способ!)

Если Chrome уже открыт с авторизацией, подключитесь к нему:

```bash
# 1. Запустите Chrome с отладочным портом (один раз)
google-chrome --remote-debugging-port=9222

# 2. Подключитесь через MCP
browser_connect({ port: 9222 })
```

Или запустите браузер через MCP:
```javascript
browser_start_with_debug({
  browser: "chrome",
  port: 9222,
  profile: "default"  // использовать существующий профиль
})
// Затем подключитесь
browser_connect({ port: 9222 })
```

**Важно**: При `browser_close()` сервер отключится от браузера, но НЕ закроет его — вы сможете продолжать работу в браузере вручную.

### Авто-определение активного профиля

```javascript
// Определить какой профиль используется
browser_detect_active_profile({ browser: "chrome" })
// Вернет: имя профиля, путь, есть ли куки, запущен ли браузер
```

### Использование реального профиля (с куками и авторизацией)

```javascript
// Использовать основной профиль Chrome (все куки и сессии)
browser_navigate({
  url: "https://github.com",
  profile: "default"
})

// Использовать конкретный профиль
browser_navigate({
  url: "https://github.com",
  profile: "default",
  profileName: "Profile 1"
})

// Указать кастомный путь к профилю
browser_navigate({
  url: "https://github.com",
  profile: "custom",
  profilePath: "/home/user/.config/google-chrome"
})

// Без профиля (чистая сессия)
browser_navigate({
  url: "https://github.com",
  profile: "none"
})
```

### Просмотр доступных профилей

```javascript
// Найти все профили Chrome
browser_list_profiles({ browser: "chrome" })

// Определить активный профиль
browser_detect_active_profile({ browser: "chrome" })
```

### Работа с куками

```javascript
// Посмотреть все куки
browser_get_cookies()

// Куки для конкретного домена
browser_get_cookies({ url: "https://github.com" })

// Установить куку
browser_set_cookie({
  name: "session",
  value: "abc123",
  domain: ".github.com"
})

// Удалить куку
browser_delete_cookie({
  name: "session",
  domain: ".github.com"
})
```

### Переменные окружения

```bash
# Указать путь к профилю
export BROWSER_PROFILE_PATH="~/.config/google-chrome"

# Указать путь к браузеру
export PUPPETEER_EXECUTABLE_PATH="/usr/bin/google-chrome"
```

## Пример использования (промпт для LLM)

```
Открой GitHub с моим профилем (profile="default"), найди мой репозиторий и создай новый issue.
```

```
Зайди на сайт с авторизацией. Используй profile="default" чтобы сохранить сессию.
После входа получи куки и сохрани их.
```

## Автоматизация (пример)

```bash
# Пример цепочки действий через MCP:
1. browser_navigate(url="https://github.com", profile="default")
2. browser_click(selector="a[href='/login']")
3. browser_wait(selector="input[name='login']", timeout=5000)
4. browser_type(selector="input[name='login']", text="myuser")
5. browser_type(selector="input[name='password']", text="mypass")
6. browser_click(selector="input[type='submit']")
7. browser_wait(selector=".dashboard", timeout=10000)
8. browser_screenshot()
```

## Требования

- Node.js 18+
- Один из браузеров: Chrome, Chromium, Edge, Brave, Opera или Firefox
- ~200MB места для браузера

### Автоопределение браузера

Сервер автоматически ищет браузеры в стандартных путях:
- `/usr/bin/google-chrome`
- `/snap/bin/chromium`
- `/usr/bin/microsoft-edge`
- `/usr/bin/brave-browser`
- `/usr/bin/firefox`

### Автоопределение профилей

Сервер ищет профили в стандартных путях:
- Chrome: `~/.config/google-chrome`, `~/.config/chromium`
- Firefox: `~/.mozilla/firefox`
- Edge: `~/.config/microsoft-edge`
- Brave: `~/.config/BraveSoftware/Brave-Browser`

Укажите `BROWSER_PROFILE_PATH` если профили в нестандартном месте.

### Важно

При использовании реального профиля **не запускайте браузер дважды** — это может повредить данные. Если браузер уже открыт, закройте его вручную перед использованием MCP сервера.

## Лицензия

MIT
