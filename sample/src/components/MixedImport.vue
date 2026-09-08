<template>
  <div :class="[relStyle.lessCard, tsStyle.container]">
    <span :class="reqStyle['less-card-title']"></span>
  </div>
</template>

<script setup lang="ts">
import relStyle from "../styles/nested.module.less";
import tsStyle from "#styles/common.module.scss";
const reqStyle = require("../styles/nested.module.less");
</script>
