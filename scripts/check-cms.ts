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
 * Fail-closed by construction. Every exit path counts what it actually
 * inspected: a config that parses to nothing, a collection with no `files:`,
 * a JSON file that cannot be read, and a run that compares zero files are all
 * failures rather than a clean pass. A checker that reports success when it
 * read nothing is worse than no checker, because it is believed.
 *
 * Self-test it before trusting a clean run: `--self-test` injects a stray key
 * and a missing field into copies of the real inputs and asserts both are
 * caught.
 */
import { readFileSync, existsSync } from 'node:fs';
import { parse } from 'yaml';

const CONFIG = 'static/admin/config.yml';

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
}

/** Every key path a field tree declares, dotted; a list contributes its own
 *  name plus the paths of its item fields under `[]`. */
function declaredPaths(fields: Field[] | undefined, prefix = ''): string[] {
  if (!fields) return [];
  const out: string[] = [];
  for (const f of fields) {
    if (!f.name) continue;
    const path = prefix ? `${prefix}.${f.name}` : f.name;
    out.push(path);
    if (f.required === false) OPTIONAL.add(path);
    if (f.widget === 'list') {
      // A list is either `fields:` (objects) or a single `field:` (scalars).
      const itemFields = f.fields ?? (f.field ? [f.field] : undefined);
      out.push(...declaredPaths(itemFields, `${path}[]`));
    } else if (f.fields) {
      out.push(...declaredPaths(f.fields, path));
    }
  }
  return out;
}

/**
 * Paths the config marks `required: false`.
 *
 * They are allowed to be absent from the JSON, and until now they were not:
 * every declared path had to have a key behind it, so `required: false` was a
 * label with no meaning and the only safe optional fields were the ones nested
 * in a list, which store `null` rather than vanishing. Sveltia may omit a
 * cleared top-level key entirely, and a build that fails because John emptied
 * a field the config calls optional is a build that lied to him about which
 * fields he had to fill in.
 *
 * The rule it does NOT relax: a path in the JSON that the config does not
 * declare is still reported, because the editor deletes those on its next save.
 * Optional means "may be absent", never "may be unknown".
 */
const OPTIONAL = new Set<string>();

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
  kind: 'dropped-on-save' | 'declared-but-absent' | 'unreadable' | 'not-a-files-collection';
  detail: string;
}

function audit(configText: string, read: (p: string) => string): {
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

  for (const collection of collections) {
    if (!collection.files) {
      // A `folder:` collection maps many files to one schema and is a
      // different check; this site has none, and silently skipping one would
      // be the fail-open path.
      problems.push({
        file: collection.name ?? '(unnamed)',
        kind: 'not-a-files-collection',
        detail: 'collection has no `files:`; a single content file must be a files entry'
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

      const declared = new Set(declaredPaths(entry.fields));
      const actual = new Set(actualPaths(json));

      for (const path of actual) {
        // A path whose parent is undeclared is already reported by the parent;
        // only report the shallowest miss, or the output is unreadable.
        const parent = path.replace(/[.[][^.[]*$/, '');
        if (!declared.has(path) && (parent === path || declared.has(parent))) {
          problems.push({
            file: entry.file,
            kind: 'dropped-on-save',
            detail: `\`${path}\` is in the JSON but not in the config; the editor will delete it on its next save`
          });
        }
      }
      for (const path of declared) {
        if (OPTIONAL.has(path)) continue;
        const parent = path.replace(/[.[][^.[]*$/, '');
        if (!actual.has(path) && (parent === path || actual.has(parent))) {
          problems.push({
            file: entry.file,
            kind: 'declared-but-absent',
            detail: `\`${path}\` is declared in the config but absent from the JSON; the editor shows an empty field`
          });
        }
      }
    }
  }

  return { problems, filesCompared };
}

function report(problems: Problem[], filesCompared: number, label: string): boolean {
  for (const p of problems) {
    console.error(`${p.kind.padEnd(24)} ${p.file}\n  ${p.detail}`);
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
