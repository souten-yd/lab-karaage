/* 唐揚げ防衛隊 - オーディオマネージャ (SonicForge生成ファイル再生) */
window.KD = window.KD || {};

(function () {
  var AudioMgr = function () {
    this.ctx = null;
    this.master = null;
    this.bgmGain = null;
    this.ambGain = null;
    this.sfxGain = null;
    this.voiceGain = null;
    this.nodes = {};
    this.playing = {};
    this.muted = false;
    this.ready = false;
    this.failed = {};
    this.radioFilter = null;
    this.staticBuf = null;
  };

  AudioMgr.prototype.init = function () {
    if (this.ready) return true;
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(this.ctx.destination);
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = 0.5;
      this.bgmGain.connect(this.master);
      this.ambGain = this.ctx.createGain();
      this.ambGain.gain.value = 0.4;
      this.ambGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.9;
      this.sfxGain.connect(this.master);
      this.voiceGain = this.ctx.createGain();
      this.voiceGain.gain.value = 1.0;
      this.voiceGain.connect(this.master);
      // 無線 (walkie-talkie) 帯域制限バス
      this.radioFilter = this.ctx.createBiquadFilter();
      this.radioFilter.type = "bandpass";
      this.radioFilter.frequency.value = 1600;
      this.radioFilter.Q.value = 0.5;
      this.radioFilter.connect(this.voiceGain);
      this.ready = true;
      return true;
    } catch (e) {
      console.warn("AudioContext init failed:", e);
      return false;
    }
  };

  AudioMgr.prototype.resume = function () {
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  };

  AudioMgr.prototype.load = function (name, url, destGain) {
    var self = this;
    if (!this.ready) return;
    if (this.nodes[name] || this.failed[name]) return;
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.responseType = "arraybuffer";
    xhr.onload = function () {
      if (xhr.status !== 200) {
        self.failed[name] = true;
        console.warn("audio missing:", url);
        return;
      }
      self.ctx.decodeAudioData(xhr.response, function (buf) {
        self.nodes[name] = buf;
      }, function () {
        self.failed[name] = true;
        console.warn("audio decode failed:", url);
      });
    };
    xhr.onerror = function () {
      self.failed[name] = true;
      console.warn("audio fetch error:", url);
    };
    xhr.send();
  };

  AudioMgr.prototype.startLoop = function (name, destGain, vol) {
    if (!this.ready || !this.nodes[name]) return;
    if (this.playing[name]) this.stopLoop(name);
    var src = this.ctx.createBufferSource();
    src.buffer = this.nodes[name];
    src.loop = true;
    var g = this.ctx.createGain();
    g.gain.value = vol == null ? 1 : vol;
    src.connect(g);
    g.connect(destGain || this.sfxGain);
    src.start(0);
    this.playing[name] = { src: src, gain: g };
  };

  AudioMgr.prototype.stopLoop = function (name) {
    var p = this.playing[name];
    if (!p) return;
    try {
      p.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
      var src = p.src;
      setTimeout(function () {
        try { src.stop(); } catch (e) {}
      }, 600);
    } catch (e) {}
    this.playing[name] = null;
  };

  AudioMgr.prototype.play = function (name, opts) {
    if (!this.ready || !this.nodes[name]) return null;
    var o = opts || {};
    var src = this.ctx.createBufferSource();
    src.buffer = this.nodes[name];
    src.playbackRate.value = o.rate || 1;
    var g = this.ctx.createGain();
    g.gain.value = o.vol == null ? 1 : o.vol;
    if (o.fade) g.gain.setTargetAtTime(0, this.ctx.currentTime + o.fade, 0.1);
    src.connect(g);
    var dest = o.dest || (name.indexOf("voice_") === 0 ? this.voiceGain : this.sfxGain);
    if (o.radio && this.radioFilter) dest = this.radioFilter;
    g.connect(dest);
    src.start(0);
    src.onended = function () { try { g.disconnect(); } catch (e) {} };
    return src;
  };

  // 無線バースト (ノイズ) を再生して walkie-talkie の"チャキッ"を再現
  AudioMgr.prototype.playStatic = function (dur, vol) {
    if (!this.ready || !this.radioFilter) return;
    if (!this.staticBuf) {
      var len = Math.floor(this.ctx.sampleRate * 0.25);
      this.staticBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      var d = this.staticBuf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    var src = this.ctx.createBufferSource();
    src.buffer = this.staticBuf;
    var g = this.ctx.createGain();
    var v = vol == null ? 0.12 : vol;
    g.gain.value = v;
    src.connect(g);
    g.connect(this.radioFilter);
    src.start(0);
  };

  // 無線経由で音声再生 (開始時バースト付き)
  AudioMgr.prototype.playRadio = function (name, opts) {
    if (!this.ready || !this.nodes[name]) return null;
    var o = opts || {};
    this.playStatic(0.05, 0.1);
    var src = this.play(name, { vol: o.vol, rate: o.rate, radio: true });
    if (src && o.burstAtEnd) {
      var self = this;
      src.onended = function () { self.playStatic(0.04, 0.06); };
    }
    return src;
  };

  AudioMgr.prototype.toggleMute = function () {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.8;
    return this.muted;
  };

  AudioMgr.prototype.loadAll = function () {
    var cfg = KD.Config.audio;
    this.load("bgm", cfg.bgm, this.bgmGain);
    if (cfg.bgmStages) {
      for (var i = 0; i < cfg.bgmStages.length; i++) {
        this.load("bgm_stage" + i, cfg.bgmStages[i], this.bgmGain);
      }
    }
    this.load("amb", cfg.amb, this.ambGain);
    for (var k in cfg.sfx) this.load(k, cfg.sfx[k], this.sfxGain);
    if (cfg.voice) {
      for (var v in cfg.voice) {
        // voice_ prefix は旧キー、op_ はオペレーター無線
        var key = v.indexOf("op") === 0 ? v : "voice_" + v;
        this.load(key, cfg.voice[v], this.voiceGain);
      }
    }
  };

  AudioMgr.prototype.startGameAudio = function () {
    this.startLoop("bgm", this.bgmGain, 0.55);
    this.startLoop("amb", this.ambGain, 0.5);
  };

  // ステージBGM切替 (0.3sクロスフェード相当: 旧曲フェードアウト+新曲フェードイン)
  AudioMgr.prototype.setStageBGM = function (stageIdx) {
    if (!this.ready) return;
    var cfg = KD.Config.audio;
    if (!cfg.bgmStages || !cfg.bgmStages[stageIdx]) return;
    var name = "bgm_stage" + stageIdx;
    if (!this.nodes[name]) return;
    // 現在再生中のステージBGMを停止
    if (this._curBgm) this.stopLoop(this._curBgm);
    this.stopLoop("bgm"); // フォールバックも止める
    if (this.playing[name]) return;
    var src = this.ctx.createBufferSource();
    src.buffer = this.nodes[name];
    src.loop = true;
    var g = this.ctx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(0.55, this.ctx.currentTime, 0.15);
    src.connect(g);
    g.connect(this.bgmGain);
    src.start(0);
    this.playing[name] = { src: src, gain: g };
    this._curBgm = name;
  };

  AudioMgr.prototype.stopStageBGM = function () {
    if (this._curBgm) { this.stopLoop(this._curBgm); this._curBgm = null; }
    this.stopLoop("bgm");
  };

  window.KD.Audio = new AudioMgr();
})();
