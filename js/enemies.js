/* 唐揚げ防衛隊 - 敵怪獣5種 (ビリボード表現) */
window.KD = window.KD || {};

(function () {
  var texCache = {};

  function fallbackTexture(type) {
    var c = document.createElement("canvas");
    c.width = c.height = 256;
    var g = c.getContext("2d");
    var colors = { raptor: "#4f7a3a", ptera: "#6a4f8a", squid: "#3a6a7a", mosa: "#3a5f7a", tera: "#7a3a3a" };
    g.fillStyle = colors[type] || "#666";
    g.beginPath();
    g.ellipse(128, 140, 95, 85, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#ffd24a";
    g.beginPath(); g.arc(95, 110, 14, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(161, 110, 14, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#1a1a1a";
    g.beginPath(); g.arc(95, 110, 6, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(161, 110, 6, 0, Math.PI * 2); g.fill();
    return new THREE.CanvasTexture(c);
  }

  function loadTex(type, url) {
    if (texCache[type]) return texCache[type];
    var t;
    t = new THREE.Texture();
    var loader = new THREE.TextureLoader();
    loader.load(
      url,
      function (loaded) {
        t.image = loaded.image;
        t.needsUpdate = true;
      },
      undefined,
      function () {
        var fb = fallbackTexture(type);
        t.image = fb.image;
        t.needsUpdate = true;
      }
    );
    texCache[type] = t;
    return t;
  }

  function DebrisSystem() {
    this.count = 320;
    this.pos = new Float32Array(this.count * 3);
    this.vel = new Float32Array(this.count * 3);
    this.life = new Float32Array(this.count);
    this.color = new Float32Array(this.count * 3);
    for (var i = 0; i < this.count; i++) this.pos[i * 3 + 1] = -100;
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(this.color, 3));
    var mat = new THREE.PointsMaterial({
      size: 1.8, vertexColors: true, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.cursor = 0;
  }

  DebrisSystem.prototype.emit = function (x, y, z, r, g, b, n) {
    for (var i = 0; i < n; i++) {
      var idx = this.cursor;
      this.cursor = (this.cursor + 1) % this.count;
      this.pos[idx * 3] = x + (Math.random() - 0.5) * 6;
      this.pos[idx * 3 + 1] = y + (Math.random() - 0.5) * 6;
      this.pos[idx * 3 + 2] = z + (Math.random() - 0.5) * 6;
      var a = Math.random() * Math.PI * 2;
      var sp = 8 + Math.random() * 16;
      this.vel[idx * 3] = Math.cos(a) * sp;
      this.vel[idx * 3 + 1] = 6 + Math.random() * 14;
      this.vel[idx * 3 + 2] = Math.sin(a) * sp;
      this.life[idx] = 1;
      this.color[idx * 3] = r * (0.7 + Math.random() * 0.3);
      this.color[idx * 3 + 1] = g * (0.7 + Math.random() * 0.3);
      this.color[idx * 3 + 2] = b * (0.7 + Math.random() * 0.3);
    }
  };

  DebrisSystem.prototype.update = function (dt) {
    for (var i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt * 0.9;
      if (this.life[i] <= 0) {
        this.pos[i * 3 + 1] = -100;
        this.color[i * 3] = this.color[i * 3 + 1] = this.color[i * 3 + 2] = 0;
        continue;
      }
      this.vel[i * 3 + 1] -= 26 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.2) {
        this.pos[i * 3 + 1] = 0.2;
        this.vel[i * 3 + 1] *= -0.35;
      }
      var f = this.life[i];
      this.color[i * 3] *= 0.985;
      this.color[i * 3 + 1] *= 0.985;
      this.color[i * 3 + 2] *= 0.985;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  };

  var Enemies = {
    list: [],
    projectiles: [],
    debris: null,
    scene: null,

    init: function (scene) {
      this.scene = scene;
      this.debris = new DebrisSystem();
      scene.add(this.debris.points);
    },

    spawn: function (type) {
      var cfg = KD.Config.enemies[type];
      if (!cfg) return null;
      var ang = Math.random() * Math.PI * 2;
      var dist = KD.Config.spawnRingMin + Math.random() * (KD.Config.spawnRingMax - KD.Config.spawnRingMin);
      var pos = new THREE.Vector3(Math.cos(ang) * dist, 0, Math.sin(ang) * dist);

      var w = cfg.billboardW || cfg.billboardH;
      var tex = loadTex(type, cfg.img);
      var mat = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false,
      });
      var mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, cfg.billboardH), mat);
      mesh.renderOrder = 5;

      var coat = new THREE.Mesh(
        new THREE.PlaneGeometry(w * 1.02, cfg.billboardH * 1.02),
        new THREE.MeshBasicMaterial({
          map: tex, color: 0x2e8fff, transparent: true, opacity: 0,
          side: THREE.DoubleSide, depthWrite: false,
        })
      );
      coat.position.z = 0.15;
      mesh.add(coat);

      var shadow = new THREE.Mesh(
        new THREE.CircleGeometry(cfg.billboardH * 0.28, 24),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false })
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.08;

      var en = {
        type: type,
        cfg: cfg,
        pos: pos,
        mesh: mesh,
        shadow: shadow,
        coat: coat,
        hp: cfg.hp,
        maxHp: cfg.hp,
        state: "seek",
        stateTime: 0,
        cooldown: 1.5 + Math.random() * 2,
        strikeDir: new THREE.Vector3(),
        strikeTarget: new THREE.Vector3(),
        strikeDamageDone: false,
        tare: 0,
        coated: false,
        coatedTime: 0,
        flash: 0,
        phase: Math.random() * Math.PI * 2,
        dead: false,
        onCoated: function (e) { e.coat.material.opacity = 0.42; },
        onUncoated: function (e) { e.coat.material.opacity = 0; },
      };
      mesh.position.copy(pos);
      if (cfg.fly) mesh.position.y = cfg.flyHeight;

      this.scene.add(mesh);
      this.scene.add(shadow);
      this.list.push(en);
      return en;
    },

    damage: function (en, dmg) {
      if (en.dead) return false;
      var d = dmg * (en.coated ? KD.Config.base.tareDamageMult : 1);
      en.hp -= d;
      en.flash = 0.12;
      if (en.hp <= 0) {
        en.dead = true;
        this.kill(en);
        return true;
      }
      return false;
    },

    kill: function (en) {
      this.scene.remove(en.mesh);
      this.scene.remove(en.shadow);
      var c = { raptor: [0.5, 0.8, 0.4], ptera: [0.7, 0.5, 0.9], squid: [0.4, 0.8, 0.9], mosa: [0.4, 0.6, 0.9], tera: [0.9, 0.5, 0.4] };
      var col = c[en.type] || [1, 0.7, 0.3];
      this.debris.emit(en.pos.x, en.pos.y + (en.cfg.fly ? 0 : 6), en.pos.z, col[0], col[1], col[2], en.cfg.boss ? 90 : 40);
      KD.Audio.play("death", { vol: en.cfg.boss ? 1.0 : 0.7 });
      if (window.KD.Main) KD.Main.onEnemyKilled(en);
      var i = this.list.indexOf(en);
      if (i >= 0) this.list.splice(i, 1);
    },

    windupFor: function (en) {
      var c = en.cfg;
      if (c.attack === "lunge") return c.lungeWindup;
      if (c.attack === "dive") return c.diveWindup;
      if (c.attack === "charge") return 0.8;
      if (c.attack === "tentacle") return c.tentacleWindup;
      if (c.attack === "stomp") return c.stompWindup;
      return 0.8;
    },

    fireTentacle: function (en, tx, tz) {
      var from = new THREE.Vector3(en.pos.x, en.pos.y + 14, en.pos.z);
      var to = new THREE.Vector3(tx, 3, tz);
      var dir = to.clone().sub(from);
      var dist = dir.length();
      dir.normalize().multiplyScalar(46);
      var mesh = new THREE.Mesh(
        new THREE.ConeGeometry(2.2, 9, 8),
        new THREE.MeshLambertMaterial({ color: 0x4a9aa8, emissive: 0x1a4a52 })
      );
      mesh.position.copy(from);
      this.scene.add(mesh);
      this.projectiles.push({
        mesh: mesh,
        pos: from,
        vel: dir,
        life: dist / 46 + 1.5,
      });
      KD.Audio.play("spray", { vol: 0.45, rate: 0.6 });
    },

    doStomp: function (en) {
      var r = en.cfg.stompRange + 6;
      this.debris.emit(en.pos.x, 1, en.pos.z, 0.6, 0.5, 0.35, 36);
      KD.Audio.play("death", { vol: 0.55, rate: 0.7 });
      var Main = window.KD.Main;
      var Player = window.KD.Player;
      if (Main && Player && !Player.dead) {
        var d = Math.hypot(Player.pos.x - en.pos.x, Player.pos.z - en.pos.z);
        if (d < r) Main.damagePlayer(en.cfg.damage, en.pos);
      }
      if (Math.hypot(en.pos.x, en.pos.z) < r + 20) {
        if (Main) Main.damageBase(en.cfg.damage * 0.6, en.pos);
      }
      if (Main) Main.shake(r * 0.02);
    },

    update: function (dt) {
      var cfg = KD.Config;
      var player = window.KD.Player;
      var Main = window.KD.Main;
      var cam = KD.World ? KD.World.camera : null;
      var px = player && player.pos ? player.pos.x : 0;
      var pz = player && player.pos ? player.pos.z : 0;

      for (var i = this.list.length - 1; i >= 0; i--) {
        var en = this.list[i];
        if (en.dead) continue;
        var c = en.cfg;
        if (en.flash > 0) en.flash -= dt;
        en.mesh.material.color.setScalar(en.flash > 0 ? 1 + en.flash * 6 : 1);

        var speed = c.speed * (en.coated ? cfg.base.tareSpeedMult : 1);
        var dBase = Math.hypot(en.pos.x, en.pos.z) || 1;

        if (en.state === "seek") {
          if (c.fly) {
            var dr = dBase;
            var targetR = 90;
            var radial = (targetR - dr) * 0.7;
            var tx2 = -en.pos.z / dr;
            var tz2 = en.pos.x / dr;
            en.pos.x += (tx2 * speed + (en.pos.x / dr) * radial) * dt;
            en.pos.z += (tz2 * speed + (en.pos.z / dr) * radial) * dt;
          } else if (dBase > 7) {
            en.pos.x += (-en.pos.x / dBase) * speed * dt;
            en.pos.z += (-en.pos.z / dBase) * speed * dt;
          }
          en.cooldown -= dt;
          if (en.cooldown <= 0) {
            var inRange = c.fly
              ? Math.hypot(en.pos.x - px, en.pos.z - pz) < 70
              : dBase < 70;
            if (inRange && !player.dead) {
              en.state = "windup";
              en.stateTime = this.windupFor(en);
              if (Main) Main.announceEnemy();
              en.strikeDamageDone = false;
              if (c.attack === "stomp" || c.attack === "dive") {
                KD.Audio.play("roar", { vol: c.boss ? 1.0 : 0.6 });
              }
            }
          }
        } else if (en.state === "windup") {
          en.stateTime -= dt;
          if (en.stateTime <= 0) {
            en.state = "strike";
            if (c.attack === "lunge") {
              var dx = px - en.pos.x, dz = pz - en.pos.z;
              var dl = Math.hypot(dx, dz) || 1;
              en.strikeDir.set(dx / dl, 0, dz / dl);
              en.stateTime = 1.1;
            } else if (c.attack === "dive") {
              en.strikeTarget.set(px, 0, pz);
              en.stateTime = 1.3;
            } else if (c.attack === "charge") {
              var cx = -en.pos.x, cz = -en.pos.z;
              var cl = Math.hypot(cx, cz) || 1;
              en.strikeDir.set(cx / cl, 0, cz / cl);
              en.stateTime = c.chargeTime;
            } else if (c.attack === "tentacle") {
              this.fireTentacle(en, px, pz);
              en.stateTime = 0.4;
            } else if (c.attack === "stomp") {
              en.stateTime = 0.3;
              this.doStomp(en);
            }
          }
        } else if (en.state === "strike") {
          en.stateTime -= dt;
          if (c.attack === "lunge") {
            en.pos.x += en.strikeDir.x * c.lungeSpeed * dt;
            en.pos.z += en.strikeDir.z * c.lungeSpeed * dt;
            if (!en.strikeDamageDone && player && !player.dead) {
              if (Math.hypot(en.pos.x - px, en.pos.z - pz) < c.attackRange + 4) {
                if (Main) Main.damagePlayer(c.damage, en.pos);
                en.strikeDamageDone = true;
              }
            }
          } else if (c.attack === "dive") {
            var ddx = en.strikeTarget.x - en.pos.x;
            var ddz = en.strikeTarget.z - en.pos.z;
            var ddl = Math.hypot(ddx, ddz) || 1;
            en.pos.x += (ddx / ddl) * c.diveSpeed * dt;
            en.pos.z += (ddz / ddl) * c.diveSpeed * dt;
            if (en.stateTime <= 0) {
              if (!en.strikeDamageDone && player && !player.dead) {
                if (Math.hypot(px - en.strikeTarget.x, pz - en.strikeTarget.z) < 14) {
                  if (Main) Main.damagePlayer(c.damage, en.pos);
                }
              }
            }
          } else if (c.attack === "charge") {
            en.pos.x += en.strikeDir.x * c.chargeSpeed * dt;
            en.pos.z += en.strikeDir.z * c.chargeSpeed * dt;
            if (!en.strikeDamageDone) {
              if (dBase < cfg.base.panRadius + 6) {
                if (Main) Main.damageBase(c.damage, en.pos);
                en.strikeDamageDone = true;
              } else if (player && !player.dead) {
                if (Math.hypot(en.pos.x - px, en.pos.z - pz) < c.attackRange + 5) {
                  if (Main) Main.damagePlayer(c.damage * 0.8, en.pos);
                  en.strikeDamageDone = true;
                }
              }
            }
          }
          if (en.stateTime <= 0 && c.attack !== "stomp" && c.attack !== "tentacle") {
            en.state = "recover";
            en.stateTime = 0.9;
            en.cooldown = c.lungeCooldown || c.attackInterval;
          }
        } else if (en.state === "recover") {
          en.stateTime -= dt;
          if (dBase > 20) {
            en.pos.x += (-en.pos.x / dBase) * speed * 0.4 * dt;
            en.pos.z += (-en.pos.z / dBase) * speed * 0.4 * dt;
          }
          if (en.stateTime <= 0) {
            en.state = "seek";
            en.cooldown = c.attackInterval;
          }
        }

        if (!c.fly) {
          en.pos.y = 0;
        } else {
          var ty = c.flyHeight + Math.sin(performance.now() * 0.001 + en.pos.x * 0.01) * 3;
          if (en.state === "seek" || en.state === "recover") en.pos.y += (ty - en.pos.y) * Math.min(1, dt * 2);
        }

        var gr = cfg.world.groundRadius - 12;
        var rd = Math.hypot(en.pos.x, en.pos.z);
        if (rd > gr) {
          en.pos.x *= gr / rd;
          en.pos.z *= gr / rd;
        }

        // プロシージャルモーション (billboard にバウンス・スウェイ・スクワッシュ)
        var t = performance.now() * 0.001;
        var moving = (en.state === "seek" || en.state === "recover") ? 1 : 0;
        var bobAmp = c.fly ? 3.0 : c.billboardH * 0.03;
        var bob = Math.sin(t * (c.fly ? 2.2 : 6.0) + en.phase) * bobAmp * (moving || 1);
        var sway = Math.sin(t * 1.6 + en.phase) * 0.04;
        var scaleY = 1, scaleX = 1;
        if (en.state === "windup") {
          var wp = 1 - (en.stateTime / Math.max(0.001, this.windupFor(en)));
          scaleY = 1 - wp * 0.22;
          scaleX = 1 + wp * 0.16;
        } else if (en.state === "strike") {
          var sp = Math.min(1, (1 - en.stateTime) / 0.5);
          scaleY = 1 + sp * 0.12;
          scaleX = 1 - sp * 0.06;
        }
        if (c.fly) {
          // 羽ばたき
          var flap = Math.sin(t * 9 + en.phase) * 0.12;
          scaleY *= (1 + flap);
          bob = Math.sin(t * 1.8 + en.phase) * 4.5;
        }
        en.mesh.scale.set(scaleX, scaleY, 1);
        var baseY = en.pos.y + (c.fly ? 0 : c.billboardH * 0.5);
        en.mesh.position.set(en.pos.x, baseY + bob, en.pos.z);
        if (cam) {
          // 注: lookAt+rotation.z 書き込みは yaw±90°超でオイラー特異点に落ち
          // スプライトが逆さまになるため、Euler直接入力+クォータニオンrollにする
          var bang = Math.atan2(cam.position.x - en.pos.x, cam.position.z - en.pos.z);
          en.mesh.rotation.set(0, bang, 0);
          en.mesh.rotateZ(sway);
        }
        en.shadow.position.set(en.pos.x, 0.08, en.pos.z);
        en.shadow.material.opacity = c.fly ? 0.18 : 0.4;
        if (!c.fly) {
          var sh = 1 - Math.abs(bob) / (c.billboardH * 0.5 + 1);
          en.shadow.scale.setScalar(Math.max(0.6, sh));
        }
      }

      for (var j = this.list.length - 1; j >= 0; j--) {
        var a = this.list[j];
        for (var k = j - 1; k >= 0; k--) {
          var b = this.list[k];
          if (a.cfg.fly !== b.cfg.fly) continue;
          var sx = a.pos.x - b.pos.x;
          var sz = a.pos.z - b.pos.z;
          var sd = Math.hypot(sx, sz);
          var minD = (a.cfg.billboardH + b.cfg.billboardH) * 0.35;
          if (sd > 0.001 && sd < minD) {
            var push = (minD - sd) * 0.5;
            sx /= sd; sz /= sd;
            a.pos.x += sx * push; a.pos.z += sz * push;
            b.pos.x -= sx * push; b.pos.z -= sz * push;
          }
        }
      }

      for (var p = this.projectiles.length - 1; p >= 0; p--) {
        var pr = this.projectiles[p];
        pr.life -= dt;
        pr.vel.y -= 6 * dt;
        pr.pos.addScaledVector(pr.vel, dt);
        pr.mesh.position.copy(pr.pos);
        pr.mesh.lookAt(pr.pos.clone().add(pr.vel));
        var hit = pr.life <= 0 || pr.pos.y < 0.5;
        if (!hit) {
          if (Math.hypot(pr.pos.x, pr.pos.z) < cfg.base.panRadius + 4) hit = true;
          if (player && !player.dead &&
            Math.hypot(pr.pos.x - px, pr.pos.z - pz) < 4) {
            if (Main) Main.damagePlayer(14, pr.pos);
            hit = true;
          }
        }
        if (hit) {
          this.scene.remove(pr.mesh);
          this.projectiles.splice(p, 1);
          this.debris.emit(pr.pos.x, Math.max(1, pr.pos.y), pr.pos.z, 0.4, 0.8, 0.9, 14);
          if (Math.hypot(pr.pos.x, pr.pos.z) < cfg.base.panRadius + 8) {
            if (Main) Main.damageBase(16, pr.pos);
          }
          KD.Audio.play("hit", { vol: 0.5, rate: 0.8 });
        }
      }

      this.debris.update(dt);
    },
  };

  window.KD.Enemies = Enemies;
})();
