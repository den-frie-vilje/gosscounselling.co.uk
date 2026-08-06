import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, normalizePath, type Plugin } from 'vite';
// This file is inside the type-checked project — `.svelte-kit/tsconfig.json`
// includes it — and the project has no `@types/node`, deliberately: nothing
// the SITE ships runs in node, and the node-side tooling in `scripts/` is run
// rather than compiled. So the one node import this config needs is silenced
// here rather than by pulling node's global types over every file in `src`,
// where they would quietly change what `setTimeout` returns in a browser
// component. If a future dependency brings @types/node in, TypeScript will
// report this line as an unnecessary suppression and it can simply be deleted.
// @ts-expect-error — no @types/node in this project; see above.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
// @ts-expect-error — same reason as the line above: no @types/node here.
import { resolve } from 'node:path';
// @ts-expect-error — same reason.
import { fileURLToPath } from 'node:url';

/**
 * Drafts never enter the bundle.
 *
 * Filtering them in `$lib/content` is not enough, and the first build with a
 * draft in it proved it: a JSON import becomes a module holding the WHOLE
 * array, and no amount of downstream filtering lets a bundler drop the
 * entries nobody reads, because "nobody reads them" is a fact about the data
 * rather than about the code. That build shipped the draft's title, summary
 * and body inside `_app/immutable/chunks/*.js`, on every page of the site.
 *
 * A post published with a date in the future IS left in, on purpose: that one
 * is early rather than private, and the listings hold it back in the browser
 * (DECISIONS.md §22).
 *
 * There are now THREE things to do, because a post is now a file of its own
 * and `$lib/content` reads the folder with `import.meta.glob`.
 *
 * 1. NARROW THE GLOB (`hideDraftsFromTheGlob`). A glob is expanded at compile
 *    time into one import per matching file plus a record keyed by their
 *    PATHS, and those path strings survive into the chunk whether or not
 *    anything reads them — `Object.values(...)` still needs the object they
 *    are keys of. Emptying a draft's contents therefore is not enough: the
 *    second build with a draft in it shipped
 *    `"/src/content/posts/notes-on-waiting-lists.json"` into
 *    `_app/immutable/chunks/*.js`, which is the draft's title in hyphens, on
 *    every page. So the pattern is rewritten before Vite expands it, to
 *    exclude the files that are drafts today: a draft is not imported, not
 *    keyed, and not named anywhere in the output.
 *
 * 2. EMPTY WHAT IS LEFT (`stripDraftPosts`). Belt as well as braces, and the
 *    only guard the mock content has:
 *
 *      src/content/posts/<slug>.json  ONE post. Excluded by (1), so this
 *                                     should never see a draft — and if it
 *                                     ever does, the words go anyway.
 *      src/content/mock/posts.json    the dev-only stand-ins, still a single
 *                                     file with an array in it (see
 *                                     src/lib/content/mock.ts for why it
 *                                     cannot become a folder).
 *
 * 3. FAIL LOUDLY. Both hooks refuse anything they cannot parse, and (1)
 *    refuses to run at all if the glob it is meant to narrow is not where it
 *    expects it — a rewrite that silently matched nothing would be a rewrite
 *    that silently published drafts.
 *
 * And `scripts/check-posts.ts` is the proof, run against the built output
 * after every build. It is what caught the path-in-the-chunk leak above.
 */
const POSTS_DIR = 'src/content/posts';
const POST_FILE = /\/src\/content\/posts\/[^/]+\.json$/;
const MOCK_POSTS = /\/src\/content\/mock\/posts\.json$/;

/** Where the glob lives, and the exact pattern it is written with. Both are
 *  asserted rather than assumed; see `hideDraftsFromTheGlob`. */
const CONTENT_INDEX = 'src/lib/content/index.ts';
const POSTS_GLOB = "'/src/content/posts/*.json'";

/**
 * The post files that are not published, as the root-relative paths the glob
 * speaks in.
 *
 * Anything that is not exactly `published` counts as a draft, so a mistyped
 * status hides a post rather than publishing one. A file that will not parse
 * is not silently treated either way: it throws, and the caller turns that
 * into a build error.
 */
function draftPaths(root: string): string[] {
  const dir = `${root}/${POSTS_DIR}`;
  if (!existsSync(dir)) return [];
  const drafts: string[] = [];
  for (const name of (readdirSync(dir) as string[]).sort()) {
    if (!name.endsWith('.json')) continue;
    let post: { status?: string };
    try {
      post = JSON.parse(readFileSync(`${dir}/${name}`, 'utf8')) as { status?: string };
    } catch (error) {
      throw new Error(`${POSTS_DIR}/${name} is not valid JSON: ${(error as Error).message}`);
    }
    if (post?.status !== 'published') drafts.push(`/${POSTS_DIR}/${name}`);
  }
  return drafts;
}

/**
 * Runs before Vite expands `import.meta.glob`, so what it expands is already
 * the narrowed pattern.
 *
 * The source is still TypeScript at that point, which is why this is a string
 * replacement on a literal rather than anything cleverer: the alternative is
 * rewriting the code Vite generated, and code generated by somebody else is
 * the worst thing to own.
 */
