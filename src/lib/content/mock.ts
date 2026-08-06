/**
 * Stand-in content for dev, and the mechanism that keeps it out of a build.
 *
 * John has not written a blog post or a service detail page, and nobody is
 * going to invent either for him (DECISIONS.md §19). That leaves whole
 * layouts, the blog index, the featured posts on the home page and their
 * one/two/three arrangements, a service detail page, the testimonials rail,
 * that cannot be looked at at all while the real content is empty. So there
 * is a second set of files in `src/content/mock/`, in the same shapes, that
 * only dev ever sees.
 *
 * `import.meta.env.DEV` is a COMPILE-TIME constant: Vite substitutes the
 * literal `false` into a build, so `dev ? posts : null` folds to `null`, the
 * binding goes unreferenced, and the JSON — which has no side effects — is
 * tree-shaken out. That is the difference between "the mock content is skipped
 * at runtime" and "the mock content is not in the artefact", and it is the
 * whole point.
 *
 * THESE USED TO BE `await import(...)`, and that was a bug for eight months.
 * The comment here claimed a static import "would NOT be removed, because the
 * binding is referenced further down the file". That is wrong: the reference
 * is inside a ternary whose condition folds to `false`, so the branch and the
 * binding both go. It is checked rather than argued — see check-mock below.
 *
 * The cost of being wrong was three top-level awaits, which made this module
 * async, which made `$lib/content` async, which made EVERY ROUTE NODE async,
 * in dev only. SvelteKit's client router reads `node.component` off that
 * namespace during a navigation, and WebKit hands it over before the async
 * graph has settled: "Cannot access 'component' before initialization", on
 * every client-side navigation, in Safari, for months. Chromium waits, so
 * nobody saw it. Direct page loads were fine, which is what made it look like
 * a routing problem rather than a module-shape one.
 *
 * Intent is not proof. Every string in these files carries a sentinel, and
 * `scripts/check-mock.ts` greps the built output for it after every build.
 * A mechanism that is supposed to remove something is worth exactly as much
 * as the check that it did.
 *
 * WHY THE MOCK POSTS ARE STILL ONE FILE. The real posts moved to one file per
 * post in `src/content/posts/`, read with `import.meta.glob` — and a glob is
 * exactly what cannot be used here. `import.meta.glob` is resolved when the
 * module is compiled, not when the branch runs: eager, it emits a static
 * import per file, and lazy, it emits a dynamic import per file that becomes
 * a chunk of its own. Either way the mock copy is in the artefact and
 * check-mock.ts fails, which is the check doing its job. So the stand-ins keep
 * the `{ posts: [...] }` envelope: one file, one static import, one dead
 * ternary the bundler can fold.
 */
import type { Post, ServiceDetail, Testimonials } from './index';
import posts from '../../content/mock/posts.json';
import servicesDetail from '../../content/mock/services-detail.json';
import testimonials from '../../content/mock/testimonials.json';

/** The dev-only envelope. Deliberately NOT the shape of `src/content/posts/`;
 *  see the note above. */
interface MockPosts {
  posts: Post[];
}

/** Keyed by the service `slug` it belongs to. */
type MockServiceDetail = Record<string, ServiceDetail>;

const dev = import.meta.env.DEV;

export const mockPosts: MockPosts | null = dev ? (posts as unknown as MockPosts) : null;

export const mockServiceDetail: MockServiceDetail | null = dev
  ? (servicesDetail as unknown as MockServiceDetail)
  : null;

export const mockTestimonials: Testimonials | null = dev
  ? (testimonials as unknown as Testimonials)
  : null;
