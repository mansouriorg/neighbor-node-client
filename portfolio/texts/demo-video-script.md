# Neighbor Node: demo video script

A script for a screen recording of a little over a minute. The times are a guide; the checker only looks that they follow each other and that the words fit the time.

## Before you record

- Start the site on your computer with `npm run dev`, and open http://localhost:3000.
- Use a made-up post only. No real names, streets, phone numbers or e-mail addresses on screen.
- The post you save is written to `data/posts.json` on your computer. When you are done, remove it as the README says: delete its entry by hand, or delete the file.
- Close other tabs, and hide bookmarks and notifications.
- Record in the light theme. The dark theme follows the system setting, so change the system setting if you want a dark scene.

## Script

| Time | On screen | Say |
| --- | --- | --- |
| 0:00-0:08 | The home page | Neighbor Node is a help and lending board for people who live near each other. |
| 0:08-0:20 | The board, then the filter buttons | The board shows posts, newest first. Each one is Help wanted, Offer or Lend. The sample posts are marked Example. I can filter by kind. |
| 0:20-0:30 | One sample post | Only a street or an area is shown, never a house number. The area field even refuses digits. |
| 0:30-0:45 | The new post form, filled with a made-up post, then Save | Writing a post needs no account. The server checks every rule again before it saves the post, and the form shows a message under any field that is wrong. |
| 0:45-0:58 | The private link, then its page | Instead of an account, the post gets a private link. With it, the author can edit the post, change its status, read replies and take it down. |
| 0:58-1:10 | The saved post, with the reply form and the report form | A neighbor can reply, and the reply goes only to the author. A report says why, never who. |
| 1:10-1:20 | The home page again, or the terminal with the tests | It is an early version, with 1,068 tests in 125 test files. The README lists what is still missing. An AI assistant helped me build it. |

## After you record

- Watch the video once with the sound off. If you can follow it from the screen alone, the script works.
- The last scene says that an AI assistant helped. Keep that sentence, also if you cut the video shorter.
- The video has no address yet, so no text mentions one. If you publish it, write its link in `portfolio/profile.json` under links, video.
