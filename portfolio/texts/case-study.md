# Neighbor Node: case study

A write-up of the project for a portfolio. Every number comes from `portfolio/facts.md`, where the command that counted it is written next to it. Every file named here exists in the project. The parts about the author and about how the project was built are in the first person, and they say plainly that an AI assistant wrote the code.

| Item | Detail |
| --- | --- |
| Project | Neighbor Node, a help and lending board for neighbors |
| Kind | A web app (Next.js and TypeScript) and a small command-line tool |
| Status | An early version, with no accounts and no database |
| Author and role | Mahmoud Mansouri. Chose which feature came next, ran every update on his own computer, and built the project with an AI assistant, which wrote the code and the tests |
| Time frame | Built in small steps, one update at a time. The counting tool does not read the commit history, so these texts give no dates and no hours |
| Code | The project folder, with a README that explains how to run it. No online address is claimed here |
| Live demo | None. The site runs on a local computer at http://localhost:3000 |

## Problem

Neighbors sometimes need a small favor or a tool for an afternoon: a ladder carried up two floors, a lift to the pharmacy, a drill. Other neighbors may be glad to help or to lend, but the two sides have to find each other first. This project is a small, local place where they can.

The design follows these rules, taken from the README:

- Nobody needs an account to use it.
- Only a street or an area is shown, never a house number.
- Replies are private, and a report says why but never who.
- Anyone can call the server directly, so the server checks every request itself.

The idea comes from the problem above. The project is small enough to finish and to review, and it still asks for real choices: how to let people edit their post with no accounts, how to slow down abuse with no accounts, and how to keep private replies private. Those choices, written down in the README with their costs, are the reason it is worth showing.

## Who it is for

The README describes people who live near each other. In the code there are three roles, and none of them has an account:

- A neighbor who needs help, offers help or has something to lend. This person writes a post and keeps its private link.
- A neighbor who wants to answer. This person reads the board and sends a reply or a report.
- The person who runs the server. This person reads reports and takes posts down with a command-line tool.

## The solution

Neighbor Node is a Next.js app. The board lists posts, newest first, and can be filtered by kind. A post is one of three kinds (Help wanted, Offer or Lend) and has one of three statuses (Open, In progress or Done). The board also shows 9 made-up sample posts, marked Example. They cannot be changed, reported or replied to.

When someone writes a post, the server saves it and shows a private link once. The link ends in a secret key. With the link, the author can edit the post, change its status, read replies, see how many reports the post has, keep it up, or take it down. Without it, nobody can.

## Main features

- Read the board and filter it by kind (`app/board/page.tsx`, `components/kind-filter.tsx`).
- Write a post. The server checks it again before it saves it (`app/board/new/actions.ts`, `lib/new-post.ts`).
- A private link instead of an account (`lib/manage-key.ts`).
- A private page for the author: edit the post, change its status, read replies, see report counts, take it down (`app/board/[id]/manage/page.tsx`, `components/manage-post-panel.tsx`).
- A post that nobody touches for 30 days is hidden from the board and never deleted. The author can keep it up (`lib/post-age.ts`, `components/keep-post-up.tsx`).
- Private replies. Only the author reads them (`app/board/[id]/reply-actions.ts`, `components/reply-post-form.tsx`).
- Reports with a reason and no name. There are 5 reasons (`app/board/[id]/actions.ts`, `lib/report-reasons.ts`).
- Speed limits on every public action (`lib/rate-limit.ts`).
- A command-line tool that lists reports and takes posts down, with a backup first (`scripts/moderate.mjs`).
- A light and a dark theme, made from CSS variables. The dark theme follows the system setting (`app/globals.css`).
- Safe headers on every page (`next.config.ts`).
- A share image that is drawn when the site is built (`app/opengraph-image.tsx`).
- `robots.txt` and a sitemap that leaves out every post (`app/robots.ts`, `app/sitemap.ts`).

## How it works

Saving a post:

