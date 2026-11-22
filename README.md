# SmartOS – kit pembinaan (prototaip v0.1)

OS berasaskan Debian 13 (trixie) dengan enjin AI, "Make a Software", Blender bersambung automatik,
Wine/Proton untuk app Windows, dan kemas kini automatik. Kit ini menghasilkan fail ISO live.

## Bina ISO
Pilihan A, mesin Debian 12/13 (atau VM):  `sudo ./build.sh`
Pilihan B, Docker pada Linux lain: `docker run --rm --privileged -v "$PWD":/work -w /work debian:trixie ./build.sh`

Perlu ~15 GB ruang kosong, internet, dan 20 hingga 60 minit. Hasilnya `smartos.iso`.
Log ada dalam `build.log`. Jika build gagal, hantar log itu untuk dibaiki.

## Bina di awan (GitHub Actions, tanpa memasang apa-apa)
1. Cipta akaun GitHub dan repositori baharu (public disyorkan).
2. Muat naik SEMUA kandungan kit ke repositori, termasuk folder tersembunyi `.github/workflows/build-iso.yml`
   (jika muat naik melalui pelayar tidak membawanya, guna "Add file → Create new file", taip laluan
   `.github/workflows/build-iso.yml` dan tampal kandungan fail itu).
3. Tab Actions → "Bina ISO SmartOS" → Run workflow. Tunggu 40 hingga 90 minit.
4. Tab Releases: muat turun semua `smartos.iso.part-*` dan `smartos.iso.sha256`, gabungkan (arahan ada pada halaman Release).
Jika gagal, muat turun artifak `build-log` daripada larian itu. ISO dipecah kerana had 2 GB sefail pada Release.

## Uji
`./test-in-vm.sh smartos.iso` (QEMU), atau buka ISO dalam VirtualBox/VMware (4 GB RAM, EFI, 3D acceleration).
Jika sistem boot, anda akan nampak skrin boot Plymouth dengan logo, kemudian shell SmartOS.

## USB portable (boleh dibawa ke komputer lain)
Cara paling mudah (Linux): `sudo ./make-usb.sh smartos.iso /dev/sdX` (cari sdX dengan `lsblk`; skrip menolak cakera bukan USB
dan cakera sistem). Ia menulis ISO dan mencipta partition `persistence` supaya tetapan, kunci API dan app yang dicipta kekal.
Windows/Mac: guna Rufus (mod "DD Image") atau balenaEtcher. Itu cuma menghasilkan USB live tanpa persistence.
Keperluan: USB 3.0, sekurang-kurangnya 16 GB. Pada komputer dengan Secure Boot, matikan Secure Boot dalam BIOS
(imej ini tidak ditandatangani). Kunci API disimpan tanpa penyulitan pada USB: jangan hilangkan USB anda.

## Mula guna
1. Tetapan (ikon gear) → pilih penyedia (anthropic / openai / deepseek / ollama), masukkan kunci API.
   Pilih `mock` untuk mencuba aliran tanpa kunci (app demo sahaja).
2. "Cipta app" → taip apa yang anda mahu → pratonton → ubah → Pasang.
3. Bar atas: butang AI/Blender. Dalam mod Blender, arahan anda dijadikan skrip bpy dan dijalankan dalam Blender
   (Blender mesti dibuka melalui SmartOS).

## Struktur
- `iso/` konfigurasi live-build (pakej, hook, fail yang disalin ke OS)
- `opt/smartos/service/smartos_service.py` enjin AI, pengurus app, peranti, jambatan Blender
- `opt/smartos/shell/` antara muka desktop (HTML) dan tetingkap WebKitGTK
- `opt/smartos/sdk/smartos-sdk.js` API `window.os` untuk app yang dijana
- `opt/smartos/blender/smartos_bridge.py` add-on jambatan Blender
- `opt/smartos/bin/smartos-update` + `smartos-update.timer` kemas kini automatik harian
- `usr/share/plymouth/themes/smartos/` skrin boot
- `tests/selftest.py` ujian servis (`python3 tests/selftest.py`)

## Keselamatan (ringkas)
- App dijana berjalan dalam iframe sandbox tanpa akses langsung ke servis; semua panggilan melalui shell yang menyemak
  kebenaran. Rangkaian ditutup melalui CSP melainkan kebenaran "Internet" diberi.
- Servis hanya di 127.0.0.1, memerlukan token sesi dan menyemak Host.
- Kebenaran "Blender" membolehkan app menjalankan skrip Python dalam Blender dengan hak pengguna. Beri hanya pada app yang dipercayai.
- Pakej `.smartapp` hanya ditandatangani dengan sha256 (semak integriti), BUKAN tandatangan kriptografi pengarang.
  Tambah tandatangan kunci awam sebelum membuka repositori kongsi awam.

## Status jujur
Telah diuji (sandbox, tanpa ISO): servis + 24 ujian automatik, jambatan Blender dengan bpy tiruan, sintaks semua skrip.
BELUM diuji: `lb build` sebenar, boot ISO, Plymouth, WebKitGTK shell di bawah cage, Wine/Steam, Blender sebenar,
panggilan ke API AI sebenar. Jangkakan beberapa pembaikan pada percubaan pertama.

## Had diketahui
- ISO ialah mod live: perubahan hilang selepas reboot. Pemasang (Calamares) belum disertakan.
- `cage` memaparkan satu app skrin penuh pada satu masa (mod kiosk). Untuk berbilang tetingkap, tukar kepada labwc/sway.
- Steam dipasang melalui Flatpak/pakej pada percubaan pertama; permainan dengan anti-cheat kernel tidak akan berjalan.
- Pemacu NVIDIA proprietari tidak disertakan (guna nouveau). Tambah pada senarai pakej jika perlu.
