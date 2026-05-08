# Catchtable — Frontend

Next.js 16 製のお客様向け・管理者向け画面。

---

## 技術スタック

| 項目 | 内容 |
|---|---|
| フレームワーク | Next.js 16 (App Router) |
| 言語 | TypeScript |
| スタイル | CSS Custom Properties (OKLCH) |
| フォント | Pretendard (CDN) |
| 通知 | Web Push API + Service Worker |

---

## ディレクトリ構成

```
src/
├── app/
│   ├── page.tsx              # 고객 등록（登録フォーム）
│   ├── full/page.tsx         # 마감（満員画面）
│   ├── wait/[id]/page.tsx    # 대기 중（待ち画面）
│   ├── called/[id]/page.tsx  # 호출됨（呼び出し画面）
│   ├── admin/page.tsx        # 관리자 대시보드
│   ├── layout.tsx            # ルートレイアウト
│   └── globals.css           # デザイントークン・グローバルスタイル
├── components/
│   └── CustomerFrame.tsx     # お客様画面共通ラッパー（ショップ名・言語トグル）
└── lib/
    └── api.ts                # バックエンドAPIクライアント
public/
└── sw.js                     # Service Worker（Push通知受信・通知クリック処理）
```

---

## 画面と URL

| URL | 画面 | 説明 |
|---|---|---|
| `/` | 登録フォーム | 名前・電話番号を入力して登録 |
| `/wait/[番号]` | 待ち画面 | 自分の番号と現在の順番を表示。5秒ポーリング |
| `/called/[番号]` | 呼び出し画面 | 通知クリック後に表示。韓国語/英語切り替え |
| `/full` | 満員画面 | 上限に達した場合にリダイレクト |
| `/admin` | 管理者画面 | 待ちリスト・呼び出しボタン・上限設定 |

---

## 環境変数

`.env.local` を作成して設定する。`.env.local` は `.gitignore` で除外済み。

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_VAPID_PUBLIC_KEY=（バックエンドで生成したVAPID公開鍵）
```

---

## 起動方法

```bash
npm install
npm run dev       # 開発サーバー → http://localhost:3000
npm run build     # 本番ビルド
npm start         # 本番サーバー起動
```

---

## Web Push の仕組み

```
1. お客様が /wait/[番号] に遷移
2. ブラウザが通知許可ダイアログを表示
3. 許可 → Service Worker が Push Subscription を生成
4. Subscription をバックエンドに保存
         POST /api/customer/{番号}/subscription/
5. 管理者が呼び出しボタンを押す
6. バックエンドが Google サーバー経由で通知を送信
7. sw.js が通知を受け取りロック画面にも表示
8. 通知クリック → /called/[番号] に遷移
```

---

## 言語切り替え

お客様画面はハングル / English の切り替えあり。`CustomerFrame` が `lang` state を管理し各ページに props で渡す。管理者画面はハングルのみ。

---

## デザインシステム

`globals.css` に CSS Custom Properties として定義。OKLCH カラースペースを使用。

| 変数 | 用途 |
|---|---|
| `--y*` | Yellow — メインカラー・CTA ボタン |
| `--b*` | Blue — 順番表示・ステータス |
| `--n*` | Neutral — テキスト・背景・ボーダー |
| `--r-*` | Border Radius |
| `--sp*` | Spacing（4pt 基準） |
