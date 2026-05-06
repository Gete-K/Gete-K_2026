# 劇団サイト 編集メモ

このサイトは、ホームページ制作が初めてでも更新しやすいように作っています。
基本的には `content/site.def` だけ編集すれば、トップページの文章や日程、ニュース、メンバー情報を変えられます。

## まず触るファイル

- `content/site.def`
  - サイト名、次回公演、News、Schedule、Members、SNS、Contact を編集するファイルです。
  - 左側の `hero.title` や `news.1.title` は消さず、`=` の右側だけを書き換えます。

## あまり触らないファイル

- `index.html`
  - ページの骨組みです。
  - セクションを増やしたい時だけ触ります。

- `styles.css`
  - 見た目を決めるファイルです。
  - 色を変えたい時は、上の `:root` にある `--accent` などを変更します。

- `main.js`
  - スマホメニュー、現在地ハイライト、`site.def` の読み込み処理です。
  - コメントを多めに残してありますが、普段の更新では触らなくてOKです。

## ローカルで確認する方法

`site.def` はブラウザの安全制限のため、HTMLファイルを直接開くだけでは読み込めない場合があります。
確認するときは、このフォルダで簡易サーバーを起動してから開くのがおすすめです。

```powershell
node tools/local-server.cjs 8000
```

そのあとブラウザで次を開きます。

```text
http://localhost:8000/
```

## よくある編集

Newsを増やす場合は、`content/site.def` に次のように番号を増やして追加します。

```ini
news.3.date = 2026-04-01
news.3.title = 新しいお知らせ
news.3.text = ここに本文を書きます。
news.3.url =
```

メンバーを非表示にしたい場合は、`enabled` を `false` にします。

```ini
members.2.enabled = false
```

文章を改行したい場合は、`\n` と書きます。

```ini
hero.lead = 1行目のコピー\n2行目のコピー
```
