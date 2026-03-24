<script lang="ts">
  import { resolve } from '$app/paths';
</script>

<div class="stub">
  <h1>ルール一覧</h1>
  <p>（TASK-0014で実装予定）</p>
  <a href={resolve('/')}>トップに戻る</a>
</div>

<style>
  .stub {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100svh;
    text-align: center;
    color: #aaa;
  }

  a {
    color: #e91e63;
    margin-top: 24px;
  }
</style>
