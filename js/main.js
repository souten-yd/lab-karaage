/* 唐揚げ防衛隊 - メインループ・状態管理・HUD */
window.KD = window.KD || {};

(function () {
  var Main = {
    state: "title",
    wave: -1,
    spawnQueue: [],
    spawnTimer: 0,
    score: 0,
    dp: 0,
    baseHp: 0,
    shakeMag: 0,
    intermission: 0,
    bannerTimer: 0,
    last: 0,
    upg: null,
    turrets: [],
    soldiers: [],
    _turretBullets: [],
    boss: null,
    bossLowAnnounced: false,
    _clearAnnounced: false,
    radioBusy: false,
    idleTimer: 20,
    el: {},

    init: function () {
      var e = this.el;
      e.canvas = document.getElementById("game-canvas");
      e.hud = document.getElementById("hud");
      e.hpFill = document.getElementById("hp-fill");
      e.baseFill = document.getElementById("base-fill");
      e.ammo = document.getElementById("ammo");
      e.score = document.getElementById("score");
      e.wave = document.getElementById("wave");
      e.left = document.getElementById("left");
      e.msg = document.getElementById("msg");
      e.mute = document.getElementById("mute");
      e.cross = document.getElementById("crosshair");
      e.screens = document.querySelectorAll(".screen");
      e.overMsg = document.getElementById("over-msg");
      e.overScore = document.getElementById("over-score");
      e.vicScore = document.getElementById("vic-score");
      e.dp = document.getElementById("dp");
      e.prepTitle = document.getElementById("prep-title");
      e.prepDp = document.getElementById("prep-dp");
      e.prepButtons = {};
      ["weapon", "base", "squad", "turret"].forEach(function (k) {
        e.prepButtons[k] = {
          root: document.getElementById("upg-" + k),
          name: document.getElementById("upg-" + k + "-name"),
          lv: document.getElementById("upg-" + k + "-lv"),
          desc: document.getElementById("upg-" + k + "-desc"),
          cost: document.getElementById("upg-" + k + "-cost"),
        };
      });
      e.btnPrepDone = document.getElementById("btn-prep-done");

      var self = this;
      document.getElementById("btn-start").addEventListener("click", function () { self.start(); });
      document.getElementById("btn-restart").addEventListener("click", function () { self.start(); });
      document.getElementById("btn-again").addEventListener("click", function () { self.start(); });
      document.getElementById("btn-resume").addEventListener("click", function () { self.resume(); });
      e.btnPrepDone.addEventListener("click", function () { self.finishPrep(); });
      ["weapon", "base", "squad", "turret"].forEach(function (k) {
        e.prepButtons[k].root.addEventListener("click", function () { self.buyUpgrade(k); });
      });
      // タッチ UI
      e.btnFire = document.getElementById("btn-fire");
      e.btnPause = document.getElementById("btn-pause");
      if (e.btnFire) {
        e.btnFire.addEventListener("click", function () {
          var on = KD.Input.toggleAutoFire();
          e.btnFire.textContent = on ? "射撃 ON" : "射撃 OFF";
          e.btnFire.classList.toggle("on", on);
        });
      }
      if (e.btnPause) {
        e.btnPause.addEventListener("click", function () {
          if (self.state === "playing") self.pause();
          else if (self.state === "paused") self.resume();
        });
      }
      window.addEventListener("keydown", function (ev) {
        if (ev.code === "Enter" && (self.state === "title" || self.state === "gameover" || self.state === "victory")) self.start();
        if (ev.code === "Enter" && self.state === "paused") self.resume();
        if (ev.code === "Enter" && self.state === "prep") self.finishPrep();
        if (ev.code === "Escape" && self.state === "playing") self.pause();
      });

      Array.prototype.forEach.call(e.screens, function (s) {
        if (s.id === "title-screen") s.classList.add("show");
      });
      e.hud.style.display = "none";
      e.cross.style.display = "none";
    },

    boot: function () {
      this.init();
      KD.Audio.init();
      KD.Audio.loadAll();
      KD.Input.init(this.el.canvas);
      KD.World.init(this.el.canvas);
      KD.Base.init(KD.World.scene);
      KD.Enemies.init(KD.World.scene);
      KD.Player.init(KD.World.scene);
      this.baseHp = KD.Config.base.hp;
      this.upg = { weapon: 0, base: 0, squad: 0, turret: 0 };
      this.last = performance.now();
      var self = this;
      this.loop();
      this.banner("", 0);
    },

    onEnemyKilled: function (en) {
      this.score += en.cfg.score;
      var w = KD.Config.waves[this.wave];
      var mult = w && w.dpMult ? w.dpMult : 1;
      this.dp += Math.round(en.cfg.score * KD.Config.dp.perScore * mult);
      if (en.cfg.boss) {
        this.score += 500; // ボス撃破ボーナス
        this.shake(4);
        this.sayRadio("opBossDown", 1, 3);
      }
    },

    damageBase: function (dmg, src) {
      if (this.state !== "playing") return;
      this.baseHp -= dmg;
      KD.Base.shakeKaraage(1.2);
      this.shake(0.7);
      var nowBase = performance.now();
      if (nowBase - (this._lastVoiceBase || 0) > 2500) {
        this._lastVoiceBase = nowBase;
        var line = this._baseHitAlt ? "opBaseHit2" : "voice_baseHit";
        this._baseHitAlt = !this._baseHitAlt;
        this.sayRadio(line, 0.85, 2);
      }
      if (this.baseHp <= 0) {
        this.baseHp = 0;
        this.gameover("巨大フライパンが破壊された!");
      }
    },

    damagePlayer: function (dmg, src) {
      if (this.state !== "playing") return;
      var P = KD.Player;
      if (P.dead || P.invuln > 0) return;
      var mult = this.upg && this.upg.squad >= 2 ? 0.8 : 1;
      P.hp -= dmg * mult;
      P.invuln = KD.Config.player.invulnAfterHit;
      KD.Audio.play("playerHit", { vol: 0.8 });
      var nowPlayer = performance.now();
      if (nowPlayer - (this._lastVoicePlayer || 0) > 2500) {
        this._lastVoicePlayer = nowPlayer;
        var line = this._playerHitAlt ? "opPlayerHit2" : "voice_playerHit";
        this._playerHitAlt = !this._playerHitAlt;
        this.sayRadio(line, 0.85, 2);
      }
      this.shake(1.6);
      if (P.hp <= 0) {
        P.hp = 0;
        P.dead = true;
        this.gameover("防衛官が倒された!");
      }
    },

    shake: function (m) {
      this.shakeMag = Math.max(this.shakeMag, m || 1);
    },

    announceEnemy: function () {
      var now = performance.now();
      if (now - (this._lastVoiceEnemy || 0) > 8000) {
        this._lastVoiceEnemy = now;
        KD.Audio.play("voice_enemy", { vol: 0.75 });
      }
    },

    onMuteToggle: function (muted) {
      var el = this.el.mute;
      if (!el) return;
      el.textContent = muted ? "ミュート中 (M)" : "ミュート解除 (M)";
      el.style.opacity = 1;
      clearTimeout(this._muteT);
      var self = this;
      this._muteT = setTimeout(function () { el.style.opacity = 0; }, 2000);
    },

    onPointerUnlock: function () {
      if (this.state !== "playing") return;
      this.state = "paused";
      this.showScreen("pause-screen");
    },

    pause: function () {
      if (this.state !== "playing") return;
      this.state = "paused";
      this.showScreen("pause-screen");
      if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock();
      KD.Input.endAllTouch();
    },

    resume: function () {
      if (this.state !== "paused") return;
      this.state = "playing";
      this.showScreen(null);
      KD.Input.tryLock(this.el.canvas);
    },

    startWave: function (i) {
      this.wave = i;
      var w = KD.Config.waves[i];
      this.spawnQueue = [];
      for (var g = 0; g < w.list.length; g++) {
        for (var n = 0; n < w.list[g][1]; n++) this.spawnQueue.push(w.list[g][0]);
      }
      for (var s = this.spawnQueue.length - 1; s > 0; s--) {
        var j = Math.floor(Math.random() * (s + 1));
        var tmp = this.spawnQueue[s];
        this.spawnQueue[s] = this.spawnQueue[j];
        this.spawnQueue[j] = tmp;
      }
      this.spawnTimer = 1.0;
      this.intermission = 0;
      this.boss = null;
      this.bossLowAnnounced = false;
      this._clearAnnounced = false;
      this.banner(w.message, 4);
      KD.Audio.play("alarm", { vol: 0.9 });
      KD.Audio.setStageBGM(i);
      KD.World.setDestruction(i + 1);
      // オペレーター無線: ステージ開始
      this.sayRadio("opStage" + (i + 1), 0.95, 2, 900);
      var hasBoss = false;
      for (var b = 0; b < w.list.length; b++) {
        var ec = KD.Config.enemies[w.list[b][0]];
        if (ec && ec.boss) hasBoss = true;
      }
      if (hasBoss) {
        this.sayRadio("voice_boss", 1, 3, 1800);
        var bossLine = Math.random() < 0.5 ? "opBossIn1" : "opBossIn2";
        this.sayRadio(bossLine, 0.95, 3, 3600);
      }
    },

    updateWaves: function (dt) {
      if (this.spawnQueue.length > 0) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0 && KD.Enemies.list.length < KD.Config.maxEnemies) {
          KD.Enemies.spawn(this.spawnQueue.shift());
          this.spawnTimer = 0.9 + Math.random() * 1.2;
        }
      } else if (KD.Enemies.list.length === 0) {
        if (this.wave >= KD.Config.waves.length - 1) {
          this.victory();
          return;
        }
        if (!this._clearAnnounced) {
          this._clearAnnounced = true;
          this.enterPrep();
        }
      }
    },

    update: function (dt) {
      if (this.state === "prep") {
        // 準備フェーズ: 世界フリーズ、基地の演出のみ継続
        KD.Base.update(dt, []);
        KD.World.update(dt);
        this.updateTurrets(dt, true);
        this.updateTurretBullets(dt);
        return;
      }
      if (this.state !== "playing") return;
      var lk = KD.Input.consumeLook();
      KD.Player.applyLook(lk.x, lk.y);
      if (KD.Input.reload()) KD.Player.startReload();
      this.updateWaves(dt);
      KD.Base.update(dt, KD.Enemies.list);
      KD.Enemies.update(dt);
      KD.Player.update(dt);
      this.updateTurrets(dt, false);
      this.updateTurretBullets(dt);
      this.updateSoldiers(dt);
      this.updateBoss(dt);
      this.updateIdleRadio(dt);

      if (this.shakeMag > 0.002) {
        var s = this.shakeMag;
        KD.World.camera.position.x += (Math.random() - 0.5) * s;
        KD.World.camera.position.y += (Math.random() - 0.5) * s;
        KD.World.camera.position.z += (Math.random() - 0.5) * s;
        this.shakeMag *= Math.exp(-6 * dt);
      } else {
        this.shakeMag = 0;
      }
      KD.World.update(dt);
      this.updateHUD();
    },

    updateHUD: function () {
      var P = KD.Player;
      var w = KD.Config.weapon;
      var hpPct = Math.max(0, P.hp / KD.Config.player.hp) * 100;
      this.el.hpFill.style.width = hpPct + "%";
      this.el.hpFill.style.background = hpPct > 40 ? "#4caf50" : "#e53935";
      var basePct = Math.max(0, this.baseHp / KD.Config.base.hp) * 100;
      this.el.baseFill.style.width = basePct + "%";
      this.el.baseFill.style.background = basePct > 40 ? "#ffb300" : "#e53935";
      this.el.ammo.textContent = P.reloading ? "リロード中..." : P.ammo + " / " + w.magSize;
      this.el.score.textContent = this.score;
      this.el.wave.textContent = "ステージ " + (this.wave + 1) + " / 全" + KD.Config.waves.length;
      this.el.left.textContent = KD.Enemies.list.length + this.spawnQueue.length;
      if (this.el.dp) this.el.dp.textContent = this.dp;
    },

    // ===== オペレーター無線 (単一チャネル・優先度付き) =====
    sayRadio: function (name, vol, priority, delay) {
      var self = this;
      priority = priority || 1;
      setTimeout(function () {
        if (!KD.Audio.nodes[name]) return;
        if (self.state === "title") return;
        if (self.radioBusy) {
          if (priority >= 3 && self._radioSrc) {
            try { self._radioSrc.stop(); } catch (e) {}
            self.radioBusy = false;
          } else if (priority >= 2 && !self._pendingRadio) {
            self._pendingRadio = { name: name, vol: vol };
            return;
          } else {
            return;
          }
        }
        self._playRadioNow(name, vol);
      }, delay || 0);
    },

    _playRadioNow: function (name, vol) {
      var self = this;
      var src = KD.Audio.playRadio(name, { vol: vol == null ? 0.9 : vol });
      if (!src) return;
      self._radioSrc = src;
      self.radioBusy = true;
      var origEnd = src.onended;
      src.onended = function () {
        if (origEnd) origEnd();
        self.radioBusy = false;
        self._radioSrc = null;
        if (self._pendingRadio) {
          var p = self._pendingRadio;
          self._pendingRadio = null;
          self._playRadioNow(p.name, p.vol);
        }
      };
    },

    updateIdleRadio: function (dt) {
      this.idleTimer -= dt;
      if (this.idleTimer > 0) return;
      this.idleTimer = 20 + Math.random() * 20;
      if (this.radioBusy) return;
      var n = Math.floor(Math.random() * 8) + 1;
      var name = "opIdle" + (n < 10 ? "0" : "") + n;
      this.sayRadio(name, 0.8, 1);
    },

    updateBoss: function (dt) {
      var list = KD.Enemies.list;
      if (!this.boss) {
        for (var i = 0; i < list.length; i++) {
          if (list[i].cfg.boss) { this.boss = list[i]; break; }
        }
      }
      if (!this.boss || this.boss.dead) {
        this.boss = null;
        return;
      }
      if (!this.bossLowAnnounced && this.boss.hp < this.boss.maxHp * 0.5) {
        this.bossLowAnnounced = true;
        this.sayRadio("opBossLow", 1, 3, 400);
      }
    },

    // ===== タレット / 支援兵 =====
    updateTurrets: function (dt, idle) {
      for (var i = 0; i < this.turrets.length; i++) {
        var t = this.turrets[i];
        t.fireTimer -= dt;
        var target = null, best = 1e9;
        if (!idle) {
          var list = KD.Enemies.list;
          for (var e = 0; e < list.length; e++) {
            var en = list[e];
            if (en.dead) continue;
            var d = Math.hypot(en.pos.x - t.group.position.x, en.pos.z - t.group.position.z);
            if (d < 130 && d < best) { best = d; target = en; }
          }
        }
        if (target) {
          var want = Math.atan2(target.pos.x - t.group.position.x, target.pos.z - t.group.position.z);
          var diff = want - t.aim;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          t.aim += diff * Math.min(1, dt * 6);
          if (t.fireTimer <= 0) {
            t.fireTimer = 0.9;
            t.fire(target);
          }
        }
        t.head.rotation.y = t.aim;
      }
    },

    updateSoldiers: function (dt) {
      var P = KD.Player;
      var n = this.soldiers.length;
      for (var i = 0; i < n; i++) {
        var s = this.soldiers[i];
        var ang = performance.now() * 0.001 + i * (Math.PI * 2 / Math.max(1, n));
        var rx = -Math.sin(P.yaw) * 3.2 - Math.cos(ang) * 1.6;
        var rz = -Math.cos(P.yaw) * 3.2 - Math.sin(ang) * 1.6;
        s.group.position.x += (P.pos.x + rx - s.group.position.x) * Math.min(1, dt * 5);
        s.group.position.z += (P.pos.z + rz - s.group.position.z) * Math.min(1, dt * 5);
        s.group.rotation.y = P.yaw;
        s.group.position.y = Math.abs(Math.sin(performance.now() * 0.006 + i)) * 0.25;
      }
    },

    // ===== 準備フェーズ =====
    enterPrep: function () {
      this.state = "prep";
      this._clearAnnounced = true;
      if (document.exitPointerLock) document.exitPointerLock();
      KD.Input.enabled = false;
      this.el.prepTitle.textContent = "ステージ " + (this.wave + 1) + " 制圧 — 準備フェーズ";
      this.banner("", 0);
      this.updatePrepUI();
      this.showScreen("prep-screen");
      KD.Audio.play("alarm", { vol: 0.4 });
    },

    finishPrep: function () {
      if (this.state !== "prep") return;
      this.state = "playing";
      this.showScreen(null);
      KD.Input.enabled = true;
      KD.Input.tryLock(this.el.canvas);
      this.startWave(this.wave + 1);
    },

    updatePrepUI: function () {
      var keys = ["weapon", "base", "squad", "turret"];
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        var cfg = KD.Config.upgrades[k];
        var lv = this.upg[k];
        var b = this.el.prepButtons[k];
        b.name.textContent = cfg.name;
        b.lv.textContent = "Lv" + lv + " / 2";
        if (lv >= 2) {
          b.desc.textContent = "MAX";
          b.cost.textContent = "—";
          b.root.classList.add("maxed");
          b.root.classList.remove("disabled");
        } else {
          b.desc.textContent = cfg.desc[lv];
          b.cost.textContent = cfg.cost + " DP";
          b.root.classList.remove("maxed");
          b.root.classList.toggle("disabled", this.dp < cfg.cost);
        }
      }
      if (this.el.prepDp) this.el.prepDp.textContent = this.dp;
      if (this.el.dp) this.el.dp.textContent = this.dp;
    },

    buyUpgrade: function (k) {
      if (this.state !== "prep") return;
      var cfg = KD.Config.upgrades[k];
      if (this.upg[k] >= 2 || this.dp < cfg.cost) {
        if (this.upg[k] >= 2) this.sayRadio("opUpMax", 0.9, 1);
        return;
      }
      this.dp -= cfg.cost;
      this.upg[k]++;
      if (k === "weapon") this.applyWeaponStats();
      else if (k === "base") {
        var heal = this.upg.base === 1 ? 200 : 400;
        this.baseHp = Math.min(KD.Config.base.hp + this._baseHpBonus(), this.baseHp + heal);
      } else if (k === "squad") this.addSoldier();
      else if (k === "turret") this.addTurret();
      var line = { weapon: "opUpWeapon", base: "opUpBase", squad: "opUpSquad", turret: "opUpTurret" }[k];
      this.sayRadio(line, 0.9, 1);
      this.updatePrepUI();
      this.updateHUD();
    },

    _baseHpBonus: function () {
      return this.upg.base === 1 ? 300 : this.upg.base === 2 ? 700 : 0;
    },

    applyWeaponStats: function () {
      var w = KD.Config.weapon;
      if (this.upg.weapon >= 1) {
        w.damage = 15;
        w.fireInterval = 0.11;
      } else {
        w.damage = 12;
        w.fireInterval = 0.11;
      }
      if (this.upg.weapon >= 2) {
        w.damage = 19;
        w.fireInterval = 0.11 * 0.8;
      }
    },

    addSoldier: function () {
      var scene = KD.World.scene;
      var g = new THREE.Group();
      var body = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 1.5, 0.7),
        new THREE.MeshLambertMaterial({ color: 0x2e7fd6 })
      );
      body.position.y = 1.2;
      body.castShadow = true;
      g.add(body);
      var head = new THREE.Mesh(
        new THREE.SphereGeometry(0.42, 10, 10),
        new THREE.MeshLambertMaterial({ color: 0xd8b088 })
      );
      head.position.y = 2.3;
      g.add(head);
      var helmet = new THREE.Mesh(
        new THREE.SphereGeometry(0.46, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshLambertMaterial({ color: 0x16324f })
      );
      helmet.position.y = 2.35;
      g.add(helmet);
      scene.add(g);
      this.soldiers.push({ group: g });
      if (this.upg.squad === 1) KD.Player.hp = Math.min(KD.Config.player.hp + 20, KD.Player.hp + 20);
    },

    addTurret: function () {
      var scene = KD.World.scene;
      var idx = this.turrets.length;
      var ang = idx === 0 ? Math.PI / 4 : Math.PI * 1.25;
      var rad = KD.Config.base.panRadius + 9;
      var g = new THREE.Group();
      var pedestal = new THREE.Mesh(
        new THREE.CylinderGeometry(2.2, 2.8, 2.4, 12),
        new THREE.MeshLambertMaterial({ color: 0x1e3a5f })
      );
      pedestal.position.y = 1.2;
      pedestal.castShadow = true;
      g.add(pedestal);
      var head = new THREE.Group();
      head.position.y = 3.0;
      var dome = new THREE.Mesh(
        new THREE.SphereGeometry(1.5, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshLambertMaterial({ color: 0x2e7fd6 })
      );
      head.add(dome);
      var barrel = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.5, 4.5),
        new THREE.MeshLambertMaterial({ color: 0x16324f })
      );
      barrel.position.set(0, 0.4, -2.2);
      head.add(barrel);
      g.add(head);
      g.position.set(Math.cos(ang) * rad, 0, Math.sin(ang) * rad);
      scene.add(g);
      var self = this;
      var tDmg = self.upg.turret >= 2 ? 5 : 4;
      var t = {
        group: g,
        head: head,
        aim: ang + Math.PI,
        fireTimer: 1.0,
        fire: function (target) {
          var origin = new THREE.Vector3();
          barrel.getWorldPosition(origin);
          var dir = new THREE.Vector3(target.pos.x - origin.x, (target.pos.y + 6) - origin.y, target.pos.z - origin.z);
          dir.normalize();
          var mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.4, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0x7adfff })
          );
          mesh.position.copy(origin);
          scene.add(mesh);
          self._turretBullets.push({ mesh: mesh, pos: origin, vel: dir.multiplyScalar(140), life: 1.6, dmg: tDmg });
          KD.Audio.play("shoot", { vol: 0.25, rate: 0.8 });
        },
      };
      this.turrets.push(t);
    },

    updateTurretBullets: function (dt) {
      var Enemies = KD.Enemies;
      var scene = KD.World.scene;
      for (var i = this._turretBullets.length - 1; i >= 0; i--) {
        var b = this._turretBullets[i];
        b.life -= dt;
        b.pos.addScaledVector(b.vel, dt);
        b.mesh.position.copy(b.pos);
        var remove = b.life <= 0 || b.pos.y < 0.2;
        var hit = false;
        if (!remove) {
          for (var e = 0; e < Enemies.list.length; e++) {
            var en = Enemies.list[e];
            if (en.dead) continue;
            var rad = en.cfg.billboardH * 0.42 + 2;
            var dy = b.pos.y - (en.pos.y + (en.cfg.fly ? 0 : en.cfg.billboardH * 0.5));
            if (Math.hypot(b.pos.x - en.pos.x, b.pos.z - en.pos.z) < rad && Math.abs(dy) < rad * 0.9) {
              hit = true;
              remove = true;
              Enemies.damage(en, b.dmg);
              KD.Audio.play("hit", { vol: 0.3, rate: 1.1 });
              break;
            }
          }
        }
        if (remove) {
          scene.remove(b.mesh);
          this._turretBullets.splice(i, 1);
        }
      }
    },

    banner: function (text, dur) {
      this.el.msg.textContent = text || "";
      this.bannerTimer = dur || 3;
      this.el.msg.style.opacity = text ? 1 : 0;
    },

    start: function () {
      var cfg = KD.Config;
      this.score = 0;
      this.dp = 0;
      this.baseHp = cfg.base.hp;
      this.wave = -1;
      this.spawnQueue = [];
      this.spawnTimer = 0;
      this.intermission = 0;
      this.shakeMag = 0;
      this.upg = { weapon: 0, base: 0, squad: 0, turret: 0 };
      this.boss = null;
      this.bossLowAnnounced = false;
      this.radioBusy = false;
      this._pendingRadio = null;
      this._radioSrc = null;
      this.idleTimer = 15;
      this._lastVoiceBase = 0;
      this._lastVoicePlayer = 0;
      this._lastVoiceEnemy = 0;
      this._baseHitAlt = false;
      this._playerHitAlt = false;
      this.state = "playing";

      // タレット / 支援兵 / 弾を掃除
      for (var t = 0; t < this.turrets.length; t++) KD.World.scene.remove(this.turrets[t].group);
      this.turrets.length = 0;
      for (var s = 0; s < this.soldiers.length; s++) KD.World.scene.remove(this.soldiers[s].group);
      this.soldiers.length = 0;
      for (var tb = 0; tb < this._turretBullets.length; tb++) KD.World.scene.remove(this._turretBullets[tb].mesh);
      this._turretBullets.length = 0;

      this.applyWeaponStats();
      KD.World.setDestruction(1);

      for (var i = 0; i < KD.Enemies.list.length; i++) {
        KD.Enemies.kill(KD.Enemies.list[i]);
      }
      for (var p = 0; p < KD.Enemies.projectiles.length; p++) {
        KD.Enemies.scene.remove(KD.Enemies.projectiles[p].mesh);
      }
      KD.Enemies.projectiles.length = 0;

      KD.Player.reset();
      KD.Input.enabled = true;
      KD.Input.autoFire = false;
      if (this.el.btnFire) {
        this.el.btnFire.textContent = "射撃 OFF";
        this.el.btnFire.classList.remove("on");
      }
      this.showScreen(null);
      KD.Audio.resume();
      KD.Audio.startGameAudio();
      KD.Audio.play("voice_briefing", { vol: 1 });
      this.startWave(0);
      KD.Input.tryLock(this.el.canvas);
      var self = this;
      setTimeout(function () {
        if (self.state !== "playing") return;
        if (KD.Input.isTouch) {
          self.banner("左: ジョイスティック移動 / 右: ドラッグで視点 / 右下: 射撃切替", 8);
        } else if (KD.Input.fallback) {
          self.banner("左ドラッグ: 視点 / 右クリック: 射撃 / WASD移動 / Rリロード", 8);
        } else if (!KD.Input.locked) {
          self.banner("画面をクリックしてマウスをロック (WASD移動 / 左クリック射撃 / Rリロード)", 8);
        }
      }, 500);
    },

    gameover: function (msg) {
      if (this.state === "gameover") return;
      this.state = "gameover";
      KD.Input.enabled = false;
      if (document.exitPointerLock) document.exitPointerLock();
      KD.Audio.stopStageBGM();
      KD.Audio.stopLoop("amb");
      KD.Audio.play("death", { vol: 0.9 });
      KD.Audio.play("voice_gameover", { vol: 1 });
      this.el.overMsg.textContent = msg;
      this.el.overScore.textContent = this.score;
      this.showScreen("gameover-screen");
    },

    victory: function () {
      if (this.state === "victory") return;
      this.state = "victory";
      KD.Input.enabled = false;
      if (document.exitPointerLock) document.exitPointerLock();
      KD.Audio.stopStageBGM();
      KD.Audio.play("voice_victory", { vol: 1 });
      this.el.vicScore.textContent = this.score;
      this.showScreen("victory-screen");
    },

    showScreen: function (id) {
      var screens = this.el.screens;
      Array.prototype.forEach.call(screens, function (s) {
        s.classList.toggle("show", s.id === id);
      });
      this.el.hud.style.display = (this.state === "playing" || this.state === "paused" || this.state === "prep") ? "block" : "none";
      this.el.cross.style.display = this.state === "playing" ? "block" : "none";
    },

    loop: function () {
      requestAnimationFrame(function () { KD.Main.loop(); });
      var now = performance.now();
      var dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      if (this.bannerTimer > 0) {
        this.bannerTimer -= dt;
        if (this.bannerTimer <= 0) this.el.msg.style.opacity = 0;
      }
      this.update(dt);
      KD.World.render();
    }
  };

  window.KD.Main = Main;
  window.KD.UI = Main;
})();
