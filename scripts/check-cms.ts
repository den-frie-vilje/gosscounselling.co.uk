/**
 * Deterministic key-diff between the Sveltia config and the content JSON.
 *
 *     pkgx node scripts/check-cms.ts
 *
 * Why this exists. Sveltia writes back exactly the fields its config declares
 * and nothing else, so a key that lives in the JSON but not in `config.yml` is
 * silently deleted the first time the editor saves that file. Nothing warns:
 * the build stays green, `pnpm check` stays green, and the copy is simply gone
 * from the page after John edits something unrelated. The reverse is quieter
 * still, a field declared in the config with no key behind it, which shows the
 * editor an empty box he will reasonably fill in and then not see anywhere.
 *
 * Two collection shapes, because the CMS has two.
 *
 *   files:   one entry per file, each with its own `fields:`. The page and the
 *            general settings: a fixed set of documents, each a different
 *            shape.
 *   folder:  one `fields:` for a folder of files that are all the same shape,
 *            each its own entry in the editor with its own New button. The
 *            blog. Its files are compared one at a time for keys the config
 *            does not declare — a stray key is a fact about ONE post and the
 *            person fixing it needs to know which — and as a union for fields
 *            the config declares, because an optional field genuinely present
 *            on one post and absent from another is not a fault.
 *
 * Fail-closed by construction. Every exit path counts what it actually
 * inspected: a config that parses to nothing, a collection that is neither
 * shape, a folder collection in a format this cannot read, a JSON file that
 * cannot be read, and a run that compares zero files are all failures rather
 * than a clean pass. A checker that reports success when it read nothing is
 * worse than no checker, because it is believed.
 *
 * Self-test it before trusting a clean run: `--self-test` injects a stray key
 * and a missing field into copies of the real inputs, on both paths, and
 * asserts each is caught.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { parse } from 'yaml';

const CONFIG = 'src/lib/cms/config.yml';

interface Field {
  name?: string;
  widget?: string;
  fields?: Field[];
  field?: Field;
  required?: boolean;
}

interface FileEntry {
  name?: string;
  file?: string;
  fields?: Field[];
}

interface Collection {
  name?: string;
  files?: FileEntry[];
  folder?: string;
  extension?: string;
  format?: string;
  fields?: Field[];
}

/**
 * What one `fields:` tree declares: every key path, dotted, and which of them
 * the config marks `required: false`.
 *
 * Scoped to the tree rather than global, and that is load-bearing. The two
 * sets used to be one module-level Set that every collection added to, which
 * worked only while no two collections named the same path: the blog became a
 * folder collection, its optional `seo.title` sat at the top level for the
 * first time, and it would have silently excused the home page's REQUIRED
 * `seo.title` from the same rule. A checker weakened by an unrelated edit
 * somewhere else in the config is a checker nobody can reason about.
 *
 * A list contributes its own name plus the paths of its item fields under `[]`.
 */
interface Declared {
  paths: Set<string>;
  /**
   * Paths that may be ABSENT from the JSON.
   *
   * Until this existed every declared path had to have a key behind it, so
   * `required: false` was a label with no meaning and the only safe optional
   * fields were the ones nested in a list, which store `null` rather than
   * vanishing. Sveltia may omit a cleared top-level key entirely, and a build
   * that fails because John emptied a field the config calls optional is a
   * build that lied to him about which fields he had to fill in.
   *
   * The rule it does NOT relax: a path in the JSON that the config does not
   * declare is still reported, because the editor deletes those on its next
   * save. Optional means "may be absent", never "may be unknown".
   */
  optional: Set<string>;
}

function declare(fields: Field[] | undefined): Declared {
  const declared: Declared = { paths: new Set(), optional: new Set() };
  walkFields(fields, '', declared);
  return declared;
}

function walkFields(fields: Field[] | undefined, prefix: string, out: Declared): void {
  if (!fields) return;
  for (const f of fields) {
    if (!f.name) continue;
    const path = prefix ? `${prefix}.${f.name}` : f.name;
    out.paths.add(path);
    if (f.required === false) out.optional.add(path);
    if (f.widget === 'list') {
      // A list is either `fields:` (objects) or a single `field:` (scalars).
      const itemFields = f.fields ?? (f.field ? [f.field] : undefined);
      walkFields(itemFields, `${path}[]`, out);
    } else if (f.fields) {
      walkFields(f.fields, path, out);
    }
  }
}

