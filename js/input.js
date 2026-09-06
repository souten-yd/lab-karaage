/* 唐揚げ防衛隊 - 入力 (キーボード + マウス/ポインタロック + タッチ) */
window.KD = window.KD || {};

(function () {
  var JOY_RADIUS = 56;   // ジョイスティック最大半径(px)
  var TOUCH_LOOK_SCALE = 2.4; // タッチドラッグ → 相当マウスpx換算

  var Input = {
    keys: {},
    mouseDown: false,      // 射撃意図 (ロック左クリック長押し / フォールバック右クリック / タッチautoFireは別)
    locked: false,
    fallback: false,        // ポインタロック不可環境: 左ドラッグ=視点、右クリック=射撃
    fallbackLooking: false,
    isTouch: false,
    autoFire: false,        // モバイル用オートファイア切替
    moveAxis: { x: 0, y: 0 }, // 仮想ジョイスティック (-1..1)
    mouseDX: 0,
    mouseDY: 0,
    enabled: false,

    // タッチ内部状態
    joyId: null,
    joyOX: 0,
    joyOY: 0,
    lookId: null,
    lookLX: 0,
    lookLY: 0,

    joyBaseEl: null,
    joyKnobEl: null,

    // ポインタロック要求 (同期throw / Promise reject / pointerlockerror すべて捕捉)
    tryLock: function (canvas) {
      if (!canvas.requestPointerLock || this.isTouch) return;
      var p;
      try { p = canvas.requestPointerLock(); } catch (err) { this.fallback = true; return; }
      if (p && typeof p.catch === "function") {
        p.catch(function () {
          if (!document.pointerLockElement) this.fallback = true;
        }.bind(this));
      }
    },

    init: function (canvas) {
      var self = this;
      this.canvas = canvas;
      this.isTouch = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);
      if (this.isTouch) document.body.classList.add("touch");

      // ジョイスティック DOM (タッチ時のみ表示)
      this.joyBaseEl = document.getElementById("joy-base");
      this.joyKnobEl = document.getElementById("joy-knob");

      window.addEventListener("keydown", function (e) {
        if (e.repeat) return;
        self.keys[e.code] = true;
        if (e.code === "KeyM") KD.UI && KD.UI.onMuteToggle(KD.Audio.toggleMute());
      });
      window.addEventListener("keyup", function (e) {
        self.keys[e.code] = false;
      });
      window.addEventListener("blur", function () {
        self.keys = {};
        self.mouseDown = false;
        self.fallbackLooking = false;
        self.endAllTouch();
      });

      // ===== マウス (ポインタロック / フォールバック) =====
      if (!canvas.requestPointerLock) self.fallback = true;

      canvas.addEventListener("pointerlockerror", function () {
        self.fallback = true;
      });

      canvas.addEventListener("mousedown", function (e) {
        if (!self.enabled) return;
        if (self.fallback) {
          if (e.button === 0) self.fallbackLooking = true;
          if (e.button === 2) self.mouseDown = true;
          return;
        }
        if (e.button === 0) {
          if (!self.locked) {
            try { canvas.requestPointerLock(); } catch (err) { self.fallback = true; }
          }
          if (self.locked) self.mouseDown = true;
        }
      });
      window.addEventListener("mouseup", function (e) {
        if (self.fallback) {
          if (e.button === 0) self.fallbackLooking = false;
          if (e.button === 2) self.mouseDown = false;
          return;
        }
        if (e.button === 0) self.mouseDown = false;
      });

      document.addEventListener("pointerlockchange", function () {
        self.locked = document.pointerLockElement === canvas;
        if (!self.locked) {
          self.mouseDown = false;
          if (KD.UI && KD.UI.onPointerUnlock) KD.UI.onPointerUnlock();
        }
      });

      document.addEventListener("mousemove", function (e) {
        if (self.locked) {
          self.mouseDX += e.movementX || 0;
          self.mouseDY += e.movementY || 0;
        } else if (self.fallback && self.fallbackLooking) {
          self.mouseDX += e.movementX || 0;
          self.mouseDY += e.movementY || 0;
        }
      });

      // ===== タッチ (Pointer Events, マルチタッチ) =====
      canvas.addEventListener("pointerdown", function (e) {
        if (e.pointerType !== "touch" || !self.enabled) return;
        e.preventDefault();
        var x = e.clientX, y = e.clientY;
        if (self.joyId === null && x < window.innerWidth * 0.45) {
          // 左領域: ジョイスティック開始
          self.joyId = e.pointerId;
          self.joyOX = x;
          self.joyOY = y;
          self.placeJoy(x, y);
        } else if (self.lookId === null) {
          // 右領域: 視点ドラッグ開始
          self.lookId = e.pointerId;
          self.lookLX = x;
          self.lookLY = y;
        }
      });
      window.addEventListener("pointermove", function (e) {
        if (e.pointerType !== "touch") return;
        if (e.pointerId === self.joyId) {
          var dx = e.clientX - self.joyOX;
          var dy = e.clientY - self.joyOY;
          var len = Math.hypot(dx, dy);
          if (len > JOY_RADIUS) { dx *= JOY_RADIUS / len; dy *= JOY_RADIUS / len; }
          self.moveAxis.x = dx / JOY_RADIUS;
          self.moveAxis.y = -dy / JOY_RADIUS;
          if (self.joyKnobEl) self.joyKnobEl.style.transform = "translate(" + dx + "px," + dy + "px)";
        } else if (e.pointerId === self.lookId) {
          self.mouseDX += (e.clientX - self.lookLX) * TOUCH_LOOK_SCALE;
          self.mouseDY += (e.clientY - self.lookLY) * TOUCH_LOOK_SCALE;
          self.lookLX = e.clientX;
          self.lookLY = e.clientY;
        }
      });
      var endPointer = function (e) {
        if (e.pointerType !== "touch") return;
        if (e.pointerId === self.joyId) {
          self.joyId = null;
          self.moveAxis.x = 0;
          self.moveAxis.y = 0;
          if (self.joyBaseEl) self.joyBaseEl.style.opacity = 0;
          if (self.joyKnobEl) self.joyKnobEl.style.transform = "translate(0,0)";
        } else if (e.pointerId === self.lookId) {
          self.lookId = null;
        }
      };
      window.addEventListener("pointerup", endPointer);
      window.addEventListener("pointercancel", endPointer);

      canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });
      document.addEventListener("gesturestart", function (e) { e.preventDefault(); });
    },

    placeJoy: function (x, y) {
      // 画面左下エリア内にクランプ
      var bx = Math.min(x, window.innerWidth * 0.42);
      var by = Math.min(Math.max(y, 110), window.innerHeight - 110);
      if (this.joyBaseEl) {
        this.joyBaseEl.style.left = (bx - JOY_RADIUS) + "px";
        this.joyBaseEl.style.top = (by - JOY_RADIUS) + "px";
        this.joyBaseEl.style.opacity = 1;
      }
    },

    endAllTouch: function () {
      this.joyId = null;
      this.lookId = null;
      this.moveAxis.x = 0;
      this.moveAxis.y = 0;
      if (this.joyBaseEl) this.joyBaseEl.style.opacity = 0;
      if (this.joyKnobEl) this.joyKnobEl.style.transform = "translate(0,0)";
    },

    toggleAutoFire: function () {
      this.autoFire = !this.autoFire;
      return this.autoFire;
    },

    // 射撃意図の統合 (左クリック長押し / 右クリック長押し / オートファイア)
    firing: function () {
      return this.mouseDown || this.autoFire;
    },

    consumeLook: function () {
      var dx = this.mouseDX, dy = this.mouseDY;
      this.mouseDX = 0;
      this.mouseDY = 0;
      return { x: dx, y: dy };
    },

    key: function (code) { return !!this.keys[code]; },
    forward: function () { return this.key("KeyW") || this.key("ArrowUp"); },
    back: function () { return this.key("KeyS") || this.key("ArrowDown"); },
    left: function () { return this.key("KeyA") || this.key("ArrowLeft"); },
    right: function () { return this.key("KeyD") || this.key("ArrowRight"); },
    sprint: function () { return this.key("ShiftLeft") || this.key("ShiftRight"); },
    reload: function () { return this.key("KeyR"); },
  };

  window.KD.Input = Input;
})();
