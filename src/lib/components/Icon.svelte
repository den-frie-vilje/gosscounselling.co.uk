<!--
  The small line glyphs the contact rows and buttons use. Stroked in
  `currentColor` so a glyph takes the colour of whatever it sits in, and
  `aria-hidden` throughout: every one of these sits beside a real text label,
  so announcing it would only repeat that label.
-->
<script lang="ts">
  interface Props {
    name: 'phone' | 'mail' | 'whatsapp' | 'pin' | 'arrow';
    size?: number;
    class?: string;
  }

  let { name, size = 22, class: klass = '' }: Props = $props();
</script>

<svg
  class={klass}
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.7"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
>
  {#if name === 'phone'}
    <path
      d="M6.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16.8 16.8 0 0 1 4.5 5.7 2 2 0 0 1 6.5 3.5Z"
    />
  {:else if name === 'mail'}
    <rect x="2.75" y="5" width="18.5" height="14" rx="2" />
    <path d="m3.5 6.75 8.5 6 8.5-6" />
  {:else if name === 'whatsapp'}
    <path d="M3.5 20.5 5 16.4a8 8 0 1 1 3.1 3L3.5 20.5Z" />
    <path d="M9.2 9.1c-.3.6-.2 1.4.3 2.2a7 7 0 0 0 3.2 3c.8.4 1.6.4 2.1 0l.6-.6-1.7-1.3-.8.6a5.2 5.2 0 0 1-2-1.9l.6-.8-1.2-1.8-.5.2Z" />
  {:else if name === 'pin'}
    <path d="M12 21s6.5-6 6.5-11a6.5 6.5 0 0 0-13 0C5.5 15 12 21 12 21Z" />
    <circle cx="12" cy="10" r="2.4" />
  {:else if name === 'arrow'}
    <path d="M4.5 12h14" />
    <path d="m13 6.5 5.5 5.5-5.5 5.5" />
  {/if}
</svg>
