# Neighbor Node

A help and lending board for neighbors. People who live near each other post what they need, what they can do, and what they can lend. A neighbor answers, and the author keeps the post up to date.

This is an early version. There are no accounts and no database yet: the posts are kept in one file inside the project. Only a street or an area is shown, never a house number.

A post is one of three kinds: Help wanted, Offer or Lend. It is either Open, In progress or Done.

## What works today

- Read the board and filter it by kind.
- Write a post. The server checks it again and saves it in `data/posts.json`.
- Use the private link that the form shows once after saving. With it, the author edits the post, changes the status, reads the replies, sees how many reports the post has, or takes the post down.
- Edit your own post. The board and the page of the post then say "Edited today" (or the day), so neighbors can see that the text has changed.
- Keep a post up. A post that nothing happens to for 30 days is hidden from the board, and never deleted. The author starts the 30 days again with one button, and can show a hidden post again.
- Reply to a post. A reply goes only to the author and is never shown on the board.
- Report a post. A report says why, never who.
- Run a small tool, `scripts/moderate.mjs`, to look at reports and take posts down.

The board also shows nine made-up sample posts, marked "Example". They cannot be changed, reported or replied to.

## Quick start

You need Node.js 20.9 or newer. That is what Next.js 16 asks for, see the [Next.js 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16). Run the commands inside the project folder.

    npm install
    npm run dev

Then open http://localhost:3000 in your browser. The server looks for `data/posts.json` in the folder where you started it, so always start it inside the project folder.

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the site for development. |
| `npm run build` | Builds the site for real use. |
| `npm run start` | Runs the built site. |
| `npm test` | Runs all tests once. |
| `npm run test:watch` | Keeps the tests running while you work. |
| `npm run typecheck` | Checks the TypeScript types. |
| `npm run lint` | Checks the code style with ESLint. |

Settings are written in front of the command, for example `SITE_URL=https://neighbors.example npm run build`.

| Setting | What it does | If it is not set |
| --- | --- | --- |
| `SITE_URL` | The full address of the site. | `http://localhost:3000` |
| `POSTS_PER_HOUR` | How many posts one visitor can save in an hour. | 5 |
| `POSTS_PER_HOUR_SITE` | How many posts the whole site accepts in an hour. | 60 |

`SITE_URL` can also be written as a line in a file named `.env.local`, which git ignores. A value that is not a full web address gives an error. The two post settings take whole numbers from 1 to 1000. A wrong value is ignored, and a warning is printed in the terminal.

## Pages

| Address | What it shows | Code |
| --- | --- | --- |
| `/` | The home page. | `app/page.tsx` |
| `/board` | Saved posts, newest first, then the samples. Filter with `?kind=help`, `?kind=offer` or `?kind=lend`. | `app/board/page.tsx`, `lib/board-posts.ts` |
| `/board/post-...` | One saved post in full, with the forms to reply and to report. | `app/board/[id]/page.tsx` |
| `/board/sample-1` to `sample-9` | One sample post. | `lib/posts.ts` |
| `/board/new` | The form to write a post. | `app/board/new/page.tsx`, `components/new-post-form.tsx` |
| `/board/post-.../manage#...` | The private page of one post. The part after the `#` is the secret key. | `app/board/[id]/manage/page.tsx` |
| `/robots.txt`, `/sitemap.xml` | For search engines. The sitemap lists only the home page and the board. | `app/robots.ts`, `app/sitemap.ts` |

An address with an unknown id, or the address of a post that is hidden or was taken down, shows a "Post not found" page. If the posts file cannot be read, the board still opens with the samples and says so. The board and the post pages are made fresh for every visit, so "Today" and "3 days ago" stay right.

## Privacy and safety in short

- There are no accounts. A post gets a secret key instead, and only a fingerprint of it is saved.
- Only a street or an area is asked for. The area field refuses digits, so a house number cannot slip in.
- Everything the browser checks is checked again on the server, because anyone can call a server action, not only our forms.
- Replies are private. They are read only on the private page of the post, with the key.
- Reports say why, never who. Nothing about who reported or who replied is saved.
- Every action that anyone can use has a speed limit, see Limits below.
- Post pages and private pages ask search engines not to list them. The sitemap leaves out all posts.
- Nothing is erased. A post that is taken down gets a field in its entry, so it can be brought back by hand. A post that is hidden after 30 days gets nothing at all: the page works it out from the dates.
- Every page is sent with a few safe headers, see Security headers below.

