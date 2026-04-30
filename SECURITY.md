# Security Policy

## サポートバージョン

このプロジェクトはローリングリリース（最新の `main` ブランチのみサポート）です。

## 報告方法

セキュリティ脆弱性を発見した場合は、**公開 issue として報告せず**、以下のいずれかの方法でプライベートに連絡してください：

- GitHub の [Security Advisories](https://github.com/<owner>/<repo>/security/advisories/new) で Private vulnerability report を作成
- リポジトリ管理者に直接連絡

## 対象となる脆弱性

このアプリは **完全フロントエンド (静的サイト)** で、バックエンド・認証・データベースを持ちません。
そのため、以下の脆弱性が主な評価対象です：

- XSS (Cross-Site Scripting) — 問題JSON / インポートデータの描画
- DoS — ローカルストレージ枯渇、巨大ファイルインポート
- Click-jacking — フレーム埋め込み攻撃
- 第三者依存（Google Fonts 等）の悪用
- localStorage 経由のデータポイズニング

以下は本プロジェクトでは「対象外」です：
- ユーザのブラウザ自体のセキュリティ問題
- ユーザがフォークし改変したリポジトリの問題
- DevTools 経由の self-XSS（ブラウザの一般警告事項）

## アーキテクチャと既知の防御

| 層 | 防御 |
|----|------|
| HTML | CSP (Content-Security-Policy) meta タグでスクリプト・スタイル元を制限 |
| HTML | `X-Content-Type-Options: nosniff` |
| HTML | `Referrer-Policy: strict-origin-when-cross-origin` |
| JS | `escapeHtml()` で全 innerHTML 経路をエスケープ |
| JS | `safeUrl()` で外部リンクの protocol を `http(s)` / `mailto` のみ許可 |
| JS | `target="_blank"` には `rel="noopener noreferrer"` を必須 |
| JS | `importData()` でファイルサイズ上限 (5MB) と スキーマ検証 |
| Storage | localStorage は origin-scoped。ユーザ間データ干渉なし |
| Network | バックエンドなし。Anthropic / Google 等への自動データ送信なし |

## ユーザの個人情報・プライバシー

- 学習進捗 (`localStorage`) はユーザのブラウザ内にのみ保存され、第三者サーバへ送信されません。
- 解析・トラッキングコード (Google Analytics 等) は使用していません。
- Cookie は使用していません。
- Google Fonts の CSS / フォントファイルは fonts.googleapis.com / fonts.gstatic.com から読み込まれます。
  これにより Google が訪問者の IP アドレス・User-Agent を取得し得ます。
  完全にオフ化したい場合は、Google Fonts へのリンクを削除しシステムフォントのみで動作させる選択も可能です。

## 既知の制限事項

- AI 生成された問題コンテンツに事実誤認や古い情報が含まれる可能性があります（コンテンツ品質の問題でセキュリティ問題ではない）。
- 学習進捗データはブラウザのキャッシュ削除等で消失します。`stats.html` の Export 機能でバックアップしてください。

## 公開時の運用上の推奨

GitHub Pages 等で公開する場合：

1. ブランチ保護 (`main` への直接 push 禁止)
2. Dependabot Alerts を有効化（外部依存はないが将来用）
3. CodeQL or GitHub Advanced Security の利用を検討
4. CSP のレポートエンドポイントを設定する場合は `Content-Security-Policy-Report-Only` で観測してから本番化
