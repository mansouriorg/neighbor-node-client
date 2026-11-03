# Neighbor Node: interview answers

Ten questions you may be asked about this project. Each answer has two parts: the facts, with the files to open, and the answer in the first person, which you can say as it is or in your own words. Read the files named in each answer before the interview. An answer that you cannot explain is worse than no answer.

## Before you use these

This project was built with an AI assistant. Say so before you are asked. A reader who hears it from you, together with a clear account of what you decided and what you checked, will trust the rest. The README of the project also mentions the update commands that made backups, so an interviewer may notice it anyway.

The facts below are the ones that the files support. The answers in the first person only say what the project and its history show: no user numbers, no traffic and no speed measurements are claimed, because there are none.

## What is Neighbor Node, in one minute?

The facts: it is a help and lending board for people who live near each other. A post is Help wanted, Offer or Lend, and is Open, In progress or Done. Only a street or an area is shown. There are no accounts: each post has a private link for its author. The project has 5 pages and 9 server actions (`app/board/page.tsx`, `app/board/new/actions.ts`).

In my words: Neighbor Node is a small board where neighbors ask for help, offer help or lend things. There are no accounts. When you write a post you get a private link, and with that link you can edit the post, change its status and take it down. I would show the board first, then the form to write a post, then the private page. With half the time I would drop the moderation tool and keep the private link, because that is the part that is different.

## Why are there no accounts, and how can an author still edit a post?

The facts: accounts would need passwords, sign-in and a place to keep people. This project gives each post a private link instead. The server makes a key of 32 random bytes, written as 64 characters, shows it once, and keeps only a SHA-256 fingerprint of it (`lib/manage-key.ts`). The key is the part of the link after the `#`, so the browser does not send it to the server when it opens the page. The cost: a lost link cannot be replaced from the site.

In my words: Accounts would have turned a small project into a project about passwords and sign-in. The private link keeps it small: whoever has the link can edit the post, like a key. The price is that a lost link cannot be replaced from the site, and the README says so. A neighbor who loses the link can write a new post, and the old one hides itself after 30 days. For a real launch I would add accounts, because limits and moderation need something stronger than an address to rest on.

## How is the private key protected?

The facts: the file keeps only the fingerprint, so reading `data/posts.json` does not give anyone a working link. The fingerprints are compared in constant time. A wrong key, an unknown post, an old post without a fingerprint and a post that was taken down all get the same answer (`lib/manage-key.ts`, `lib/post-store.ts`). The private page asks search engines not to list it (`app/board/[id]/manage/page.tsx`). Anyone who has the link can change the post, so it works like a password. The tests are in `__tests__/manage-key.test.ts`.

In my words: The file never holds the key, only its fingerprint, so a copy of `data/posts.json` does not open any post. The link itself works like a password: a link pasted into a chat or shown in a screenshot is a leak, and the person who holds it can change the post. I would make sure the page that shows the link says that. The next thing I would look at is where else a link can end up, for example in the history of a browser.

## Why does the server check everything again when the browser already did?

The facts: a server action is an address that anyone can call, also without our form. So `savePost` checks every rule again with `lib/new-post.ts`, and it uses only the four fields of the form, so nobody can choose an id, a status or a date (`app/board/new/actions.ts`). The 9 server actions are spread over 7 files. The tests that call the actions directly are in `__tests__/new-post-actions.test.ts`.

In my words: If the server trusted the browser, a visitor could skip the form and call the action with any values: a title that is far too long, a status that is already Done, or the id of somebody else's post. The rule that is easiest to forget is one that the form makes impossible to break, such as the length of a field, because nobody ever sees it fail in the browser. To find such a gap in another project I would list every action and call each one by hand with wrong values.

## How do the speed limits work, and what can they not stop?

