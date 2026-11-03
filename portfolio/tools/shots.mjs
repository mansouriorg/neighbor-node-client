// shots.mjs: takes the pictures for the portfolio. It only reads the project and the site.
// It writes the pictures and portfolio/screenshots/index.json, and nothing else.
//
//   node portfolio/tools/shots.mjs site --base http://localhost:3217 [--chrome path of a browser]
//       pictures of the running site (light, dark, phone) and the architecture diagram
//   node portfolio/tools/shots.mjs tests
//       a picture of the end of the output of npm test (the text is read from portfolio/.work/tests.txt)
//
// Most people run it through  bash portfolio/tools/make-pictures.sh  which starts the site first.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { findChrome, launch, decodePicture, pngSize } from "./browser.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const shotsDir = path.join(root, "portfolio", "screenshots");
const workDir = path.join(root, "portfolio", ".work");
const indexFile = path.join(shotsDir, "index.json");

const DEVICES = {
  desktop: { width: 1440, height: 900, scale: 2, mobile: false, words: "desktop" },
  phone: { width: 390, height: 844, scale: 3, mobile: true, words: "phone" },
};
// A picture taller than this many real pixels is cut off at the bottom (and the index says so).
const MOST_PIXELS = 16000;

// The pages. Every caption and alt text says only what the code of the page shows.
const PAGES = {
  home: {
    name: "Home page",
    route: "/",
    full: true,
    caption: "The home page.",
    alt: "The home page of Neighbor Node. The heading reads: Ask for a hand. Offer one. Lend what you do not use. Below it are two buttons, one to open the board and one to write a post. Further down are the three kinds of posts, how it works, and a note that addresses stay private.",
  },
  board: {
    name: "The board",
    route: "/board",
    full: true,
    caption: "The board: posts from neighbors, with a filter by kind.",
    alt: "The board page. A heading reads The board, next to a button to write a post. Under it are filter buttons for all posts and for the three kinds of posts, and then the cards of the posts, with the sample posts marked as examples.",
  },
  "board-help": {
    name: "The board, Help wanted filter",
    route: "/board?kind=help",
    full: true,
    caption: "The board with the filter set to Help wanted.",
    alt: "The board page with the filter set to Help wanted. Only the posts of that kind are listed.",
  },
  new: {
    name: "Write a post",
    route: "/board/new",
    full: true,
    caption: "The form to write a post. It needs no account.",
    alt: "The page to write a post. A short note says this is an early version. The form asks for the kind of post, a title, details and an area, and ends with a button, Save my post.",
  },
  "new-errors": {
    name: "Write a post, with the problems listed",
    route: "/board/new",
    full: true,
    steps: [{ click: "form button[type=submit]" }, { waitFor: "[role=alert]" }],
    caption: "The same form after Save my post is pressed with every field empty.",
    alt: "The form to write a post after the Save my post button was pressed with every field empty. A box at the top says how many things there are to fix, and the fields that need a change show a message under them. Nothing was saved.",
  },
  post: {
    name: "A sample post",
    route: "/board/sample-1",
    full: true,
    caption: "The page of one sample post.",
    alt: "The page of one sample post. It shows the kind, the status, the title, the details and the area of the post, and a form to reply to the author.",
  },
  "post-not-found": {
    name: "Post not found",
    route: "/board/does-not-exist",
    status: 404,
    full: false,
    caption: "The page for a post that does not exist.",
    alt: "A page that says Post not found. It explains that the post does not exist, was taken down, or was hidden, and has a button back to the board.",
  },
  "not-found": {
    name: "Page not found",
    route: "/this-page-does-not-exist",
    status: 404,
    full: false,
    caption: "The page for an address that does not exist.",
    alt: "A page that says Page not found, with a button back to the home page.",
  },
  "saved-post": {
    name: "A saved post",
    route: "/board/SAVED",
    full: true,
    caption: "The page of a post saved on this computer.",
    alt: "The page of a post that was saved on this computer, with its details and the forms to reply to it and to report it.",
  },
  "manage-no-key": {
    name: "Private page without its secret code",
    route: "/board/SAVED/manage",
    full: false,
    caption: "The private page opened without its secret code.",
    alt: "The private page of a saved post, opened with an address that has no secret code. It says that the link is incomplete and asks to open the whole link again.",
  },
};

