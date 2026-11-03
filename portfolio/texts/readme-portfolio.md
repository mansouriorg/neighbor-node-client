# Neighbor Node

A help and lending board for neighbors. People who live near each other post what they need, what they can do and what they can lend, and a neighbor answers.

This is an early version. It has no accounts and no database, and there is no live demo yet.

The technical details are in the documentation of the project.

## Screenshots

![The home page of Neighbor Node.](portfolio/screenshots/home-light-desktop.png)

![The board, with the posts of the neighbors and a filter by kind.](portfolio/screenshots/board-light-desktop.png)

![How the parts of Neighbor Node fit together.](portfolio/screenshots/architecture-diagram.png)

More pictures, in the dark theme and on a phone, are in `portfolio/gallery.html`.

## What it does

- Read the board of posts, newest first, and filter it by kind: Help wanted, Offer or Lend.
- Write a post. A post is Open, In progress or Done. Only a street or an area is shown, never a house number.
- Get a private link when the post is saved. With it, the author edits the post, changes its status, reads replies, sees how many reports it has, keeps it up, or takes it down.
- Reply to a post. A reply goes only to the author.
- Report a post with a reason. A report says why, never who.
- A post that nobody touches for 30 days is hidden from the board. Nothing is deleted, and the author can show it again.
- Use a light or a dark theme. The dark theme follows the system setting.

## Why there are no accounts

Each post gets a secret key when it is saved. The server shows the key once, as the end of the private link, and keeps only a SHA-256 fingerprint of it. A browser does not send the part of a link after the `#` to the server, so the key stays out of the server logs. Whoever has the link can change the post, so the link works like a password.

Every rule that the browser checks is checked again on the server, because anyone can call a server action. Every public action has a speed limit.

## Run it on your computer

You need Node.js 20.9 or newer. Run these commands inside the project folder:

    npm install
    npm run dev

Then open http://localhost:3000 in your browser. The server looks for `data/posts.json` in the folder where you started it, and makes the file when the first post is saved. The board also shows 9 made-up sample posts.

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the site for development. |
| `npm run build` | Builds the site. |
| `npm run start` | Starts the built site. |
| `npm run lint` | Checks the code with ESLint. |
| `npm run typecheck` | Checks the types with TypeScript. |
| `npm test` | Runs the tests once. |
| `npm run test:watch` | Runs the tests again each time a file changes. |

These settings go in front of a command. All of them are optional.

| Setting | What it does | If it is not set |
| --- | --- | --- |
| `SITE_URL` | The full address of the site. | `http://localhost:3000` |
| `POSTS_PER_HOUR` | How many posts one visitor can save in an hour. | 5 |
| `POSTS_PER_HOUR_SITE` | How many posts the whole site accepts in an hour. | 60 |

## Tech stack

- Next.js 16.2.1 (App Router and server actions) and React 19.2.4
- TypeScript 5
- Tailwind CSS 4
- Vitest, jsdom and React Testing Library for the tests
- ESLint 9
- One JSON file for the posts, and a small Node.js script for moderation

## Tests

There are 125 test files with 1,068 tests in `__tests__/`. Tests that need a posts file use temporary folders, so they never touch `data/posts.json`. Run them with `npm test`.

## Project structure

| Path | What is in it |
| --- | --- |
| `app/` | The pages, the server actions and the colors in `app/globals.css`. |
| `components/` | The parts that the pages are made of, and the icons in `components/icons.tsx`. |
| `lib/` | The rules, the storage and the speed limits. No page code. |
| `scripts/moderate.mjs` | The moderation tool. |
| `__tests__/` | All tests. |
| `data/` | Made when the first post is saved. Holds `data/posts.json`. |
| `next.config.ts` | The safe headers. |

## Moderation

The person who runs the site can look at reports and take posts down. The tool is plain Node.js and works on `data/posts.json` in the folder where it runs:

    node scripts/moderate.mjs list
    node scripts/moderate.mjs show POST-ID
    node scripts/moderate.mjs take-down POST-ID
    node scripts/moderate.mjs take-down POST-ID --yes

`take-down` is only a preview until `--yes` is added. With `--yes`, the tool copies the posts file first.

## Limits and what is missing

- The posts are kept in one file. Run only one copy of the server on it.
- A host with a read-only disk cannot save posts, so a public site needs a database.
- The speed limits live in the memory of the running server. Put a proxy in front of the site that sets `x-forwarded-for` or `x-real-ip`.
- Nobody checks a post before it shows.
- Not there yet: accounts, messages to the author when a reply or report arrives, deleting a single reply from the site, and the history of an edited post.

## About this project

I am Mahmoud Mansouri. I built Neighbor Node with the help of an AI assistant (Claude, by Anthropic). The assistant wrote the code and the tests, in small steps. I chose which feature came next, ran every step as one command in my own terminal and sent the output back. The tests, the counting tool and the pictures in `portfolio/` are there so that a reader can check the project without taking my word for it.

## License

No license has been chosen yet.