/** Every key path actually present in a JSON value, in the same notation. */
function actualPaths(value: unknown, prefix = ''): string[] {
  const out: string[] = [];
  if (Array.isArray(value)) {
    // Union across items, so an optional field present on only one entry is
    // still seen. A list of scalars contributes nothing below itself.
    for (const item of value) out.push(...actualPaths(item, `${prefix}[]`));
    return [...new Set(out)];
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const path = prefix ? `${prefix}.${k}` : k;
      out.push(path);
      out.push(...actualPaths(v, path));
    }
  }
  return out;
}

interface Problem {
  file: string;
  kind:
    | 'dropped-on-save'
    | 'declared-but-absent'
    | 'unreadable'
    | 'not-a-files-or-folder-collection';
  detail: string;
}

/** The parent of a dotted path, or the path itself when it has none. */
const parentOf = (path: string) => path.replace(/[.[][^.[]*$/, '');

/**
 * The JSON files of a folder collection, in a fixed order.
 *
 * A folder that is not there yet is not an error: `create: true` means there
 * are no files until John writes the first entry, and an empty blog is the
 * state this site ships in. A folder that is there and cannot be read throws,
 * and the caller reports it.
 */
function listJson(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => `${dir}/${name}`);
}

function audit(
  configText: string,
  read: (p: string) => string,
  list: (dir: string) => string[] = listJson
): {
  problems: Problem[];
  filesCompared: number;
} {
  const problems: Problem[] = [];
  let filesCompared = 0;

  const config = parse(configText) as { collections?: Collection[] } | null;
  const collections = config?.collections ?? [];
  if (collections.length === 0) {
    problems.push({
      file: CONFIG,
      kind: 'unreadable',
      detail: 'the config declares no collections, so there was nothing to check'
    });
    return { problems, filesCompared };
  }

  /** Both rules, for one JSON value against one declared field tree. `strays`
   *  are reported against `file`; the caller decides what `actual` is a union
   *  of, because the two collection shapes union different things. */
  function compare(file: string, declared: Declared, actual: Set<string>, strays: boolean) {
    if (strays) {
      for (const path of actual) {
        // A path whose parent is undeclared is already reported by the parent;
        // only report the shallowest miss, or the output is unreadable.
        const parent = parentOf(path);
        if (!declared.paths.has(path) && (parent === path || declared.paths.has(parent))) {
          problems.push({
            file,
            kind: 'dropped-on-save',
            detail: `\`${path}\` is in the JSON but not in the config; the editor will delete it on its next save`
          });
        }
      }
      return;
    }
    for (const path of declared.paths) {
      if (declared.optional.has(path)) continue;
      const parent = parentOf(path);
      if (!actual.has(path) && (parent === path || actual.has(parent))) {
        problems.push({
          file,
          kind: 'declared-but-absent',
          detail: `\`${path}\` is declared in the config but absent from the JSON; the editor shows an empty field`
        });
      }
    }
  }

  for (const collection of collections) {
    if (collection.folder) {
      // Every file in the folder is the same shape, so the fields are declared
      // once on the collection rather than per file.
      const declared = declare(collection.fields);
      if (declared.paths.size === 0) {
        problems.push({
          file: collection.folder,
          kind: 'unreadable',
          detail: 'folder collection declares no fields, so there was nothing to compare against'
        });
        continue;
      }
      // Only JSON is understood here. A folder collection in markdown would be
      // read as JSON, fail to parse and be reported as unreadable, which is at
      // least honest — but saying so up front is honester still.
      if (collection.extension !== 'json' || collection.format !== 'json') {
        problems.push({
          file: collection.folder,
          kind: 'unreadable',
          detail: `folder collection is \`${collection.extension ?? 'unset'}\`/\`${collection.format ?? 'unset'}\`; this check reads JSON only`
        });
        continue;
      }

      let paths: string[];
      try {
        paths = list(collection.folder);
      } catch (error) {
        problems.push({
          file: collection.folder,
          kind: 'unreadable',
          detail: `could not list the folder: ${(error as Error).message}`
        });
        continue;
      }

      // The union across the folder. An optional field filled in on one post
      // and left empty on another is not a fault, so the declared-but-absent
      // rule is answered by the folder as a whole; the stray-key rule is
      // answered per file, because a stray key is one post's problem and the
      // person fixing it needs to know which post.
      const union = new Set<string>();
      for (const path of paths) {
        let json: unknown;
        try {
          json = JSON.parse(read(path));
        } catch (error) {
          problems.push({
            file: path,
            kind: 'unreadable',
            detail: `could not read or parse: ${(error as Error).message}`
          });
          continue;
        }
        filesCompared += 1;
        const actual = new Set(actualPaths(json));
        compare(path, declared, actual, true);
        for (const p of actual) union.add(p);
      }
      // Nothing to say about an empty folder: no post is not a broken post.
      if (union.size > 0) compare(collection.folder, declared, union, false);
      continue;
    }

    if (!collection.files) {
      // Neither shape. Silently skipping one would be the fail-open path: the
      // whole point of this script is that a collection nobody checked is a
      // collection the editor can quietly empty.
      problems.push({
        file: collection.name ?? '(unnamed)',
        kind: 'not-a-files-or-folder-collection',
        detail:
          'collection has neither `files:` nor `folder:`; a shape this check does not understand is a shape it will not vouch for'
      });
      continue;
    }

    for (const entry of collection.files) {
      if (!entry.file) {
        problems.push({
          file: entry.name ?? '(unnamed)',
          kind: 'unreadable',
          detail: 'files entry has no `file:` path'
        });
        continue;
      }

      let json: unknown;
      try {
        json = JSON.parse(read(entry.file));
      } catch (error) {
        problems.push({
          file: entry.file,
          kind: 'unreadable',
          detail: `could not read or parse: ${(error as Error).message}`
        });
        continue;
      }

      filesCompared += 1;

      const declared = declare(entry.fields);
      const actual = new Set(actualPaths(json));
      compare(entry.file, declared, actual, true);
      compare(entry.file, declared, actual, false);
    }
  }

  return { problems, filesCompared };
}

function report(problems: Problem[], filesCompared: number, label: string): boolean {
  for (const p of problems) {
    console.error(`${p.kind.padEnd(32)} ${p.file}\n  ${p.detail}`);
  }
  if (filesCompared === 0) {
    console.error(`${label}: compared zero content files. That is a failure, not a pass.`);
    return false;
  }
  if (problems.length) {
    console.error(`\n${label}: ${problems.length} problem(s) across ${filesCompared} file(s).`);
    return false;
  }
  console.log(`${label}: ${filesCompared} content file(s) match the editor config exactly.`);
  return true;
}

// ---- self-test ------------------------------------------------------------
// Inject known faults into copies of the real inputs and confirm each is
// caught. An unproven checker's clean run means nothing.
function selfTest(): boolean {
  const configText = readFileSync(CONFIG, 'utf8');
  const realRead = (p: string) => readFileSync(p, 'utf8');
  let ok = true;

  // Fault 1: a key in the JSON that the config does not declare.
  const strayRead = (p: string) => {
    const raw = realRead(p);
    if (!p.endsWith('site.json')) return raw;
    const obj = JSON.parse(raw);
    obj.strayKeyNobodyDeclared = 'this would be deleted on the next save';
    return JSON.stringify(obj);
  };
  const stray = audit(configText, strayRead);
  const caughtStray = stray.problems.some(
    (p) => p.kind === 'dropped-on-save' && p.detail.includes('strayKeyNobodyDeclared')
  );
  console.log(`self-test: stray JSON key ${caughtStray ? 'CAUGHT' : 'MISSED'}`);
  ok &&= caughtStray;

  // Fault 2: a field declared in the config with nothing behind it.
  const extraField = configText.replace(
    '          - { name: tagline, label: Tagline, widget: string }',
    '          - { name: tagline, label: Tagline, widget: string }\n          - { name: fieldWithNoKey, label: Nothing behind it, widget: string }'
  );
  if (extraField === configText) {
    console.error('self-test: could not inject the config fault; the anchor line moved.');
    return false;
  }
  const missing = audit(extraField, realRead);
  const caughtMissing = missing.problems.some(
    (p) => p.kind === 'declared-but-absent' && p.detail.includes('fieldWithNoKey')
  );
  console.log(`self-test: config field with no key ${caughtMissing ? 'CAUGHT' : 'MISSED'}`);
  ok &&= caughtMissing;

  // Fault 2b: the same field, declared OPTIONAL. It must NOT be reported —
  // otherwise `required: false` is a label with no meaning and every optional
  // field is a build waiting to break the first time John clears it. Run
  // second, so fault 2 has already proved the rule still fires when it should.
  const optionalField = configText.replace(
    '          - { name: tagline, label: Tagline, widget: string }',
    '          - { name: tagline, label: Tagline, widget: string }\n          - { name: fieldWithNoKey, label: Nothing behind it, widget: string, required: false }'
  );
  const optional = audit(optionalField, realRead);
  const toleratedOptional = !optional.problems.some((p) => p.detail.includes('fieldWithNoKey'));
  console.log(
    `self-test: optional config field with no key ${toleratedOptional ? 'TOLERATED' : 'WRONGLY REPORTED'}`
  );
  ok &&= toleratedOptional;

  // Fault 3: the can't-read path. A checker that loops over fetched input and
  // starts from an optimistic default reports PASS when the fetch returns
  // nothing, because the loop runs zero times.
  const blindRead = () => {
    throw new Error('simulated unreadable content file');
  };
  const blind = audit(configText, blindRead);
  const failsClosed = !report(blind.problems, blind.filesCompared, 'self-test(unreadable)');
  console.log(`self-test: unreadable content ${failsClosed ? 'FAILS CLOSED' : 'FAILED OPEN'}`);
  ok &&= failsClosed;

  // Fault 4: the FOLDER path, which the real run cannot exercise on a site
  // that ships with no posts — the blog folder is empty, so a clean run there
  // proves nothing about it. So a post is put in front of it: one file, with a
  // key nobody declared, and without `title`, which is declared and required.
  // Both must be reported. `slug` is declared `required: false` and is missing
  // from the same file, and must NOT be, or optional means nothing here either.
  const FOLDER = 'src/content/posts';
  const PLANTED = `${FOLDER}/self-test-post.json`;
  const plantedPost = JSON.stringify({
    status: 'published',
    publishAt: '2020-01-01T00:00:00Z',
    excerpt: 'A post that exists only inside this self-test.',
    body: 'A post that exists only inside this self-test.',
    strayKeyNobodyDeclared: 'this would be deleted on the next save'
  });
  const folder = audit(
    configText,
    (p) => (p === PLANTED ? plantedPost : realRead(p)),
    (dir) => (dir === FOLDER ? [PLANTED] : listJson(dir))
  );
  const caughtFolderStray = folder.problems.some(
    (p) => p.kind === 'dropped-on-save' && p.file === PLANTED && p.detail.includes('strayKeyNobodyDeclared')
  );
  const caughtFolderMissing = folder.problems.some(
    (p) => p.kind === 'declared-but-absent' && p.detail.includes('`title`')
  );
  const toleratedFolderOptional = !folder.problems.some((p) => p.detail.includes('`slug`'));
  console.log(`self-test: stray key in a folder entry ${caughtFolderStray ? 'CAUGHT' : 'MISSED'}`);
  console.log(
    `self-test: required folder field with no key ${caughtFolderMissing ? 'CAUGHT' : 'MISSED'}`
  );
  console.log(
    `self-test: optional folder field with no key ${toleratedFolderOptional ? 'TOLERATED' : 'WRONGLY REPORTED'}`
  );
  ok &&= caughtFolderStray && caughtFolderMissing && toleratedFolderOptional;

  // Fault 5: a collection that is neither shape must still fail closed. It is
  // the rule the folder work could most easily have loosened into a shrug.
  const shapeless = audit(
    'collections:\n  - name: something-new\n    label: Something new\n',
    realRead
  );
  const refusedShape = shapeless.problems.some(
    (p) => p.kind === 'not-a-files-or-folder-collection'
  );
  console.log(
    `self-test: collection with neither files nor folder ${refusedShape ? 'REFUSED' : 'WAVED THROUGH'}`
  );
  ok &&= refusedShape;

  return ok;
}

// ---- run ------------------------------------------------------------------
if (!existsSync(CONFIG)) {
  console.error(`${CONFIG} not found.`);
  process.exit(1);
}

if (process.argv.includes('--self-test')) {
  process.exit(selfTest() ? 0 : 1);
}

const { problems, filesCompared } = audit(readFileSync(CONFIG, 'utf8'), (p) =>
  readFileSync(p, 'utf8')
);
process.exit(report(problems, filesCompared, 'check-cms') ? 0 : 1);
