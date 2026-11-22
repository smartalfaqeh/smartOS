#!/usr/bin/env bash
# Uji ISO dalam QEMU (apt install qemu-system-x86 ovmf). Tambah -enable-kvm jika tersedia.
ISO="${1:-smartos.iso}"
exec qemu-system-x86_64 -m 4096 -smp 2 -enable-kvm -cdrom "$ISO" -boot d \
  -vga virtio -display gtk,gl=on -device intel-hda -device hda-duplex \
  -usb -device usb-tablet -nic user,model=virtio-net-pci