## Saved posts

Posts are kept in one file, `data/posts.json`, inside the project. `lib/post-store.ts` reads and writes it. The file is made when the first post is saved. The folder `data/` is listed in `.gitignore`, so your neighbors' posts are never committed to git. The file looks like this:

    { "version": 1, "posts": [ ... ] }

| Field of a post | Meaning |
| --- | --- |
| `id`, `kind`, `title`, `details`, `area`, `status`, `createdAt` | The post itself. Since the first version. |
| `manageKeyHash` | The fingerprint of the secret key. Posts saved before private links existed have none. |
| `removedAt` | The time the post was taken down. |
| `editedAt` | The time the author last edited the title, the details or the area. Only a post that was edited has it. It also keeps the post up. |
| `renewedAt` | The time the author last pressed "Keep my post up". Only a post where it was pressed has it. It is written at most once a day. |
| `reports` | What visitors reported, each with a reason and a time. |
| `replies` | What neighbors answered, each with a message, an optional name, an optional contact, and a time. |

The last six fields are additions: `version` stays 1, and a file without them still works. Nothing in the file is ever deleted by the app. The board and the pages never show the fingerprint, the reports or the replies. `editedAt` shows only as words, for example "Edited 3 days ago". `renewedAt` is never shown as a date: the private page only says how many days are left.

What a neighbor can write:

| Text | Length |
| --- | --- |
| Title of a post | 5 to 80 characters |
| Details of a post | 10 to 500 characters |
| Area of a post | up to 60 characters, no digits |
| Message of a reply | 5 to 300 characters |
| Name in a reply (optional) | up to 40 characters |
| Contact in a reply (optional) | up to 100 characters |

The rules are in `lib/new-post.ts` and `lib/new-reply.ts`.

Saving. When someone presses "Save my post", the browser calls `savePost` in `app/board/new/actions.ts`. It runs on the server and checks the post again. It uses only the four fields of the form, so nobody can choose an id, a status or a date. If the board is full or the file cannot be written, the person sees a plain message, and the details go to the terminal where the server runs. Saves happen one at a time inside one running server, so no change is lost.

Limits to know about:

- The file holds at most 500 posts. A post that was taken down still counts, and so does a post that is hidden after 30 days.
- Run only one copy of the server on a file.
- A file that cannot be read is never replaced. You get an error that names the file, and you fix it or move it away.
- A host with a read-only disk, such as Vercel, cannot save to a file. A public site on such a host will need a database later.
- There are no accounts, so anyone who can open the site can post. Nobody checks a post before it shows.
- To remove a test post, open `data/posts.json` and delete its entry by hand (keep the file valid JSON), or delete the whole file.

## Limits

Anyone can use the site, so the server limits how fast. A limit is a speed bump, not a lock.

| What | Limit | Where the number is |
| --- | --- | --- |
| Posts saved by one visitor | 5 an hour | `defaultPostLimitSettings` in `lib/post-limits.ts` |
| Posts saved by the whole site | 60 an hour | `defaultPostLimitSettings` in `lib/post-limits.ts` |
| Wrong tries on a private page, one visitor | 10 in 10 minutes | `defaultManageLimitSettings` in `lib/manage-limits.ts` |
| Reports sent by one visitor | 5 an hour | `defaultReportLimitSettings` in `lib/report-limits.ts` |
| Replies sent by one visitor | 10 an hour | `defaultReplyLimitSettings` in `lib/reply-limits.ts` |
| Edits saved by one visitor | 10 an hour | `defaultEditLimitSettings` in `lib/edit-own-post-limits.ts` |
| Reports kept for one post | 20 | `reportsKeptPerPost` in `lib/post-store.ts` |
| Replies kept for one post | 20 | `repliesKeptPerPost` in `lib/new-reply.ts` |
| Posts in the file | 500 | `savedPostsLimit` in `lib/post-store.ts` |

How the counting works:

