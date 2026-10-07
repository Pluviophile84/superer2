import { test } from "node:test";
import assert from "node:assert/strict";
import { createConsoleState, consoleVersion, readoutText, lineText, START_COUNT } from "../site/src/console.js";
import { versionName, extraERs } from "../site/src/overload.js";

test("every ER counts: SUPER 1, SUPERER 2, SUPERERER 3, SUPERERERER 4", () => {
  assert.equal(versionName(1), "SUPER");
  assert.equal(versionName(2), "SUPERER");
  assert.equal(versionName(3), "SUPERERER");
  assert.equal(versionName(4), "SUPERERERER");
  assert.equal(extraERs(1), 0);
  assert.equal(extraERs(2), 0);
  assert.equal(extraERs(6), 4);
});

test("console starts at SUPER with ER: 1", () => {
  const s = createConsoleState();
  assert.equal(START_COUNT, 1);
  assert.equal(s.count, 1);
  assert.equal(readoutText(s.count), "VERSION: SUPER · ER: 1 · INTELLIGENCE: 100");
});

test("press -> added -> total: 1->+1->2, 2->+2->4, 3->+1->5, 4->+1->6, 5->+1->7", () => {
  const s = createConsoleState();
  const expected = [
    [1, 2, "SUPERER"],
    [2, 4, "SUPERERERER"],
    [1, 5, "SUPERERERERER"],
    [1, 6, "SUPERERERERERER"],
    [1, 7, "SUPERERERERERERER"],
    [1, 8, "SUPERERERERERERERER"],
  ];
  for (const [added, count, name] of expected) {
    const r = s.press();
    assert.equal(r.added, added);
    assert.equal(r.count, count);
    assert.equal(consoleVersion(r.count), name);
    assert.equal(readoutText(r.count), `VERSION: ${name} · ER: ${count} · INTELLIGENCE: 100`);
  }
});

test("terminal blocks follow the script in order", () => {
  const s = createConsoleState();
  const blocks = Array.from({ length: 6 }, () => s.press().lines.map(lineText));
  assert.deepEqual(blocks[0], [
    "> upgrade --target superer",
    "allocating ER done",
    "intelligence unchanged (100)",
    "ER 2",
    "status: CANONICAL. there is only one SUPERER.",
    "scientists warned us not to add another ER.",
  ]);
  assert.deepEqual(blocks[1], ["> upgrade --ignore-warnings", "ER 4  (+2)", "we added two."]);
  assert.deepEqual(blocks[2], ["> upgrade", "ER 5", "note: everything after SUPERER is an upgrade."]);
  assert.deepEqual(blocks[3], ["> upgrade", "ER 6", "warning: ER exceeds container. this is a feature."]);
  assert.deepEqual(blocks[4], ["> upgrade", "ER 7", "intelligence unchanged (100)"]);
  assert.deepEqual(blocks[5], ["> upgrade", "ER 8", "intelligence unchanged (100)"]);
});

test("key/value lines are data, so CSS can draw the dot leaders", () => {
  const [, row] = createConsoleState().press().lines;
  assert.deepEqual(row, { kind: "kv", key: "allocating ER", value: "done" });
});

test("RESET returns to SUPER / ER: 1 and restarts the script from press 1", () => {
  const s = createConsoleState();
  for (let i = 0; i < 5; i++) s.press();
  s.reset();
  assert.equal(s.count, 1);
  assert.equal(s.presses, 0);
  assert.equal(readoutText(s.count), "VERSION: SUPER · ER: 1 · INTELLIGENCE: 100");
  const r = s.press();
  assert.equal(r.count, 2);
  assert.equal(lineText(r.lines[0]), "> upgrade --target superer");
  assert.equal(s.press().added, 2, "the 2nd press after RESET adds two again");
});

test("long versions use the short form with the corrected count", () => {
  assert.equal(consoleVersion(9), "SUPERERERERERERERERER");
  assert.equal(consoleVersion(10), "SUP(ER)×10");
});
