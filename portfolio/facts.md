# Facts about neighbor-node

Counted on 2026-11-01. Every number was counted by the command next to it, run inside the project folder. Left out of every count: node_modules, hidden folders, data/, portfolio/, coverage/ and *.d.ts files.

This file is made by `bash portfolio/tools/facts.sh`. Do not edit it by hand: run the tool again.

## Numbers

- **TypeScript files (.ts): 112**
  Command: `find . \( -type d \( -name '.?*' -o -name node_modules -o -name data -o -name portfolio -o -name coverage \) -prune \) -o -type f -name '*.ts' -not -name '*.d.ts' -not -name '*.d.mts' -print | wc -l`
- **React files (.tsx): 93**
  Command: `find . \( -type d \( -name '.?*' -o -name node_modules -o -name data -o -name portfolio -o -name coverage \) -prune \) -o -type f -name '*.tsx' -print | wc -l`
- **TypeScript module files (.mts): 1**
  Command: `find . \( -type d \( -name '.?*' -o -name node_modules -o -name data -o -name portfolio -o -name coverage \) -prune \) -o -type f -name '*.mts' -not -name '*.d.ts' -not -name '*.d.mts' -print | wc -l`
- **JavaScript module files (.mjs): 3**
  Command: `find . \( -type d \( -name '.?*' -o -name node_modules -o -name data -o -name portfolio -o -name coverage \) -prune \) -o -type f -name '*.mjs' -print | wc -l`
- **Style sheets (.css): 1**
  Command: `find . \( -type d \( -name '.?*' -o -name node_modules -o -name data -o -name portfolio -o -name coverage \) -prune \) -o -type f -name '*.css' -print | wc -l`
- **Lines in .ts files: 12415**
  Command: `find . \( -type d \( -name '.?*' -o -name node_modules -o -name data -o -name portfolio -o -name coverage \) -prune \) -o -type f -name '*.ts' -not -name '*.d.ts' -not -name '*.d.mts' -exec cat {} + | wc -l`
- **Lines in .tsx files: 10337**
  Command: `find . \( -type d \( -name '.?*' -o -name node_modules -o -name data -o -name portfolio -o -name coverage \) -prune \) -o -type f -name '*.tsx' -exec cat {} + | wc -l`
- **Lines in .mts files: 13**
  Command: `find . \( -type d \( -name '.?*' -o -name node_modules -o -name data -o -name portfolio -o -name coverage \) -prune \) -o -type f -name '*.mts' -not -name '*.d.ts' -not -name '*.d.mts' -exec cat {} + | wc -l`
- **Lines in .mjs files: 535**
  Command: `find . \( -type d \( -name '.?*' -o -name node_modules -o -name data -o -name portfolio -o -name coverage \) -prune \) -o -type f -name '*.mjs' -exec cat {} + | wc -l`
- **Lines in .css files: 138**
  Command: `find . \( -type d \( -name '.?*' -o -name node_modules -o -name data -o -name portfolio -o -name coverage \) -prune \) -o -type f -name '*.css' -exec cat {} + | wc -l`
- **Code files (.ts, .tsx, .mts, .mjs): 209**
  Command: `sum of: files_ts files_tsx files_mts files_mjs`
- **Lines of code (.ts, .tsx, .mts, .mjs), blank lines and comments included: 23300**
  Command: `sum of: lines_ts lines_tsx lines_mts lines_mjs`
- **Code files in app/: 20**
  Command: `find app -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.mts' -o -name '*.mjs' \) -not -name '*.d.ts' -not -name '*.d.mts' | wc -l`
- **Lines of code in app/: 1012**
  Command: `find app -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.mts' -o -name '*.mjs' \) -not -name '*.d.ts' -not -name '*.d.mts' -exec cat {} + | wc -l`
- **Code files in components/: 24**
  Command: `find components -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.mts' -o -name '*.mjs' \) -not -name '*.d.ts' -not -name '*.d.mts' | wc -l`
- **Lines of code in components/: 3143**
  Command: `find components -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.mts' -o -name '*.mjs' \) -not -name '*.d.ts' -not -name '*.d.mts' -exec cat {} + | wc -l`
- **Code files in lib/: 33**
  Command: `find lib -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.mts' -o -name '*.mjs' \) -not -name '*.d.ts' -not -name '*.d.mts' | wc -l`
- **Lines of code in lib/: 2630**
  Command: `find lib -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.mts' -o -name '*.mjs' \) -not -name '*.d.ts' -not -name '*.d.mts' -exec cat {} + | wc -l`
