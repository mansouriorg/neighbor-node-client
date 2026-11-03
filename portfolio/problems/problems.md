# Problems and open points

This file lists what could not be done, or could not be confirmed. It is not part of the texts for readers. Add your own notes at the end: the tools never overwrite this file.

## Open at the first step

- The number of commits and of contributors is not counted. The tools never run the version-control program, so no text shows these numbers.
- The counting tool counts the tests in the files and does not run them. The picture command runs `npm test` and keeps the result in `manifest.json`. The build, the lint and the type check are not run by any tool of this folder, so no text says that they passed.
- There is no public demo, so no text mentions one.
- The pictures are made by `bash portfolio/tools/make-pictures.sh`. What could not be done in the last run is in `problems/picture-problems.md`. Pictures of the running site need the site to run on your computer; the tool saves no post.
- The counts describe the files on the day written in `facts.md`. After you change the project, run `bash portfolio/tools/facts.sh check` again.
