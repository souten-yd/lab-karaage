/* 唐揚げ防衛隊 - 拠点: 巨大フライパンと唐揚げ、タレスプリンカー */
window.KD = window.KD || {};

(function () {
  function makeKaraageFallback() {
    var c = document.createElement("canvas");
    c.width = c.height = 256;
    var g = c.getContext("2d");
    g.fillStyle = "#d98a2b";
    g.beginPath(); g.arc(128, 128, 100, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#b05e14";
    for (var i = 0; i < 14; i++) {
      g.beginPath();
      g.arc(70 + Math.random() * 116, 70 + Math.random() * 116, 14 + Math.random() * 18, 0, Math.PI * 2);
      g.fill();
    }
    return new THREE.CanvasTexture(c);
  }

  function SpraySystem() {
    this.count = 240;
    this.pos = new Float32Array(this.count * 3);
    this.vel = new Float32Array(this.count * 3);
    this.life = new Float32Array(this.count);
    this.color = new Float32Array(this.count * 3);
    for (var i = 0; i < this.count; i++) this.pos[i * 3 + 1] = -100;
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(this.color, 3));
    var mat = new THREE.PointsMaterial({
      size: 1.0, vertexColors: true, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.cursor = 0;
  }

  SpraySystem.prototype.emit = function (x, y, z, dirX, dirZ, n, spread) {
    for (var i = 0; i < n; i++) {
      var idx = this.cursor;
      this.cursor = (this.cursor + 1) % this.count;
      var a = Math.atan2(dirZ, dirX) + (Math.random() - 0.5) * spread;
      var sp = 14 + Math.random() * 10;
      this.pos[idx * 3] = x;
      this.pos[idx * 3 + 1] = y;
      this.pos[idx * 3 + 2] = z;
      this.vel[idx * 3] = Math.cos(a) * sp;
        this.vel[idx * 3 + 1] = 2 + Math.random() * 3;
        this.vel[idx * 3 + 2] = Math.sin(a) * sp;
        this.life[idx] = 1.0;
        this.color[idx * 3] = 0.2;
        this.color[idx * 3 + 1] = 0.55;
        this.color[idx * 3 + 2] = 1.0;
    };
  };

  SpraySystem.prototype.update = function (dt) {
    for (var i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt * 1.4;
      if (this.life[i] <= 0) {
        this.pos[i * 3 + 1] = -100;
        this.color[i * 3] = this.color[i * 3 + 1] = this.color[i * 3 + 2] = 0;
        continue;
      }
      this.vel[i * 3 + 1] -= 22 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.1) {
        this.pos[i * 3 + 1] = 0.1;
        this.vel[i * 3 + 1] = 0;
      }
      var f = this.life[i];
      this.color[i * 3] = 0.2 * f;
      this.color[i * 3 + 1] = 0.55 * f;
      this.color[i * 3 + 2] = 1.0 * f;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  };

  var Base = {
    group: null,
    karaage: null,
    karaageTex: null,
    spray: null,
    steam: null,
    steamLife: null,
    sprayTimer: 0,
    tareRing: null,
    time: 0,
    eating: false,

    init: function (scene) {
      var cfg = KD.Config.base;
      this.group = new THREE.Group();

      var pedestal = new THREE.Mesh(
        new THREE.CylinderGeometry(cfg.panRadius + 4.5, cfg.panRadius + 6, cfg.pedestalHeight, 48),
        new THREE.MeshLambertMaterial({ color: 0x1e3a5f })
      );
      pedestal.position.y = cfg.pedestalHeight / 2;
      pedestal.castShadow = true;
      pedestal.receiveShadow = true;
      this.group.add(pedestal);

      var rim = new THREE.Mesh(
        new THREE.TorusGeometry(cfg.panRadius, 0.8, 14, 64),
        new THREE.MeshLambertMaterial({ color: 0x9fc4e8, emissive: 0x1a4a7a })
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.y = cfg.pedestalHeight + cfg.panRimHeight;
      rim.castShadow = true;
      this.group.add(rim);

      var panBottom = new THREE.Mesh(
        new THREE.CylinderGeometry(cfg.panRadius, cfg.panRadius - 0.6, 0.7, 48),
        new THREE.MeshLambertMaterial({ color: 0x6a94c4 })
      );
      panBottom.position.y = cfg.pedestalHeight + 0.35;
      panBottom.receiveShadow = true;
      this.group.add(panBottom);

      var handle = new THREE.Mesh(
        new THREE.BoxGeometry(9, 1.2, 2.4),
        new THREE.MeshLambertMaterial({ color: 0x16324f })
      );
      handle.position.set(cfg.panRadius + 5, cfg.pedestalHeight + cfg.panRimHeight, 0);
      handle.castShadow = true;
      this.group.add(handle);

      var self = this;
      var loader = new THREE.TextureLoader();
      this.karaageTex = loader.load(
        "assets/karaage.png",
        function () {},
        undefined,
        function () {
          self.karaageTex = makeKaraageFallback();
          if (self.karaage) {
            self.karaage.material.map = self.karaageTex;
            self.karaage.material.needsUpdate = true;
          }
        }
      );
      var ka = new THREE.Mesh(
        new THREE.PlaneGeometry(17, 17),
        new THREE.MeshBasicMaterial({
          map: this.karaageTex, transparent: true,
          side: THREE.DoubleSide, depthWrite: false,
        })
      );
      ka.position.y = cfg.pedestalHeight + 9;
      this.karaage = ka;
      this.group.add(ka);

      var n = cfg.sprayNozzles;
      for (var i = 0; i < n; i++) {
        var ang = (i / n) * Math.PI * 2 + Math.PI / n;
        var nz = new THREE.Mesh(
          new THREE.ConeGeometry(0.9, 2.2, 8),
          new THREE.MeshLambertMaterial({ color: 0x2e7fd6, emissive: 0x0a2a4a })
        );
        nz.rotation.z = Math.PI / 2;
        nz.rotation.y = -ang;
        nz.position.set(
          Math.cos(ang) * (cfg.panRadius + 4.2),
          cfg.pedestalHeight + 1.6,
          Math.sin(ang) * (cfg.panRadius + 4.2)
        );
        this.group.add(nz);
      }

      this.spray = new SpraySystem();
      this.group.add(this.spray.points);

      var sc = 36;
      var spos = new Float32Array(sc * 3);
      var scol = new Float32Array(sc * 3);
      for (var s = 0; s < sc; s++) spos[s * 3 + 1] = -100;
      var sgeo = new THREE.BufferGeometry();
      sgeo.setAttribute("position", new THREE.BufferAttribute(spos, 3));
      sgeo.setAttribute("color", new THREE.BufferAttribute(scol, 3));
      var smat = new THREE.PointsMaterial({
        size: 1.6, vertexColors: true, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      this.steam = new THREE.Points(sgeo, smat);
      this.steam.frustumCulled = false;
      this.steamLife = new Float32Array(sc);
      this.steamVel = new Float32Array(sc * 3);
      this.steamCursor = 0;
      this.group.add(this.steam);

      var ringGeo = new THREE.RingGeometry(cfg.tareZoneRadius - 1.2, cfg.tareZoneRadius + 1.2, 96);
      var ringMat = new THREE.MeshBasicMaterial({
        color: 0x2e8fff, transparent: true, opacity: 0.22,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
      });
      this.tareRing = new THREE.Mesh(ringGeo, ringMat);
      this.tareRing.rotation.x = -Math.PI / 2;
      this.tareRing.position.y = 0.06;
      this.group.add(this.tareRing);

      scene.add(this.group);
    },

    update: function (dt, enemies) {
      var cfg = KD.Config.base;
      this.time += dt;

      var look = (window.KD.Player && window.KD.Player.lookPos) ? window.KD.Player.lookPos : null;
      if (this.karaage) {
        this.karaage.position.y = cfg.pedestalHeight + 9 + Math.sin(this.time * 1.3) * 0.7;
        if (look) {
          // enemies.js と同じ理由: lookAt+rotation.z は特異点で逆さまになる
          var kAng = Math.atan2(look.x - this.karaage.position.x, look.z - this.karaage.position.z);
          this.karaage.rotation.set(0, kAng, 0);
          if (this.eating) this.karaage.rotateZ(Math.sin(this.time * 30) * 0.05);
        }
        this.karaage.position.x = this.eating ? Math.sin(this.time * 40) * 0.25 : 0;
      }

      this.sprayTimer -= dt;
      this.eating = false;
      if (this.sprayTimer <= 0) {
        this.sprayTimer = cfg.sprayInterval;
        for (var i = 0; i < cfg.sprayNozzles; i++) {
          var ang = (i / cfg.sprayNozzles) * Math.PI * 2 + Math.PI / cfg.sprayNozzles;
          var x = Math.cos(ang) * (cfg.panRadius + 4.2);
          var z = Math.sin(ang) * (cfg.panRadius + 4.2);
          this.spray.emit(x, cfg.pedestalHeight + 1.6, z, Math.cos(ang), Math.sin(ang), 26, 0.7);
        }
        KD.Audio.play("spray", { vol: 0.5, rate: 0.9 + Math.random() * 0.25 });
      }
      this.spray.update(dt);

      var sc = this.steamLife.length;
      var p = this.steam.geometry.attributes.position.array;
      var c = this.steam.geometry.attributes.color.array;
      for (var s = 0; s < sc; s++) {
        if (this.steamLife[s] <= 0) continue;
        this.steamLife[s] -= dt * 0.55;
        if (this.steamLife[s] <= 0) {
          p[s * 3 + 1] = -100;
          c[s * 3] = c[s * 3 + 1] = c[s * 3 + 2] = 0;
          continue;
        }
        p[s * 3] += this.steamVel[s * 3] * dt;
        p[s * 3 + 1] += this.steamVel[s * 3 + 1] * dt;
        p[s * 3 + 2] += this.steamVel[s * 3 + 2] * dt;
        var f = this.steamLife[s];
        c[s * 3] = 0.7 * f;
        c[s * 3 + 1] = 0.7 * f;
        c[s * 3 + 2] = 0.75 * f;
      }
      this.steam.geometry.attributes.position.needsUpdate = true;
      this.steam.geometry.attributes.color.needsUpdate = true;
      if (Math.random() < dt * 14) this.emitSteam();

      if (this.tareRing) {
        this.tareRing.material.opacity = 0.16 + Math.sin(this.time * 2.2) * 0.08;
      }

      for (var e = 0; e < enemies.length; e++) {
        var en = enemies[e];
        if (en.dead) continue;
        var d = Math.hypot(en.pos.x, en.pos.z);
        if (d < cfg.eatRadius) this.eating = true;
        if (d < cfg.tareZoneRadius) {
          en.tare = Math.min(1, (en.tare || 0) + dt / cfg.tareChargeTime);
          if (en.tare >= 1 && !en.coated) {
            en.coated = true;
            en.coatedTime = cfg.tareDuration;
            KD.Audio.play("tare", { vol: 0.8 });
            if (en.onCoated) en.onCoated(en);
          }
        } else if (!en.coated) {
          en.tare = Math.max(0, (en.tare || 0) - dt * 0.6);
        }
        if (en.coated) {
          en.coatedTime -= dt;
          if (en.coatedTime <= 0) {
            en.coated = false;
            en.tare = 0;
            if (en.onUncoated) en.onUncoated(en);
          }
        }
      }
    },

    emitSteam: function () {
      var idx = this.steamCursor;
      this.steamCursor = (this.steamCursor + 1) % this.steamLife.length;
      var p = this.steam.geometry.attributes.position.array;
      var c = this.steam.geometry.attributes.color.array;
      p[idx * 3] = (Math.random() - 0.5) * 8;
      p[idx * 3 + 1] = KD.Config.base.pedestalHeight + 15;
      p[idx * 3 + 2] = (Math.random() - 0.5) * 8;
      this.steamVel[idx * 3] = (Math.random() - 0.5) * 1.2;
      this.steamVel[idx * 3 + 1] = 2.5 + Math.random() * 2;
      this.steamVel[idx * 3 + 2] = (Math.random() - 0.5) * 1.2;
      this.steamLife[idx] = 1;
      c[idx * 3] = 0.8;
      c[idx * 3 + 1] = 0.8;
      c[idx * 3 + 2] = 0.85;
    },

    shakeKaraage: function (amt) {
      if (!this.karaage) return;
      this.karaage.position.x += (Math.random() - 0.5) * (amt || 1.5);
      this.karaage.position.z += (Math.random() - 0.5) * (amt || 1.5);
    }
  };

  window.KD.Base = Base;
})();