- Posting. Only a post that was really saved counts. A post that fails the checks, or cannot be written, gives its place back. After the limit, the form says that saving is paused and about how many minutes to wait.
- Private page. A try is wrong when the post or the key does not fit, when the post was taken down already, or when the id or the key does not have the right shape. A try with the right key is free, and so is a try that fails on our side. After the 10th wrong try, the server stops answering that visitor for a while and does not open the file. The actions of the private page (`checkManageLink`, `changePostStatus`, `removePost`) share one counter. Reading the replies, saving an edit and keeping a post up share it too.
- Editing. Every edit that reaches the file counts, also one that changes nothing, because the server opens and compares the file each time. A wrong try, a text that fails the checks and a try that fails on our side give their place back. A visitor who is over the limit is told so before the key is looked at. The server then says how many minutes to wait and does not open the file.
- Reports and replies. Every try counts, also one about a post that does not exist, because it makes the server open the file. Only a try that fails on our side gives its place back. After the limit, the server says how many minutes to wait and does not open the file.
- The place is taken before the file is opened, so many tries sent at the same moment cannot all slip through.
- The counting itself is the small counter in `lib/rate-limit.ts`. The counters of the running server are made in `lib/live-post-limits.ts`, `lib/live-manage-limits.ts`, `lib/live-report-limits.ts` and `lib/live-reply-limits.ts`.
- The counts live in the memory of the running server. Stopping and starting it begins again from zero. If you hit a limit while testing on your own computer, restart `npm run dev`.

How a visitor is told apart. By the last address in the `x-forwarded-for` header, which a proxy in front of the site adds (nginx is one), or else by `x-real-ip`. The first addresses in that header can be written by the visitor, so they are not used. With neither header, every visitor counts as the same one. Then 5 posts by anyone use up the posting limit, and 10 wrong tries by anyone pause every private page for up to 10 minutes. Check that your host or proxy sets one of these headers.

What a limit cannot do:

- A visitor who talks to the server directly, with no proxy in front, can write any address in these headers and look like a new visitor each time. Then only the limit for the whole site still holds, and one flood can use up all 60 places, so that nobody else can post for up to an hour.
- Two copies of the server count separately.
- A real fix needs accounts, a check of the posts, or a limit in the proxy in front of the site. The Next.js self-hosting guide advises a reverse proxy for this.
- There is no limit for the whole site on the private page, on purpose, because it would let one flood lock every author out.

## Private keys for posts

A post gets a secret key when it is saved. The server makes it (32 random bytes, written as 64 characters, in `lib/manage-key.ts`) and sends it back once, in the answer of `savePost`. It does not keep the key. It keeps a fingerprint (a SHA-256 hash) in the field `manageKeyHash`, so reading `data/posts.json` does not give anyone a working key.

Four functions in `lib/post-store.ts` need the key to read or change a post: `readOwnPost`, `updateOwnPostStatus`, `updateOwnPost` and `removeOwnPost`. A wrong key, an unknown post, an old post without a fingerprint and a post that was taken down all get the same answer, "not-allowed". `lib/manage-post.ts` wraps them for the server. It refuses an id or a key of the wrong shape before it opens the file, and it turns a damaged file into a plain "failed". `app/board/[id]/manage/actions.ts` hands them to the browser as server actions.

Anyone who has a key can edit that post, change its status or take it down, so a key is like a password. A guessed key is not a realistic risk (there are 2 to the power 256 possible keys). The limit on wrong tries is not what keeps posts safe. It only stops one visitor from making the server read the file again and again with tries that cannot work.

## The private page

Right after a post is saved, the form shows a private link once, for example `http://localhost:3000/board/post-.../manage#...`, with a button to copy it. The form drops the key from the screen as soon as the person writes another post.

The key is the end of the link, after the `#`. A browser never sends the part after the `#` to the server when it opens a page, so the key does not show up in the logs of the server. The page reads it in the browser (`components/manage-post-panel.tsx`) and sends it along with each check and each change.

On the private page the author can:

- edit the title, the details and the area, see Editing a post below;
- change the status with the buttons Open, In progress and Done;
- read the replies, see Replying to a post below;
- see how many reports the post has (see Reports below);
- keep the post up, or show it again when it is hidden, see Keeping a post up below;
- take the post down.

Keep the link, it is the only way back. If it is lost, the post cannot be changed from the site (you can still edit `data/posts.json` by hand). The browser that opened the link keeps it in its history. Posts saved before private links existed cannot be changed or taken down from the site.

### Editing a post

