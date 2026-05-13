# Catchtable — Frontend

Next.js 製のお客様向け・管理者向け画面。

---

## 技術スタック

| 項目 | 内容 |
|---|---|
| フレームワーク | Next.js（App Router） |
| 言語 | TypeScript |
| スタイル | CSS Custom Properties (OKLCH) |
| フォント | Pretendard (CDN) |
| 通知 | Web Push API + Service Worker |

---

## ディレクトリ構成

```
src/
├── app/
│   ├── page.tsx                          # 고객 등록（登録フォーム）
│   ├── full/page.tsx                     # 마감（満員画面）
│   ├── wait/[id]/page.tsx                # 대기 중（待ち画面）
│   ├── called/[id]/page.tsx              # 호출됨（呼び出し画面）
│   ├── already-called/[id]/page.tsx      # 호출 완료（呼び出し済み警告画面）
│   ├── manage-684bfb9247d05388/page.tsx  # 관리자 대시보드（Basic認証+URL難読化）
│   ├── layout.tsx                        # ルートレイアウト
│   └── globals.css                       # デザイントークン・グローバルスタイル
├── components/
│   └── CustomerFrame.tsx     # お客様画面共通ラッパー（ショップ名・言語トグル）
└── lib/
    └── api.ts                # バックエンドAPIクライアント（10秒タイムアウト）
public/
└── sw.js                     # Service Worker（Push通知受信・通知クリック処理）
```

---

## 画面とURL

| URL | 画面 | 説明 |
|---|---|---|
| `/?token=...` | 登録フォーム | 名前・電話番号・同意チェックで登録 |
| `/wait/[番号]` | 待ち画面 | 自分の番号と現在の順番を表示。10秒ポーリング |
| `/called/[番号]` | 呼び出し画面 | SMS受信後に表示 |
| `/already-called/[番号]` | 呼び出し済み警告 | 既に呼び出されたユーザーへの案内 |
| `/full` | 満員画面 | 上限に達した場合にリダイレクト |
| `/manage-684bfb9247d05388` | 管理者画面 | 待ちリスト・呼び出し・上限設定・検索・QRコード |

---

## 環境変数

`.env.local` を作成して設定する。

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

## 主な機能

### 登録フロー
- QRコードのURLに含まれる`token`パラメータで受付中チェック
- 個人情報収集同意チェックボックス（未チェック時は登録ボタン無効）
- device_id（localStorage+Cookie）による同一ブラウザからの二重登録防止
- 電話番号重複時は既存の待ち画面へリダイレクト

### 待ち画面
- 10秒ごとに自分のステータスをポーリング
- 登録キャンセル機能（サーバーレコード削除→再登録可）
- Web Push通知の購読

### 管理者画面
- 待ち中・呼び出し済みリストをリアルタイム表示（5秒ポーリング）
- 名前・電話番号での横断検索
- QRコードのタップで全画面モーダル表示
- 受付開始/終了に確認ダイアログ

### APIクライアント（api.ts）
- 全リクエストに10秒タイムアウト（AbortController）
- タイムアウト時は既存のエラーメッセージで再試行を促す

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
