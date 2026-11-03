# Neighbor Node: project description

Four lengths of the same description. Copy the one that fits the box you are filling in. Every number was counted by the tool in `portfolio/tools/facts.sh` and is listed in `portfolio/facts.md`.

## One line

A help and lending board for neighbors, built with Next.js and TypeScript: no accounts, private edit links, no database.

## Short

Neighbor Node is a help and lending board for people who live near each other. Neighbors post what they need, what they can do and what they can lend. There are no accounts: each post gets a private link for its author. It is built with Next.js, React and TypeScript, and has 125 test files.

## Medium

Neighbor Node is a small web app where people who live near each other ask for help, offer help and lend things. A post is one of three kinds (Help wanted, Offer or Lend) and is Open, In progress or Done. Only a street or an area is shown, never a house number.

There are no accounts. When a post is saved, the server makes a secret key and shows it once, as the end of a private link. With that link the author edits the post, changes its status, reads private replies and takes the post down. The server keeps only a SHA-256 fingerprint of the key.

The app is written in TypeScript with Next.js 16 and React 19. The posts are kept in one JSON file. The project has 5 pages, 9 server actions, and 125 test files with 1,068 tests. It is an early version, and its README lists what is still missing.

## Long

Neighbor Node is a help and lending board for people who live near each other. Someone needs a ladder carried up two floors, or has a drill to lend, or can walk a dog on Tuesdays. They write a short post, and a neighbor answers. The goal is a small, local place for these favors that does not ask anyone to make an account or to show an exact address.

A post is one of three kinds (Help wanted, Offer or Lend) and has one of three statuses (Open, In progress or Done). Visitors can read the board, filter it by kind, write a post, reply to a post and report it. A reply goes only to the author. A report says why, never who.

Because there are no accounts, each post gets a secret key when it is saved. The server shows it once, as the end of a private link, and keeps only a SHA-256 fingerprint. With the link, the author can edit the post, change its status, read the replies, see how many reports it has, keep it on the board, or take it down. A post that nobody touches for 30 days is hidden from the board, and nothing is deleted.

Every action that anyone can call has a speed limit, and the server checks every rule again, because a server action can be called without the page. The pages are made with Next.js 16 (App Router) and React 19 in TypeScript, and styled with Tailwind CSS 4 in a light and a dark theme. The posts are kept in one JSON file that is written through a temporary file and a rename. A small Node.js tool lets the person who runs the site look at reports and take posts down, with a backup first.

The project has 209 code files and 23,300 lines of code. 15,930 of those lines are in the test folder, which holds 125 test files with 1,068 tests. The site has 5 pages, 9 server actions and no database.

It is an early version. It must run as one server copy on a host that can write to a disk, and its speed limits live in the memory of that server. The README says what is missing: accounts, a database, messages to the author, and a check of posts before they show.

## Before you copy

- The descriptions give no link to the code, because the project has no public address in these files. They stay true wherever you paste them.
- There is no live demo, and none of the descriptions mention one.
- The descriptions name no author. The case study (`case-study.md`) and the front README (`readme-portfolio.md`) say who built the project and how.
