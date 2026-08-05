/**
 * Mock content must never reach a build.
 *
 *     pkgx node scripts/check-mock.ts
 *
 * The site has real content and almost none of it, by design: John has not
 * written a blog post or a service page yet, and nobody is going to invent
 * either for him. That leaves whole layouts, the blog index, the featured
 * posts on the home page, a service detail page, that cannot be looked at
 * while they are empty.
 *
 * So `src/content/mock/` holds stand-in copy, loaded ONLY in dev. The
 * mechanism is `import.meta.env.DEV`, which Vite resolves at compile time, so
 * the branch and the dynamic import inside it are eliminated from a
 * production build rather than merely skipped at runtime.
 *
 * That is the intent. This is the proof. Every mock string carries a sentinel,
 * and this greps the built output for it. If a single one survives, the build
 * fails: a mechanism that is supposed to remove something is worth exactly as
 * much as the check that it did.
 *
 * Fail-closed. A missing build directory, a mock directory with no sentinel in
 * it, or zero files examined are all failures, because each of them would let
 * this report a clean pass having verified nothing.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** Present in every mock string. Chosen to be findable and never plausible. */
export const MOCK_SENTINEL = 'MOCKONLY-8f3a1c';

const BUILD = 'build';
const MOCK_DIR = 'src/content/mock';

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}

// ---- 1. the mock content must actually be marked ------------------------
// Without this, a mock file someone forgot to mark would be invisible to the
// grep below and this check would pass while shipping it.
if (!existsSync(MOCK_DIR)) {
  console.log(`check-mock: no ${MOCK_DIR}, nothing to keep out of the build.`);
  process.exit(0);
}
const mockFiles = walk(MOCK_DIR).filter((f) => f.endsWith('.json'));
if (mockFiles.length === 0) {
  console.log(`check-mock: ${MOCK_DIR} holds no content, nothing to keep out of the build.`);
  process.exit(0);
}
let unmarked = 0;
for (const file of mockFiles) {
  if (!readFileSync(file, 'utf8').includes(MOCK_SENTINEL)) {
    console.error(
      `unmarked  ${file}\n  every mock file must carry ${MOCK_SENTINEL} in its strings, or this check cannot see it.`
    );
    unmarked++;
  }
}

// ---- 2. none of it may be in the build ----------------------------------
if (!existsSync(BUILD)) {
  console.error(
    `check-mock: no ${BUILD}/ directory. Run the build first; a check that examined nothing is not a pass.`
  );
  process.exit(1);
}

const built = walk(BUILD);
if (built.length === 0) {
  console.error(`check-mock: ${BUILD}/ is empty. That is a failure, not a pass.`);
  process.exit(1);
}

const guilty: string[] = [];
for (const file of built) {
  // Read as latin1 rather than utf8 so binaries do not throw, and a sentinel
  // hidden in one would still be found.
  if (readFileSync(file, 'latin1').includes(MOCK_SENTINEL)) guilty.push(file);
}

console.log(
  `check-mock: ${mockFiles.length} mock file(s), ${built.length} built file(s) examined.`
);

if (unmarked || guilty.length) {
  for (const file of guilty) {
    console.error(`LEAKED    ${file}\n  contains ${MOCK_SENTINEL}; mock content is in the build.`);
  }
  console.error(
    `\n${guilty.length} built file(s) carry mock content and ${unmarked} mock file(s) are unmarked.`
  );
  process.exit(1);
}
console.log('No mock content reached the build.');
