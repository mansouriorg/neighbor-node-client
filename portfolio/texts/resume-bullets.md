# Neighbor Node: resume bullets

Six bullets for the projects part of a resume. Each has one number, and every number was counted from the files (see the table at the end). The project was built with an AI assistant that wrote the code, and the bullets describe the project. The interview answers say how it was made.

## Bullets

- Built a help and lending board for neighbors with Next.js and TypeScript, together with an AI assistant: 5 pages, no database and no accounts.
- Designed private links in place of accounts, and wrote 9 server actions that check every rule again on the server, because anyone can call them without the page.
- Wrote an in-memory speed limiter and used it in 5 live counters that cover posting, private-page tries, reports, replies and edits.
- Stored posts in one JSON file that is written through a temporary file and a rename, with a limit of 500 posts, so a crash cannot leave half a file.
- Wrote 1,068 tests with Vitest and React Testing Library, using temporary folders so that no test touches real data.
- Built a Node.js moderation tool of 508 lines with no packages: it previews by default and copies the posts file before it takes a post down.

## Where the numbers come from

| Bullet | Number | Fact key |
| --- | --- | --- |
| First | 5 | `pages` |
| Second | 9 | `server_actions` |
| Third | 5 | `limit_counter_files` |
| Fourth | 500 | `saved_posts_limit` |
| Fifth | 1,068 | `test_definitions` |
| Sixth | 508 | `lines_scripts` |

The tests are counted as lines that start a `test(` or an `it(` call. A test that runs several cases counts once.

## How to read the bullets

The first bullet says plainly that an assistant took part. The other five describe parts of the project that exist in the code and can be opened and read: each one names something that is in the files, and each number can be counted again with `bash portfolio/tools/facts.sh check`. No bullet claims users, traffic or speed, because the project has none of those.
