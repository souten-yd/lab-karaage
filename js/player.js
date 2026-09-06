/* 唐揚げ防衛隊 - プレイヤー (TPS視点・移動・射撃) */
window.KD = window.KD || {};

(function () {
  var Player = {
    pos: null,
    vel: null,
    yaw: 0,
    pitch: 0.12,
    lookPos: null,
    hp: 0,
    dead: false,
    invuln: 0,
    mesh: null,
    gunTip: null,
    flash: null,
    ammo: 0,
    reloading: false,
    reloadTimer: 0,
    fireTimer: 0,
    muzzleTimer: 0,
    bullets: [],
    bulletGeo: null,
    bulletMat: null,
    bulletCursor: 0,

    init: function (scene) {
      var cfg = KD.Config.player;
      this.pos = new THREE.Vector3(0, 0, 60);
      this.vel = new THREE.Vector3();
      this.hp = cfg.hp;
      this.dead = false;
      this.ammo = KD.Config.weapon.magSize;
      this.lookPos = new THREE.Vector3();

      this.mesh = new THREE.Group();
      var bodyMat = new THREE.MeshLambertMaterial({ color: 0x2e7fd6 });
      var body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.8, 0.9), bodyMat);
      body.position.y = 1.6;
      body.castShadow = true;
      this.mesh.add(body);
      var chest = new THREE.Mesh(
        new THREE.BoxGeometry(1.45, 0.5, 0.95),
        new THREE.MeshLambertMaterial({ color: 0x16324f })
      );
      chest.position.y = 2.0;
      this.mesh.add(chest);
      var head = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 12, 12),
        new THREE.MeshLambertMaterial({ color: 0xd8b088 })
      );
      head.position.y = 2.95;
      head.castShadow = true;
      this.mesh.add(head);
      var helmet = new THREE.Mesh(
        new THREE.SphereGeometry(0.6, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshLambertMaterial({ color: 0x16324f, emissive: 0x0a2440 })
      );
      helmet.position.y = 3.0;
      this.mesh.add(helmet);
      var visor = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.22, 0.2),
        new THREE.MeshBasicMaterial({ color: 0x7adfff })
      );
      visor.position.set(0, 3.0, -0.55);
      this.mesh.add(visor);
      var legMat = new THREE.MeshLambertMaterial({ color: 0x16324f });
      var legL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, 0.55), legMat);
      legL.position.set(-0.4, 0.7, 0);
      this.mesh.add(legL);
      var legR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, 0.55), legMat);
      legR.position.set(0.4, 0.7, 0);
      this.mesh.add(legR);
      var gun = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.3, 1.8),
        new THREE.MeshLambertMaterial({ color: 0x12233a })
      );
      gun.position.set(0.7, 2.0, -0.7);
      this.mesh.add(gun);
      var tip = new THREE.Object3D();
      tip.position.set(0.7, 2.05, -1.7);
      this.gunTip = tip;
      this.mesh.add(tip);

      this.flash = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x7adfff, transparent: true, opacity: 0.9, depthWrite: false })
      );
      this.flash.visible = false;
      this.mesh.add(this.flash);

      scene.add(this.mesh);

      this.bulletGeo = new THREE.SphereGeometry(0.35, 8, 8);
      this.bulletMat = new THREE.MeshBasicMaterial({ color: KD.Config.weapon.tracerColor });
    },

    reset: function () {
      this.pos.set(0, 0, 60);
      this.vel.set(0, 0, 0);
      this.yaw = 0;
      this.pitch = 0.12;
      this.hp = KD.Config.player.hp;
      this.dead = false;
      this.invuln = 0;
      this.ammo = KD.Config.weapon.magSize;
      this.reloading = false;
      this.fireTimer = 0;
      for (var i = 0; i < this.bullets.length; i++) {
        KD.World.scene.remove(this.bullets[i].mesh);
      }
      this.bullets.length = 0;
    },

    applyLook: function (dx, dy) {
      var cfg = KD.Config.player;
      this.yaw -= dx * cfg.camYawSens;
      this.pitch -= dy * cfg.camPitchSens;
      if (this.pitch > cfg.camPitchMax) this.pitch = cfg.camPitchMax;
      if (this.pitch < cfg.camPitchMin) this.pitch = cfg.camPitchMin;
    },

    startReload: function () {
      var w = KD.Config.weapon;
      if (this.reloading || this.ammo >= w.magSize || this.dead) return;
      this.reloading = true;
      this.reloadTimer = w.reloadTime;
    },

    spawnBullet: function (origin, dir) {
      var w = KD.Config.weapon;
      var mesh = new THREE.Mesh(this.bulletGeo, this.bulletMat);
      mesh.position.copy(origin);
      KD.World.scene.add(mesh);
      this.bullets.push({
        mesh: mesh,
        pos: origin.clone(),
        vel: dir.clone().multiplyScalar(w.bulletSpeed),
        life: w.bulletLife,
      });
    },

    update: function (dt) {
      var p = KD.Config.player;
      var w = KD.Config.weapon;
      var Input = window.KD.Input;

      if (!this.dead && Input) {
        var fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
        var right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
        var move = new THREE.Vector3();
        if (Input.keys["KeyW"] || Input.keys["ArrowUp"]) move.add(fwd);
        if (Input.keys["KeyS"] || Input.keys["ArrowDown"]) move.sub(fwd);
        if (Input.keys["KeyD"] || Input.keys["ArrowRight"]) move.add(right);
        if (Input.keys["KeyA"] || Input.keys["ArrowLeft"]) move.sub(right);
        // 仮想ジョイスティック (モバイル)
        if (Input.moveAxis && (Input.moveAxis.x !== 0 || Input.moveAxis.y !== 0)) {
          move.addScaledVector(right, Input.moveAxis.x);
          move.addScaledVector(fwd, Input.moveAxis.y);
        }
        if (move.lengthSq() > 0) move.normalize();
        var maxSpd = (Input.keys["ShiftLeft"] || Input.keys["ShiftRight"]) ? p.sprintSpeed : p.speed;
        var target = move.multiplyScalar(maxSpd);
        var t = Math.min(1, p.accel * dt / Math.max(1, maxSpd));
        this.vel.x += (target.x - this.vel.x) * t;
        this.vel.z += (target.z - this.vel.z) * t;
        this.pos.x += this.vel.x * dt;
        this.pos.z += this.vel.z * dt;

        var minD = KD.Config.base.panRadius + 7;
        var d = Math.hypot(this.pos.x, this.pos.z);
        if (d < minD) {
          this.pos.x *= minD / d;
          this.pos.z *= minD / d;
        }
        var gr = KD.Config.world.groundRadius - 8;
        var rd = Math.hypot(this.pos.x, this.pos.z);
        if (rd > gr) {
          this.pos.x *= gr / rd;
          this.pos.z *= gr / rd;
        }
      }

      this.mesh.position.set(this.pos.x, 0, this.pos.z);
      this.mesh.rotation.y = this.yaw;
      this.mesh.visible = !this.dead;

      var cp = Math.cos(this.pitch);
      var dir = new THREE.Vector3(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
      var head = new THREE.Vector3(this.pos.x, p.eyeHeight, this.pos.z);
      this.lookPos.copy(head).addScaledVector(dir, 120);

      var camPos = head.clone().addScaledVector(dir, -p.camDist);
      camPos.y = Math.max(1.2, camPos.y);
      KD.World.camera.position.copy(camPos);
      KD.World.camera.lookAt(this.lookPos);

      if (this.invuln > 0) {
        this.invuln -= dt;
        this.mesh.visible = Math.floor(performance.now() / 90) % 2 === 0;
      }

      if (!this.dead) {
        if (this.reloading) {
          this.reloadTimer -= dt;
          if (this.reloadTimer <= 0) {
            this.reloading = false;
            this.ammo = w.magSize;
          }
        }
        this.fireTimer -= dt;
        if (Input && Input.firing() && !this.reloading && this.fireTimer <= 0) {
          if (this.ammo > 0) {
            this.ammo--;
            this.fireTimer = w.fireInterval;
            var origin = new THREE.Vector3();
            this.gunTip.getWorldPosition(origin);
            var bdir = dir.clone();
            bdir.x += (Math.random() - 0.5) * w.spread;
            bdir.y += (Math.random() - 0.5) * w.spread;
            bdir.z += (Math.random() - 0.5) * w.spread;
            bdir.normalize();
            this.spawnBullet(origin, bdir);
            this.muzzleTimer = w.muzzleFlashTime;
            KD.Audio.play("shoot", { vol: 0.4, rate: 0.95 + Math.random() * 0.1 });
            if (this.ammo <= 0) this.startReload();
          } else {
            this.startReload();
          }
        }
        if (this.muzzleTimer > 0) {
          this.muzzleTimer -= dt;
          this.flash.visible = this.muzzleTimer > 0;
          this.flash.scale.setScalar(0.7 + Math.random() * 0.7);
        } else {
          this.flash.visible = false;
        }
      }

      for (var i = this.bullets.length - 1; i >= 0; i--) {
        var b = this.bullets[i];
        b.life -= dt;
        b.pos.addScaledVector(b.vel, dt);
        b.mesh.position.copy(b.pos);
        var remove = b.life <= 0 || b.pos.y < 0.2 ||
          Math.hypot(b.pos.x, b.pos.z) > KD.Config.world.groundRadius;
        var hit = false;
        var Enemies = window.KD.Enemies;
        if (!remove && Enemies) {
          for (var e = 0; e < Enemies.list.length; e++) {
            var en = Enemies.list[e];
            if (en.dead) continue;
            var rad = en.cfg.billboardH * 0.42 + 2;
            var dy = b.pos.y - (en.pos.y + (en.cfg.fly ? 0 : en.cfg.billboardH * 0.5));
            if (Math.hypot(b.pos.x - en.pos.x, b.pos.z - en.pos.z) < rad && Math.abs(dy) < rad * 0.9) {
              hit = true;
              remove = true;
              if (Enemies.damage(en, w.damage)) {
                KD.Audio.play("hit", { vol: 0.5, rate: 1.1 });
              } else {
                KD.Audio.play("hit", { vol: 0.3, rate: 0.9 });
                if (Enemies.debris) {
                  Enemies.debris.emit(b.pos.x, b.pos.y, b.pos.z, 1, 0.8, 0.4, 4);
                }
              }
              break;
            }
          }
        }
        if (remove) {
          KD.World.scene.remove(b.mesh);
          this.bullets.splice(i, 1);
        }
      }
    }
  };

  window.KD.Player = Player;
})();