1. The form (`components/new-post-form.tsx`) checks the fields in the browser.
2. It calls `savePost` in `app/board/new/actions.ts`, which runs on the server. It uses only the four fields of the form, so nobody can choose an id, a status or a date. It checks the rules again (`lib/new-post.ts`).
3. The server takes a place in the speed limit for the visitor and for the whole site (`lib/post-limits.ts`, `lib/live-post-limits.ts`) before it opens the file.
4. `lib/manage-key.ts` makes the key: 32 random bytes, written as 64 characters. Only a SHA-256 fingerprint of the key goes into the file.
5. `lib/post-store.ts` adds the post to `data/posts.json`. It writes a new file next to the old one and renames it over the old one. Changes happen one at a time.
6. The answer holds the private link. The form shows it once.

Opening the private link:

- The key is the end of the link, after the `#`. A browser does not send that part to the server when it opens a page, so the key does not show up in the server logs.
- The page reads the key in the browser (`components/manage-post-panel.tsx`) and sends it along with each check and each change.
- The functions in `lib/post-store.ts` that read or change one post need the key. A wrong key, an unknown post, an old post without a fingerprint and a post that was taken down all get the same answer.

Old posts and moderation:

- Hiding a post after 30 days is worked out from its dates on each visit. Nothing is written when a post becomes hidden (`lib/post-age.ts`).
- Taking a post down adds a `removedAt` time to its entry. The entry stays in the file.
- The person who runs the site uses `scripts/moderate.mjs` with the commands `list`, `show` and `take-down`. `take-down` is only a preview until `--yes` is added. With `--yes`, it copies the posts file first.

## Tech stack

| Part | What | Notes |
| --- | --- | --- |
| Framework | Next.js 16.2.1 | App Router and server actions. There are no API route handlers (`route_handlers`: 0). |
| UI | React 19.2.4 | The pages and the components. |
| Language | TypeScript 5 | `strict` is on in `tsconfig.json`. |
| Styles | Tailwind CSS 4 | Colors are CSS variables, one set for light and one for dark. |
| Font | Geist | Loaded with `next/font`. |
| Storage | One JSON file, `data/posts.json` | There is no database (`database_files`: 0). |
| Moderation tool | A Node.js script | `scripts/moderate.mjs`. It needs no packages. |
| Tests | Vitest, jsdom, React Testing Library | The tests are in `__tests__/`. |
| Checks | ESLint 9 and `tsc --noEmit` | `npm run lint` and `npm run typecheck`. |

There are 3 packages in `dependencies` (`next`, `react` and `react-dom`). The full list with versions is in `portfolio/facts.json`.

## Engineering highlights

- **The server does not trust the browser.** A server action is an address that anyone can call. So every rule the browser checks is checked again on the server. The rules live in `lib/` (for example `lib/new-post.ts`) and the actions in `app/` call them.
- **Private links without accounts.** The key is 32 random bytes. The file keeps only a SHA-256 fingerprint, so reading `data/posts.json` does not give anyone a working link. The two fingerprints are compared in constant time (`lib/manage-key.ts`).
- **Speed limits without a database or an extra service.** One small counter (`lib/rate-limit.ts`) keeps the places in memory and forgets the visitors who were not seen for the longest time first. There are 7 files of limit rules and 5 live counters in `lib/`. A place is taken before the file is opened, so many tries at the same moment cannot all get through. A try that fails on the server's side gives its place back.
- **A JSON file that does not break halfway.** Posts are written to a temporary file that is then renamed over the old one, so a crash cannot leave half a file. A file that cannot be read is never replaced (`lib/post-store.ts`).
- **Nothing is erased.** Taking a post down and hiding an old post only change what is shown. An entry can be brought back by hand.
- **A moderation tool with a safety net.** It only previews until `--yes` is added. It copies the file before it changes it, refuses a file it does not understand, and never prints replies. It replaces control characters in what it prints, so a title cannot send commands to the terminal. Tests compare it with the store (`__tests__/moderate-script.test.ts`).
- **Details for people who use screen readers or reduced motion.** The question "Really take this post down?" opens with focus on the safe answer, and Escape closes it (`components/manage-post-panel.tsx`). The 21 icons are plain SVG and hidden from screen readers (`components/icons.tsx`). The motion switches off for people who ask for less of it (`app/globals.css`). The pages and components have 79 `aria-*` attributes.
- **Tests that cannot touch real data.** Tests that need a posts file use temporary folders (`__tests__/support/temp-folders.ts`). `__tests__/project-files.test.ts` checks that the saved posts and the backups stay out of version control. `__tests__/look-tokens.test.ts` checks that every CSS variable the style sheet asks for is defined in both themes.
- **Safe headers.** 5 headers are set in `next.config.ts`, and the `X-Powered-By` header is switched off. A script policy and `Strict-Transport-Security` are left out on purpose, and the README says why.

