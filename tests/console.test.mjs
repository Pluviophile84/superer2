import { test } from "node:test";
import assert from "node:assert/strict";
import { createConsoleState, consoleVersion, readoutText, START_COUNT } from "../site/src/console.js";
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

test("press-to-count table, including +2 on the 4th press", () => {
  const s = createConsoleState();
  const expected = [
    [1, 2, "SUPERER"],
    [1, 3, "SUPERERER"],
    [1, 4, "SUPERERERER"],
    [2, 6, "SUPERERERERERER"],
    [1, 7, "SUPERERERERERERER"],
    [1, 8, "SUPERERERERERERERER"],
    [1, 9, "SUPERERERERERERERERER"],
  ];
  for (const [added, count, name] of expected) {
    const r = s.press();
    assert.equal(r.added, added);
    assert.equal(r.count, count);
    assert.equal(consoleVersion(r.count), name);
  }
});

test("terminal blocks follow the script in order", () => {
  const s = createConsoleState();
  const blocks = Array.from({ length: 7 }, () => s.press().lines);
  assert.equal(blocks[0][0], "> upgrade --target superer");
  assert.equal(blocks[0][3], "  ER .................................... 2");
  assert.equal(blocks[0][4], "  status: CANONICAL. there is only one SUPERER.");
  assert.deepEqual(blocks[1].slice(0, 2), ["> upgrade --target supererer", "  ER .................................... 3"]);
  assert.deepEqual(blocks[2].slice(0, 2), ["> upgrade --target superererer", "  ER .................................... 4"]);
  assert.deepEqual(blocks[3], [
    "> upgrade --ignore-warnings",
    "  ER .................................... 6  (+2)",
    "  we added two.",
  ]);
  assert.deepEqual(blocks[4], [
    "> upgrade",
    "  ER .................................... 7",
    "  warning: ER exceeds container. this is a feature.",
  ]);
  for (const [i, b] of [[5, blocks[5]], [6, blocks[6]]]) {
    assert.deepEqual(b, [
      "> upgrade",
      `  ER .................................... ${i + 3}`,
      "  intelligence .......................... unchanged (100)",
    ]);
  }
});

test("RESET returns to SUPER / ER: 1 and restarts the script from press 1", () => {
  const s = createConsoleState();
  for (let i = 0; i < 5; i++) s.press();
  s.reset();
  assert.equal(s.count, 1);
  assert.equal(s.presses, 0);
  const r = s.press();
  assert.equal(r.count, 2);
  assert.equal(r.lines[0], "> upgrade --target superer");
  s.press();
  s.press();
  assert.equal(s.press().added, 2, "the 4th press after RESET adds two again");
});

test("long versions use the short form with the corrected count", () => {
  assert.equal(consoleVersion(9), "SUPERERERERERERERERER");
  assert.equal(consoleVersion(10), "SUP(ER)×10");
});
