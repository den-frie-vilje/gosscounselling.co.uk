<!--
  Root layout: global styles only. The header and footer chrome lives in the
  `(site)` group's layout, so the editor routes stay bare.
-->
<script lang="ts">
  import '../app.css';

  let { children } = $props();
</script>

{@render children()}