## Challenges

These are the problems the design has to solve, and what is still open. The open parts are written in the README.

- **Who may edit a post, with no accounts?** The private link answers it. The cost is that a lost link cannot be replaced from the site, and that anyone who has the link can edit the post.
- **How to slow down abuse, with no accounts?** The speed limits are only a speed bump. Without a proxy in front of the site, a visitor can write any address in the headers that the limits read. Two copies of the server count separately. A restart starts the counts again.
- **How to save to a file safely?** The rename keeps the file whole, and changes run one after another inside one server. The file is not locked, so only one copy of the server may use it. A host with a read-only disk cannot save posts at all, so a public site will need a database.
- **How to keep replies private?** A reply goes only to the author, and is never shown on the board. The contact in a reply is shown as plain text and never as a link, so that nobody can slip in a link for the author to click.
- **How to hide old posts without a background job?** The page works it out from the dates on each visit, so there is nothing to schedule and nothing to repair.

The hardest choices were the ones that come from having no accounts. Who may edit a post: the private link answers it, and the cost is that a lost link cannot be replaced. How to slow down abuse: the limits are only a speed bump, and the README says what they cannot stop. Saving to a file was simpler once its limit was accepted, that only one copy of the server may use the file. With more time I would start from a database, because it removes the largest limit of the project.

This project was built with the help of an AI assistant (Claude, by Anthropic). The assistant wrote the code and the tests, in small steps. I chose which feature came next, for example the replies to a post and the README, and I ran every step as one command in my own terminal and sent the output back. Each command backed up the files it changed, checked itself and could be undone. The shape of the project is described in the README: three kinds of post, a private link instead of accounts, and an honest list of what is missing. The tests and the counting tool let a reader check the result without taking my word for it.

## Results

These are counts from the files. They describe the code, not how well the site works for users. Each row names the key in `portfolio/facts.md` that holds the number and the command.

| What was counted | Number | Fact key |
| --- | --- | --- |
| Pages | 5 | `pages` |
| Error and not-found pages | 4 | `error_pages` |
| Server actions | 9 | `server_actions` |
| API route handlers | 0 | `route_handlers` |
| Database files | 0 | `database_files` |
| Code files | 209 | `files_code` |
| Lines of code, with comments and blank lines | 23,300 | `lines_code` |
| Lines of code in `__tests__/` | 15,930 | `lines_tests` |
| Test files | 125 | `test_files` |
| Tests written | 1,068 | `test_definitions` |
| Packages in `dependencies` | 3 | `dependencies` |
| Icons drawn | 21 | `icons` |
| Security headers | 5 | `security_headers` |

The tests are counted as lines that start a `test(` or an `it(` call. A test that runs several cases counts once.

Not measured: there are no users, no traffic and no speed measurements, so this case study has no numbers about them.

The checks that exist in the project are `npm test`, `npm run lint`, `npm run typecheck` and `npm run build`. The command that makes the pictures of this portfolio runs `npm test` and keeps the end of its output as a picture and in `manifest.json`, so the result of the last test run is on record. No text claims that the lint, the type check or the build passed, because no tool in `portfolio/` runs them. The number of commits and of contributors is not shown, because the counting tool does not run the version-control program.

## What I would do next

The README lists what is not there yet. A possible order, starting with what a public site needs first:

1. A database, because a host with a read-only disk cannot save posts to a file.
2. Accounts and sign-in, so that limits and moderation can rest on something more than an address.
3. A message to the author when a reply or a report arrives, or before a post is hidden.
4. Deleting one reply from the site, and bringing a taken-down post back from the site.
5. A list of the old versions of an edited post.
6. A check of posts before they show.
7. A script policy and `Strict-Transport-Security`.

The order above is the order I would follow. The database comes first, because without it a public site cannot save posts on most hosts. Accounts come second, because the speed limits and the moderation both need more than an address. A message to the author comes third, because today an author has to open the private page to see a reply or a report. The check of posts before they show comes sixth: it costs the most to run, and it matters most once there are many posts.
