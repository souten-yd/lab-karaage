# 唐揚げ防衛隊 — 作業ステータス(セッション引き継ぎ用)

更新: 2026-09-07

## 概要
Three.js 製の3D三人称カオジュ撃退シューティング。唐揚げ基地を10ステージ(ボスS5/S10)のカオジュ群から守る。
DP(ポイント)経済 + 準備フェーズのアップグレード + オペレーター無線(TTS)。
モバイル(仮想ジョイスティック/オートファイア)とPC(ポインタロック/フォールバックマウス)対応。
ブラウザで `index.html` を開くだけで遊べる(ローカルHTTP配信推奨)。

## 現状まとめ
| 項目 | 状態 |
|---|---|
| ゲーム本体(js/ 8ファイル + three.min.js + index.html + css/) | ✅ 完成・全10ステージ自然フロー検証済み(victory到達) |
| 音声(audio/ 57ファイル) | ✅ 完了: SFX 8 + AMB 1 + BGM 10ステージ + TTS 29 + 旧BGM 1 + 旧VOICE 8 |
| 画像(assets/ 7種) | ✅ 怪獣5種+タイトル背景+唐揚げ |
| 入力 | ✅ キーボード+ポインタロック / フォールバックマウス(左ドラッグ視点・右クリック射撃) / タッチ(ジョイスティック+視点ドラッグ+オートファイア+ポーズ) |

## 10ステージ構成(config.js `waves`)
| # | 構成 [raptor,ptera,squid,mosa,tera,terax] | dpMult | 備考 |
|---|---|---|---|
| 1 | 6,0,0,0,0,0 | 0.5 | |
| 2 | 8,3,0,0,0,0 | 0.6 | |
| 3 | 6,4,3,0,0,0 | 0.7 | |
| 4 | 8,4,3,4,0,0 | 0.8 | |
| 5 | 8,4,4,0,1,0 | 0.9 | ボス tera (hp3200 dmg40) |
| 6 | 8,6,6,0,0,0 | 1.0 | |
| 7 | 8,5,6,5,0,0 | 1.1 | |
| 8 | 12,6,6,6,0,0 | 1.2 | 30体=maxEnemies |
| 9 | 8,8,6,8,0,0 | 1.3 | |
| 10 | 8,6,4,6,0,1 | 1.4 | 最終ボス terax (kaiju_tera.png复用) |

- DP/キル = score/10 × dpMult。S9累計3238 = 総量4736の68.4%
- アップグレード(準備フェーズ、各Lv2まで、300 DP/Lv): weapon(12→15→19 dmg, 連射0.8x)/ base(HP+300/+700, 修復200/400)/ squad(支援兵+1, 被ダメ0.8x)/ turret(自衛砲台+1)
- 街の破壊はステージ進行で段階破壊(world.js `setDestruction`)

## ファイル構成
```
唐揚げ防衛隊/
├── index.html          # エントリ。viewport meta + #touch-ui(ジョイスティック/射撃/ポーズ)
├── three.min.js        # Three.js 0.160.1
├── css/style.css       # 青基調UI + タッチUI + モバイルコンパクト
├── audio/
│   ├── bgm_stage01..10.ogg   # 10ステージBGM (libvorbis 48kHz stereo 160kbps, 32s×8/36s/40s)
│   ├── op_*.ogg              # TTS 29本 (libvorbis 32kHz mono 96kbps)
│   ├── bgm_defense.ogg / amb_city_night.ogg / sfx_*.ogg / voice_*.ogg  # 旧アセット
├── assets/             # 怪獣5種 + bg_title.png + karaage.png
└── js/
    ├── config.js       # 10波・敵6種・DP経済・アップグレード定義・音声パス
    ├── audio.js        # BGM切替(setStageBGM)・無線バンドパス(1600Hz)・TTS再生
    ├── input.js        # キーボード+ポインタロック+フォールバック+タッチ(全Pointer Events)
    ├── world.js        # シティ・段階破壊・照明・フォグ
    ├── base.js         # 唐揚げ基地・タレゾーン
    ├── enemies.js      # 6種。プロシージャルモーション(バウンス/スウェイ/スクワッシュ/羽ばたき)
    ├── player.js       # 三人称カメラ・射撃・ジョイスティック移動・firing()
    └── main.js         # 状態機(title/prep/playing/paused/gameover/victory)・DP・アップグレード・無線・HUD
```