The facts: one small counter (`lib/rate-limit.ts`) keeps the places in memory. A place is taken before the file is opened, so many tries at the same moment cannot all get through, and a try that fails on the server's side gives its place back. There are 7 files of rules and 5 live counters in `lib/`. What they cannot stop, as the README says: a visitor who talks to the server directly, without a proxy, can write any address in the headers that the limits read. Two copies of the server count separately, and a restart starts the counts again. A real fix needs accounts, a check of the posts, or a limit in a proxy.

In my words: The limits are a speed bump, not a wall, and I say so before anyone asks. For a public site I would put the limit in a proxy in front of the server, because the proxy is the only part that sees the real address of a visitor. The limit on wrong tries at the private page does not keep posts safe, since a guessed key is not a realistic risk. It only stops one visitor from making the server read the file again and again. I would test a limit like this by making more tries than it allows and checking that the extra ones are refused.

## Why one JSON file instead of a database?

The facts: this is an early version, and a file is the smallest thing that works on one machine. Posts are written to a temporary file that is then renamed over the old one, and changes run one after another inside one server (`lib/post-store.ts`). The file holds at most 500 posts, and a file that cannot be read is never replaced. The costs: only one copy of the server may use the file, and a host with a read-only disk cannot save posts at all. A database is the first item on the list for a public site.

In my words: A file is the smallest thing that works on one machine, and this is an early version. I know its costs: only one copy of the server may use it, and a host with a read-only disk cannot save posts. To move to a database I would pick a hosted SQL database, because posts, replies and reports are related records. I would keep the functions of `lib/post-store.ts` with the same names, change only what is inside them, and copy the posts of the file over once.

## How do you know it works?

The facts: there are 125 test files with 1,068 tests, counted from the files. 64 files test rules and storage and 61 test pages and components (`test_files_logic`, `test_files_components`). The tests run in jsdom with React Testing Library, not in a real browser. Tests that need a posts file use temporary folders. `__tests__/project-files.test.ts` checks that the saved posts stay out of version control, and a test for the moderation tool compares it with the store. Nobody has used the site yet, and there are no load tests.

In my words: I trust the tests for the rules and the storage, and I know their limit: they run in jsdom, not in a real browser, and nobody has used the site yet. The command that makes the pictures of the portfolio runs `npm test` and keeps the end of its output as a picture, so the result of the last run is on record. Before a public launch I would add a test in a real browser and a load test.

## What was the hardest part?

The facts: the places where the code has to choose, and where the README says what is left open. Who may edit a post, with no accounts. How to slow down abuse, with no accounts. How to save to a file without breaking it. How to hide old posts without a background job.

In my words: The hardest choices were the two that come from having no accounts: who may edit a post, and how to slow down abuse. Each answer has a cost that the README states: a lost link cannot be replaced, and the limits only slow a visitor down. Saving to a file became simple once its limit was accepted: one copy of the server. If I started again for a public site, I would start from a database.

## How did you use an AI assistant, and what did you check yourself?

The facts: an AI assistant helped build this project. The files show small, separate steps with tests next to the code, and the README mentions the update commands.

In my words: An AI assistant (Claude, by Anthropic) wrote the code and the tests. I chose which feature came next, for example the replies to a post and the README, ran every update as one command in my own terminal, and sent the output back. Each command backed up the files it changed, checked itself and could be undone. I do not say that I wrote the code line by line. What I can show is the decisions: three kinds of post, a private link instead of accounts, and the list in the README of what is missing. The tests and the counting tool are there so that a reader can check the project without taking my word for it. One example: when the picture tool of this portfolio was tested, a test found that pressing Ctrl+C left a hidden browser folder behind, and it was fixed before the tool was handed over.

## What would you do next?

The facts: the README lists what is not there yet: accounts, a database, a message to the author when a reply or report arrives, deleting a single reply, a history of edited posts, a check of posts before they show, and a script policy with `Strict-Transport-Security`. For a public site, the database comes first.

In my words: First the database, because without it a public site cannot save posts on most hosts. I would measure it by one thing: a post is still there after the server restarts. Accounts come second, because the limits and the moderation both need more than an address. I would leave the check of posts before they show until there are enough posts to need it, because it costs the most to run.
