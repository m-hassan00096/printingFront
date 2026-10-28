import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
test("The Tabaa UI uses the approved light dashboard design system", () => {
  assert.match(css, /color-scheme:\s*light/);
  assert.match(css, /--background:\s*#f7f8fc/i);
  assert.match(css, /--card:\s*#ffffff/i);
  assert.match(css, /--sidebar:\s*#f6f8fc/i);
  assert.match(css, /--foreground:\s*#222633/i);
  assert.match(css, /--primary:\s*#535fd1/i);
  assert.doesNotMatch(css, /color-scheme:\s*dark/);
});
