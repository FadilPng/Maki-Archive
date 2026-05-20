/**
 * shared/ui-utils.js
 * 
 * Fungsi-fungsi bersama yang dipakai oleh semua halaman karakter.
 * Dipanggil SETELAH karakter Spine berhasil di-load.
 * 
 * Cara pakai:
 *   const ui = buatUI(maki, app, config);
 *   ui.pasangEventCanvas(app.canvas atau app.view);
 */

/**
 * @param {object} maki       - Instance Spine character
 * @param {object} app        - PIXI.Application
 * @param {object} config     - Konfigurasi per-halaman (lihat contoh di bawah)
 * 
 * config = {
 *   hitboxRadius : 300,
 *   hitboxX      : -200,    // geser X hitbox relatif ke worldX tulang kepala
 *   hitboxY      : -2450,   // geser Y hitbox relatif ke worldY tulang kepala
 *   balonX       : 400,     // geser X balon subtitle dari hitbox
 *   balonY       : 0,       // geser Y balon subtitle dari hitbox
 *   namaTulangKepala : "Head",       // nama bone kepala di skeleton
 *   namaTulangLeher  : "neck",       // nama bone leher di skeleton
 *   timeline     : [ { animBody, animFace, suara: [{file, jedaAwal, teks}] } ]
 * }
 */
