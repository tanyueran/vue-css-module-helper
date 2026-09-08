<template>
  <div :class="$style.inlineBox">
    <span :class="theme.themeText"></span>
    <b :class="s.inlineBox"></b>
  </div>
</template>

<script setup lang="ts">
import { useCssModule } from "vue";
const s = useCssModule();
</script>

<style module>
.inlineBox {
  color: red;
}
.inlineBox__title {
  font-size: 14px;
}
</style>

<style module="theme">
.themeText {
  color: blue;
}
</style>
