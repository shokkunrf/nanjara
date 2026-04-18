<script lang="ts">
  import { resolve } from '$app/paths';
</script>

<div class="top">
  <h1>nanjara</h1>
  <p>パイを撮影して加点役・ジャラを計算</p>

  <div class="actions">
    <a href={resolve('/camera')} class="btn btn-primary">撮影する</a>
    <a href={resolve('/hand')} class="btn btn-secondary">手牌入力</a>
    <a href={resolve('/rules')} class="btn btn-secondary">役一覧</a>
  </div>
</div>

<style>
  .top {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100svh;
    text-align: center;
    padding: 0 24px;
  }

  h1 {
    font-size: 32px;
    margin: 0 0 8px;
  }

  p {
    font-size: 14px;
    color: #aaa;
    margin: 0 0 48px;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
    max-width: 280px;
  }

  .btn {
    display: block;
    padding: 16px;
    border-radius: 12px;
    text-decoration: none;
    font-size: 16px;
    font-weight: 600;
    text-align: center;
  }

  .btn-primary {
    background-color: #e91e63;
    color: #fff;
  }

  .btn-secondary {
    background-color: transparent;
    color: #aaa;
    border: 1px solid #555;
  }
</style>
