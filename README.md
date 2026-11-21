# csv-reader-speed

[![csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/gregorionainggolan8-tech/makefun-csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/gregorionainggolan8-tech/makefun-csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)

A fast drop-in for csv-reader 1.0.0, built for make.fun's
[Read broken CSV files faster, 21 November 2026](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
bounty.

`solve.js` returns exactly csv-reader 1.0.0's answer for every input
`{text, header}` — `{columns, rows, errors}` — including its broken-row
policy (BOM, stray CR, unterminated quotes, quote junk, short/long rows),
but reads the text with index-based scans and builds each field out of
slices of the input instead of one character at a time. `main.ts` is the
harness driver: it reads every case from `/input/cases.json`, answers each
with `run`, and writes `/output/answers.json`.

No dependencies, no network or model calls at run time, Node 22 only.
