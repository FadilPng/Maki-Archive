# Maki Archive - Interactive Spine Web Viewer

Proyek ini lahir dari satu pertanyaan iseng: bisa ga sih karakter Blue Archive ditampilin di browser terus bisa diinteraksi? Ternyata bisa. Tapi jalannya lumayan berliku :''v

Ini catatan buat diri sendiri, supaya sebulan lagi kalau lupa tidak perlu baca kode dari awal. Ditulis jujur, termasuk bagian-bagian yang bikin frustrasi.

---

## Apa yang Bisa Dilakukan

- Karakter Maki tampil di layar, animasi idle jalan otomatis
- Klik area kepala, bisa "dielus", kepala ngikutin arah kursor
- Klik di luar kepala, Maki ngomong (ada suara + subtitle balon kata)
- Ada dua halaman: versi rumah (`index.html`) dan versi camping (`camp.html`)
- Pindah halaman dengan tombol, musik latar fade out/in dengan mulus
- Splash screen cuma muncul sekali di awal sesi

---

## Struktur Folder

```
project/
│
├── index.html
├── camp.html
│
├── shared/
│   ├── ui.css
│   └── ui-utils.js
│
└── assets/
    ├── maki-home/
    │   ├── maki_home.skel
    │   ├── maki_home.atlas
    │   ├── maki_home.png
    │   ├── logo.png
    │   ├── bgm.ogg
    │   ├── talk_1_1.ogg
    │   └── ...
    │
    └── maki-camp/
        ├── CH0235_home.skel
        ├── CH0235_home.atlas
        ├── CH0235_home.png
        ├── bgm_camp.ogg
        ├── camp_1_1.ogg
        └── ...
```

File `.skel` dan `.atlas` diambil dari data game. Jangan tanya caranya :''v

---

## Library yang Dipakai

Tidak perlu install apapun, semua di-load dari CDN.

**index.html** pakai Spine versi lama:
```html
<script src="https://cdn.jsdelivr.net/npm/pixi.js@6.5.10/dist/browser/pixi.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/pixi-spine@3.0.7/dist/pixi-spine.umd.js"></script>
```

**camp.html** pakai Spine versi baru:
```html
<script src="https://cdn.jsdelivr.net/npm/pixi.js@8/dist/pixi.min.js"></script>
<script src="https://unpkg.com/@esotericsoftware/spine-pixi-v8@4.2.*/dist/iife/spine-pixi-v8.js"></script>
```

Kenapa beda? Karena file `.skel` tiap karakter diekspor dari game dengan versi Spine yang berbeda. Maki home pakai Spine v3, karakter camp pakai Spine v4, dan keduanya tidak kompatibel. Coba paksa pakai library yang salah, hasilnya karakter tidak keluar atau langsung error merah di console :''v

---

## Bagian yang Bikin Frustrasi

### 1. Pindah dari Spine v3 ke v4 :''v

Ini yang paling tidak terduga. Waktu pertama coba nampilin karakter camp, library-nya masih pixi-spine v3. Hasilnya? Layar hitam. Tidak ada error jelas, karakter tidak muncul, cuma hitam.

Setelah ngulik lama, ternyata file `.skel` camp diekspor pakai Spine v4 dan runtime v3 tidak bisa bacanya. Solusinya ganti ke library resmi dari Esoteric Software, tapi cara inisialisasinya beda total.

**Spine v3:**
```javascript
const loader = new PIXI.Loader();
loader.add("maki", "maki_home.skel", { ... });
loader.load((ldr, res) => {
    const maki = new PIXI.spine.Spine(res.maki.spineData);
});
```

**Spine v4:**
```javascript
await PIXI.Assets.load(["makiAtlas", "makiSkel"]);
const maki = spine.Spine.from({ skeleton: "makiSkel", atlas: "makiAtlas" });
```

Beda banget. Dan karena kedua halaman butuh versi yang berbeda, tidak bisa disatukan, terpaksa masing-masing halaman bawa library sendiri.

Ada satu perbedaan lagi yang baru ketahuan saat kena bug-nya, soal rotasi kepala. Di Spine v3, modifikasi rotasi tulang langsung di `updateWorldTransform` aman-aman saja. Di Spine v4, kalau nilai rotasi tidak di-restore setelah fungsi aslinya dipanggil, nilainya numpuk tiap frame dan kepala Maki muter-muter ga karuan :''v

