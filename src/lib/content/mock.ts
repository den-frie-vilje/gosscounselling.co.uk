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
 * literal `false` into a build, and the dead branch plus the dynamic import
 * inside it are then removed by the bundler. A top-level
 * `import mock from '../../content/mock/posts.json'` would NOT be removed,
 * because the binding is referenced further down the file; only a dynamic
 * import inside a branch that provably cannot run is dropped. That is the
 * difference between "the mock content is skipped at runtime" and "the mock
 * content is not in the artefact", and it is the whole point.
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
 * check-mock.ts fails, which is the check doing its job. So the stand-ins
 * keep the `{ posts: [...] }` envelope and stay behind the one thing that can
 * be eliminated: a single dynamic import inside a dead branch.
 */
import type { Post, ServiceDetail, Testimonials } from './index';

/** The dev-only envelope. Deliberately NOT the shape of `src/content/posts/`;
 *  see the note above. */
interface MockPosts {
  posts: Post[];
}

/** Keyed by the service `slug` it belongs to. */
type MockServiceDetail = Record<string, ServiceDetail>;

const dev = import.meta.env.DEV;

export const mockPosts: MockPosts | null = dev
  ? ((await import('../../content/mock/posts.json')).default as unknown as MockPosts)
  : null;

export const mockServiceDetail: MockServiceDetail | null = dev
  ? ((await import('../../content/mock/services-detail.json'))
      .default as unknown as MockServiceDetail)
  : null;

export const mockTestimonials: Testimonials | null = dev
  ? ((await import('../../content/mock/testimonials.json')).default as unknown as Testimonials)
  : null;
