#!/usr/bin/env bash
# Bina ISO SmartOS. Jalankan pada Debian 12/13 sebagai root, ATAU melalui Docker:
#   docker run --rm --privileged -v "$PWD":/work -w /work debian:trixie ./build.sh
set -euo pipefail
cd "$(dirname "$0")"
[ "$(id -u)" = 0 ] || { echo "Jalankan sebagai root (sudo ./build.sh)"; exit 1; }
apt-get update
apt-get install -y live-build debootstrap xorriso squashfs-tools debian-archive-keyring
# muat naik melalui web membuang bit "boleh laku", jadi tetapkan semula
chmod +x iso/auto/config iso/config/hooks/live/* iso/config/includes.chroot/opt/smartos/bin/* iso/config/includes.chroot/opt/smartos/service/*.py iso/config/includes.chroot/opt/smartos/shell/*.py 2>/dev/null || true
cd iso
# live-build baharu menggunakan nama includes.chroot_after_packages
rm -rf config/includes.chroot_after_packages
cp -a config/includes.chroot config/includes.chroot_after_packages
lb clean --purge || true
lb config
lb build 2>&1 | tee ../build.log
ISOFILE="$(ls -1 *.iso | head -1)"
[ -n "$ISOFILE" ] || { echo "ISO tidak dijumpai, semak build.log"; exit 1; }
mv -f "$ISOFILE" ../smartos.iso
rm -rf config/includes.chroot_after_packages
echo "Siap: $(ls ../*.iso)"