function buatUI(maki, app, config) {

    // DOM Elements
    const kotakSub  = document.getElementById("kotak-subtitle");
    const teksSub   = document.getElementById("teks-subtitle");
    const btnSub    = document.getElementById("btn-subtitle");
    const iconSub   = document.getElementById("icon-subtitle");
  
    // State
    let isSubtitleOn       = true;
    let audioSaatIni       = null;
    let timerJedaAudio     = null;
    let urutanTalk         = 0;
  
    let mouseX = window.innerWidth  / 2;
    let mouseY = window.innerHeight / 2;
  
    let targetRotasiKepala   = 0;
    let rotasiKepalaSaatIni  = 0;
    let lagiDitekan          = false;
    let lagiDielus           = false;
    let timerBerhenti        = null;
  
    // Bone references
    const tulangKepala = maki.skeleton.findBone(config.namaTulangKepala);
    const tulangLeher  = maki.skeleton.findBone(config.namaTulangLeher);
  
    // Helper: posisi dunia tulang kepala -> koordinat layar
    function getPosisiKepala() {
      if (!tulangKepala) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      return {
        x: maki.x + (tulangKepala.worldX * maki.scale.x),
        y: maki.y - (tulangKepala.worldY * maki.scale.y)
      };
    }
  
    // Helper: koordinat hitbox final
    function getHitbox() {
      const pos = getPosisiKepala();
      return {
        x      : pos.x + (config.hitboxX * maki.scale.x),
        y      : pos.y + (config.hitboxY * maki.scale.y),
        radius : config.hitboxRadius * maki.scale.x
      };
    }
  
    // Subtitle: tampil / sembunyikan
    function tampilkanSubtitle(teks) {
      if (!isSubtitleOn) return;
      teksSub.innerText = teks;
      kotakSub.classList.add("show");
    }
  
    function sembunyikanSubtitle() {
      kotakSub.classList.remove("show");
    }
  
    // Audio Timeline
    function playManualTimeline(skenario) {
      if (audioSaatIni) {
        audioSaatIni.pause();
        audioSaatIni.currentTime = 0;
      }
      if (timerJedaAudio) clearTimeout(timerJedaAudio);
  
      maki.state.setAnimation(1, skenario.animBody, false);
      maki.state.setAnimation(2, skenario.animFace, false);
  
      let indexAudio = 0;
  
      function putarSelanjutnya() {
        if (indexAudio >= skenario.suara.length) {
          sembunyikanSubtitle();
          maki.state.addEmptyAnimation(1, 0.2, 0);
          maki.state.addEmptyAnimation(2, 0.2, 0);
          return;
        }
  
        const dataSuara = skenario.suara[indexAudio];
        timerJedaAudio = setTimeout(() => {
          audioSaatIni = new Audio(dataSuara.file);
          audioSaatIni.volume = 1.0;
          audioSaatIni.play().catch(() => {});
          tampilkanSubtitle(dataSuara.teks);
  
          audioSaatIni.onended = () => {
            indexAudio++;
            putarSelanjutnya();
          };
        }, dataSuara.jedaAwal);
      }
  
      putarSelanjutnya();
    }
  
    function playTalk() {
      sembunyikanSubtitle();
      const skenario = config.timeline[urutanTalk];
      if (skenario) playManualTimeline(skenario);
      urutanTalk = (urutanTalk + 1) % config.timeline.length;
    }
  
    // Animasi Elus
    function stopElus() {
      if (!lagiDielus) return;
      lagiDielus = false;
      maki.state.setAnimation(1, "PatEnd_01_M", false);
      maki.state.setAnimation(2, "PatEnd_01_A", false);
      maki.state.addEmptyAnimation(1, 0.2, 0);
      maki.state.addEmptyAnimation(2, 0.2, 0);
    }
  
    // Override updateWorldTransform: rotasi kepala smooth
    const fungsiAsli = maki.skeleton.updateWorldTransform.bind
      ? maki.skeleton.updateWorldTransform.bind(maki.skeleton)
      : maki.skeleton.updateWorldTransform;
  
    maki.skeleton.updateWorldTransform = function(arg) {
      if (tulangKepala && tulangLeher) {
        // Simpan nilai asli agar tidak menumpuk setiap frame
        const oriLeher  = tulangLeher.rotation;
        const oriKepala = tulangKepala.rotation;
  
        tulangLeher.rotation  += (rotasiKepalaSaatIni * 0.2);
        tulangKepala.rotation += (rotasiKepalaSaatIni * 0.8);
  
        fungsiAsli(arg);
  
        // Restore (hanya diperlukan untuk Spine v4+)
        tulangLeher.rotation  = oriLeher;
        tulangKepala.rotation = oriKepala;
      } else {
        fungsiAsli(arg);
      }
    };
  
    //Ticker: jalan tiap frame
    function tickerUpdate() {
      const hb = getHitbox();
  
      // Update posisi balon subtitle
      if (isSubtitleOn && kotakSub.classList.contains("show")) {
        kotakSub.style.left = (hb.x + (config.balonX * maki.scale.x)) + "px";
        kotakSub.style.top  = (hb.y + (config.balonY * maki.scale.y)) + "px";
      }
  
      // Kepala ngikutin kursor saat dielus
      if (lagiDielus && tulangKepala) {
        let sx = (mouseX - hb.x) * -0.05;
        let sy = (mouseY - hb.y) *  0.05;
        sx = Math.min(Math.max(sx, -3), 4);
        sy = Math.min(Math.max(sy, -3), 4);
        targetRotasiKepala = sx + sy;
      } else {
        targetRotasiKepala = 0;
      }
  
      rotasiKepalaSaatIni += (targetRotasiKepala - rotasiKepalaSaatIni) * 0.1;
    }
  
    // Skip Intro
    // Kalau Start_Idle_01 masih main, klik pertama skip ke Idle
    function skipIntroJikaPerlu() {
      const track = maki.state.tracks[0];
      if (!track) return false;
      const namaAnim = track.animation && track.animation.name;
      if (namaAnim === "Start_Idle_01") {
        maki.state.setAnimation(0, "Idle_01", true);
        return true;
      }
      return false;
    }
  
    // Pasang event ke canvas
    function pasangEventCanvas(canvas) {
      canvas.addEventListener("pointerdown", (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
  
        // Klik saat intro masih jalan -> skip intro saja, tidak playTalk
        if (skipIntroJikaPerlu()) return;
  
        const hb    = getHitbox();
        const jarak = Math.hypot(mouseX - hb.x, mouseY - hb.y);
  
        if (e.button === 0) {
          if (jarak <= hb.radius) {
            lagiDitekan = true;
          } else {
            playTalk();
          }
        } else if (e.button === 2) {
          playTalk();
        }
      });
  
      canvas.addEventListener("pointermove", (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
  
        if (lagiDitekan) {
          if (!lagiDielus) {
            lagiDielus = true;
            maki.state.setAnimation(1, "Pat_01_M", true);
            maki.state.setAnimation(2, "Pat_01_A", true);
          }
          clearTimeout(timerBerhenti);
          timerBerhenti = setTimeout(stopElus, 300);
        }
      });
  
      window.addEventListener("pointerup", (e) => {
        if (e.button === 0) {
          lagiDitekan = false;
          clearTimeout(timerBerhenti);
          stopElus();
        }
      });
  
      window.addEventListener("pointerout", () => {
        lagiDitekan = false;
        clearTimeout(timerBerhenti);
        stopElus();
      });
  
      window.addEventListener("contextmenu", (e) => e.preventDefault());
    }
  
    // Tombol Subtitle
    function pasangTombolSubtitle() {
      btnSub.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        isSubtitleOn = !isSubtitleOn;
  
        if (isSubtitleOn) {
          btnSub.classList.remove("off");
          iconSub.className = "fa-solid fa-comment";
        } else {
          btnSub.classList.add("off");
          iconSub.className = "fa-solid fa-comment-slash";
          sembunyikanSubtitle();
        }
      });
    }
  
    // Splash Screen
    /**
     * @param {Audio|null} bgmObj  - Objek Audio BGM, atau null kalau tidak ada splash
     * @param {boolean} tampilkanSplash
     */
    function pasangSplash(bgmObj, tampilkanSplash = true, onMasuk = null) {
      const splash = document.getElementById("splash-screen");
      if (!splash) return;
  
      if (!tampilkanSplash) {
        splash.style.display = "none";
        if (bgmObj) bgmObj.play().catch(() => {});
        return;
      }
  
      splash.addEventListener("pointerdown", function handler() {
        if (bgmObj) bgmObj.play().catch(() => {});
        if (onMasuk) onMasuk();
        splash.style.opacity = "0";
        setTimeout(() => { splash.style.display = "none"; }, 500);
        splash.removeEventListener("pointerdown", handler);
      });
    }
  
    // BGM Fade Out -> Navigasi
    /**
     * Fade out BGM, simpan state ke sessionStorage, lalu pindah halaman.
     * @param {Audio} bgmObj   - objek Audio yang sedang main
     * @param {string} tujuan  - URL tujuan
     * @param {number} durasi  - durasi fade dalam ms (default 400)
     */
    function navigasiDenganFade(bgmObj, tujuan, durasi = 400) {
      if (!bgmObj) { window.location.href = tujuan; return; }
  
      // Simpan posisi playback supaya halaman tujuan bisa lanjut
      try {
        sessionStorage.setItem("bgm_resume", JSON.stringify({
          volume : bgmObj.volume   // hanya simpan volume, BGM mulai dari awal
        }));
      } catch(e) {}
  
      // Fade out bertahap
      const volAwal   = bgmObj.volume;
      const langkah   = 20; // berapa kali update volume
      const interval  = durasi / langkah;
      const penurunan = volAwal / langkah;
      let counter = 0;
  
      const timer = setInterval(() => {
        counter++;
        bgmObj.volume = Math.max(0, volAwal - penurunan * counter);
        if (counter >= langkah) {
          clearInterval(timer);
          bgmObj.pause();
          window.location.href = tujuan;
        }
      }, interval);
    }
  
    // BGM lanjut (dipanggil saat halaman baru load)
    /**
     * Cek sessionStorage, kalau ada data resume -> fade in BGM dari volume 0.
     * Karena file BGM beda antar halaman, currentTime tidak dipakai
     * (BGM mulai dari awal tapi langsung fade in).
     * @param {Audio} bgmObj  - objek Audio halaman ini
     * @param {number} durasi - durasi fade in dalam ms
     */
    function resumeBGM(bgmObj, durasi = 400) {
      let data = null;
      try {
        const raw = sessionStorage.getItem("bgm_resume");
        if (raw) { data = JSON.parse(raw); sessionStorage.removeItem("bgm_resume"); }
      } catch(e) {}
  
      if (!data) return false; // tidak ada data resume, main normal
  
      // File BGM sama -> resume dari posisi terakhir
      // BGM selalu mulai dari awal (tidak resume currentTime)
      bgmObj.currentTime = 0;
      const volTarget = data.volume || 0.3;
      bgmObj.volume   = 0;   // mulai dari bisu
  
      bgmObj.play().then(() => {
        // Fade in bertahap
        const langkah  = 20;
        const interval = durasi / langkah;
        const naik     = volTarget / langkah;
        let counter    = 0;
  
        const timer = setInterval(() => {
          counter++;
          bgmObj.volume = Math.min(volTarget, naik * counter);
          if (counter >= langkah) clearInterval(timer);
        }, interval);
      }).catch(() => {});
  
      return true;
    }
  
    // Init
    pasangTombolSubtitle();
  
    return {
      pasangEventCanvas,
      pasangSplash,
      navigasiDenganFade,
      resumeBGM,
      tickerUpdate,
      playTalk,
      stopElus,
      getPosisiKepala,
      getHitbox,
    };
  }