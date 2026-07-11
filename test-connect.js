#!/usr/bin/env node
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function test() {
  console.log("=== ТЕСТ BROWSER MCP СЕРВЕРА ===\n");

  // 1. Запустить MCP сервер
  console.log("1. Запускаю MCP сервер...");
  const transport = new StdioClientTransport({
    command: "node",
    args: ["./index.js"],
  });

  const client = new Client({ name: "test", version: "1.0.0" });
  await client.connect(transport);
  console.log("   OK: MCP сервер подключен\n");

  // 2. Подключиться к запущенному Chromium
  console.log("2. Подключаюсь к Chromium (port 9222)...");
  const connect = await client.callTool({
    name: "browser_connect",
    arguments: { browser: "chrome", port: 9222 }
  });
  console.log("   ", connect.content[0].text, "\n");

  // 3. Открыть страницу
  console.log("3. Открываю https://example.com...");
  const nav = await client.callTool({
    name: "browser_navigate",
    arguments: { url: "https://example.com" }
  });
  console.log("   ", nav.content[0].text, "\n");

  // 4. Получить информацию
  console.log("4. Получаю информацию о странице...");
  const info = await client.callTool({
    name: "browser_get_info",
    arguments: {}
  });
  console.log("   ", info.content[0].text, "\n");

  // 5. Получить текст страницы
  console.log("5. Получаю текст страницы...");
  const text = await client.callTool({
    name: "browser_get_text",
    arguments: {}
  });
  console.log("   Текст:", text.content[0].text.substring(0, 200), "...\n");

  // 6. Сделать скриншот
  console.log("6. Делаю скриншот...");
  const screenshot = await client.callTool({
    name: "browser_screenshot",
    arguments: {}
  });
  console.log("   ", screenshot.content[0].text, "\n");

  // 7. Информация о браузере
  console.log("7. Информация о браузере...");
  const browserInfo = await client.callTool({
    name: "browser_get_browser_info",
    arguments: {}
  });
  console.log("   ", browserInfo.content[0].text, "\n");

  // 8. Отключиться (не закрывая браузер)
  console.log("8. Отключаюсь от браузера...");
  await client.callTool({
    name: "browser_close",
    arguments: {}
  });
  console.log("   OK: Отключены\n");

  console.log("=== ТЕСТ ЗАВЕРШЕН УСПЕШНО ===");

  await client.close();
  process.exit(0);
}

test().catch(e => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
