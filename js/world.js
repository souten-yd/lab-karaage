/* 唐揚げ防衛隊 - 世界 (夜景の都市・照明・地面) */
window.KD = window.KD || {};

(function () {
  var World = {
    scene: null,
    camera: null,
    renderer: null,
    stars: null,
    spotLight: null,
    groundY: 0,

    init: function (canvas) {
      var cfg = KD.Config.world;
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(cfg.skyColor);
      this.scene.fog = new THREE.Fog(cfg.skyColor, cfg.fogNear, cfg.fogFar);

      this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1200);
      this.camera.position.set(0, 10, 20);

      this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      var amb = new THREE.AmbientLight(cfg.ambientColor, cfg.ambientIntensity);
      this.scene.add(amb);
      this.ambLight = amb;
      var hemi = new THREE.HemisphereLight(0x2a3c66, 0x0c0e18, 0.5);
      this.scene.add(hemi);
      this.hemiLight = hemi;

      var moon = new THREE.DirectionalLight(cfg.moonColor, cfg.moonIntensity);
      this.moonLight = moon;
      moon.position.set(-120, 180, -80);
      moon.castShadow = true;
      moon.shadow.mapSize.set(2048, 2048);
      moon.shadow.camera.left = -120;
      moon.shadow.camera.right = 120;
      moon.shadow.camera.top = 120;
      moon.shadow.camera.bottom = -120;
      moon.shadow.camera.far = 500;
      moon.shadow.bias = -0.0005;
      this.scene.add(moon);

      this.buildGround();
      this.buildBuildings();
      this.buildStreetLights();
      this.buildStars();
      this.buildBaseSpotlights();

      var self = this;
      window.addEventListener("resize", function () {
        self.camera.aspect = window.innerWidth / window.innerHeight;
        self.camera.updateProjectionMatrix();
        self.renderer.setSize(window.innerWidth, window.innerHeight);
      });
    },

    makeGroundTexture: function () {
      var c = document.createElement("canvas");
      c.width = c.height = 512;
      var g = c.getContext("2d");
      g.fillStyle = "#141a28";
      g.fillRect(0, 0, 512, 512);
      for (var i = 0; i < 2600; i++) {
        var v = 18 + Math.floor(Math.random() * 22);
        g.fillStyle = "rgb(" + v + "," + (v + 4) + "," + (v + 12) + ")";
        g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
      }
      g.strokeStyle = "rgba(90,110,150,0.25)";
      g.lineWidth = 2;
      for (var x = 0; x <= 512; x += 64) {
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke();
        g.beginPath(); g.moveTo(0, x); g.lineTo(512, x); g.stroke();
      }
      var tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(64, 64);
      return tex;
    },

    buildGround: function () {
      var cfg = KD.Config.world;
      var tex = this.makeGroundTexture();
      var ground = new THREE.Mesh(
        new THREE.CircleGeometry(cfg.groundRadius, 64),
        new THREE.MeshLambertMaterial({ map: tex, color: 0x8899bb })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      this.scene.add(ground);

      var outer = new THREE.Mesh(
        new THREE.RingGeometry(cfg.groundRadius, 900, 64),
        new THREE.MeshLambertMaterial({ color: 0x05070d, side: THREE.DoubleSide })
      );
      outer.rotation.x = -Math.PI / 2;
      outer.position.y = -0.05;
      this.scene.add(outer);

      var plazaTex = this.makeGroundTexture();
      var plaza = new THREE.Mesh(
        new THREE.CircleGeometry(KD.Config.base.tareZoneRadius + 14, 48),
        new THREE.MeshLambertMaterial({ map: plazaTex, color: 0xaabbdd })
      );
      plaza.rotation.x = -Math.PI / 2;
      plaza.position.y = 0.02;
      plaza.receiveShadow = true;
      this.scene.add(plaza);
    },

    buildBuildings: function () {
      var cfg = KD.Config.world;
      this.buildings = [];
      var group = new THREE.Group();
      var winMat = new THREE.MeshBasicMaterial({ color: 0xffcf7a });
      var winMat2 = new THREE.MeshBasicMaterial({ color: 0x7ab8ff });
      var count = 90;
      var bodyGeo = new THREE.BoxGeometry(1, 1, 1);
      var winGeo = new THREE.PlaneGeometry(0.9, 1.4);

      for (var i = 0; i < count; i++) {
        var ang = (i / count) * Math.PI * 2 + Math.random() * 0.2;
        var dist = cfg.groundRadius * 0.45 + Math.random() * cfg.groundRadius * 0.55;
        var w = 14 + Math.random() * 26;
        var d = 14 + Math.random() * 26;
        var h = 20 + Math.random() * 110;
        if (Math.random() < 0.12) h = 140 + Math.random() * 60;
        // 個別マテリアル (崩壊時に減光するため)
        var bodyMat = new THREE.MeshLambertMaterial({ color: 0x1a2233 });
        var b = new THREE.Mesh(bodyGeo, bodyMat);
        b.scale.set(w, h, d);
        var bx = Math.cos(ang) * dist, bz = Math.sin(ang) * dist;
        b.position.set(bx, h / 2, bz);
        b.rotation.y = Math.random() * Math.PI;
        group.add(b);
        var wins = Math.floor(Math.random() * 10) + 2;
        var winMeshes = [];
        for (var wi = 0; wi < wins; wi++) {
          var wm = new THREE.Mesh(winGeo, Math.random() < 0.7 ? winMat : winMat2);
          var face = Math.floor(Math.random() * 4);
          var px = (Math.random() - 0.5) * w * 0.8;
          var pz = (Math.random() - 0.5) * d * 0.8;
          var py = 4 + Math.random() * (h - 10);
          if (face === 0) wm.position.set(bx + w / 2 + 0.1, py, bz + pz);
          else if (face === 1) wm.position.set(bx - w / 2 - 0.1, py, bz + pz);
          else if (face === 2) wm.position.set(bx + px, py, bz + d / 2 + 0.1);
          else wm.position.set(bx + px, py, bz - d / 2 - 0.1);
          wm.rotation.y = face === 0 || face === 1 ? Math.PI / 2 : 0;
          group.add(wm);
          winMeshes.push(wm);
        }
        this.buildings.push({
          body: b,
          wins: winMeshes,
          mat: bodyMat,
          x: bx, z: bz, w: w, d: d, h: h,
          rotY: b.rotation.y,
          state: "intact",   // intact | falling | rubble
          fallT: 0,
          order: Math.random(), // 崩壊順序
          rubble: null,
        });
      }
      this.scene.add(group);
      // 崩壊順序ソート
      this.buildings.sort(function (a, b) { return a.order - b.order; });
      this._destruction = 0;
    },

    setDestruction: function (stage) {
      if (!this.buildings) return;
      stage = Math.max(1, Math.min(10, stage));
      // 段階に応じて約6割まで倒壊
      var target = Math.floor(this.buildings.length * (stage / 10) * 0.62);
      for (var i = 0; i < this.buildings.length; i++) {
        var b = this.buildings[i];
        if (i < target && b.state === "intact") {
          b.state = "falling";
          b.fallT = 0;
          if (window.KD.Audio) KD.Audio.play("death", { vol: 0.4, rate: 0.6 });
          if (window.KD.Main) KD.Main.shake(1.5);
        } else if (i >= target && b.state === "rubble") {
          // リセット (新ゲーム)
          this._restoreBuilding(b);
        }
      }
      // 空・フォグ・照明を段階的に変化
      var t = (stage - 1) / 9;
      var sky = new THREE.Color(KD.Config.world.skyColor).lerp(new THREE.Color(0x05060c), t * 0.85);
      this.scene.background = sky;
      this.scene.fog.color.copy(sky);
      this.scene.fog.near = KD.Config.world.fogNear - t * 40;
      this.scene.fog.far = KD.Config.world.fogFar - t * 130;
      if (this.ambLight) this.ambLight.intensity = KD.Config.world.ambientIntensity * (1 - t * 0.55);
      if (this.moonLight) this.moonLight.intensity = KD.Config.world.moonIntensity * (1 - t * 0.45);
      this._destruction = stage;
    },

    _restoreBuilding: function (b) {
      b.state = "intact";
      b.fallT = 0;
      b.body.visible = true;
      b.body.scale.set(b.w, b.h, b.d);
      b.body.position.set(b.x, b.h / 2, b.z);
      b.body.rotation.set(0, b.rotY, 0);
      b.mat.color.setHex(0x1a2233);
      b.mat.emissive.setHex(0x000000);
      for (var i = 0; i < b.wins.length; i++) b.wins[i].visible = true;
      if (b.rubble) { this.scene.remove(b.rubble); b.rubble = null; }
    },

    _makeRubble: function (b) {
      var g = new THREE.Group();
      var mat = new THREE.MeshLambertMaterial({ color: 0x141a26 });
      var n = 3 + Math.floor(Math.random() * 3);
      for (var i = 0; i < n; i++) {
        var s = 3 + Math.random() * (b.w * 0.35);
        var m = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.6, s), mat);
        m.position.set((Math.random() - 0.5) * b.w * 0.7, s * 0.3, (Math.random() - 0.5) * b.w * 0.7);
        m.rotation.y = Math.random() * Math.PI;
        g.add(m);
      }
      g.position.set(b.x, 0, b.z);
      this.scene.add(g);
      b.rubble = g;
    },

    buildStreetLights: function () {
      var cfg = KD.Config.world;
      var group = new THREE.Group();
      var poleMat = new THREE.MeshLambertMaterial({ color: 0x2a3244 });
      var lampMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
      var n = 14;
      for (var i = 0; i < n; i++) {
        var ang = (i / n) * Math.PI * 2;
        var dist = KD.Config.base.tareZoneRadius + 30;
        var pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.35, 0.5, 18, 8),
          poleMat
        );
        pole.position.set(Math.cos(ang) * dist, 9, Math.sin(ang) * dist);
        group.add(pole);
        var lamp = new THREE.Mesh(
          new THREE.SphereGeometry(1.1, 10, 10),
          lampMat
        );
        lamp.position.set(Math.cos(ang) * dist, 18.4, Math.sin(ang) * dist);
        group.add(lamp);
      }
      this.scene.add(group);
    },

    buildStars: function () {
      var count = 500;
      var pos = new Float32Array(count * 3);
      for (var i = 0; i < count; i++) {
        var theta = Math.random() * Math.PI * 2;
        var phi = Math.random() * Math.PI * 0.45;
        var r = 850;
        pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        pos[i * 3 + 1] = r * Math.cos(phi) + 30;
        pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      var mat = new THREE.PointsMaterial({ color: 0xcdd8ff, size: 2.2, sizeAttenuation: false });
      this.stars = new THREE.Points(geo, mat);
      this.scene.add(this.stars);
    },

    buildBaseSpotlights: function () {
      this.spotLight = new THREE.SpotLight(0xffe9b8, 1.6, 160, Math.PI / 5, 0.5, 1.2);
      this.spotLight.position.set(0, 60, 0);
      this.spotLight.target.position.set(0, 0, 0);
      this.scene.add(this.spotLight);
      this.scene.add(this.spotLight.target);
      var spot2 = new THREE.PointLight(0xff8844, 0.8, 90, 1.6);
      spot2.position.set(0, 8, 0);
      this.scene.add(spot2);
      this.heatLight = spot2;
    },

    render: function () {
      this.renderer.render(this.scene, this.camera);
    },

    update: function (dt) {
      if (this.spotLight) this.spotLight.intensity = 1.6 + Math.sin(performance.now() * 0.002) * 0.15;
      this.updateBuildings(dt);
    },

    updateBuildings: function (dt) {
      if (!this.buildings) return;
      for (var i = 0; i < this.buildings.length; i++) {
        var b = this.buildings[i];
        if (b.state !== "falling") continue;
        b.fallT += dt;
        var dur = 2.2;
        var p = Math.min(1, b.fallT / dur);
        // 傾斜しながら沈没
        b.body.rotation.z = p * 0.5 * (b.order > 0.5 ? 1 : -1);
        b.body.position.y = b.h / 2 * (1 - p);
        b.mat.color.lerp(new THREE.Color(0x0a0d14), 0.1);
        for (var wi = 0; wi < b.wins.length; wi++) b.wins[wi].visible = p < 0.5;
        if (p >= 1) {
          b.state = "rubble";
          b.body.visible = false;
          for (var wj = 0; wj < b.wins.length; wj++) b.wins[wj].visible = false;
          this._makeRubble(b);
        }
      }
    },
  };

  window.KD.World = World;
})();