- **Code files in __tests__/: 126**
  Command: `find __tests__ -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.mts' -o -name '*.mjs' \) -not -name '*.d.ts' -not -name '*.d.mts' | wc -l`
- **Lines of code in __tests__/: 15930**
  Command: `find __tests__ -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.mts' -o -name '*.mjs' \) -not -name '*.d.ts' -not -name '*.d.mts' -exec cat {} + | wc -l`
- **Code files in scripts/: 1**
  Command: `find scripts -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.mts' -o -name '*.mjs' \) -not -name '*.d.ts' -not -name '*.d.mts' | wc -l`
- **Lines of code in scripts/: 508**
  Command: `find scripts -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.mts' -o -name '*.mjs' \) -not -name '*.d.ts' -not -name '*.d.mts' -exec cat {} + | wc -l`
- **Pages (page.tsx files in app/): 5**
  Command: `find app -type f -name 'page.tsx' | wc -l`
- **Error and not-found pages in app/: 4**
  Command: `find app -type f \( -name 'not-found.tsx' -o -name 'error.tsx' -o -name 'global-error.tsx' \) | wc -l`
- **API route handlers (route.ts files in app/): 0**
  Command: `find app -type f \( -name 'route.ts' -o -name 'route.tsx' \) | wc -l`
- **Files in app/ that are server actions: 7**
  Command: `grep -rl '"use server"' app | wc -l`
- **Server actions (exported async functions in the files that are server actions): 9**
  Command: `grep -rl '"use server"' app | while read -r f; do grep -h '^export async function' "$f"; done | wc -l`
- **Database files (.sql, schema.prisma, .db, .sqlite): 0**
  Command: `find . \( -type d \( -name '.?*' -o -name node_modules -o -name data -o -name portfolio -o -name coverage \) -prune \) -o -type f \( -name '*.sql' -o -name 'schema.prisma' -o -name '*.db' -o -name '*.sqlite' \) -print | wc -l`
- **Component files (.tsx in components/): 21**
  Command: `find components -type f -name '*.tsx' | wc -l`
- **Modules in lib/ (.ts): 33**
  Command: `find lib -type f -name '*.ts' -not -name '*.d.ts' -not -name '*.d.mts' | wc -l`
- **Speed-limit rule files in lib/ (*-limits.ts, without live-*): 7**
  Command: `find lib -type f -name '*-limits.ts' -not -name 'live-*' | wc -l`
- **Speed-limit counters in lib/ (live-*-limits.ts): 5**
  Command: `find lib -type f -name 'live-*-limits.ts' | wc -l`
- **Icons drawn in components/icons.tsx: 21**
  Command: `grep -cE '^  [a-zA-Z]+: [(<]' components/icons.tsx`
- **Security headers set in next.config.ts: 5**
  Command: `grep -c 'key: "' next.config.ts`
- **aria-* attributes written in app/ and components/: 79**
  Command: `grep -rhoE 'aria-[a-z]+=' app components | wc -l`
- **Kinds of post: 3**
  Command: `awk '/export const postKindIds/ { go = 1 } go { print } go && /as const/ { exit }' lib/post-kinds.ts | grep -o '"[a-z-]*"' | wc -l`
- **Statuses of a post: 3**
  Command: `awk '/export const postStatusIds/ { go = 1 } go { print } go && /as const/ { exit }' lib/posts.ts | grep -o '"[a-z-]*"' | wc -l`
- **Reasons for a report: 5**
  Command: `awk '/export const reportReasonIds/ { go = 1 } go { print } go && /as const/ { exit }' lib/report-reasons.ts | grep -o '"[a-z-]*"' | wc -l`
- **Made-up sample posts in lib/posts.ts: 9**
  Command: `grep -c 'id: "sample-' lib/posts.ts`
- **Days after which a post that nobody touched is hidden: 30**
  Command: `sed -n 's/^export const hideAfterDays = \([0-9]*\);.*/\1/p' lib/post-age.ts`
- **Posts the file may hold: 500**
  Command: `sed -n 's/^export const savedPostsLimit = \([0-9]*\);.*/\1/p' lib/post-store.ts`
- **Reports kept for one post: 20**
  Command: `sed -n 's/^export const reportsKeptPerPost = \([0-9]*\);.*/\1/p' lib/post-store.ts`
- **Replies kept for one post: 20**
  Command: `sed -n 's/^export const repliesKeptPerPost = \([0-9]*\);.*/\1/p' lib/new-reply.ts`