The private page has a block "Edit your post". The button "Edit my post" opens a form with the title, the details and the street or area, filled in as they are now. Nothing is saved until the author presses "Save changes", and "Cancel" closes the form and drops what was typed. The kind, the status, the date and the secret key cannot be changed here.

- The texts follow the rules of a new post: a title of 5 to 80 characters, details of 10 to 500, an area of up to 60 with no digits. `lib/edit-post.ts` reuses `validateNewPost` from `lib/new-post.ts`. The browser checks first, and the server checks again, because anyone can call a server action.
- An edit that changes nothing is not saved, and the post is not marked as edited. Spaces at the start or the end do not count as a change.
- A saved edit adds `editedAt` to the post. The board and the page of the post then show "Edited today", "Edited yesterday", "Edited 3 days ago" or "Edited last week" next to the time the post was posted. The words are worked out on each visit, like "3 days ago".
- The post keeps its place on the board, its posted time, its status, its reports and its replies. Only the three texts and `editedAt` change.
- The old text is replaced and not kept. A report may therefore describe a text that is gone. The moderation tool shows the text as it is now and does not say that the post was edited: look for `editedAt` in `data/posts.json`.
- `updateOwnPost` in `lib/post-store.ts` does the writing and needs the key. `editOwnPostFromInput` in `lib/edit-own-post.ts` checks everything that comes in and answers with plain data: ok, invalid (with a message for each field), not-allowed or failed. `editPost` in `app/board/[id]/manage/edit-actions.ts` is the server action. The limits are described under Limits.
- The edit form is `components/edit-post-form.tsx`. The panel (`components/manage-post-panel.tsx`) sends the edit, so that only one change, a new status or a new text, is on its way at a time.

### Keeping a post up

A post that nothing happens to for 30 days is hidden from the board. Nothing is deleted: the entry stays in `data/posts.json`, and the private page of the post still works.

- The 30 days count from the latest of three times: `createdAt`, `editedAt` and `renewedAt`. An edit keeps a post up, and so does the button "Keep my post up". Changing the status does not.
- A post that is done is never hidden. Marking a hidden post as done puts it back on the board, as done. Opening an old done post again hides it at once, because the last news about it is old.
- Hiding is worked out from the dates on each visit (`lib/post-age.ts`). Nothing is written when a post becomes hidden. The board does not list a hidden post, its own page shows "Post not found", and it takes no new reports and no new replies.
- The private page of a hidden post says so in the block "Keep your post up", and the button "Show my post again" starts the 30 days again. A hidden post has no link to its own page there, because that page would say "Post not found".
- The button writes `renewedAt` at most once a day for a post. It shares the wrong-try counter of the private page. `renewOwnPost` in `lib/post-store.ts` does the writing, `renewOwnPostFromInput` in `lib/renew-own-post.ts` checks what comes in, and `renewPost` in `app/board/[id]/manage/renew-actions.ts` is the server action.
- A post that was kept up keeps its place on the board. It is not moved to the top.
- A hidden post still counts toward the 500 posts of the file. The moderation tool does not know about hiding: `list` and `show` still show hidden posts, and `take-down` works as before.

### Taking a post down

The button "Take this post down" does not act at once. It first opens the question "Really take this post down?", with the title of the post, and focus moves to "Keep my post", the safe answer. Only "Yes, take it down" sends the request. "Keep my post", or the Escape key, closes the question and sends nothing. If sending fails, the question stays open and says so, and the post stays.

`removePost` in `app/board/[id]/manage/actions.ts` checks the key again, because anyone can call it without our page. `removeOwnPost` in `lib/post-store.ts` does not erase the post. It only adds `removedAt` with the time to its entry. From then on the board and the page of the post leave the post out, and its private link stops working: opening it again only gets "This link does not match your post".

Because the entry stays in the file, you, who run the server, can bring a post back by deleting its `removedAt` line by hand (keep the file valid JSON). To get rid of a post for good, delete its whole entry by hand. The author cannot bring a post back from the site. A post that was taken down still counts toward the 500 posts of the file, so a very full board needs some cleaning by hand.

## Reports

Every saved post page has a small button "Report this post" (`components/report-post-form.tsx`). It opens a short form with five reasons: spam or an advertisement, an exact address or private details, a scam or a request for money, unkind or unsafe or against the law, and something else. The ids and words are in `lib/report-reasons.ts`. No account and no key are needed. Nothing is sent until the person has chosen a reason and presses "Send report". The sample posts have no button.

