# Fasa 3: ciri yang memerlukan infrastruktur

## Faqeh Hello (sembang, panggilan, kongsi skrin/fail, permainan)
Memerlukan pelayan pusat: (1) pendaftaran ID unik (ID dijana setempat sekarang, format FQ-XXXX-XXXX; pelayan perlu menolak pertindihan dan mengesahkan bahawa pemilik menggunakan FaqehOS, contohnya tandatangan kunci peranti), (2) signalling WebRTC, (3) pelayan TURN untuk NAT, (4) storan mesej.
Pilihan: Supabase/Firebase untuk akaun dan mesej + LiveKit atau WebRTC sendiri dengan coturn. Kos pelayan dan moderasi perlu dirancang.

## Mod Pelayan
Pasang tindanan (nginx/Apache, Node, PHP-FPM, MariaDB/PostgreSQL, cron) melalui pembantu root. cPanel/WHM berlesen komersial dan tidak boleh disertakan percuma; alternatif sumber terbuka (contoh CloudPanel, Webmin). Perlindungan: Cloudflare Tunnel (tanpa membuka port), fail2ban, nftables, kemas kini automatik. Mendedahkan peranti rumah membawa risiko; ia mesti diuji teliti.

## Pasaran app/model 3D (Stripe)
Jual-beli antara pengguna memerlukan Stripe Connect (akaun penjual), pelayan untuk webhook dan pengesahan pembayaran, dan pengedaran pakej yang ditandatangani. Dashboard kewangan sedia ada hanya membaca akaun Stripe pengguna sendiri.
