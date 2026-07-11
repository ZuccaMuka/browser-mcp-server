#!/usr/bin/env node

/**
 * Browser MCP Server
 *
 * A Model Context Protocol server for browser automation.
 * Works with any LLM that supports MCP (Claude, GPT, Gemini, etc.)
 *
 * Features:
 * - Stealth mode (puppeteer-extra-plugin-stealth)
 * - Auto-detect browser profiles with cookies
 * - Connect to running browser instances
 * - Anti-detection capabilities
 *
 * Tools provided:
 * - browser_navigate: Open a URL
 * - browser_click: Click an element
 * - browser_type: Type text into an input
 * - browser_screenshot: Take a screenshot
 * - browser_get_text: Get text content from element
 * - browser_evaluate: Execute JavaScript in browser
 * - browser_wait: Wait for element or time
 * - browser_list_tabs: List open pages
 * - browser_switch_tab: Switch to a different page
 * - browser_close: Close browser
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";
import { execSync } from "child_process";

// Enable stealth plugin
puppeteer.use(StealthPlugin());

// State
let browser = null;
let browserType_ = null;
let pages = [];
let activePageIndex = 0;
let isUsingProfile = false;

// Browser detection paths by type
const BROWSER_PATHS = {
  chrome: [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/snap/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ],
  chromium: [
    "/snap/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ],
  firefox: [
    "/usr/bin/firefox",
    "/usr/bin/firefox-esr",
    "/snap/bin/firefox",
    "/Applications/Firefox.app/Contents/MacOS/firefox",
    "C:\\Program Files\\Mozilla Firefox\\firefox.exe",
  ],
  edge: [
    "/usr/bin/microsoft-edge",
    "/usr/bin/microsoft-edge-stable",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ],
  brave: [
    "/usr/bin/brave-browser",
    "/usr/bin/brave-browser-stable",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  ],
  opera: [
    "/usr/bin/opera",
    "/usr/bin/opera-stable",
    "/Applications/Opera.app/Contents/MacOS/Opera",
  ],
};

// Browser profile directories by type (Linux/Mac/Windows)
const PROFILE_PATHS = {
  chrome: [
    "~/.config/google-chrome",
    "~/.config/chromium",
    "~/Library/Application Support/Google/Chrome",
    "C:\\Users\\%USERNAME%\\AppData\\Local\\Google\\Chrome\\User Data",
  ],
  firefox: [
    "~/.mozilla/firefox",
    "~/Library/Application Support/Firefox/Profiles",
    "C:\\Users\\%USERNAME%\\AppData\\Roaming\\Mozilla\\Firefox\\Profiles",
  ],
  edge: [
    "~/.config/microsoft-edge",
    "~/Library/Application Support/Microsoft Edge",
    "C:\\Users\\%USERNAME%\\AppData\\Local\\Microsoft\\Edge\\User Data",
  ],
  brave: [
    "~/.config/BraveSoftware/Brave-Browser",
    "~/Library/Application Support/BraveSoftware/Brave-Browser",
    "C:\\Users\\%USERNAME%\\AppData\\Local\\BraveSoftware\\Brave-Browser\\User Data",
  ],
  opera: [
    "~/.config/opera",
    "~/Library/Application Support/com.operasoftware.Opera",
    "C:\\Users\\%USERNAME%\\AppData\\Roaming\\Opera Software\\Opera Stable",
  ],
};

// Expand ~ in path
function expandPath(p) {
  if (p.startsWith("~")) {
    const home = process.env.HOME || process.env.USERPROFILE || "";
    return p.replace("~", home);
  }
  return p;
}

// Find browser executable
function findBrowserPath(browserType = "auto") {
  // Custom path always wins
  const customPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (customPath) return { path: customPath, type: "custom" };

  // Try specified browser type first
  if (browserType !== "auto" && BROWSER_PATHS[browserType]) {
    for (const p of BROWSER_PATHS[browserType]) {
      if (fs.existsSync(p)) return { path: p, type: browserType };
    }
  }

  // Auto-detect: try all Chromium-based browsers
  const chromiumBased = ["chrome", "chromium", "edge", "brave", "opera"];
  for (const type of chromiumBased) {
    for (const p of BROWSER_PATHS[type] || []) {
      if (fs.existsSync(p)) return { path: p, type };
    }
  }

  // Firefox last (needs different config)
  for (const p of BROWSER_PATHS.firefox || []) {
    if (fs.existsSync(p)) return { path: p, type: "firefox" };
  }

  return { path: null, type: null };
}

// Find browser profile directory
function findProfileDir(browserType = "auto") {
  // Custom profile path always wins
  const customProfile = process.env.BROWSER_PROFILE_PATH;
  if (customProfile) {
    const expanded = expandPath(customProfile);
    if (fs.existsSync(expanded)) return expanded;
  }

  // Try specified browser type first
  if (browserType !== "auto" && PROFILE_PATHS[browserType]) {
    for (const p of PROFILE_PATHS[browserType]) {
      const expanded = expandPath(p);
      if (fs.existsSync(expanded)) return expanded;
    }
  }

  // Auto-detect profile directories
  const allTypes = ["chrome", "chromium", "edge", "brave", "firefox", "opera"];
  for (const type of allTypes) {
    for (const p of PROFILE_PATHS[type] || []) {
      const expanded = expandPath(p);
      if (fs.existsSync(expanded)) return expanded;
    }
  }

  return null;
}

// Get active profile from Local State file (Chromium-based browsers)
function getActiveProfile(browserType = "chrome") {
  const profileDir = findProfileDir(browserType);
  if (!profileDir) return null;

  // Look for Local State file (Chrome/Edge/Brave/Opera)
  const localStatePath = `${profileDir}/Local State`;
  if (fs.existsSync(localStatePath)) {
    try {
      const localState = JSON.parse(fs.readFileSync(localStatePath, "utf-8"));
      if (localState.profile && localState.profile.last_used) {
        const profileName = localState.profile.last_used;
        const profilePath = `${profileDir}/${profileName}`;
        
        // Check if profile has cookies
        const hasCookies = fs.existsSync(`${profilePath}/Cookies`) || 
                          fs.existsSync(`${profilePath}/cookies.sqlite`);
        
        // Check profile info
        const infoCache = localState.profile.info_cache?.[profileName] || {};
        
        return {
          name: profileName,
          path: profilePath,
          profileDir,
          info_cache: infoCache,
          hasCookies,
          browserType,
        };
      }
    } catch (e) {
      // Ignore parse errors
    }
  }

  // For Firefox, check profiles.ini
  const profilesIniPath = `${expandPath("~/.mozilla/firefox")}/profiles.ini`;
  if (fs.existsSync(profilesIniPath)) {
    try {
      const iniContent = fs.readFileSync(profilesIniPath, "utf-8");
      const lines = iniContent.split("\n");
      let currentProfile = null;
      let isRelative = false;

      for (const line of lines) {
        if (line.startsWith("Name=")) {
          currentProfile = line.split("=")[1];
        }
        if (line.startsWith("IsRelative=")) {
          isRelative = line.includes("1");
        }
        if (currentProfile && line.startsWith("Path=")) {
          const pathValue = line.split("=")[1];
          let profilePath;
          
          if (isRelative) {
            profilePath = `${expandPath("~/.mozilla/firefox")}/${pathValue}`;
          } else {
            profilePath = pathValue;
          }
          
          if (fs.existsSync(profilePath)) {
            const hasCookies = fs.existsSync(`${profilePath}/cookies.sqlite`);
            return { 
              name: currentProfile, 
              path: profilePath,
              profileDir: expandPath("~/.mozilla/firefox"),
              hasCookies,
              browserType: "firefox",
            };
          }
        }
      }
    } catch (e) {
      // Ignore errors
    }
  }

  return null;
}

// Find profile with cookies (for auto mode)
function findProfileWithCookies(browserType = "auto") {
  // First try to get the active profile
  const activeProfile = getActiveProfile(browserType);
  if (activeProfile && activeProfile.hasCookies) {
    return activeProfile;
  }

  // If active profile has no cookies, search all profiles
  const profileDir = findProfileDir(browserType);
  if (!profileDir) return null;

  const profiles = listProfiles(profileDir);
  for (const profile of profiles) {
    if (profile.hasCookies) {
      return {
        name: profile.name,
        path: profile.path,
        profileDir,
        hasCookies: true,
        browserType,
      };
    }
  }

  // Return active profile even without cookies
  return activeProfile;
}

// Detect if browser is currently running
function isBrowserRunning(browserType = "chrome") {
  const processNames = {
    chrome: ["chrome", "chromium", "google-chrome"],
    firefox: ["firefox"],
    edge: ["microsoft-edge", "msedge"],
    brave: ["brave-browser", "brave"],
    opera: ["opera"],
  };

  const names = processNames[browserType] || processNames.chrome;
  for (const name of names) {
    try {
      execSync(`pgrep -x "${name}" > /dev/null 2>&1`);
      return true;
    } catch {}
  }
  return false;
}

// Find Chrome DevTools Protocol endpoint for running browser
function findCDPEndpoint(browserType = "chrome") {
  // Check common debug port locations
  const ports = [9222, 9223, 9229];

  for (const port of ports) {
    try {
      const response = execSync(
        `curl -s http://localhost:${port}/json/version`,
        { timeout: 2000 }
      );
      const data = JSON.parse(response);
      if (data.webSocketDebuggerUrl) {
        return { port, wsUrl: data.webSocketDebuggerUrl };
      }
    } catch {}
  }
  
  return null;
}

// List available profiles in a directory
function listProfiles(profileDir) {
  const profiles = [];
  if (!profileDir || !fs.existsSync(profileDir)) return profiles;

  try {
    const items = fs.readdirSync(profileDir);
    for (const item of items) {
      const itemPath = `${profileDir}/${item}`;
      const stat = fs.statSync(itemPath);
      if (stat.isDirectory()) {
        // Check if it looks like a profile (has Preferences or Cookies file)
        const hasPrefs = fs.existsSync(`${itemPath}/Preferences`);
        const hasCookies = fs.existsSync(`${itemPath}/Cookies`) || fs.existsSync(`${itemPath}/cookies.sqlite`);
        const hasCache = fs.existsSync(`${itemPath}/Cache`) || fs.existsSync(`${itemPath}/cache2`);
        
        if (hasPrefs || hasCookies || hasCache || item === "Default" || item.startsWith("Profile ")) {
          profiles.push({
            name: item,
            path: itemPath,
            isDefault: item === "Default",
            hasCookies,
            hasPrefs,
          });
        }
      }
    }
  } catch (e) {
    // Ignore permission errors
  }

  return profiles;
}

// Get active page
function getActivePage() {
  if (pages.length === 0) return null;
  return pages[activePageIndex] || pages[0];
}

// Create MCP server
const server = new McpServer({
  name: "browser-mcp",
  version: "1.0.0",
});

// ============ TOOLS ============

// Navigate to URL
server.tool(
  "browser_navigate",
  "Navigate browser to a URL",
  {
    url: z.string().url().describe("URL to navigate to"),
    browser: z.enum(["auto", "chrome", "chromium", "firefox", "edge", "brave", "opera"])
      .default("auto")
      .describe("Browser type to use"),
    profile: z.enum(["auto", "default", "none", "custom"]).default("auto")
      .describe("Profile mode: 'auto' = detect profile with cookies, 'default' = main profile, 'none' = fresh, 'custom' = specify path"),
    profilePath: z.string().optional()
      .describe("Custom profile directory path (when profile='custom')"),
    profileName: z.string().optional()
      .describe("Profile subfolder name (e.g., 'Profile 1', 'Default')"),
    headless: z.boolean().default(true).describe("Run in headless mode"),
    waitUntil: z.enum(["load", "domcontentloaded", "networkidle0", "networkidle2"])
      .default("networkidle2")
      .describe("When to consider navigation complete"),
  },
  async ({ url, browser: browserType, profile, profilePath, profileName, headless, waitUntil }) => {
    try {
      if (!browser) {
        const detected = findBrowserPath(browserType);
        if (!detected.path) {
          return {
            content: [{
              type: "text",
              text: `No browser found. Install one of: Chrome, Chromium, Firefox, Edge, Brave.\nOr set PUPPETEER_EXECUTABLE_PATH env variable.`,
            }],
            isError: true,
          };
        }

        const launchOptions = {
          headless: headless ? "new" : false,
          executablePath: detected.path,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        };

        // Firefox needs different config
        if (detected.type === "firefox") {
          launchOptions.product = "firefox";
        }

        // Handle profile/user data directory
        let profileInfo = null;
        
        if (profile === "auto") {
          // Auto-detect profile with cookies
          profileInfo = findProfileWithCookies(detected.type);
          if (profileInfo) {
            launchOptions.userDataDir = profileInfo.profileDir || profileInfo.path;
            isUsingProfile = true;
          }
        } else if (profile === "default" || profile === "custom") {
          let userDataDir = null;

          if (profile === "custom" && profilePath) {
            userDataDir = expandPath(profilePath);
          } else {
            userDataDir = findProfileDir(detected.type);
          }

          if (userDataDir && fs.existsSync(userDataDir)) {
            launchOptions.userDataDir = userDataDir;
            isUsingProfile = true;

            // If profileName specified, append it
            if (profileName) {
              launchOptions.userDataDir = `${userDataDir}/${profileName}`;
            }
          }
        }

        // For non-headless with profile, don't use 'new' headless mode
        if (!headless && isUsingProfile) {
          launchOptions.headless = false;
        }

        // Add stealth args
        launchOptions.args = [
          ...launchOptions.args,
          "--disable-blink-features=AutomationControlled",
          "--disable-features=IsolateOrigins,site-per-process",
        ];

        browser = await puppeteer.launch(launchOptions);
        browserType_ = detected.type;
      }

      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 720 });
      await page.goto(url, { waitUntil, timeout: 30000 });

      pages.push(page);
      activePageIndex = pages.length - 1;

      const profileText = isUsingProfile ? " (with profile + cookies)" : "";
      return {
        content: [{
          type: "text",
          text: `Navigated to ${url}. Browser: ${browserType_ || "unknown"}${profileText}. Title: ${await page.title()}`,
        }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// Click element
server.tool(
  "browser_click",
  "Click an element on the page",
  {
    selector: z.string().describe("CSS selector for element to click"),
    timeout: z.number().default(5000).describe("Timeout in ms"),
  },
  async ({ selector, timeout }) => {
    const page = getActivePage();
    if (!page) {
      return { content: [{ type: "text", text: "No active page. Use browser_navigate first." }], isError: true };
    }

    try {
      await page.waitForSelector(selector, { timeout });
      await page.click(selector);
      return { content: [{ type: "text", text: `Clicked: ${selector}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error clicking ${selector}: ${error.message}` }], isError: true };
    }
  }
);

// Type text
server.tool(
  "browser_type",
  "Type text into an input field",
  {
    selector: z.string().describe("CSS selector for input field"),
    text: z.string().describe("Text to type"),
    clear: z.boolean().default(true).describe("Clear field before typing"),
  },
  async ({ selector, text, clear }) => {
    const page = getActivePage();
    if (!page) {
      return { content: [{ type: "text", text: "No active page. Use browser_navigate first." }], isError: true };
    }

    try {
      await page.waitForSelector(selector, { timeout: 5000 });
      if (clear) {
        await page.click(selector, { clickCount: 3 });
      }
      await page.type(selector, text);
      return { content: [{ type: "text", text: `Typed "${text}" into ${selector}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error typing: ${error.message}` }], isError: true };
    }
  }
);

// Take screenshot
server.tool(
  "browser_screenshot",
  "Take a screenshot of the current page",
  {
    fullPage: z.boolean().default(false).describe("Capture full page"),
    selector: z.string().optional().describe("Element selector to screenshot (optional)"),
  },
  async ({ fullPage, selector }) => {
    const page = getActivePage();
    if (!page) {
      return { content: [{ type: "text", text: "No active page. Use browser_navigate first." }], isError: true };
    }

    try {
      const options = { encoding: "base64" };
      
      if (selector) {
        const element = await page.$(selector);
        if (element) {
          const screenshot = await element.screenshot(options);
          return {
            content: [
              { type: "text", text: `Screenshot of ${selector}` },
              { type: "image", data: screenshot, mimeType: "image/png" },
            ],
          };
        }
      }

      const screenshot = await page.screenshot({ ...options, fullPage });
      return {
        content: [
          { type: "text", text: "Page screenshot" },
          { type: "image", data: screenshot, mimeType: "image/png" },
        ],
      };
    } catch (error) {
      return { content: [{ type: "text", text: `Error taking screenshot: ${error.message}` }], isError: true };
    }
  }
);

// Get text from element
server.tool(
  "browser_get_text",
  "Get text content from an element or the whole page",
  {
    selector: z.string().optional().describe("CSS selector (omit for full page)"),
  },
  async ({ selector }) => {
    const page = getActivePage();
    if (!page) {
      return { content: [{ type: "text", text: "No active page. Use browser_navigate first." }], isError: true };
    }

    try {
      let text;
      if (selector) {
        text = await page.$eval(selector, el => el.textContent.trim());
      } else {
        text = await page.evaluate(() => document.body.innerText);
      }
      return { content: [{ type: "text", text: text || "(empty)" }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }
);

// Get HTML
server.tool(
  "browser_get_html",
  "Get HTML content from an element or the whole page",
  {
    selector: z.string().optional().describe("CSS selector (omit for full page)"),
  },
  async ({ selector }) => {
    const page = getActivePage();
    if (!page) {
      return { content: [{ type: "text", text: "No active page. Use browser_navigate first." }], isError: true };
    }

    try {
      let html;
      if (selector) {
        html = await page.$eval(selector, el => el.outerHTML);
      } else {
        html = await page.content();
      }
      return { content: [{ type: "text", text: html || "(empty)" }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }
);

// Evaluate JavaScript
server.tool(
  "browser_evaluate",
  "Execute JavaScript in the browser context",
  {
    script: z.string().describe("JavaScript code to execute"),
  },
  async ({ script }) => {
    const page = getActivePage();
    if (!page) {
      return { content: [{ type: "text", text: "No active page. Use browser_navigate first." }], isError: true };
    }

    try {
      const result = await page.evaluate(script);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }
);

// Wait
server.tool(
  "browser_wait",
  "Wait for an element or time duration",
  {
    selector: z.string().optional().describe("CSS selector to wait for"),
    timeout: z.number().default(5000).describe("Timeout in ms"),
    time: z.number().optional().describe("Wait fixed time in ms (ignores selector)"),
  },
  async ({ selector, timeout, time }) => {
    const page = getActivePage();
    if (!page) {
      return { content: [{ type: "text", text: "No active page. Use browser_navigate first." }], isError: true };
    }

    try {
      if (time) {
        await new Promise(r => setTimeout(r, time));
        return { content: [{ type: "text", text: `Waited ${time}ms` }] };
      }
      
      if (selector) {
        await page.waitForSelector(selector, { timeout });
        return { content: [{ type: "text", text: `Element ${selector} appeared` }] };
      }
      
      return { content: [{ type: "text", text: "Nothing to wait for" }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Wait timeout: ${error.message}` }], isError: true };
    }
  }
);

// Select option
server.tool(
  "browser_select",
  "Select an option from a dropdown",
  {
    selector: z.string().describe("CSS selector for select element"),
    value: z.string().describe("Option value to select"),
  },
  async ({ selector, value }) => {
    const page = getActivePage();
    if (!page) {
      return { content: [{ type: "text", text: "No active page. Use browser_navigate first." }], isError: true };
    }

    try {
      await page.select(selector, value);
      return { content: [{ type: "text", text: `Selected "${value}" in ${selector}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }
);

// List tabs
server.tool(
  "browser_list_tabs",
  "List all open browser tabs/pages",
  {},
  async () => {
    if (pages.length === 0) {
      return { content: [{ type: "text", text: "No pages open. Use browser_navigate first." }] };
    }

    const tabList = pages.map((page, i) => {
      const url = page.url();
      const title = "No title";
      return `[${i}] ${title} - ${url}${i === activePageIndex ? " (ACTIVE)" : ""}`;
    });

    return { content: [{ type: "text", text: tabList.join("\n") }] };
  }
);

// Switch tab
server.tool(
  "browser_switch_tab",
  "Switch to a different browser tab",
  {
    index: z.number().describe("Tab index to switch to"),
  },
  async ({ index }) => {
    if (index < 0 || index >= pages.length) {
      return { content: [{ type: "text", text: `Invalid index. Valid: 0-${pages.length - 1}` }], isError: true };
    }

    activePageIndex = index;
    return { content: [{ type: "text", text: `Switched to tab ${index}: ${pages[index].url()}` }] };
  }
);

// Scroll
server.tool(
  "browser_scroll",
  "Scroll the page",
  {
    direction: z.enum(["up", "down", "top", "bottom"]).describe("Scroll direction"),
    amount: z.number().optional().describe("Pixels to scroll (optional)"),
  },
  async ({ direction, amount }) => {
    const page = getActivePage();
    if (!page) {
      return { content: [{ type: "text", text: "No active page. Use browser_navigate first." }], isError: true };
    }

    try {
      switch (direction) {
        case "top":
          await page.evaluate(() => window.scrollTo(0, 0));
          break;
        case "bottom":
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          break;
        case "down":
          await page.evaluate((n) => window.scrollBy(0, n || 500), amount);
          break;
        case "up":
          await page.evaluate((n) => window.scrollBy(0, -(n || 500)), amount);
          break;
      }
      return { content: [{ type: "text", text: `Scrolled ${direction}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }
);

// Hover
server.tool(
  "browser_hover",
  "Hover over an element",
  {
    selector: z.string().describe("CSS selector to hover over"),
  },
  async ({ selector }) => {
    const page = getActivePage();
    if (!page) {
      return { content: [{ type: "text", text: "No active page. Use browser_navigate first." }], isError: true };
    }

    try {
      await page.hover(selector);
      return { content: [{ type: "text", text: `Hovered over ${selector}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }
);

// Upload file
server.tool(
  "browser_upload",
  "Upload a file to a file input",
  {
    selector: z.string().describe("CSS selector for file input"),
    filePath: z.string().describe("Path to file to upload"),
  },
  async ({ selector, filePath }) => {
    const page = getActivePage();
    if (!page) {
      return { content: [{ type: "text", text: "No active page. Use browser_navigate first." }], isError: true };
    }

    try {
      const input = await page.$(selector);
      if (!input) throw new Error("File input not found");
      await input.uploadFile(filePath);
      return { content: [{ type: "text", text: `Uploaded ${filePath}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }
);

// Press key
server.tool(
  "browser_press",
  "Press a keyboard key",
  {
    key: z.string().describe("Key to press (Enter, Tab, Escape, ArrowDown, etc.)"),
    selector: z.string().optional().describe("Element to focus first"),
  },
  async ({ key, selector }) => {
    const page = getActivePage();
    if (!page) {
      return { content: [{ type: "text", text: "No active page. Use browser_navigate first." }], isError: true };
    }

    try {
      if (selector) {
        await page.click(selector);
      }
      await page.keyboard.press(key);
      return { content: [{ type: "text", text: `Pressed ${key}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }
);

// Get page info
server.tool(
  "browser_get_info",
  "Get current page URL and title",
  {},
  async () => {
    const page = getActivePage();
    if (!page) {
      return { content: [{ type: "text", text: "No active page. Use browser_navigate first." }] };
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          url: page.url(),
          title: await page.title(),
          usingProfile: isUsingProfile,
        }),
      }],
    };
  }
);

// List available browser profiles
server.tool(
  "browser_list_profiles",
  "List available browser profiles (with cookies)",
  {
    browser: z.enum(["auto", "chrome", "chromium", "firefox", "edge", "brave", "opera"])
      .default("auto")
      .describe("Browser type to check profiles for"),
  },
  async ({ browser: browserType }) => {
    const profileDir = findProfileDir(browserType);
    if (!profileDir) {
      return {
        content: [{
          type: "text",
          text: `No profile directory found for ${browserType}.\nSearched in standard locations.\nSet BROWSER_PROFILE_PATH env variable to specify custom path.`,
        }],
      };
    }

    const profiles = listProfiles(profileDir);
    
    const result = {
      profileDir,
      profiles: profiles.map(p => ({
        name: p.name,
        isDefault: p.isDefault,
        hasCookies: p.hasCookies,
        hasPrefs: p.hasPrefs,
      })),
    };

    return {
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

// Get cookies from current session
server.tool(
  "browser_get_cookies",
  "Get cookies from the current browser session",
  {
    url: z.string().optional().describe("URL to get cookies for (omit for all)"),
  },
  async ({ url }) => {
    const page = getActivePage();
    if (!page) {
      return { content: [{ type: "text", text: "No active page. Use browser_navigate first." }], isError: true };
    }

    try {
      const cookies = await page.cookies(url || "");
      return {
        content: [{
          type: "text",
          text: JSON.stringify(cookies, null, 2),
        }],
      };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }
);

// Set cookie
server.tool(
  "browser_set_cookie",
  "Set a cookie in the browser",
  {
    name: z.string().describe("Cookie name"),
    value: z.string().describe("Cookie value"),
    domain: z.string().optional().describe("Cookie domain"),
    path: z.string().default("/").describe("Cookie path"),
    expires: z.number().optional().describe("Expiration timestamp"),
  },
  async ({ name, value, domain, path, expires }) => {
    const page = getActivePage();
    if (!page) {
      return { content: [{ type: "text", text: "No active page. Use browser_navigate first." }], isError: true };
    }

    try {
      const cookie = { name, value, path };
      if (domain) cookie.domain = domain;
      if (expires) cookie.expires = expires;

      await page.setCookie(cookie);
      return { content: [{ type: "text", text: `Cookie set: ${name}=${value}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }
);

// Delete cookie
server.tool(
  "browser_delete_cookie",
  "Delete a cookie from the browser",
  {
    name: z.string().describe("Cookie name"),
    domain: z.string().optional().describe("Cookie domain"),
    path: z.string().default("/").describe("Cookie path"),
  },
  async ({ name, domain, path }) => {
    const page = getActivePage();
    if (!page) {
      return { content: [{ type: "text", text: "No active page. Use browser_navigate first." }], isError: true };
    }

    try {
      await page.deleteCookie({ name, domain, path });
      return { content: [{ type: "text", text: `Cookie deleted: ${name}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }
);

// Detect active browser profile
server.tool(
  "browser_detect_active_profile",
  "Detect which browser profile is currently being used",
  {
    browser: z.enum(["auto", "chrome", "chromium", "firefox", "edge", "brave", "opera"])
      .default("auto")
      .describe("Browser type to check"),
  },
  async ({ browser: browserType }) => {
    const result = {
      browserType,
      isRunning: isBrowserRunning(browserType),
      activeProfile: null,
      allProfiles: [],
      profileDir: null,
    };

    // Get profile directory
    result.profileDir = findProfileDir(browserType);

    // Get active profile
    if (browserType === "chrome" || browserType === "auto" || browserType === "chromium") {
      result.activeProfile = getActiveProfile("chrome");
    } else if (browserType === "firefox") {
      result.activeProfile = getActiveProfile("firefox");
    } else {
      result.activeProfile = getActiveProfile(browserType);
    }

    // List all profiles
    if (result.profileDir) {
      result.allProfiles = listProfiles(result.profileDir);
    }

    // Check if we can connect to running browser
    result.cdpEndpoint = findCDPEndpoint(browserType);

    return {
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

// Connect to running browser instance
server.tool(
  "browser_connect",
  "Connect to an already running browser (with all cookies and sessions)",
  {
    browser: z.enum(["auto", "chrome", "chromium", "firefox", "edge", "brave", "opera"])
      .default("auto")
      .describe("Browser type to connect to"),
    port: z.number().optional().describe("Chrome DevTools Protocol port (default: auto-detect)"),
    url: z.string().url().optional().describe("Navigate to URL after connecting"),
  },
  async ({ browser: browserType, port, url }) => {
    try {
      if (browser) {
        return {
          content: [{ type: "text", text: "Browser already connected. Use browser_close first." }],
          isError: true,
        };
      }

      // Try to find CDP endpoint
      let wsUrl = null;

      if (port) {
        // Use specified port
        try {
          const response = execSync(
            `curl -s http://localhost:${port}/json/version`,
            { timeout: 2000 }
          );
          const data = JSON.parse(response);
          wsUrl = data.webSocketDebuggerUrl;
        } catch {}
      } else {
        // Auto-detect
        const endpoint = findCDPEndpoint(browserType);
        if (endpoint) {
          wsUrl = endpoint.wsUrl;
        }
      }

      if (!wsUrl) {
        return {
          content: [{
            type: "text",
            text: `No running browser found with debug port.\n\nTo use this feature, start your browser with:\n\nChrome/Chromium:\n  google-chrome --remote-debugging-port=9222\n\nEdge:\n  microsoft-edge --remote-debugging-port=9222\n\nThen run browser_connect again.`,
          }],
          isError: true,
        };
      }

      // Connect to existing browser
      browser = await puppeteer.connect({
        browserWSEndpoint: wsUrl,
        defaultViewport: null,
      });
      
      browserType_ = browserType;
      isUsingProfile = true;

      // Get existing pages
      const existingPages = await browser.pages();
      pages = existingPages;
      activePageIndex = 0;

      // Navigate if URL provided
      if (url) {
        const page = pages[0] || await browser.newPage();
        await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
        if (!pages.includes(page)) {
          pages.unshift(page);
        }
      }

      return {
        content: [{
          type: "text",
          text: `Connected to running ${browserType} browser!\nPages: ${pages.length}\nProfile: using existing session with all cookies`,
        }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error connecting: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// Start browser with remote debugging
server.tool(
  "browser_start_with_debug",
  "Start a new browser with remote debugging enabled (for later connection)",
  {
    browser: z.enum(["chrome", "chromium", "edge", "brave"])
      .default("chrome")
      .describe("Browser type to start"),
    port: z.number().default(9222).describe("Debug port"),
    profile: z.enum(["default", "none"]).default("default")
      .describe("Use existing profile"),
    headless: z.boolean().default(false).describe("Run in headless mode"),
  },
  async ({ browser: browserType, port, profile, headless }) => {
    try {
      if (browser) {
        return {
          content: [{ type: "text", text: "Browser already running. Use browser_close first." }],
          isError: true,
        };
      }

      const detected = findBrowserPath(browserType);
      if (!detected.path) {
        return {
          content: [{ type: "text", text: `No ${browserType} browser found.` }],
          isError: true,
        };
      }

      const args = [
        `--remote-debugging-port=${port}`,
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
      ];

      if (profile === "default") {
        const profileDir = findProfileDir(detected.type);
        if (profileDir) {
          args.push(`--user-data-dir=${profileDir}`);
        }
      }

      browser = await puppeteer.launch({
        headless: headless ? "new" : false,
        executablePath: detected.path,
        args,
      });

      browserType_ = detected.type;
      isUsingProfile = profile === "default";

      return {
        content: [{
          type: "text",
          text: `Browser started with debugging on port ${port}.\nYou can now connect with: browser_connect(port=${port})`,
        }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error starting browser: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// Auto-detect profile and launch browser with cookies
server.tool(
  "browser_auto_connect",
  "Auto-detect browser profile with cookies and launch browser",
  {
    browser: z.enum(["auto", "chrome", "chromium", "firefox", "edge", "brave", "opera"])
      .default("auto")
      .describe("Browser type to use"),
    headless: z.boolean().default(true).describe("Run in headless mode"),
    url: z.string().url().optional().describe("URL to navigate to after connecting"),
  },
  async ({ browser: browserType, headless, url }) => {
    try {
      if (browser) {
        return {
          content: [{ type: "text", text: "Browser already running. Use browser_close first." }],
          isError: true,
        };
      }

      // Detect browser
      const detected = findBrowserPath(browserType);
      if (!detected.path) {
        return {
          content: [{
            type: "text",
            text: `No browser found. Install Chrome, Chromium, Firefox, Edge, or Brave.`,
          }],
          isError: true,
        };
      }

      // Detect profile with cookies
      const profileInfo = findProfileWithCookies(detected.type);

      const launchOptions = {
        headless: headless ? "new" : false,
        executablePath: detected.path,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-blink-features=AutomationControlled",
        ],
      };

      // Firefox needs different config
      if (detected.type === "firefox") {
        launchOptions.product = "firefox";
      }

      // Use detected profile
      let profileName = "none";
      if (profileInfo) {
        launchOptions.userDataDir = profileInfo.profileDir || profileInfo.path;
        isUsingProfile = true;
        profileName = profileInfo.name || "default";
      }

      browser = await puppeteer.launch(launchOptions);
      browserType_ = detected.type;

      // Navigate if URL provided
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 720 });
      
      if (url) {
        await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      }

      pages.push(page);
      activePageIndex = 0;

      const profileStatus = profileInfo 
        ? `Profile: ${profileName} (${profileInfo.hasCookies ? "has cookies" : "no cookies"})`
        : "Profile: not found, using fresh session";

      return {
        content: [{
          type: "text",
          text: `Browser: ${detected.type}\n${profileStatus}\nPages: ${pages.length}\n${url ? `URL: ${url}` : "Ready for navigation"}`,
        }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// Close browser
server.tool(
  "browser_close",
  "Close the browser and all tabs",
  {},
  async () => {
    try {
      if (browser) {
        // Check if we connected to an existing browser or launched it
        let isConnected = false;
        try {
          isConnected = browser.connected;
        } catch {}

        if (isConnected) {
          // Just disconnect - don't close user's browser
          try {
            browser.disconnect();
          } catch {}
        } else {
          // We launched it, so close it
          try {
            await browser.close();
          } catch {}
        }

        browser = null;
        browserType_ = null;
        isUsingProfile = false;
        pages = [];
        activePageIndex = 0;
      }
      return { content: [{ type: "text", text: "Browser disconnected/closed" }] };
    } catch (error) {
      // Suppress cleanup errors
      browser = null;
      browserType_ = null;
      isUsingProfile = false;
      pages = [];
      activePageIndex = 0;
      return { content: [{ type: "text", text: "Browser closed" }] };
    }
  }
);

// Get browser info
server.tool(
  "browser_get_browser_info",
  "Get information about the current browser",
  {},
  async () => {
    if (!browser) {
      return { content: [{ type: "text", text: "No browser running. Use browser_navigate first." }] };
    }

    const profileDir = findProfileDir(browserType_);
    let version = "unknown";
    try {
      version = browser.version();
    } catch {}

    let isConnected = false;
    try {
      isConnected = browser.connected;
    } catch {}

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          type: browserType_ || "unknown",
          version,
          connected: isConnected,
          pages: pages.length,
          activePage: activePageIndex,
          usingProfile: isUsingProfile,
          profileDir: profileDir || "not found",
          stealth: true,
          stealthEvasions: [
            "chrome.app",
            "chrome.csi",
            "chrome.loadTimes",
            "chrome.runtime",
            "iframe.contentWindow",
            "media.codecs",
            "navigator.hardwareConcurrency",
            "navigator.languages",
            "navigator.permissions",
            "navigator.plugins",
            "navigator.vendor",
            "navigator.webdriver",
            "sourceurl",
            "user-agent-override",
            "webgl.vendor",
            "window.outerdimensions",
          ],
        }),
      }],
    };
  }
);

// Check stealth mode status
server.tool(
  "browser_check_stealth",
  "Check if stealth mode is active and test anti-detection",
  {},
  async () => {
    const page = getActivePage();
    
    const stealthInfo = {
      stealthEnabled: true,
      plugin: "puppeteer-extra-plugin-stealth",
      evasions: [
        "chrome.app",
        "chrome.csi",
        "chrome.loadTimes",
        "chrome.runtime",
        "iframe.contentWindow",
        "media.codecs",
        "navigator.hardwareConcurrency",
        "navigator.languages",
        "navigator.permissions",
        "navigator.plugins",
        "navigator.vendor",
        "navigator.webdriver",
        "sourceurl",
        "user-agent-override",
        "webgl.vendor",
        "window.outerdimensions",
      ],
      tests: {},
    };

    if (page) {
      // Test webdriver detection
      try {
        const webdriver = await page.evaluate(() => navigator.webdriver);
        stealthInfo.tests.webdriverHidden = webdriver === undefined || webdriver === false;
      } catch {}

      // Test chrome.runtime
      try {
        const chromeRuntime = await page.evaluate(() => !!window.chrome?.runtime);
        stealthInfo.tests.chromeRuntimeExists = chromeRuntime;
      } catch {}

      // Test plugins
      try {
        const plugins = await page.evaluate(() => navigator.plugins.length);
        stealthInfo.tests.pluginsCount = plugins;
      } catch {}

      // Test languages
      try {
        const languages = await page.evaluate(() => navigator.languages);
        stealthInfo.tests.languages = languages;
      } catch {}
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify(stealthInfo, null, 2),
      }],
    };
  }
);

// Suppress puppeteer cleanup errors
process.on("unhandledRejection", (reason, promise) => {
  // Ignore TargetCloseError from puppeteer disconnect
  if (reason && reason.message && reason.message.includes("Target closed")) {
    return;
  }
  console.error("Unhandled rejection:", reason);
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Browser MCP Server running on stdio");
}

main().catch(console.error);