The browser calls `reportPost` in `app/board/[id]/actions.ts`. It checks the id and the reason again. `addReport` in `lib/post-store.ts` then adds `{ "reason": "...", "at": "..." }` to the field `reports` of that post. Only the reason and the time are saved, never who sent the report. A post keeps at most 20 reports. The 21st gets a thank-you answer but is not saved. A post that was taken down cannot be reported.

Reports do not hide or remove anything by themselves, and nobody is told when one arrives. Anyone can report, so a report can be false: read it as a hint, not as proof. The same visitor can report the same post again, up to the limit, so 5 reports may come from one person.

What the author sees. The private page has a block "Reports" between the status choices and "Take this post down". It says "Nobody has reported your post." or "Your post was reported 3 times.", and under that each reason with its count. It also says what a report is: it says why, never who, it does not remove the post by itself, and it can be wrong. The server counts the reports with `summarizeReports` in `lib/report-summary.ts` and sends only the counts. The times stay in the file. The counts come with the answers of `checkManageLink` and `changePostStatus`, so a report that arrives while the page is open shows after the next check, for example after reloading the page. The author cannot answer a report or see who sent it. The count stops at 20, because a post keeps at most 20 reports.

What you see. You, who run the server, read the reports with the tool described in Looking at reports and taking posts down below. This one-line command, run in the project folder, also lists the reported posts with their reasons:

    node -e 'const d=JSON.parse(require("fs").readFileSync("data/posts.json","utf8"));for(const p of d.posts)if(p.reports)console.log(p.id,p.title,p.reports.map(r=>r.reason).join(", "))'

## Replying to a post

A neighbor can answer a saved post. Every saved post page has a button "Reply to this post" under the post (`components/reply-post-form.tsx`). It opens a short form with a message, a first name (optional) and a way to reach the neighbor (optional, for example a phone number or an email address). The lengths are in the table under Saved posts. Nothing is sent until the person presses "Send reply". The browser checks the rules first, and the server checks them again.

A reply goes only to the author. No account and no key are needed to send one, but a reply is never shown on the board or on the post page. The sample posts take no replies. A post that is marked as done takes none either: the page says so, and the server refuses (the answer "closed"). The post takes replies again when its author sets the status back to Open or In progress. A post that was taken down cannot be replied to.

The author reads the replies on the private page, in a block "Replies" between the status choices and the reports, the newest first. For each reply it shows the message, the name (or "A neighbor"), when it was written, and the contact. The contact is shown as plain text and never as a link, so that nobody can slip a link into it that the author might click by mistake. The block asks the server when the page opens, and again when the author presses "Check for new replies". Nobody is told when a reply arrives, so the author has to look.

What is saved. `addReply` in `lib/post-store.ts` adds `{ "message": "...", "name": "...", "contact": "...", "at": "..." }` to the field `replies` of that post. The name and the contact are left out when the neighbor wrote none. A reply is saved with the clean (trimmed) text that the second check produced, and only the three fields of the form are used. A post keeps at most 20 replies. The 21st gets an answer but is not saved. With 500 posts, 20 replies each and at most 440 characters in each, the file can grow to about 5 MB, and every save writes the whole file again.

The parts:

- `replyToPost` in `app/board/[id]/reply-actions.ts` is the server action of the form. It uses `lib/reply-post.ts` (the checks and the answers: sent, enough, closed, not-found, invalid and failed) and `lib/reply-limits.ts`.
- `readOwnReplies` in `lib/post-store.ts` needs the key, like the other private functions. Its server action is `loadReplies` in `app/board/[id]/manage/replies-actions.ts`, with the logic in `lib/own-replies.ts` and `lib/own-replies-limits.ts`.
- The block on the private page is `components/own-replies.tsx`. The panel only has a place for it, which `app/board/[id]/manage/page.tsx` fills, and it shows the block only while the link fits.

Limits to know about. Anyone can reply, so a reply can be spam or unkind. The author sees it and can ignore it, but cannot delete a single reply from the site yet. Someone could fill the 20 places of a post with junk. You can delete entries from the `replies` list of a post in `data/posts.json` by hand (keep the file valid JSON). There are no accounts, so nobody knows who wrote a reply, and the name and the contact are not checked. When a post is taken down, its replies stay in the file, but nobody can read them in the app any more. The moderation tool never prints them.

