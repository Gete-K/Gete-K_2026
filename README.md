# 劇団サイト 編集メモ

このサイトは GitHub Pages で動く静的サイトです。基本的には `content/site.def` だけ編集すれば、トップページの文章、公演情報、お知らせ、過去公演、SNS、問い合わせ先を変更できます。

## まず触るファイル

- `content/site.def`
  - サイト名、キャッチコピー、次回公演、お知らせ、過去公演、メンバー、SNS、問い合わせ先を編集するファイルです。
  - 左側の `hero.title` や `news.1.title` は消さず、`=` の右側だけを書き換えます。

## できるだけ触らないファイル

- `index.html`
  - トップページの骨組みです。
  - トップには「劇団について」「次回公演」「お知らせ」「過去公演」「SNS / 問い合わせ」を置いています。
- `about.html`
  - 劇団についての補足ページです。
  - メンバー紹介はトップから外し、このページの補足要素として表示できるようにしています。
- `news.html`
  - お知らせ一覧ページです。
  - トップページは最新3件だけ、こちらは全件表示します。
- `styles.css`
  - 色、余白、カード、スマホ表示など見た目を決めるファイルです。
- `main.js`
  - スマホメニュー、現在地ハイライト、`site.def` の読み込み処理です。

## ローカルで確認する方法

`site.def` はブラウザの安全制限のため、HTMLファイルを直接開くだけでは読み込めない場合があります。確認するときは、このフォルダで Node.js の簡易サーバーを起動してください。

まず、このリポジトリのフォルダへ移動します。

```powershell
cd XXX\Gete-K_2026
```

```powershell
node tools/local-server.cjs 8000
```

画面に `Local server: http://127.0.0.1:8000/` と出たら起動できています。止めるときは、その画面で `Ctrl + C` を押します。

ブラウザで次を開きます。

```text
http://127.0.0.1:8000/
```

## よくある編集

配色を変える場合は、`content/site.def` の `theme.palette` を変更します。今のおすすめは `soft-cream` です。

```ini
theme.palette = soft-cream
```

次回公演を変える場合は、次のあたりを編集します。

```ini
hero.title = 『作品タイトル』
hero.lead = トップに出す短いキャッチコピー
hero.meta1.value = 2026.03.14-03.16
hero.meta2.value = 〇〇シアター
hero.detail.url = #contact
```

お知らせを増やす場合は、番号を増やして追加します。トップページには最新3件だけ表示され、`news.html` には全件表示されます。

```ini
news.4.date = 2026-04-01
news.4.title = 新しいお知らせ
news.4.text = ここに本文を書きます。
news.4.url =
```

過去公演を増やす場合も、番号を増やします。

```ini
past.3.year = 2026
past.3.title = 第3回公演『作品タイトル』
past.3.text = 公演の短い説明
past.3.photo = なし
past.3.url =
```

メンバーを非表示にしたい場合は、`enabled` を `false` にします。メンバー情報はトップページには出ず、`about.html` の補足として表示されます。

```ini
members.2.enabled = false
```

## 画像の扱い

公開してよいWeb用画像だけを使ってください。元画像や高解像度画像、未許可の劇団員写真は GitHub に置かないでください。

キービジュアルを置く例:

```text
assets/public/keyvisual.jpg
```

`content/site.def` に書く例:

```ini
hero.keyVisual.src = ./assets/public/keyvisual.jpg
hero.keyVisual.alt = 公演キービジュアル
```

過去公演写真の例:

```text
assets/public/past/stage-2024.jpg
```

`content/site.def` に書く例:

```ini
past.1.photo = ./assets/public/past/stage-2024.jpg
```

劇団員写真を載せる前に、必ず次を確認してください。

- 本人から公式サイト掲載の許可を取る
- 未成年の場合は保護者の同意も取る
- Web用にリサイズする
- EXIF、位置情報、撮影機種情報を削除する
- ファイル名に本名、住所、撮影場所を入れない

写真を載せない場合は `なし` のままで大丈夫です。

## ローカル編集ツールの使い方

`content/site.def` をブラウザ画面から安全に編集するためのローカル専用ツールを追加しています。GitHub Pages 運用を前提にしており、公開用の HTML/CSS/JS やビルド方式は変更しません。

```powershell
npm run edit
```

起動後、表示された `http://127.0.0.1:8123/__site_editor/` をブラウザで開きます。

Node.js / npm が入っていない場合は、Node.js LTS をインストールしてから実行してください。Windows では次の方法が使えます。

```powershell
winget install OpenJS.NodeJS.LTS
```

`winget` が使えない場合は、Node.js 公式サイトから LTS 版のインストーラーを入手してください。

```text
https://nodejs.org/
```

インストール後は PowerShell を開き直し、次のコマンドで確認します。

```powershell
node -v
npm -v
```

- 最初に現在のブランチを確認し、`main` ブランチ上では派生ブランチを作成してから編集します。
- `site.def` は key を固定したまま value だけ編集できます。コメント行と空行は保持されます。
- 右側の iframe で `index.html` / `about.html` / `news.html` をローカルプレビューできます。
- 画像は `images/` 配下にだけ追加できます。上書き時は `backup/images/` にバックアップが作成されます。
- 差分と変更画像を確認してから commit できます。`main` ブランチ上の commit と push はブロックされます。
- push は確認欄に `PUSHを許可` と入力した場合だけ実行できます。push 後は GitHub Pages の反映を確認してください。
