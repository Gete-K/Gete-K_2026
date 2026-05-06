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

配色を変える場合は、`content/site.def` の `theme.palette` を変更します。
順番に試すなら、次の4つを上から入れて保存してください。

```ini
theme.palette = theater-classic
theme.palette = black-gold
theme.palette = literary-green
theme.palette = pop-red
```

おすすめは `theater-classic` です。

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

画像やURLを使わない場合は、空欄のままでも動きます。
ただし、あとから見た人に分かりやすいので `なし` と書く運用がおすすめです。

```ini
members.1.photo = なし
members.1.snsUrl = なし
branding.logo.src = なし
```

`なし`、`未設定`、`null`、`none`、`-` は空欄と同じ扱いになります。

## 劇団員写真の扱い

GitHub Pagesで公開する画像は、誰でも閲覧・保存できる公開物として扱います。
Publicリポジトリに画像を入れる場合、リポジトリ上でも画像ファイルが見えます。
一度コミットした画像は、削除してもGit履歴に残る場合があります。

劇団員写真を載せる前に、必ず次を確認してください。

- 本人から公式サイト掲載の許可を取る
- 未成年の場合は保護者の同意も取る
- Web用にリサイズする
- EXIF、位置情報、撮影機種情報を削除する
- ファイル名に本名、住所、撮影場所を入れない
- 退団や掲載停止希望があった場合にすぐ外せるようにする

公開してよいWeb用画像だけ、次のフォルダに置きます。

```text
assets/public/members/
```

例：

```text
assets/public/members/member-01.jpg
assets/public/members/member-02.jpg
```

`assets/private/`、`assets/originals/`、`assets/raw/`、`assets/work/` は `.gitignore` で除外しています。
元画像や未許可写真は、このリポジトリではなくPC内の別フォルダや外部ストレージで管理してください。

`content/site.def` に書く例：

```ini
members.1.photo = ./assets/public/members/member-01.jpg
```

写真を載せない場合：

```ini
members.1.photo = なし
```

GitHubに画像を置きたくない場合は、外部URLも使えます。

```ini
members.1.photo = https://example.com/member-01.jpg
```

Google Driveの共有URLも使えますが、共有設定に注意してください。

- `制限付き`
  - 許可されたGoogleアカウントだけが見られます。
  - 公開ホームページ上の画像表示には基本的に向きません。

- `リンクを知っている全員`
  - URLを知っている人は見られます。
  - GitHub Pagesなどの公開サイトで画像表示できます。
  - 実質的には公開画像として扱ってください。

Google Driveを使う場合でも、掲載許可済み・Web用に加工済み・見られて困らない写真だけを使います。

ヘッダーの劇団名の左にロゴ画像を出したい場合は、公開用画像を次のように置きます。

```text
assets/public/branding/logo.png
```

`content/site.def` に書く例：

```ini
branding.logo.src = ./assets/public/branding/logo.png
branding.logo.alt = 劇団XX ロゴ
```

## PrivateリポジトリとGitHub Pages

GitHub Pagesは、プランによってはPrivateリポジトリからも公開できます。
ただし、GitHub公式ドキュメントでは、Pagesサイトは基本的にインターネット上で公開されると案内されています。

つまり、Privateリポジトリにしても、サイト上に表示した画像は閲覧者からアクセスできます。
写真の安全対策は「隠す」よりも、「公開してよい状態に整えた写真だけ使う」ことが基本です。
