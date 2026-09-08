<template>
  <div :class="style.container">
    <span :class="style['btn-primary']"></span>
    <i :class="style.container__header"></i>
    <em :class="unknownVar.container"></em>
  </div>
</template>

<script setup lang="ts">
import style from "@/styles/common.module.scss";
</script>