```javascript
// Spine v4, simpan dulu, restore setelah panggil fungsiAsli
const oriLeher  = tulangLeher.rotation;
const oriKepala = tulangKepala.rotation;

tulangLeher.rotation  += rotasi * 0.2;
tulangKepala.rotation += rotasi * 0.8;

fungsiAsli(arg);

// Kalau lupa dua baris ini, kepala Maki jadi baling-baling :''v
tulangLeher.rotation  = oriLeher;
tulangKepala.rotation = oriKepala;
```

---

### 2. Atur Hitbox Kepala :''v

Ini sesi trial and error tanpa jalan pintas. Hitbox adalah lingkaran tak terlihat di area kepala. Klik di dalam lingkaran, animasi elus jalan. Klik di luar, Maki ngomong.

Masalahnya posisi "kepala" dalam koordinat Spine tidak sama dengan posisi kepala yang kelihatan di layar. Tiap file Spine punya titik origin, skala, dan offset yang berbeda. Jadi ada tiga angka yang harus dicari manual:

```javascript
hitboxRadius : 300,
hitboxX      : -200,
hitboxY      : -2450,
```

Cara nemuin angkanya: aktifkan debug circle (ada kode yang di-comment di source), ubah angkanya satu-satu, refresh browser, lihat hasilnya, geser lagi, refresh lagi, sampai lingkaran merahnya pas di kepala karakter.

Nilai `-2450` untuk `hitboxY` memang keliatan gila, tapi segitu offsetnya. Kalau ganti karakter baru, angka ini pasti beda dan harus dicari ulang dari nol. Tidak ada rumusnya.

---

### 3. Sinkronisasi Audio sama Animasi :''v

Ini yang paling banyak makan waktu. Maki punya animasi ngomong (mulut gerak, badan bergerak) dan file audio terpisah. Masalahnya animasi mulai dari detik 0 tapi suara belum tentu langsung keluar. Ada jeda natural di awal file audio, ada animasi yang perlu "pemanasan" dulu sebelum karakter benar-benar ngomong.

Hasil pertama kali dicoba: animasi sudah selesai tapi suara baru mulai. Atau sebaliknya. Atau lebih parah, dua audio main sekaligus karena timing-nya tabrakan :''v

Solusinya pakai sistem `jedaAwal`, tiap audio punya delay sebelum diputar:

```javascript
suara: [
    { file: "talk_1_1.ogg", jedaAwal: 1800, teks: "So, is this good enough?" },
    { file: "talk_1_2.ogg", jedaAwal: 1000, teks: "What do you think, Sensei?" }
]
```

Nilai `jedaAwal` juga hasil brute force. Buka game aslinya, dengerin timing suaranya, tebak jedanya dalam millisecond, test di browser, kurang pas, ubah, test lagi. Untuk lima skenario dialog bisa habis waktu lumayan cuma buat ngatur angka-angka ini :''v

Cara kerjanya: audio pertama diputar setelah nunggu `jedaAwal` ms. Setelah selesai (`onended`), baru audio kedua antri dengan `jedaAwal`-nya sendiri. Tidak ada timing absolut, setiap audio nunggu yang sebelumnya selesai dulu.

---

## Cara Kerja Render Karakter

PixiJS bikin kanvas WebGL di browser, plugin Spine baca file `.skel` dan `.atlas`, render animasinya di atas kanvas. Begitu sederhananya.

Spine pakai sistem "track" buat animasi, kayak layer:
- **Track 0** untuk animasi tubuh utama (idle, intro)
- **Track 1** untuk animasi saat ngomong atau dielus
- **Track 2** untuk animasi wajah dan mulut

```javascript
maki.state.setAnimation(0, "Idle_01", true);
maki.state.setAnimation(1, "Talk_01_M", false);
maki.state.setAnimation(2, "Talk_01_A", false);
```

Track 1 dan 2 menimpa track 0 secara visual, tapi track 0 tetap jalan di belakang. Jadi animasi idle tidak putus waktu Maki ngomong. Setelah selesai, track 1 dan 2 dikosongkan, yang kelihatan lagi ya track 0.

---

## Sistem Dialog

Setiap klik di luar kepala, satu skenario dialog jalan. Skenario disimpan di array `timeline`:

```javascript
timeline: [
    {
        animBody: "Talk_01_M",
        animFace: "Talk_01_A",
        suara: [
            { file: "talk_1_1.ogg", jedaAwal: 1800, teks: "So, is this good enough?" },
            { file: "talk_1_2.ogg", jedaAwal: 1000, teks: "What do you think, Sensei?" }
        ]
    },
    // skenario berikutnya...
]
```

Setelah semua skenario habis, balik ke index 0. Lima skenario? Klik keenam main lagi dari awal.

---

## Sistem BGM Lintas Halaman

Browser membunuh semua audio saat pindah halaman, tidak ada cara mencegahnya langsung. Solusi di sini: fade out sebelum pindah, simpan info volume ke `sessionStorage`, halaman baru baca info itu dan fade in dari volume 0.

```
Klik tombol pindah halaman
  -> BGM fade out ~400ms
  -> Simpan { volume } ke sessionStorage key "bgm_resume"
  -> window.location.href dijalankan

Halaman baru load
  -> Cek sessionStorage ada "bgm_resume" atau tidak
  -> Kalau ada: set volume = 0, play(), fade in ke volume normal
  -> Kalau tidak ada: tunggu klik pertama (atau langsung play)
```

BGM sengaja tidak dilanjut dari timestamp terakhir, tiap pindah halaman mulai dari awal. Lebih natural daripada masuk di tengah lagu :''v

---

## Splash Screen

Muncul sekali per sesi. Begitu diklik, flag `"sudah_masuk"` disimpan ke `sessionStorage`. Refresh, balik dari camp, apapun, selama tab sama, splash tidak muncul lagi.

Tutup tab, buka lagi, `sessionStorage` bersih, splash muncul lagi.

Sengaja pakai `sessionStorage` bukan `localStorage`. Kalau pakai `localStorage`, splash tidak pernah muncul lagi sampai cache dihapus manual, bukan itu yang diinginkan :''v

---

## File Bersama (`shared/`)

Supaya tidak nulis kode yang sama dua kali.

**`shared/ui.css`** berisi semua style UI: splash screen, tombol subtitle, tombol navigasi, balon kata, loading info.

Satu catatan penting: semua tombol pakai `position: fixed` bukan `absolute`. Alasannya karena canvas PixiJS di-insert ke DOM via JavaScript dan bisa nutup elemen lain. `fixed` bikin tombol selalu nempel di viewport dan tidak ikut ketindih. Ini bug yang sempat bikin bingung lumayan lama sebelum ketemu penyebabnya :''v

**`shared/ui-utils.js`** berisi satu fungsi besar `buatUI(maki, app, config)` yang dipanggil setelah karakter Spine berhasil di-load:

```javascript
const ui = buatUI(maki, app, CONFIG);

app.ticker.add(ui.tickerUpdate);
ui.pasangEventCanvas(app.view);
ui.pasangSplash(bgm, true, cb);
ui.resumeBGM(bgm);
```

---

## Cara Nambahin Halaman Baru

1. Copy HTML yang versi Spine-nya sama dengan file karakter baru
2. Ganti semua isi `CONFIG`
3. Aktifkan debug circle buat nemuin hitbox
4. Brute force `hitboxX`, `hitboxY`, `hitboxRadius` sampai pas :''v
5. Atur `jedaAwal` tiap audio sampai suaranya sinkron :''v
6. Tambah tombol navigasi, geser CSS `right`-nya tiap ada tombol baru

```css
/* Tiap tombol baru, geser 55px ke kiri */
#btn-nav-baru   { right: 130px; }
#btn-nav-camp   { right:  75px; }
#btn-subtitle   { right:  20px; }
```

---

## Penutup

Dari luar proyek ini kelihatan simpel. Ternyata ada cukup banyak hal kecil yang harus beres semua sebelum semuanya nyambung, versi library yang tepat, hitbox yang pas, timing audio yang sync, z-index yang tidak berantakan, BGM yang tidak mati pas pindah halaman.

Bagian yang paling banyak makan waktu bukan yang kelihatan susah. Justru yang "tinggal masukin angka", hitbox sama timing audio, yang butuh paling banyak percobaan.

Tapi hasilnya worth it. Maki hidup di browser dan bisa dielus. Sudah cukup :''v