## Looking at reports and taking posts down

For you, who run the server, there is a small tool in `scripts/moderate.mjs`. It is plain Node.js with no packages to install. It works on `data/posts.json` in the folder where you run it, so run it inside the project folder. It is not part of the website, and nobody can reach it from a browser.

    node scripts/moderate.mjs list
    node scripts/moderate.mjs show post-abc123
    node scripts/moderate.mjs take-down post-abc123
    node scripts/moderate.mjs take-down post-abc123 --yes

- `list` shows the posts that were reported and are still shown, the one with the most reports first, with how many reports each reason got and the time of the last one. Take the ids from there.
- `show` prints one post with its details and each of its reports (the time and the reason, the oldest first). It also works for a post that was taken down. The words of a post are written by visitors, so the tool replaces control characters before it prints them: a title cannot send commands to your terminal.
- `take-down` without `--yes` is only a preview. It says which post it would take down and what it would do, and changes nothing.
- `take-down` with `--yes` does two things, in this order. First it copies the whole posts file to a backup next to it, named like `posts.json.before-take-down-20261031-115507` (the time is UTC; a second backup in the same second gets `-2`). Then it adds `removedAt` with the time to that post, exactly as the take-down by the author does. Nothing else in the file changes, the reports stay in the entry, and the file is written through a temporary file and a rename, like the website does it.
- `--file PATH` uses another posts file than `data/posts.json`.
- The exit code is 0 when all is fine, 1 for a problem with the file or the post, and 2 when the command was used wrongly.

From then on the post is gone from the board and from its own page, and the private link of its author stops working. The tool does not tell the author. Taking a post down that is down already changes nothing and makes no backup.

The tool refuses to touch a file it does not understand: a missing file, text that is not valid JSON, another version, or a post in the wrong shape. It says what is wrong and changes nothing. It uses the same rules as `lib/post-store.ts`, and a test compares the two. It never prints the replies to a post. An id that does not have the shape of a saved post is refused before the file is opened, and two posts with the same id are left alone.

To undo a take-down, the better way is by hand: delete the `removedAt` line of that post in `data/posts.json`, and the comma at the end of the line before it. The other way is to copy the backup back over `data/posts.json`, but every post saved since then would be lost. The backups are not deleted by the tool. They are in `data/`, which `.gitignore` lists, and you can delete old ones by hand.

Limits to know about. The tool and a running server are two separate programs, and the file is not locked. If someone saves a post or sends a report in the few milliseconds between the tool reading the file and renaming the new one into place, that change is lost. On a small board this is unlikely. Run `take-down --yes` at a quiet moment, or stop the server first. The server needs no restart afterwards, because it reads the file on each visit. The tool judges nothing: a report can be false, so read the post with `show` before you act. Taking a post down does not reach copies that someone saved or shared elsewhere.

## Before you put it on the internet

- Use a host where the server can write to a disk. A read-only host such as Vercel cannot save posts to a file.
- Run only one copy of the server on the posts file.
- Put a proxy in front of the site that sets `x-forwarded-for` or `x-real-ip`. Without it, all visitors share one set of limits.
- Set `SITE_URL` to the real address when you build, and keep it set when you start the server.
- Add `Strict-Transport-Security` once the site has a real HTTPS address. Some hosts send it for you, so check yours.
- Copy `data/posts.json` to a safe place now and then. Git does not hold it, and the backups of the moderation tool sit next to it.
- Remember that nobody checks a post before it shows. Look at the reports now and then.

## Security headers

Every page is sent with a few safe headers that only turn browser features off: no guessing of file types, no showing the site in a frame, a short referrer, and no camera, microphone or location. They are listed in `next.config.ts`, which also switches off the `X-Powered-By` header.

Two things are left out on purpose. A script policy (CSP `script-src`) needs a fresh nonce on every page, which makes every page slower to serve, or `'unsafe-inline'`, which makes it weak. `Strict-Transport-Security` is best added once the site has a real HTTPS address, because browsers remember it for a long time.

## Look and feel

Colors are plain CSS variables at the top of `app/globals.css`, one set for light and one for dark. Use them in code as Tailwind classes: `bg-surface`, `text-muted`, `border-line`, `bg-accent`, and `bg-help-soft text-help` (the same for `offer` and `lend`). Error messages use `text-danger` and `bg-danger-soft`. Button styles are in `components/button-styles.ts`. The names and texts of the three post kinds are in `lib/post-kinds.ts`.

