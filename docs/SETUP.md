# Persediaan pembangun

1. GitHub: cipta repositori, muat naik kit, jalankan workflow. Muat turun ISO daripada tab Releases.
2. `branding.json`: isi `update_repo` (contoh `smartalfaqeh/faqehos`) dan `donate_url`.
3. Stripe Payment Link untuk derma: Stripe Dashboard → Payment Links → cipta pautan (jumlah bebas/tetap), aktifkan kaedah kad dan FPX (MYR), salin URL ke `donate_url`. Nota: pembayar tidak boleh "membayar dengan baki Stripe"; kaedah yang ada ialah kad, FPX dan dompet digital yang anda aktifkan.
4. Versi: ubah fail `VERSION`, bina, dan tag keluaran GitHub `vX.Y.Z`. Butang "Semak kemas kini" membandingkan tag dengan VERSION.
5. Kemas kini automatik penuh (langkah seterusnya, kita sediakan bersama): workflow menjana `faqehos-overlay.tar.gz` + tandatangan Ed25519; pengemas kini root mengesahkan tandatangan sebelum menggantikan `/opt/faqehos`.
6. Claude Desktop (rasmi): dipasang pada mesin pengguna daripada repositori apt Anthropic (cap jari kunci disemak). Ia tidak disertakan dalam ISO.