## 入力方式
- PC: ポインタロック(左クリック射撃)。iframe等でロック不可 → `Input.tryLock` が Promise reject / pointerlockerror を捕捉してフォールバックへ(左ドラッグ=視点、右クリック=射撃、WASD移動、Rリロード)
- モバイル: 左半分のタップ位置で仮想ジョイスティック出現(移動)、右半分ドラッグ=視点(TOUCH_LOOK_SCALE=2.4)、右下ボタン=オートファイア切替、右上=ポーズ
- `Input.firing()` = mouseDown || autoFire。`Input.moveAxis` = ジョイスティック軸
- Esc = ポーズ(playing時)。Enter = prep→次ステージ / pause→再開

## 検証済み事項(2026-09-07)
- **バグ修正: ステージ2以降進めない** — `_clearAnnounced` フラグが `startWave()` でリセットされず、S1クリア後に永久trueとなり S2以降 `enterPrep()` が呼ばれなかった → `startWave()` と初期化に `this._clearAnnounced = false` を追加(main.js)
  - 再現テスト: `/tmp/opencode/kdtest/natural_flow.js`(S1→prep→次へ→S2全滅でstate=playingのままフリーズを再現)
- **全10ステージ自然フロー検証OK**: `/tmp/opencode/kdtest/full_run2.js` — 各ステージ全滅→prep画面→「次へ」クリック→…→S10撃破→victory画面(score 41350 / dp 4430)、コンソールエラーゼロ
- **入力テストOK**: `/tmp/opencode/kdtest/input_test.js` — マウスモード(isTouch=false、フォールバック: 右クリック射撃・左ドラッグ視点)13項目 / タッチモード(ジョイスティック移動・視点ドラッグ・オートファイア・ポーズ/再開)12項目 全てPASS
- `node --check` 全js合格
- アップグレード購入フロー検証済み(DP=2400で4系統全てLv2到達、数値反映確認)

## SonicForge 生成メモ
- `http://127.0.0.1:9140`。music: `POST /local/v1/music {prompt,bpm,duration_sec,instrumental,quality,output:{format}}`、tts: `POST /local/v1/tts {text,language,voice_id,quality,output:{format}}` → `{job_id}`。ポーリング `GET /addon/v1/jobs/{id}`、DL `GET /addon/v1/assets/{asset_id}/content`
- TTS voice: `voice:21e118b4-cfcf-440d-9348-64b89e2eec3d` (ja)
- BGM 10本: ACE-Step(acestep-v15-turbo + 5Hz-lm)。ROCm GPU OOMが慢性的 → `~/.config/systemd/user/cdapp-feature-sonic-forge.service.d/hip-frag.conf` に `PYTORCH_HIP_ALLOC_CONF=expandable_segments:True` 等を追加。MCP改善後(ユーザー修正)に全曲生成成功
- **重要: TTSワーカーとmusicワーカーは同時常駐不可(VRAM競合でOOM)**。生成前に片方を停止
- 生成ハーネス: `/tmp/opencode/kdtest/gen.js`(sequential+resume)、`music_tasks.json`(10曲プロンプト)、`tts_tasks.json`(29行)

## テスト環境
- Chrome headless CDP port 9222 / 配信 `python3 -m http.server 8777`(PID 104740)
- ハーネスは `/tmp/opencode/kdtest/`。Node 22 の global WebSocket を使用(モジュール不要)
- `/json/new` は PUT verb 必須(GETは拒否)

## 既知の軽微事項
- headless Chromeではポインタロックが常に失敗(WrongDocumentError) → 常にフォールバック/タッチ経路で動作。実ブラウザではロック通常通り
- S8は30体でmaxEnemies到達(排出待ちが発生する設計)
- teraxは kaiju_tera.png を复用(別テクスチャ未生成)