The page font is [Geist](https://vercel.com/font), loaded by `next/font` in `app/layout.tsx`. It is the only font that is loaded. The few words that need a fixed width, such as the error reference on the error page, use the system font.

### Icons, shadows and motion

The small pictures (the pin, the clock, and one for each kind of post) are drawn in `components/icons.tsx` as plain SVG. There is no icon package and no image file. An icon takes the color of the text around it, and it is hidden from screen readers, because the words next to it say the same thing.

The two shadows are variables too: `shadow-card` for a card at rest and `shadow-lift` for a card under the pointer. The cards of a list come in one after the other (the class `rise` in `app/globals.css`). People who ask their system for less motion do not get this, and nothing slides for them. `__tests__/look-tokens.test.ts` checks that every variable the style sheet asks for is defined, in the light and in the dark theme.

The thin colored bar on a card, on the page of a post and on the home page comes from one place, `components/kind-colors.ts`. The three small cards at the top of the home page (`components/board-preview.tsx`) are only a picture, made from the first sample posts. Nothing in them can be clicked, and a screen reader skips all of them.

### Forms

The look of every form (the labels, the fields, the card around a form, the cards that offer a choice) comes from one place, `components/form-styles.ts`, and the message under a field that is wrong from `components/field-error.tsx`. The page to write a post has a short list of things to know next to the form. The pictures in the forms are only decoration: the words say the same, and a screen reader skips them.

The private page of a post is one card with a block for each thing the author can do: where the post stands, how long it stays on the board (with a bar that shows the days left), the edit form, the replies, the reports, and at the end, behind a red line, taking the post down. Every block has a small picture in front of its heading. The status buttons show the chosen status with the accent color, and the pictures on them are only decoration.

### Share image

The picture that shows when a link is shared is drawn by `app/opengraph-image.tsx`, using `components/share-card.tsx`. It is 1200 by 630 pixels and is made once, when you build. Open `/opengraph-image` in the browser to see it. The drawing engine understands only a small part of CSS, so the card uses plain styles and the light colors of `app/globals.css`, written out. A test checks that they still match.

`metadataBase` in `app/layout.tsx` turns the address of the picture into a full address, using `SITE_URL`. A wrong `SITE_URL` stops every page, not only `robots.txt` and the sitemap.

## Tests and checks

Run `npm test` once, or `npm run test:watch` while you work. Run `npm run typecheck`, `npm run lint` and `npm run build` for the other checks. The tests use Vitest with jsdom and React Testing Library, and they live in `__tests__/`. A test file is named after the code it tests. Tests that need a posts file use temporary folders, so they never touch your real `data/posts.json`.

`__tests__/project-files.test.ts` checks the files of the project itself: that `.gitignore` keeps your saved posts, the backups and the env files out of git, and that the code only points to pictures that exist.

The folder `.update-backup/` holds backups made by the update commands. Tests and lint ignore it, and `.gitignore` lists it, so git does not see the backups either. Once you are sure that you do not need a backup any more, you can delete its folder by hand.

## Project map

| Path | What is in it |
| --- | --- |
| `app/` | The pages, the server actions and the icons. `app/globals.css` has the colors. |
| `components/` | The parts that the pages are made of, and the small pictures in `icons.tsx`. |
| `lib/` | The rules, the storage and the limits. No page code. |
| `scripts/moderate.mjs` | The moderation tool. |
| `__tests__/` | All tests. |
| `data/` | Made when the first post is saved. Holds `posts.json`. Not in git. |
| `.update-backup/` | Backups made by the update commands. Not in git. |
| `next.config.ts` | The security headers. |
| `vitest.config.mts`, `vitest.setup.ts` | The test setup. |
| `eslint.config.mjs`, `tsconfig.json`, `postcss.config.mjs` | The settings of the code checks and of the styles. |

## Not there yet

- Accounts and sign-in.
- A database, which a host with a read-only disk will need.
- A message to the author when a reply or a report arrives, or before a post is hidden.
- Deleting one reply from the site, or bringing a taken-down post back from the site.
- A list of the old versions of an edited post. An edit replaces the old text.
- A check of posts before they show.
- A script policy and `Strict-Transport-Security` (left out on purpose, see Security headers).
