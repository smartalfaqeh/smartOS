#!/usr/bin/env bash
# Tulis FaqehOS ke pemacu USB dan cipta partition persistence (tetapan & app kekal).
# Guna:  sudo ./make-usb.sh faqehos.iso /dev/sdX      (gunakan lsblk untuk cari sdX)
# AMARAN: semua data pada USB itu akan dipadam.
set -euo pipefail
ISO="${1:-}"; DEV="${2:-}"
[ "$(id -u)" = 0 ] || { echo "Jalankan dengan sudo"; exit 1; }
[ -f "$ISO" ] && [ -b "$DEV" ] || { echo "Guna: sudo $0 faqehos.iso /dev/sdX"; exit 1; }
[ "$(lsblk -dno TYPE "$DEV")" = disk ] || { echo "$DEV mesti keseluruhan cakera (contoh /dev/sdb), bukan partition"; exit 1; }
if [ "$(lsblk -dno RM "$DEV")" != 1 ] && [ "$(lsblk -dno TRAN "$DEV")" != usb ]; then
  echo "$DEV bukan peranti USB. Dibatalkan demi keselamatan."; exit 1
fi
ROOTDISK="$(lsblk -no PKNAME "$(findmnt -no SOURCE /)" 2>/dev/null | head -1 || true)"
[ -z "$ROOTDISK" ] || [ "/dev/$ROOTDISK" != "$DEV" ] || { echo "Itu cakera sistem anda!"; exit 1; }
SZ=$(( $(blockdev --getsize64 "$DEV") / 1073741824 ))
[ "$SZ" -ge 12 ] || { echo "USB terlalu kecil (${SZ} GB). Guna sekurang-kurangnya 16 GB."; exit 1; }
lsblk "$DEV"
read -rp "SEMUA data pada $DEV akan DIPADAM. Taip YA untuk teruskan: " A
[ "$A" = YA ] || { echo "Dibatalkan"; exit 1; }
for p in $(lsblk -lnpo NAME "$DEV" | tail -n +2); do umount "$p" 2>/dev/null || true; done
echo ">> Menulis ISO..."
dd if="$ISO" of="$DEV" bs=4M status=progress conv=fsync
sync; partprobe "$DEV"; sleep 3
echo ">> Mencipta partition persistence..."
LABEL="$(parted -ms "$DEV" print | sed -n 2p | cut -d: -f6)"
END="$(parted -ms "$DEV" unit B print | tail -n1 | cut -d: -f3 | tr -d B)"
START="$(( END / 1048576 + 2 ))MiB"
if [ "$LABEL" = gpt ]; then parted -s "$DEV" mkpart persistence ext4 "$START" 100%
else parted -s "$DEV" mkpart primary ext4 "$START" 100%; fi
partprobe "$DEV"; sleep 3
NEW="$(lsblk -lnpo NAME "$DEV" | tail -n1)"
mkfs.ext4 -F -L persistence "$NEW"
M="$(mktemp -d)"; mount "$NEW" "$M"; echo "/ union" > "$M/persistence.conf"; umount "$M"; rmdir "$M"
sync
echo "Siap. Boot komputer daripada USB ini (tekan F12/F2/Esc semasa dihidupkan)."
