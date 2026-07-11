# Краткая шпаргалка — Browser MCP Server

## Установка (30 секунд)

```bash
cd ~/browser-mcp && npm install
claude mcp add browser node ~/browser-mcp/index.js
```

## Быстрый старт

```
Открой https://google.com и сделай скриншот
```

## Основные команды

| Действие | Команда |
|----------|---------|
| Открыть сайт | `browser_navigate(url="https://...")` |
| С профилем | `browser_auto_connect(url="https://...")` |
| Клик | `browser_click(selector="#btn")` |
| Ввести текст | `browser_type(selector="input", text="...")` |
| Скриншот | `browser_screenshot()` |
| Текст | `browser_get_text()` |
| JS | `browser_evaluate(script="...")` |
| Закрыть | `browser_close()` |

## Профили

```javascript
// Автодетект профиля с куками
browser_auto_connect({ url: "https://github.com" })

// Через навигацию
browser_navigate({ url: "https://github.com", profile: "auto" })
```

## Stealth

```javascript
// Проверить stealth mode
browser_check_stealth()
```

## К запущенному браузеру

```bash
# Запустить Chrome с debug портом
google-chrome --remote-debugging-port=9222

# Подключиться
browser_connect({ port: 9222 })
```

## Примеры

```javascript
// GitHub
"Зайди на GitHub и найди репозиторий kubernetes"

// Форма
"Зайди на httpbin.org/forms/post, заполни поля и отправь"

// Парсинг
"Получи заголовки новостей с hacker-news.com"
```

## Проблемы

| Ошибка | Решение |
|--------|---------|
| No browser found | `sudo apt install chromium-browser` |
| No profile found | `export BROWSER_PROFILE_PATH=~/.config/google-chrome` |
| Cannot find module | `rm -rf node_modules && npm install` |
