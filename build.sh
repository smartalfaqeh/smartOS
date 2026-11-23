#!/usr/bin/env bash
# Bina ISO SmartOS. Jalankan pada Debian 12/13 sebagai root, ATAU melalui Docker:
#   docker run --rm --privileged -v "$PWD":/work -w /work debian:trixie bash ./build.sh
set -euo pipefail
cd "$(dirname "$0")"
[ "$(id -u)" = 0 ] || { echo "Jalankan sebagai root (sudo ./build.sh)"; exit 1; }
apt-get update
apt-get install -y live-build debootstrap xorriso squashfs-tools debian-archive-keyring \
  syslinux syslinux-common isolinux grub-pc-bin grub-efi-amd64-bin mtools dosfstools

# live-build (trixie) hanya membenarkan SATU folder: includes.chroot_after_packages.
C=iso/config
if [ -d $C/includes.chroot ]; then
  if [ -e $C/includes.chroot_after_packages ]; then rm -rf $C/includes.chroot
  else mv $C/includes.chroot $C/includes.chroot_after_packages; fi
fi
# muat naik melalui web membuang bit "boleh laku", jadi tetapkan semula
chmod +x iso/auto/config $C/hooks/live/* 2>/dev/null || true
chmod +x $C/includes.chroot_after_packages/opt/smartos/bin/* \
         $C/includes.chroot_after_packages/opt/smartos/service/*.py \
         $C/includes.chroot_after_packages/opt/smartos/shell/*.py 2>/dev/null || true

cd iso
lb clean --purge || true
lb config
lb build 2>&1 | tee ../build.log
ISOFILE="$(ls -1 *.iso | head -1)"
[ -n "$ISOFILE" ] || { echo "ISO tidak dijumpai, semak build.log"; exit 1; }
mv -f "$ISOFILE" ../smartos.iso
echo "Siap: $(ls ../*.iso)"
