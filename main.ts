// The harness runs `node /bot/main.ts` (node22). It reads every case from
// /input/cases.json (a JSON array of {id, input}), answers each one alone
// with run() from solve.js, and writes /output/answers.json: a JSON array of
// the answers, one per case and in the cases' order. Outside a container
// MAKEFUN_INPUT_DIR and MAKEFUN_OUTPUT_DIR stand in for /input and /output.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setFlagsFromString } from 'node:v8';

// V8's incremental marking off, set before solve.js is imported so all of its
// work runs under it (the rules: the house baseline runs with
// --no-incremental-marking, and an entry may tune V8's flags too).
setFlagsFromString('--no-incremental-marking');

/** solve.js, imported by its URL (a .js module carries no types) and typed by its contract. */
const { run } = (await import(new URL('./solve.js', import.meta.url).href)) as { run: (input: unknown) => unknown };

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const cases = JSON.parse(readFileSync(join(INPUT_DIR, 'cases.json'), 'utf8')) as { id: string; input: unknown }[];

// Warm the parser up on a small input that exercises its paths (quoted
// fields with a line break inside, unquoted fields, short rows) so the big
// cases run on optimized code instead of paying for compilation mid-case.
for (let i = 0; i < 100; i++) run({ text: 'a,b\n"x\ny",2\n3,4\n', header: true });

// Stringify each case's answer as it is produced and drop the answer (and
// the case's text) at once, so the live set stays one case instead of all
// six. The output is byte-identical to JSON.stringify of the whole answers
// array: '[' + the answers' JSON joined by ',' + ']'.
const parts: string[] = [];
for (const c of cases) {
  parts.push(JSON.stringify(run(c.input)));
  c.input = null;
}
writeFileSync(join(OUTPUT_DIR, 'answers.json'), '[' + parts.join(',') + ']');
