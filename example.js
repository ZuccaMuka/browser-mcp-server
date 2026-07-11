#!/usr/bin/env node

/**
 * Example: How to use browser-mcp from code
 * 
 * This shows how to interact with the MCP server programmatically.
 * Normally the LLM handles this automatically via MCP protocol.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
  // Create transport
  const transport = new StdioClientTransport({
    command: "node",
    args: ["./index.js"],
  });

  // Create client
  const client = new Client({ name: "example-client", version: "1.0.0" });
  await client.connect(transport);

  // List available tools
  const tools = await client.listTools();
  console.log("Available tools:", tools.tools.map(t => t.name).join(", "));

  // ===== BASIC USAGE =====
  
  // Example: Navigate to a page (fresh profile)
  const result = await client.callTool({
    name: "browser_navigate",
    arguments: { url: "https://example.com", profile: "none" },
  });
  console.log("Navigate result:", result.content[0].text);

  // Example: Take screenshot
  const screenshot = await client.callTool({
    name: "browser_screenshot",
    arguments: {},
  });
  console.log("Screenshot taken:", screenshot.content[0].text);

  // Example: Get page text
  const text = await client.callTool({
    name: "browser_get_text",
    arguments: {},
  });
  console.log("Page text:", text.content[0].text.slice(0, 200) + "...");

  // ===== PROFILE USAGE =====
  
  // Example: List available profiles
  const profiles = await client.callTool({
    name: "browser_list_profiles",
    arguments: { browser: "chrome" },
  });
  console.log("Profiles:", profiles.content[0].text);

  // Example: Navigate with real profile (uses cookies/auth)
  // const profileResult = await client.callTool({
  //   name: "browser_navigate",
  //   arguments: {
  //     url: "https://github.com",
  //     profile: "default",      // Use main profile with cookies
  //     // profileName: "Profile 1",  // Or specific profile
  //     // profile: "custom",
  //     // profilePath: "/path/to/profile",
  //   },
  // });
  // console.log("Profile navigate:", profileResult.content[0].text);

  // ===== COOKIE MANAGEMENT =====
  
  // Example: Get cookies
  const cookies = await client.callTool({
    name: "browser_get_cookies",
    arguments: {},
  });
  console.log("Cookies:", cookies.content[0].text.slice(0, 200) + "...");

  // Example: Set a cookie
  const setCookie = await client.callTool({
    name: "browser_set_cookie",
    arguments: {
      name: "my_cookie",
      value: "my_value",
      domain: ".example.com",
    },
  });
  console.log("Set cookie:", setCookie.content[0].text);

  // Example: Delete a cookie
  const deleteCookie = await client.callTool({
    name: "browser_delete_cookie",
    arguments: {
      name: "my_cookie",
      domain: ".example.com",
    },
  });
  console.log("Delete cookie:", deleteCookie.content[0].text);

  // ===== BROWSER INFO =====
  
  // Example: Get browser info
  const browserInfo = await client.callTool({
    name: "browser_get_browser_info",
    arguments: {},
  });
  console.log("Browser info:", browserInfo.content[0].text);

  // Close browser
  await client.callTool({ name: "browser_close", arguments: {} });
  
  await client.close();
}

main().catch(console.error);
