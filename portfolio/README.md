# Portfolio package for Neighbor Node

This folder holds what you need to show the project in a portfolio. It is not part of the website: the site does not read this folder, and the counts of the tool skip it.

## What is in it now

| Path | What it is |
| --- | --- |
| `facts.md` | The numbers about the project, each with the command that counted it. Read this first. |
| `facts.json`, `facts.txt` | The same numbers, for tools. |
| `profile.json` | Your details: name, role, links. The texts do not need it. The tools never overwrite it. |
| `problems/problems.md` | What could not be done or could not be confirmed. |
| `tools/facts.sh` | The counting tool. It only reads the project and writes `facts.*` here. |
| `tools/facts-expected.txt` | The numbers that the texts use, so the tool can tell you if your project differs. |
| `texts/project-description.md` | The project in one line, and in about 50, 150 and 400 words. |
| `texts/case-study.md` | The case study: problem, solution, how it works, highlights, results. |
| `texts/readme-portfolio.md` | A README for the front page of the repository. To use it, put it at the top of `README.md` and keep the existing text below it, under the heading "Technical documentation". |
| `texts/resume-bullets.md` | Six bullets for a resume, each with one counted number. |
| `texts/linkedin-post.md` | A LinkedIn post. |
| `texts/github-about.md` | The About text and the eight topics for the repository. |
| `texts/cover-letter-pitch.md` | A short paragraph for a cover letter. |
| `texts/interview-answers.md` | Ten questions about the project, with the facts and an answer for each. |
| `texts/demo-video-script.md` | A script for a short screen recording. |
| `tools/check-texts.sh` | Checks the texts: numbers, file names, links, big empty words and lengths. Lists your TODO lines. |
| `tools/numbers-allowed.txt` | Numbers the texts may use that are not in `facts.txt`, each with the file that holds it. |
| `tools/make-pictures.sh` | Makes everything below in one go: it starts the site, takes the pictures, runs the tests, writes the captions, the gallery and the manifest, and checks the folder. |
| `tools/browser.mjs`, `tools/shots.mjs` | The picture tool. It drives Google Chrome without any installed package, and lists the pages and their captions. |
| `tools/build-gallery.mjs` | Writes `manifest.json`, `screenshot-captions.md`, `gallery.html` and `problems/picture-problems.md`. |
| `tools/check-portfolio.sh` | The last check of the whole folder: files, pictures, numbers, links, secrets and texts. |
| `screenshots/` | The pictures (light, dark, phone), `architecture.svg` and its picture, the picture of the test output, and `index.json`. |
| `gallery.html` | A page that shows all the pictures. Open it in a browser. |
| `manifest.json` | Every picture with its caption, alt text, size and fingerprint. |
| `screenshot-captions.md` | The captions and alt texts as text, with a line of Markdown for each picture. |
| `problems/picture-problems.md` | What could not be done when the pictures were made. Written again on every run. |

## The pictures

Make them, or make them again after you changed the site, inside the project folder:

    bash portfolio/tools/make-pictures.sh

It needs Google Chrome (or Chromium, Brave or Edge) on your computer. It uses the site that already runs on http://localhost:3000, or it builds the site and starts it for a moment on port 3217. It saves no post. Open `gallery.html` to look at the result, and read `problems/picture-problems.md` for what could not be done.

The site has no menu that opens on a phone, so there is no picture of one. The private page of a post needs a saved post, and the tool does not write one, so that picture exists only when a post is already saved on your computer.

## What to do first

1. Open `facts.md` and read the numbers. Anything that looks wrong: tell me, with the line.
2. `profile.json` holds your name, role and links. The texts do not need it: they were written without a link to the code and without a live demo. Fill it in only if you want to use it.
3. Count again at any time, inside the project folder:

       bash portfolio/tools/facts.sh check

   The last lines say if your numbers are the ones the texts use.
4. Read the texts in `texts/`. They are finished. After you change a text, check it:

       bash portfolio/tools/check-texts.sh

   It says which numbers, file names, links or words do not fit, and lists the TODO lines that are left.

## The rules of this folder

- The tools only read the project and its data. They write only inside `portfolio/`. The one exception is `make-pictures.sh`: it runs `npm run build` and `npm test` of the project, and those write their usual output (`.next/` and a test cache).
- No secrets and no personal data. Names of settings are fine, values are not.
- Every number is counted by a command that is written next to it. If something is unknown, the text leaves it out and does not guess.
- Nothing is claimed that the code does not do. What could not be confirmed goes to `problems/problems.md`.