const ALL = ["home", "board", "board-help", "new", "new-errors", "post", "post-not-found", "not-found"];
const PLAN = [
  { device: "desktop", theme: "light", pages: ALL.concat(["saved-post", "manage-no-key"]) },
  { device: "desktop", theme: "dark", pages: ALL.concat(["manage-no-key"]) },
  { device: "phone", theme: "light", pages: ["home", "board", "board-help", "new", "new-errors", "post", "not-found", "manage-no-key"] },
];

const mode = process.argv[2];
function option(name, fallback) {
  const at = process.argv.indexOf("--" + name);
  return at >= 0 && process.argv[at + 1] ? process.argv[at + 1] : fallback;
}
const chromeHint = option("chrome", "");
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function readIndex() {
  try {
    return JSON.parse(fs.readFileSync(indexFile, "utf8"));
  } catch (error) {
    return { pictures: {}, problems: {} };
  }
}
function writeIndex(index) {
  fs.mkdirSync(shotsDir, { recursive: true });
  fs.writeFileSync(indexFile, JSON.stringify(index, null, 2) + "\n");
}

// Evaluates a piece of script in the page and gives back its value.
async function inPage(browser, expression) {
  const result = await browser.page("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error("the script in the page failed: " + expression.slice(0, 70));
  return result.result.value;
}

async function savePicture(browser, name, clip, scale, group, extra, index) {
  const shot = await browser.page("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, fromSurface: true, clip }, 60000);
  const bytes = decodePicture(shot.data);
  const size = pngSize(bytes);
  if (size === null) throw new Error("Chrome did not send a PNG picture for " + name);
  fs.writeFileSync(path.join(shotsDir, name), bytes);
  index.pictures[name] = Object.assign({
    file: name,
    group,
    width_px: size.width,
    height_px: size.height,
    scale,
    bytes: bytes.length,
    taken: new Date().toISOString().slice(0, 10),
  }, extra);
}

// A full-page picture: as tall as the page, but not taller than MOST_PIXELS real pixels.
async function pageClip(browser, device, full) {
  if (full === false) return { clip: { x: 0, y: 0, width: device.width, height: device.height, scale: 1 }, cropped: false };
  const metrics = await browser.page("Page.getLayoutMetrics");
  const size = metrics.cssContentSize || metrics.contentSize;
  const most = Math.floor(MOST_PIXELS / device.scale);
  let height = Math.max(device.height, Math.ceil(size.height));
  const cropped = height > most;
  if (cropped) height = most;
  return { clip: { x: 0, y: 0, width: device.width, height, scale: 1 }, cropped };
}

function savedPosts() {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(root, "data", "posts.json"), "utf8"));
    const posts = Array.isArray(data.posts) ? data.posts : [];
    const first = posts.length > 0 && typeof posts[0].id === "string" ? posts[0].id : null;
    return { count: posts.length, id: first };
  } catch (error) {
    return { count: 0, id: null };
  }
}

