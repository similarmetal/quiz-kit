# Similarmetal Quiz Kit

**4択 (MCQ) × Spaced Repetition (SRS)** で資格学習を回すための、フレームワーク非依存のローカル Web アプリ。
学習科学（Active Recall + Spaced Repetition + Concept Map ベース MCQ）に基づいて設計。

🔗 **デモ**: https://similarmetal.github.io/quiz-kit/

## 特徴

- **カテゴリ式の試験選択**: クラウド / 会計・ファイナンス / 経営・法務 / IT基礎の4カテゴリーから選択
- **2,000問以上**の4択問題（12資格）
- **SM-2 簡易版 SRS**: 自己評価4段階で次回復習日を自動算出
- **完全フロントエンド**: HTML/CSS/Vanilla JS、サーバー不要、オフライン動作
- **個人情報送信なし**: 進捗データはブラウザの localStorage のみに保存。Cookie・解析タグなし

## 使い方

### A. ブラウザで使う（最も簡単）

上記のデモURL にアクセスするだけ。カテゴリーから試験を選んで学習開始。

### B. ローカルで動かす

```bash
git clone https://github.com/similarmetal/quiz-kit.git
cd quiz-kit/03-quiz-app
python3 -m http.server 8000
# ブラウザで http://localhost:8000 を開く
```

## 収録カテゴリと試験（2026年4月時点）

| カテゴリ | 試験 | 問題数 |
|---------|------|--------|
| クラウド・インフラ | AWS Solutions Architect Associate (SAA-C03) | 200 |
| | AWS Solutions Architect Professional (SAP-C02) | 0 ★準備中 |
| | AWS Security (SCS-C03) | 226 |
| | AWS GenAI Developer Pro (AIP-C01) | 155 |
| | AWS ML Engineer Associate (MLA-C01) | 110 |
| | AWS DevOps Pro (DOP-C02) | 140 |
| | AWS Advanced Networking (ANS-C01) | 120 |
| | AWS Database Specialty (DBS-C01) | 130 |
| | AWS AI Practitioner (AIF-C01) | 105 |
| 会計・ファイナンス | 日商簿記2級 | 227 |
| | FP技能検定2級 | 200 |
| 経営・法務 | 中小企業診断士 1次 | 380 |
| | ビジネス実務法務検定2級 | 150 |
| IT基礎・情報処理 | 応用情報技術者 | 140 |
| **合計** | **14試験** | **2,283問** |

## ディレクトリ構成

```
quiz-kit/
├── README.md
├── LICENSE
├── SECURITY.md
├── .github/workflows/deploy-pages.yml   GitHub Pages 自動デプロイ
└── 03-quiz-app/                          ★ 学習用 Web アプリ
    ├── index.html                        ホーム（カテゴリ一覧）
    ├── quiz.html                         問題演習画面
    ├── stats.html                        統計・進捗
    ├── app.js                            SRSロジック含む
    ├── styles.css
    └── data/
        ├── categories.json               カテゴリ定義
        ├── exams/{code}.json             資格メタデータ
        └── questions/{code}/{domain}.json  ドメイン別問題セット
```

## 学習科学の根拠

- **Active Recall**: Roediger & Karpicke (2006) — 記憶検索練習による長期定着（再読 34% vs テスト 80%）
- **Spaced Repetition**: Cepeda et al. (2008), Ebbinghaus 忘却曲線
- **2-3-5-7-14-30 復習間隔**: 1日後 → 3日後 → 7日後 → ... の最適スケジューリング
- **Concept Map MCQ**: Scaria et al. (2025) — Concept Map ベースの高品質MCQ生成
- **Distractor Plausibility**: Burton et al. (1990) — 誤概念ベースの distractor 設計
- **Bloom's Taxonomy**: 認知レベル配分 (Remember / Understand / Apply / Analyze / Evaluate / Create)

## 免責 / Disclaimer

> ⚠️ **重要**: 本リポジトリの問題は **生成AI (Claude) による自動生成** であり、内容の正確性・最新性を保証するものではありません。

### 本サイトの位置づけ

- 本キットは **個人開発のオープンソースプロジェクト** であり、特定の試験合格を保証するものではありません。
- 本サイトは以下の認定機関・運営団体と **一切関係ありません**。公式に承認・認定・連携されたものではありません：
  - AWS, Inc. (Amazon Web Services)
  - 日本商工会議所（日商簿記）
  - 東京商工会議所（ビジネス実務法務検定）
  - 日本FP協会・金融財政事情研究会（FP技能検定）
  - 中小企業診断協会
  - 情報処理推進機構 IPA（情報処理技術者試験）
- 各機関の公式試験規約・受験規約 (秘密保持義務 / NDA を含む) は受験者各自が遵守してください。

### 問題コンテンツについて

- すべての問題は **AI が生成した学習用サンプル** であり、公式試験問題のコピー・流出 (braindump) ではありません。
- 生成された問題には **事実誤認・古い情報・計算ミス・解釈の揺れ** が含まれる可能性があります。
- 公式試験問題との類似性は検証していません。学習補助としてのみご利用ください。

### 試験情報の最新性

試験範囲・問題形式・出題傾向・受験料・実施日程等の最新情報は、**必ず各認定機関の公式サイト** で確認してください：
- [AWS 認定](https://aws.amazon.com/certification/)
- [日商簿記](https://www.kentei.ne.jp/bookkeeping)
- [ビジネス実務法務検定](https://kentei.tokyo-cci.or.jp/)
- [日本FP協会](https://www.jafp.or.jp/)
- [中小企業診断協会](https://www.j-smeca.jp/)
- [IPA（応用情報技術者）](https://www.ipa.go.jp/)

### 専門領域に関する注意

- 法律 (ビジネス実務法務 / 中小企業診断士 / FP の税務領域) の問題は **法的助言ではありません**。具体的な事案は弁護士・税理士・社労士等の専門家にご相談ください。
- 金融・投資 (FP) の問題は **投資助言ではありません**。

### 商標・著作権

- 商標・サービス名（AWS, Amazon Bedrock, SageMaker, GuardDuty 等）はそれぞれの権利者に帰属します。
- 認定試験名 (例: "AWS Certified Security – Specialty (SCS-C03)") は記述目的での引用 (nominative fair use) であり、それぞれの権利者を示すものです。
- 各機関のロゴは使用していません。

### プライバシー

- 学習進捗データはブラウザの **localStorage** にのみ保存され、第三者には送信されません。
- アクセス解析・トラッキングコード (Google Analytics 等) は使用していません。
- Cookie は使用していません。
- Google Fonts の CSS / フォントファイルが fonts.googleapis.com / fonts.gstatic.com からロードされるため、訪問時に Google が IP・User-Agent を取得し得ます。

## ライセンス

[MIT License](LICENSE)。商用利用・再配布前に **各問題の事実関係をご自身で精査** してください。AI 生成コンテンツに起因する損害について、作者は一切の責任を負いません。