/**
 * The mock posts' photographs, served in DEV ONLY.
 *
 * The mock content exists so a layout can be looked at before John has written
 * anything, and a blog whose posts all have pictures is not the layout — half
 * of them will not. So the mock posts carry photographs, and those need to be
 * fetchable at a URL.
 *
 * NOT by copying them into `static/`. Everything there is copied into the
 * build wholesale, so five landscape photographs of Bletchley would ship to
 * every visitor of a site that does not use them — the same dead weight as the
 * knockout master, which was moved out for exactly this reason.
 *
 * They are the placeholder photographs from Direction D, Consulting Room
 * (docs/design-directions/assets/local/, CC BY-SA 2.0, credited in
 * credits.json beside them), read straight from where they already are and
 * mounted at /mock-img/. `apply: 'serve'` means this plugin does not exist in
 * a build: there is no route, the files are not emitted, and a mock post's
 * `image` path resolves to nothing — which is fine, because the post it
 * belongs to is not in the build either.
 */
function serveMockImages(): Plugin {
  const dir = resolve(fileURLToPath(new URL('.', import.meta.url)), 'docs/design-directions/assets/local');
  return {
    name: 'serve-mock-images',
    apply: 'serve',
    configureServer(server) {
      // `req` is typed as a bare IncomingMessage without @types/node's http
      // augmentation, which does not carry `url`. Narrowed here rather than
      // pulling node's globals over the whole project — see the note on the
      // fs import at the top of this file for why that is not free.
      server.middlewares.use('/mock-img', (req: { url?: string }, res, next) => {
        const name = (req.url ?? '').replace(/^\//, '').split('?')[0];
        // Only a bare filename from that one directory: no slashes, no `..`.
        if (!/^[a-z0-9-]+\.(webp|jpg|png)$/i.test(name)) return next();
        const file = resolve(dir, name);
        if (!existsSync(file)) return next();
        res.setHeader('Content-Type', name.endsWith('.webp') ? 'image/webp' : name.endsWith('.png') ? 'image/png' : 'image/jpeg');
        res.end(readFileSync(file));
      });
    }
  };
}

function hideDraftsFromTheGlob(): Plugin {
  /** Vite's own root, forward slashes, filled in before any transform runs. */
  let root = '';
  return {
    name: 'hide-draft-posts-from-the-glob',
    enforce: 'pre',
    configResolved(config) {
      root = config.root;
    },
    transform(code, id) {
      if (!normalizePath(id.split('?')[0]).endsWith(`/${CONTENT_INDEX}`)) return null;

      if (!code.includes(POSTS_GLOB)) {
        this.error(
          `${CONTENT_INDEX} no longer contains the literal ${POSTS_GLOB}, so the drafts could ` +
            'not be excluded from it. Every draft in src/content/posts/ would have its filename ' +
            'published in the JavaScript. Fix this plugin, or put the pattern back.'
        );
        return null;
      }

      let drafts: string[];
      try {
        drafts = draftPaths(root);
      } catch (error) {
        this.error((error as Error).message);
        return null;
      }
      if (drafts.length === 0) return null;

      // `['…/*.json', '!…/a-draft.json']` — Vite's own negation syntax, so the
      // expansion is still Vite's and only the question asked of it changed.
      const narrowed = JSON.stringify([
        POSTS_GLOB.slice(1, -1),
        ...drafts.map((path) => `!${path}`)
      ]);
      return { code: code.replace(POSTS_GLOB, narrowed), map: null };
    },
    handleHotUpdate({ file, server, modules }) {
      if (!POST_FILE.test(normalizePath(file))) return;
      // Which files the glob may see was decided when the module above was
      // TRANSFORMED, so flipping a post between draft and published has to
      // redo that decision rather than merely re-run the result of it.
      const index = server.moduleGraph?.getModulesByFile?.(`${root}/${CONTENT_INDEX}`);
      if (!index?.size) return;
      for (const mod of index) server.moduleGraph.invalidateModule(mod);
      return [...modules, ...index];
    }
  };
}

function stripDraftPosts(): Plugin {
  return {
    name: 'strip-draft-posts',
    // Before `vite:json`, which would otherwise have turned the text into
    // JavaScript by the time this ran.
    enforce: 'pre',
    transform(code, id) {
      const path = id.split('?')[0];
      const single = POST_FILE.test(path);
      if (!single && !MOCK_POSTS.test(path)) return null;

      let data: { status?: string; posts?: { status?: string }[] };
      try {
        data = JSON.parse(code);
      } catch (error) {
        this.error(`${path} is not valid JSON: ${(error as Error).message}`);
        return null;
      }

      if (single) {
        if (data.status === 'published') return null;
        return { code: JSON.stringify({ status: 'draft' }), map: null };
      }

      const posts = (data.posts ?? []).filter((post) => post.status === 'published');
      return { code: JSON.stringify({ ...data, posts }), map: null };
    }
  };
}

export default defineConfig({
  plugins: [serveMockImages(), hideDraftsFromTheGlob(), stripDraftPosts(), tailwindcss(), sveltekit()],
  server: {
    // Bound to every interface on purpose: the dev preview has to be
    // reachable from a phone on the LAN, not just from this machine.
    host: '0.0.0.0',
    port: 5173,
    strictPort: false
  }
});