async function runSite() {
  const base = option("base", "http://localhost:3217").replace(/\/+$/, "");
  const chrome = findChrome(chromeHint);
  const index = readIndex();
  const problems = [];
  if (chrome === null) {
    console.log("No Chrome, Chromium, Brave or Edge was found, so no pictures of the site can be made.");
    index.problems.site = ["No Chrome, Chromium, Brave or Edge was found. Install Google Chrome (or run it again with CHROME_PATH set to a browser that uses the same engine), then run: bash portfolio/tools/make-pictures.sh"];
    writeIndex(index);
    process.exitCode = 4;
    return;
  }
  try {
    await fetch(base + "/");
  } catch (error) {
    console.log("The site does not answer at " + base);
    process.exitCode = 5;
    return;
  }
  // Old pictures of the site are replaced, so that no picture of an older state stays behind.
  for (const entry of Object.values(index.pictures)) {
    if (entry.group === "site") {
      // Only a plain file name inside the screenshots folder is ever removed.
      if (path.basename(entry.file) === entry.file) fs.rmSync(path.join(shotsDir, entry.file), { force: true });
      delete index.pictures[entry.file];
    }
  }
  fs.mkdirSync(shotsDir, { recursive: true });
  fs.mkdirSync(workDir, { recursive: true });
  const saved = savedPosts();
  if (saved.count > 0) {
    problems.push("The file data/posts.json holds " + saved.count + " saved post(s) from this computer. They are shown on the board pictures. Look at those pictures before you publish them. The tool only read the file; it saved nothing.");
  } else {
    problems.push("No post is saved on this computer, so the board pictures show only the sample posts, and there is no picture of a saved post or of its private page. The tool does not write posts, because it must not change your data.");
  }

  const profile = path.join(workDir, "chrome-profile");
  fs.rmSync(profile, { recursive: true, force: true });
  const browser = await launch(chrome, profile);
  const state = { status: 0, onLoad: null };
  browser.events((message) => {
    if (message.method === "Page.loadEventFired" && state.onLoad) state.onLoad();
    if (message.method === "Network.responseReceived" && message.params.type === "Document" && state.status === 0) {
      state.status = message.params.response.status;
    }
  });

  let made = 0;
  try {
    for (const step of PLAN) {
      const device = DEVICES[step.device];
      await browser.page("Emulation.setDeviceMetricsOverride", { width: device.width, height: device.height, deviceScaleFactor: device.scale, mobile: device.mobile });
      await browser.page("Emulation.setTouchEmulationEnabled", { enabled: device.mobile });
      await browser.page("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: step.theme }, { name: "prefers-reduced-motion", value: "reduce" }] });
      for (const id of step.pages) {
        const page = PAGES[id];
        const name = id + "-" + step.theme + "-" + step.device + ".png";
        if (page.route.indexOf("SAVED") >= 0 && saved.id === null) continue;
        const route = page.route.replace("SAVED", saved.id === null ? "" : encodeURIComponent(saved.id));
        try {
          state.status = 0;
          const loaded = new Promise((resolve) => { state.onLoad = resolve; });
          const went = await browser.page("Page.navigate", { url: base + route });
          if (went.errorText) throw new Error("the page did not open: " + went.errorText);
          await Promise.race([loaded, sleep(30000)]);
          await inPage(browser, "document.fonts.ready.then(function () { return true; })");
          // The development server of Next.js adds a small button of its own. It is not part of the site.
          await inPage(browser, "document.querySelectorAll('nextjs-portal').forEach(function (e) { e.remove(); }); true");
          await sleep(900);
          const wanted = page.status || 200;
          if ((state.status === wanted) === false) {
            problems.push("No picture " + name + ": the address " + route + " answered " + state.status + ", not " + wanted + ".");
            continue;
          }
          for (const action of page.steps || []) {
            if (action.click) {
              await inPage(browser, "(function () { var el = document.querySelector(" + JSON.stringify(action.click) + "); if (el === null) { throw new Error('not found'); } el.click(); return true; })()");
            }
            if (action.waitFor) {
              let found = false;
              for (let tries = 0; tries < 80 && found === false; tries++) {
                found = await inPage(browser, "document.querySelector(" + JSON.stringify(action.waitFor) + ") === null ? false : true");
                if (found === false) await sleep(100);
              }
              if (found === false) throw new Error("the page never showed " + action.waitFor);
            }
            await sleep(500);
          }
          await inPage(browser, "window.scrollTo(0, 0); if (document.activeElement && document.activeElement.blur) { document.activeElement.blur(); } true");
          await sleep(200);
          const area = await pageClip(browser, device, page.full);
          await savePicture(browser, name, area.clip, device.scale, "site", {
            page: id,
            route,
            theme: step.theme,
            device: step.device,
            full_page: page.full,
            cropped: area.cropped,
            status: state.status,
            title: page.name + ", " + step.theme + " theme, " + device.words,
            caption: page.caption + " " + (step.theme === "dark" ? "Dark theme" : "Light theme") + ", " + device.words + ".",
            alt: page.alt + (step.theme === "dark" ? " Shown in the dark theme." : "") + (step.device === "phone" ? " Shown on a phone." : ""),
          }, index);
          made++;
          console.log("  picture " + name);
        } catch (error) {
          problems.push("No picture " + name + ": " + error.message);
          console.log("  FAILED  " + name + " (" + error.message + ")");
          if (/Chrome stopped|not running/.test(error.message)) throw error;
        }
      }
    }
  } finally {
    await browser.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }

  problems.push("This site has no menu that opens on a phone: the header holds only a link to the board. So there is no picture of an open phone menu.");
  index.problems.site = problems;
  writeIndex(index);
  console.log("Pictures of the site: " + made);
  await runDiagram();
}

// The architecture diagram: the SVG file is drawn in Chrome and saved as a PNG next to it.
async function runDiagram() {
  const svgFile = path.join(shotsDir, "architecture.svg");
  const index = readIndex();
  const chrome = findChrome(chromeHint);
  if (fs.existsSync(svgFile) === false || chrome === null) return;
  const svg = fs.readFileSync(svgFile, "utf8");
  const box = svg.match(/viewBox="0 0 ([0-9]+) ([0-9]+)"/);
  if (box === null) {
    console.log("  FAILED  architecture-diagram.png (the SVG has no viewBox)");
    return;
  }
  const width = Number(box[1]);
  const height = Number(box[2]);
  fs.mkdirSync(workDir, { recursive: true });
  const html = path.join(workDir, "architecture.html");
  fs.writeFileSync(html, "<html><body style=\"margin:0;background:#ffffff\">" + svg + "</body></html>");
  const profile = path.join(workDir, "chrome-profile");
  fs.rmSync(profile, { recursive: true, force: true });
  const browser = await launch(chrome, profile);
  try {
    await browser.page("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 2, mobile: false });
    await browser.page("Page.navigate", { url: pathToFileURL(html).href });
    await sleep(800);
    await savePicture(browser, "architecture-diagram.png", { x: 0, y: 0, width, height, scale: 1 }, 2, "diagram", {
      title: "Architecture diagram",
      caption: "How the parts of Neighbor Node fit together: the pages, the server actions, the rules, the store and the posts file.",
      alt: "A diagram with boxes and arrows. The visitor's browser opens the pages in app. A form sends its data to a server action. The server action asks the rules in lib, which include the speed limits that live in memory, and the key check. The post store writes the posts file data/posts.json. A moderation script reads and changes the same file.",
    }, index);
    console.log("  picture architecture-diagram.png");
  } catch (error) {
    console.log("  FAILED  architecture-diagram.png (" + error.message + ")");
    index.problems.diagram = ["No architecture picture: " + error.message];
  } finally {
    await browser.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
  writeIndex(index);
}

// A picture of the end of the output of npm test. It is a drawing of the real text, not a photo of a terminal.
function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
async function runTests() {
  const textFile = path.join(workDir, "tests.txt");
  const codeFile = path.join(workDir, "tests.code");
  const index = readIndex();
  const chrome = findChrome(chromeHint);
  if (fs.existsSync(textFile) === false || chrome === null) {
    index.problems.tests = ["No picture of the tests: " + (chrome === null ? "no browser was found." : "the test run left no output.")];
    writeIndex(index);
    return;
  }
  const code = fs.existsSync(codeFile) ? Number(fs.readFileSync(codeFile, "utf8").trim()) : 1;
  // Colors are taken out, and so are the folder of the project and the home folder: a picture must not show a user name.
  let raw = fs.readFileSync(textFile, "utf8").replace(/\u001b\[[0-9;?]*[A-Za-z]/g, "").replace(/\r/g, "");
  raw = raw.split(root).join("<project folder>").split(os.homedir()).join("~");
  const lines = raw.split("\n");
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
  const shown = lines.slice(-26);
  const summary = lines.filter((l) => /^\s*(Test Files|Tests|Duration)\s/.test(l)).map((l) => l.trim());
  const passed = code === 0 && summary.some((l) => /^Tests\s.*passed/.test(l)) && summary.some((l) => /failed/.test(l)) === false;
  const date = new Date().toISOString().slice(0, 10);
  const body = "<div class=\"bar\">$ npm test</div><pre>" + escapeHtml(shown.join("\n")) + "</pre><div class=\"bar\">exit code " + code + ", " + date + "</div>";
  const html = "<html><head><meta charset=\"utf-8\"><style>body{margin:0;background:#0f1115;color:#e6e6e6;font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.bar{padding:12px 24px;background:#1b1e26;color:#9aa4b2}pre{margin:0;padding:20px 24px;white-space:pre-wrap;word-break:break-word}</style></head><body>" + body + "</body></html>";
  fs.mkdirSync(workDir, { recursive: true });
  const htmlFile = path.join(workDir, "tests.html");
  fs.writeFileSync(htmlFile, html);
  const profile = path.join(workDir, "chrome-profile");
  fs.rmSync(profile, { recursive: true, force: true });
  const browser = await launch(chrome, profile);
  try {
    await browser.page("Emulation.setDeviceMetricsOverride", { width: 1000, height: 400, deviceScaleFactor: 2, mobile: false });
    await browser.page("Page.navigate", { url: pathToFileURL(htmlFile).href });
    await sleep(800);
    const height = await inPage(browser, "Math.ceil(document.documentElement.scrollHeight)");
    await savePicture(browser, "tests-output.png", { x: 0, y: 0, width: 1000, height, scale: 1 }, 2, "tests", {
      title: "Output of npm test",
      caption: passed ? "The end of the output of npm test: the tests passed." : "The end of the output of npm test. Some tests failed or the run did not finish; the picture shows what happened.",
      alt: "Text from a terminal: the last lines of the output of npm test, with the summary of test files and tests at the end.",
      exit_code: code,
      summary,
      passed,
    }, index);
    index.problems.tests = passed ? [] : ["npm test did not pass (exit code " + code + "). The picture shows the real output. Fix the tests, then run: bash portfolio/tools/make-pictures.sh"];
    console.log("  picture tests-output.png (exit code " + code + ")");
  } catch (error) {
    index.problems.tests = ["No picture of the tests: " + error.message];
    console.log("  FAILED  tests-output.png (" + error.message + ")");
  } finally {
    await browser.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
  writeIndex(index);
}

if (mode === "site") {
  await runSite();
} else if (mode === "tests") {
  await runTests();
} else if (mode === "reset") {
  // The notes of the last run are forgotten. The pictures of the last run stay until new ones replace them.
  const index = readIndex();
  index.problems = {};
  writeIndex(index);
} else if (mode === "find") {
  const found = findChrome(chromeHint);
  console.log(found === null ? "none" : found);
  process.exitCode = found === null ? 4 : 0;
} else {
  console.log("Use:  node portfolio/tools/shots.mjs site --base http://localhost:3217   or   node portfolio/tools/shots.mjs tests   or   node portfolio/tools/shots.mjs find");
  process.exitCode = 2;
}
