# SmartOS: kit pembinaan (prototaip v0.2)

OS berasaskan Debian 13 (trixie): desktop labwc + taskbar waybar, shell web SmartOS, enjin AI berantai,
My Smart App (Make a Software), Smart Store, pengurus fail, Doktor SmartOS, Blender bersambung, keselamatan berlapis.

## Bina ISO
- Awan (disyorkan): muat naik SEMUA kandungan kit ke repositori GitHub (termasuk `.github/workflows/build-iso.yml`),
  tab Actions → "Bina ISO SmartOS" → Run workflow. ISO dipecah dan diterbitkan di tab Releases.
- Mesin sendiri: `sudo ./build.sh` pada Debian 13, atau
  `docker run --rm --privileged -v "$PWD":/work -w /work debian:trixie bash ./build.sh`
- USB portable dengan persistence (Linux): `sudo ./make-usb.sh smartos.iso /dev/sdX`.
- VM: VirtualBox, 4 GB RAM, EFI, VMSVGA 128 MB + 3D acceleration, lampirkan ISO.

## Aliran boot
GRUB → skrin Plymouth (logo + nama SmartOS, dikekalkan) → desktop dengan intro 3D logo + api turquoise
(dilangkau automatik jika WebGL tidak tersedia) → taskbar muncul. Tiada skrin log masuk teks.

## Desktop
- Taskbar bawah: butang logo (menu mula), senarai tetingkap (klik = kecil/besar, klik tengah = tutup), bunyi, rangkaian, bateri, jam, kuasa.
- Desktop depan: hanya pintasan (boleh skrol). Menu mula: app Smart Store yang dipasang + butang My Smart App.
- My Smart App: app yang anda cipta (Make a Software). Klik "Pin ke desktop" untuk letak pintasan di desktop depan.
- Pintasan: Super+Ruang menu mula, Super+E Fail, Super+D tunjuk desktop, Alt+Tab tukar tetingkap, Ctrl+Alt+T Terminal.
- Alat pejabat: Google Docs/Sheets/Slides/Drive/Gmail dan Claude dibuka sebagai tetingkap aplikasi web (Chromium/Chrome).

## Enjin AI (Tetapan → AI)
Senarai penyedia berkeutamaan (Anthropic, OpenAI, DeepSeek, Ollama). Susun mengikut kualiti; jika kuota habis atau ralat
SmartOS bertukar ke penyedia seterusnya dan merehatkan yang gagal (1 jam jika kuota, 6 jam jika kunci ditolak).
Kunci disimpan di `~/.config/smartos/config.json` (mod 600) dan tidak pernah dihantar kembali ke antara muka.

## Terminal
`foot`. Taip `install-claude-code` atau `install-codex` (memerlukan Node.js, sudah disertakan), `smartos-help` untuk bantuan.

## Pustaka 3D untuk app yang dijana
Tersedia luar talian: `three` (r128), `babylon`, `theatre`. Senaraikan dalam "libs" pada manifest; SmartOS memuatkannya ke dalam sandbox.
Untuk kuasa penuh: Blender + AI (butang AI/Blender pada desktop, atau API `os.blender.run`).

## Keselamatan (berlapis, bukan jaminan mutlak)
Tembok api nftables (tolak semua sambungan masuk), AppArmor, sysctl yang diperketat, root dikunci, tiada sshd, kemas kini keselamatan automatik,
Flatpak sandbox untuk Smart Store (hanya ID dalam katalog), app dijana AI dalam iframe sandbox + CSP tanpa rangkaian + kebenaran per-app + imbasan kod,
pengurus fail terhad kepada rumah/media, imbasan virus ClamAV atas permintaan, servis hanya di 127.0.0.1 dengan token sesi.
Tidak ada: penyulitan cakera, Secure Boot ditandatangani, tandatangan kriptografi pengarang untuk .smartapp (hanya sha256).

## Doktor SmartOS
Tetapan → Doktor: mengumpul log (kunci/token disembunyikan), meminta AI menganalisis dan menghasilkan laporan + cadangan pembaikan.
Ia hanya mencadangkan. Pilihan jalankan sekali sehari menggunakan kuota AI anda.

## Ujian
`python3 tests/selftest.py` (66 ujian servis dan konfigurasi), `npm install jsdom && node tests/ui_test.js` (27 ujian UI).

## Status jujur
Diuji di sandbox: servis, pengurus fail (undo/redo/keselamatan laluan), rantaian AI, Store (tanpa Flatpak sebenar), semua paparan UI dalam jsdom,
sintaks semua konfigurasi. BELUM diuji pada perkakasan/VM: labwc, waybar, gtk-layer-shell, taskbar, menu mula overlay, intro 3D (WebGL),
boot senyap + plymouth retain-splash, Chromium/Chrome, Flatpak install, ClamAV, zram/thermald, panggilan API AI sebenar.
Jangkakan beberapa pusingan pembaikan selepas ujian pertama. Sesi sandaran: jika labwc gagal, cage (kiosk) dimulakan; log di ~/*.log.

## Had diketahui
- Mod live: perubahan hilang selepas reboot tanpa persistence; pemasangan besar (Blender Flatpak, DB virus) dilangkau jika ruang kurang 6 GB.
- Tiada pemasang (Calamares) lagi.
- "Chrome" lalai ialah Chromium; Google Chrome sebenar dipasang melalui Smart Store.
- Prestasi: zram, earlyoom, thermald, power-profiles-daemon dan desktop ringan membantu, tetapi tidak boleh dijanjikan "tanpa lag dan tanpa panas" pada semua perkakasan.
