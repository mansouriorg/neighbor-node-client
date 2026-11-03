# Neighbor Node: LinkedIn post

A post in the first person: short lines, one idea, an honest ending.

## Post

I built a small web app for neighbors: Neighbor Node, a board where people ask for help, offer help and lend things.

The idea: no accounts. Each post gets a private link instead. The server shows the key once and keeps only a one-way hash of it. With the link, the author can edit the post, change its status, read private replies and take the post down.

What I would point to:
- The server checks every rule again, because anyone can call a server action without the page.
- Every public action has a speed limit. It lives in memory, and the README says plainly what it cannot stop.
- Posts are saved to one JSON file through a temporary file and a rename, so a crash cannot leave half a file.

It is an early version: 5 pages, 9 server actions, 1,068 tests in 125 test files, and no database. The README lists what is missing. For a public site, the first item is a database.

I built it with an AI assistant. It wrote the code and the tests in small steps. I chose what to build next and ran every step on my own computer.

#nextjs #typescript #react #webdev

## Notes

- The post says that an AI assistant helped, and it says what the assistant did. Keep those lines: a reader who hears it from you trusts the rest.
- The post names no company, no person and no link, so it can be posted as it is. If the repository is public, its link fits as the last line before the tags.
