// browser.mjs: starts a headless Chrome and talks to it through a pipe (the DevTools protocol).
// Only modules that come with Node.js are used. Nothing is installed.
// Used by shots.mjs. Run by hand, it prints the browser it found:  node portfolio/tools/browser.mjs [path of a browser]
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Where Chrome (or a browser made from the same engine) usually is. A path that you give (hint) comes first.
export function findChrome(hint) {
  const home = os.homedir();
  const list = [
    hint,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    path.join(home, "Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  for (const candidate of list) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return null;
}

// Chrome sends a picture back as text made of 64 letters. This turns the text into bytes again.
// It is written out here so that you can read it; the first bytes of the result are checked later.
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const VALUE_OF = new Int16Array(128).fill(-1);
for (let i = 0; i < LETTERS.length; i++) VALUE_OF[LETTERS.charCodeAt(i)] = i;

export function decodePicture(text) {
  let end = text.length;
  while (end > 0 && text.charAt(end - 1) === "=") end--;
  const out = Buffer.alloc(Math.floor((end * 6) / 8));
  let bits = 0;
  let value = 0;
  let at = 0;
  for (let i = 0; i < end; i++) {
    const code = text.charCodeAt(i);
    const n = code < 128 ? VALUE_OF[code] : -1;
    if (n < 0) throw new Error("the picture text has a letter that does not belong");
    value = ((value << 6) | n) & 0xffffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[at++] = (value >> bits) & 0xff;
    }
  }
  return out;
}

// The size of a PNG picture, read from its first bytes. Returns null when it is not a PNG.
export function pngSize(buffer) {
  const sign = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buffer.length < 24) return null;
  for (let i = 0; i < sign.length; i++) {
    if ((buffer[i] === sign[i]) === false) return null;
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

// Starts Chrome. Gives back page(method, params), events(fn) and close().
export async function launch(chromePath, profileDir) {
  const args = [
    "--headless=new",
    "--remote-debugging-pipe",
    "--user-data-dir=" + profileDir,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-background-networking",
    "--hide-scrollbars",
    "--force-color-profile=srgb",
    "about:blank",
  ];
  // Only a program that runs as the administrator (for example inside a container) needs this.
  if (typeof process.getuid === "function" && process.getuid() === 0) args.push("--no-sandbox");
  const child = spawn(chromePath, args, { stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"] });
  let exited = false;
  const pending = new Map();
  const listeners = [];
  let nextId = 1;
  let buffer = "";

  child.on("exit", () => {
    exited = true;
    for (const entry of pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(new Error("Chrome stopped"));
    }
    pending.clear();
  });
  child.on("error", (error) => {
    exited = true;
    for (const entry of pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(error);
    }
    pending.clear();
  });

  function dispatch(message) {
    if (message.id === undefined) {
      for (const fn of listeners) fn(message);
      return;
    }
    const entry = pending.get(message.id);
    if (entry === undefined) return;
    pending.delete(message.id);
    clearTimeout(entry.timer);
    if (message.error) entry.reject(new Error(message.error.message));
    else entry.resolve(message.result || {});
  }

  const reader = child.stdio[4];
  reader.setEncoding("utf8");
  reader.on("data", (chunk) => {
    buffer += chunk;
    let at = buffer.indexOf("\0");
    while (at >= 0) {
      const text = buffer.slice(0, at);
      buffer = buffer.slice(at + 1);
      if (text.length > 0) dispatch(JSON.parse(text));
      at = buffer.indexOf("\0");
    }
  });

  function send(method, params, sessionId, ms) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      if (exited) {
        reject(new Error("Chrome is not running"));
        return;
      }
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(method + " took too long"));
      }, ms || 30000);
      pending.set(id, { resolve, reject, timer });
      const message = { id, method, params: params || {} };
      if (sessionId) message.sessionId = sessionId;
      child.stdio[3].write(JSON.stringify(message) + "\0");
    });
  }

  async function close() {
    try {
      await send("Browser.close", {}, undefined, 5000);
    } catch (error) {
      // Chrome may close before it answers.
    }
    if (exited) return;
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        child.kill();
        resolve();
      }, 5000);
      child.on("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  const created = await send("Target.createTarget", { url: "about:blank" });
  const attached = await send("Target.attachToTarget", { targetId: created.targetId, flatten: true });
  const sessionId = attached.sessionId;
  const page = (method, params, ms) => send(method, params, sessionId, ms);
  const events = (fn) => listeners.push((message) => {
    if (message.sessionId === sessionId) fn(message);
  });
  await page("Page.enable");
  await page("Runtime.enable");
  await page("Network.enable");
  return { page, events, close };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const found = findChrome(process.argv[2]);
  if (found) {
    console.log(found);
  } else {
    console.log("No Chrome, Chromium, Brave or Edge was found. Give the path of the program as the first argument.");
    process.exitCode = 4;
  }
}
