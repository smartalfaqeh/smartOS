# FaqehOS: kit pembinaan (prototaip v0.3)

Sistem pengendalian dengan AI di terasnya. Asas: Debian 13; desktop labwc + taskbar waybar; shell web FaqehOS;
Faqeh Store, My Faqeh App (Make a Software), pengurus fail, Pengurus Tugas, Tetapan gaya Windows, enjin AI berantai,
Blender bersambung, Claude Desktop/Code automatik, Stripe (pilihan), keselamatan berlapis.

## Bina ISO
- Awan: muat naik SEMUA kandungan kit ke repositori GitHub (termasuk `.github/workflows/build-iso.yml`), tab Actions → "Bina ISO FaqehOS" → Run workflow.
  Jika repositori anda mengandungi fail versi lama, `build.sh` membuang sisa nama lama secara automatik.
- Mesin sendiri: `sudo ./build.sh` (Debian 13) atau `docker run --rm --privileged -v "$PWD":/work -w /work debian:trixie bash ./build.sh`
- USB portable (Linux): `sudo ./make-usb.sh faqehos.iso /dev/sdX`. VM: VirtualBox, 4 GB RAM, EFI, VMSVGA 128 MB, 3D acceleration.

## Tetapan pembangun (sebelum membina)
Edit `iso/config/includes.chroot_after_packages/opt/faqehos/service/branding.json`:
- `donate_url`: Stripe Payment Link anda (butang Derma). Aktifkan kad dan FPX dalam Stripe untuk MYR.
- `update_repo`: `pemilik/nama-repositori` GitHub anda (untuk semakan kemas kini).
- `VERSION` (sebelah fail itu): naikkan nombor versi setiap keluaran, dan tag keluaran GitHub sebagai `v0.3.1` dsb.
Lihat `docs/SETUP.md` untuk langkah penuh.

## Apa yang ada
- Boot: menu GRUB/BIOS disembunyikan → skrin Plymouth (logo FaqehOS, cahaya turquoise, kilauan emas) → intro 3D logo (animasi anda, luar talian, dilangkau jika WebGL tiada/perlahan) → desktop. Tiada skrin log masuk teks.
- Desktop: pintasan boleh diseret (tetikus dan sentuh, tekan lama), klik kanan seperti Windows, ikon kecil/sederhana/besar, 4 latar.
- Bar tugas: butang logo (menu mula), tetingkap berbilang (Alt+Tab), klik kanan butang logo/jam/bunyi = menu (Pengurus Tugas, Tetapan bar tugas).
- Tetapan: Sistem, Personalisasi (6 warna), Rangkaian (Wi-Fi), Akaun (ID Faqeh), Masa & Bahasa (Melayu/English serta-merta), Privasi & Keselamatan, AI & API, Bayaran (Stripe), Pelayan (akan datang), Kemas kini, Tentang (hak cipta, lesen, derma).
- Claude: Claude Desktop rasmi (beta, repositori apt Anthropic) dan Claude Code (pemasang rasmi) dipasang/dikemas kini automatik apabila ada internet dan ruang cakera. Ruang kerja `~/Claude/{input,arahan,about,md,bahan,output}` + `CLAUDE.md`.
- AI: rantaian penyedia berkeutamaan (Anthropic, OpenAI, Kimi, DeepSeek, Ollama); tukar automatik bila kuota habis. Ruang kunci Meshy.
- Pustaka 3D luar talian untuk app buatan AI: three, babylon, theatre. Blender + AI melalui jambatan.
- Pemasang (eksperimen): Calamares berjenama FaqehOS, pilihan bahasa pada halaman Welcome. Tersedia dalam sesi live (Menu Mula → Pasang FaqehOS).

## Ujian
`python3 tests/selftest.py` (96 ujian servis dan konfigurasi). `npm install jsdom && node tests/ui_test.js` (54 ujian UI termasuk seret-lepas, bahasa English, semua halaman Tetapan).

## Status jujur
Diuji di sandbox: servis, semua paparan UI (jsdom), terjemahan, pengurus fail, rantaian AI, Stripe (validasi/penyembunyian kunci), sintaks semua konfigurasi dan skrip.
BELUM diuji pada VM/perkakasan: labwc/waybar/gtk-layer-shell, tetingkap popup bersaiz tetap, intro 3D (WebGL) dalam WebKitGTK, boot senyap + retain-splash,
grub/syslinux disembunyikan, Calamares + firstboot, pemasangan Claude Desktop, Flatpak, ClamAV, panggilan API sebenar (AI, Stripe).
Jangkakan beberapa pusingan pembaikan.

## Diagnosis skrin gelap (daripada rakaman anda)
Rakaman menunjukkan serpihan jubin menu mula di tengah desktop, kemudian skrin gelap. Punca yang paling sepadan: tetingkap lutsinar skrin penuh (menu mula/kuasa)
tidak dilukis semula dengan betul dalam WebKitGTK tanpa pecutan grafik, dan tersangkut di atas segala-galanya. Pembetulan: semua tetingkap popup kini OPAK dan bersaiz tetap;
`faqehos-watch` memulakan semula desktop/bar yang terhenti dan merekod kesihatan ke `~/health.log`; earlyoom dilindungi daripada mematikan desktop; `consoleblank=0`.
Punca tidak dapat disahkan 100% tanpa menguji pada VM. Jika berulang, hantar `~/health.log`, `~/labwc.log` dan `~/desktop.log`.

## Had diketahui
- Mod live: perubahan hilang selepas reboot (melainkan USB persistence). Faqeh Store dan Claude Desktop memerlukan ruang cakera (>= 1.8 GB / 2.5 GB); dalam live ia akan menolak dengan mesej jelas.
- Faqeh Hello, Mod Pelayan dan pasaran jual-beli (Stripe Connect) belum dibina: lihat `docs/FASA3.md`.
- "Tersembunyi Linux" hanya pada jenama dan antara muka; kernel dan komponen sumber terbuka kekal (lesen dipaparkan dalam Tentang).
- Kemas kini versi FaqehOS (shell/servis) melalui GitHub belum disediakan sepenuhnya: butang semak sedia, aplikasi kemas kini melalui apt/Flatpak sahaja. Lihat `docs/SETUP.md`.
