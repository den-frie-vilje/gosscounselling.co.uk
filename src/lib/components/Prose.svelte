<!--
  Renders a first-party markdown string as HTML. The trust boundary lives in
  `$lib/markdown` (build-time, first-party content — see its header).
-->
<script lang="ts">
  import { renderMarkdown } from '$lib/markdown';

  interface Props {
    md: string;
    class?: string;
  }

  let { md, class: klass = '' }: Props = $props();
  const html = $derived(renderMarkdown(md));
</script>

<div class="prose-clear {klass}">
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html html}
</div>