- **Posts one visitor may save in an hour: 5**
  Command: `sed -n 's/^  perVisitor: \([0-9]*\),.*/\1/p' lib/post-limits.ts | head -n 1`
- **Posts the whole site accepts in an hour: 60**
  Command: `sed -n 's/^  perSite: \([0-9]*\),.*/\1/p' lib/post-limits.ts | head -n 1`
- **Wrong tries on a private page, for one visitor: 10**
  Command: `sed -n 's/^  wrongTries: \([0-9]*\),.*/\1/p' lib/manage-limits.ts | head -n 1`
- **Minutes a wrong try on a private page counts: 10**
  Command: `sed -n 's/^  windowMinutes: \([0-9]*\),.*/\1/p' lib/manage-limits.ts | head -n 1`
- **Replies one visitor may send in an hour: 10**
  Command: `sed -n 's/^  replies: \([0-9]*\),.*/\1/p' lib/reply-limits.ts | head -n 1`
- **Test files (*.test.ts and *.test.tsx in __tests__/): 125**
  Command: `find __tests__ -type f \( -name '*.test.ts' -o -name '*.test.tsx' \) | wc -l`
- **Test files for rules and storage (*.test.ts): 64**
  Command: `find __tests__ -type f -name '*.test.ts' | wc -l`
- **Test files for pages and components (*.test.tsx): 61**
  Command: `find __tests__ -type f -name '*.test.tsx' | wc -l`
- **Tests written (lines that start a test or it call in __tests__/): 1068**
  Command: `grep -rEh '^[[:space:]]*(test|it)\(' __tests__ | wc -l`
- **Packages in dependencies (package.json): 3**
  Command: `node -e "console.log(Object.keys(require('./package.json').dependencies).length)"`
- **Packages in devDependencies (package.json): 14**
  Command: `node -e "console.log(Object.keys(require('./package.json').devDependencies).length)"`
- **Lines in README.md: 340**
  Command: `wc -l < README.md`
- **Sections (## headings) in README.md: 17**
  Command: `grep -c '^## ' README.md`

## Pages and addresses

- `/` from `app/page.tsx`
- `/board` from `app/board/page.tsx`
- `/board/[id]` from `app/board/[id]/page.tsx`
- `/board/[id]/manage` from `app/board/[id]/manage/page.tsx`
- `/board/new` from `app/board/new/page.tsx`
- `/opengraph-image` from `app/opengraph-image.tsx`
- `/robots.txt` from `app/robots.ts`
- `/sitemap.xml` from `app/sitemap.ts`

## What the project does, and where

- Read the board of posts and filter it by kind (Help wanted, Offer, Lend) (`app/board/page.tsx`)
- Write a post; the server checks it again before it saves it to one JSON file (`app/board/new/actions.ts`)
- No accounts: each post gets a secret key, and only a SHA-256 fingerprint of it is saved (`lib/manage-key.ts`)
- A private page for the author: edit the post, change its status, read replies, see report counts, take it down (`app/board/[id]/manage/page.tsx`)
- A post nobody touches for 30 days is hidden from the board, never deleted; the author can keep it up (`lib/post-age.ts`)
- Neighbors reply privately; only the author reads the replies (`app/board/[id]/reply-actions.ts`)
- Visitors report a post with a reason, never a name (`app/board/[id]/actions.ts`)
- Speed limits on every public action, counted in the memory of the running server (`lib/rate-limit.ts`)
- A command-line tool that lists reports and takes posts down, with a backup first (`scripts/moderate.mjs`)
- Light and dark theme from CSS variables (`app/globals.css`)
- Safe headers on every page, and no X-Powered-By header (`next.config.ts`)
- A share image that is drawn when the site is built (`app/opengraph-image.tsx`)
- robots.txt and a sitemap that leaves out every post (`app/sitemap.ts`)

## Server actions

- `changePostStatus`
- `checkManageLink`
- `editPost`
- `loadReplies`
- `removePost`
- `renewPost`
- `replyToPost`
- `reportPost`
- `savePost`

## Scripts in package.json

- `dev: next dev`
- `build: next build`
- `start: next start`
- `lint: eslint`
- `typecheck: tsc --noEmit`
- `test: vitest run`
- `test:watch: vitest`

## Not counted: the author fills these in

- TODO: this tool never runs the version-control program. Count them yourself if you want to show them.
- TODO: run the tests and write the summary line here. This tool counts the tests in the files; it does not run them.
- TODO: run the build and the lint and write the result here.
- TODO: there is no public demo yet. Write its address here when there is one.
