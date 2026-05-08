# Catchtable — Backend

Django REST Framework 製の待ち番号管理 API。

---

## 技術スタック

| 項目 | 内容 |
|---|---|
| フレームワーク | Django 4.2 + Django REST Framework |
| 言語 | Python 3.9 |
| DB | MySQL 8.0（utf8mb4） |
| 通知 | pywebpush（VAPID / Web Push） |
| タイムゾーン | Asia/Seoul |

---

## ディレクトリ構成

```
backend/
├── config/
│   ├── settings.py       # 設定（DB・CORS・VAPID を環境変数で管理）
│   ├── urls.py           # ルートURL（/api/ を queue_app に委譲）
│   └── wsgi.py
├── queue_app/
│   ├── models.py         # Customer・QueueSettings モデル
│   ├── serializers.py    # シリアライザー
│   ├── views.py          # API ビュー
│   ├── urls.py           # エンドポイント定義
│   └── migrations/
├── .env                  # 環境変数（git 除外）
├── .env.example          # 環境変数のテンプレート
└── requirements.txt
```

---

## API エンドポイント

### お客様向け

| メソッド | URL | 説明 |
|---|---|---|
| `GET` | `/api/queue/status/` | 現在の待ち人数・上限・満員フラグ |
| `POST` | `/api/register/` | お客様登録（名前・電話番号） |
| `GET` | `/api/customer/{番号}/` | 自分の番号・現在の順番取得 |
| `POST` | `/api/customer/{番号}/subscription/` | Push Subscription を保存 |

### 管理者向け

| メソッド | URL | 説明 |
|---|---|---|
| `GET` | `/api/admin/customers/` | 全お客様リスト取得 |
| `POST` | `/api/admin/call/` | 最大5人（残り人数未満なら全員）を呼び出し |
| `GET/PUT` | `/api/admin/settings/` | 上限人数の取得・変更 |
| `POST` | `/api/admin/reset/` | 全データ初期化（開発・テスト用） |

---

## モデル

### Customer

| フィールド | 型 | 説明 |
|---|---|---|
| `number` | IntegerField | 待ち番号（1 から連番・ユニーク） |
| `name` | CharField | 名前 |
| `phone` | CharField | 電話番号 |
| `status` | CharField | `waiting` / `called` |
| `push_subscription` | JSONField | Web Push の Subscription オブジェクト |
| `registered_at` | DateTimeField | 登録日時 |
| `called_at` | DateTimeField | 呼び出し日時 |

`position` プロパティ：自分より前の `waiting` 状態のお客様数 + 1。

### QueueSettings

| フィールド | 型 | 説明 |
|---|---|---|
| `max_count` | IntegerField | 登録上限人数（デフォルト 100） |

---

## 環境変数

`.env` を作成して設定する（`.gitignore` で除外済み）。`.env.example` を参照。

```env
SECRET_KEY=
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

DB_NAME=catchtable
DB_USER=root
DB_PASSWORD=
DB_HOST=127.0.0.1
DB_PORT=3306

CORS_ALLOWED_ORIGINS=http://localhost:3000

VAPID_PRIVATE_KEY=（base64url DER 形式）
VAPID_PUBLIC_KEY=（base64url 形式・フロントエンドと共有）
VAPID_CLAIM_EMAIL=admin@example.com
```

---

## セットアップ手順

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# .env を作成して DB 情報・VAPID 鍵を設定
cp .env.example .env

# DB 作成（MySQL）
mysql -u root -e "CREATE DATABASE catchtable CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# マイグレーション
python manage.py migrate

# 開発サーバー起動
python manage.py runserver 8000
```

---

## VAPID 鍵の生成

```python
from py_vapid import Vapid
import base64
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat, PrivateFormat, NoEncryption

v = Vapid()
v.generate_keys()

private_der = v.private_key.private_bytes(Encoding.DER, PrivateFormat.PKCS8, NoEncryption())
private_b64 = base64.urlsafe_b64encode(private_der).rstrip(b'=').decode()

public_raw = v.public_key.public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
public_b64 = base64.urlsafe_b64encode(public_raw).rstrip(b'=').decode()

print('VAPID_PRIVATE_KEY=' + private_b64)
print('VAPID_PUBLIC_KEY=' + public_b64)
```

生成した `VAPID_PUBLIC_KEY` はフロントエンドの `NEXT_PUBLIC_VAPID_PUBLIC_KEY` にも設定する。

---

## 呼び出しロジック

- 待ち状態（`waiting`）のお客様を番号順に最大5人取得
- 残り人数が5人未満の場合は全員を呼び出し
- `status` を `called` に変更 → `called_at` を記録
- 各お客様の `push_subscription` が存在する場合は Web Push 通知を送信
