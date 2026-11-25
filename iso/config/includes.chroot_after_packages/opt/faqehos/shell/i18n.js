"use strict";
/* Terjemahan Bahasa Melayu (asal) ke English. Menukar teks, placeholder, tajuk dan aria-label pada DOM secara langsung;
   boleh ditukar balik dan mengikuti kandungan dinamik (MutationObserver). */
(function () {
  const EN = {
    "Tetapan": "Settings", "Sistem": "System", "Personalisasi": "Personalization", "Rangkaian": "Network", "Akaun": "Account", "Masa & Bahasa": "Time & Language",
    "Privasi & Keselamatan": "Privacy & Security", "AI & API": "AI & API", "Bayaran": "Payments", "Pelayan": "Server", "Kemas kini": "Updates", "Tentang": "About",
    "Peranti": "Device", "Nama peranti": "Device name", "Pemproses": "Processor", "Memori (RAM)": "Memory (RAM)", "Storan": "Storage", "Pemacu grafik": "Graphics driver",
    "Seni bina": "Architecture", "Versi FaqehOS": "FaqehOS version", "Paparan": "Display", "Resolusi": "Resolution", "Peranti input": "Input device",
    "Skrin sentuh dikesan": "Touchscreen detected", "Tetikus / pad sentuh": "Mouse / touchpad", "Kuasa dan prestasi": "Power and performance", "Mod prestasi": "Performance mode",
    "Jimat bateri": "Battery saver", "Seimbang": "Balanced", "Prestasi": "Performance", "Mod dikemas kini": "Mode updated",
    "Jimat bateri mengurangkan haba dan penggunaan kuasa.": "Battery saver reduces heat and power use.",
    "Pengurusan profil kuasa tidak tersedia pada peranti ini.": "Power profile management is not available on this device.",
    "Pengurus Tugas": "Task Manager", "Buka": "Open", "Tutup": "Close", "Batal": "Cancel", "Simpan": "Save", "Disimpan": "Saved", "Disimpan.": "Saved.", "Teruskan": "Continue", "Sahkan": "Confirm",
    "Anda dalam sesi live: perubahan disimpan dalam RAM dan hilang selepas mulakan semula (melainkan USB mempunyai persistence). Pasang FaqehOS ke cakera untuk kegunaan tetap.":
      "You are in a live session: changes are kept in RAM and lost after a restart (unless the USB has persistence). Install FaqehOS to disk for permanent use.",
    "Warna tema": "Theme colour", "Warna ini digunakan pada semua tetingkap, bar tugas dan sempadan tetingkap.": "This colour is used on all windows, the taskbar and window borders.",
    "Warna dikemas kini": "Colour updated", "Latar desktop": "Desktop background", "Aurora": "Aurora", "Tengah malam": "Midnight", "Hutan": "Forest", "Senja": "Dusk",
    "Ikon desktop": "Desktop icons", "Kecil": "Small", "Sederhana": "Medium", "Besar": "Large", "Animasi dan prestasi": "Animation and performance", "Tahap animasi": "Animation level",
    "Penuh": "Full", "Rendah": "Low", "Mati": "Off", "Rendah atau mati menjimatkan CPU/GPU dan bateri.": "Low or off saves CPU/GPU and battery.",
    "Animasi 3D semasa mula": "3D animation at start", "Dilangkau secara automatik jika peranti tidak menyokong WebGL atau perlahan.": "Skipped automatically if the device lacks WebGL support or is slow.",
    "Bar tugas": "Taskbar", "Klik kanan butang logo atau jam pada bar tugas untuk Pengurus Tugas dan pintasan. Klik tengah pada butang tetingkap untuk menutupnya.":
      "Right-click the logo button or clock on the taskbar for Task Manager and shortcuts. Middle-click a window button to close it.",
    "Status": "Status", "Internet": "Internet", "Bersambung": "Connected", "Tiada akses": "No access", "Alamat IP": "IP address", "Ethernet": "Ethernet", "Cari rangkaian": "Scan networks",
    "Mencari…": "Searching…", "bersambung": "connected", "Putuskan": "Disconnect", "Lupakan": "Forget", "Sambung": "Connect", "Menyambung…": "Connecting…",
    "Tiada rangkaian Wi-Fi dijumpai (atau tiada adaptor Wi-Fi).": "No Wi-Fi networks found (or no Wi-Fi adapter).",
    "Profil": "Profile", "Nama paparan": "Display name", "Nama pengguna": "Username", "ID Faqeh": "Faqeh ID", "ID Faqeh anda": "Your Faqeh ID", "Salin": "Copy", "Salin ID": "Copy ID", "ID disalin": "ID copied",
    "ID unik anda untuk Faqeh Hello. Dijana pada peranti ini dan akan didaftarkan di pelayan Faqeh apabila perkhidmatan tersedia.": "Your unique ID for Faqeh Hello. Generated on this device and will be registered on the Faqeh server when the service is available.",
    "Dicipta": "Created", "Faqeh Hello": "Faqeh Hello", "Buka Faqeh Hello": "Open Faqeh Hello",
    "Sembang, panggilan suara, kongsi skrin/fail dan permainan bersama rakan (tambah rakan dengan ID Faqeh). Belum aktif: memerlukan pelayan pusat.": "Chat, voice calls, screen/file sharing and games with friends (add friends by Faqeh ID). Not active yet: needs a central server.",
    "Faqeh Hello (sembang antara rakan, panggilan suara, kongsi skrin dan fail, permainan bersama) belum aktif. Ia memerlukan pelayan pusat Faqeh untuk mendaftar ID yang unik dan menghubungkan peranti. ID di atas dijana pada peranti ini dan akan didaftarkan apabila pelayan tersedia.":
      "Faqeh Hello (friend chat, voice calls, screen and file sharing, shared games) is not active yet. It needs a central Faqeh server to register unique IDs and connect devices. The ID above is generated on this device and will be registered when the server is available.",
    "Bahasa": "Language", "Bahasa paparan": "Display language", "Bahasa Melayu": "Malay (Bahasa Melayu)", "English": "English", "Bahasa ditukar": "Language changed", "Language changed": "Language changed",
    "Bahasa dikemas kini serta-merta pada semua tetingkap. Pemasang FaqehOS juga menawarkan pilihan bahasa semasa pemasangan.": "The language updates immediately in all windows. The FaqehOS installer also offers a language choice during installation.",
    "Masa": "Time", "Format 24 jam": "24-hour format", "Zon waktu": "Time zone", "Zon waktu ditetapkan semasa pemasangan.": "The time zone is set during installation.", "Masa semasa": "Current time",
    "Status keselamatan": "Security status", "Tembok api": "Firewall", "Imbasan virus": "Virus scan", "Imbas folder Muat turun": "Scan Downloads folder", "Imbas folder Rumah": "Scan Home folder",
    "Kebenaran app (My Faqeh App)": "App permissions (My Faqeh App)", "Belum ada app yang dicipta.": "No apps created yet.", "Tiada kebenaran diminta": "No permissions requested",
    "Tiada ancaman dijumpai.": "No threats found.", "Klik untuk tukar": "Click to toggle", "Simpan data": "Store data", "Blender (boleh jalankan skrip)": "Blender (can run scripts)",
    "Lapisan: tembok api (tiada sambungan masuk), AppArmor, sandbox + CSP untuk app buatan AI, kebenaran per-app, imbasan kod, dan sandbox Flatpak untuk Faqeh Store. Tiada sistem boleh dijamin kebal sepenuhnya.":
      "Layers: firewall (no incoming connections), AppArmor, sandbox + CSP for AI-made apps, per-app permissions, code scanning, and Flatpak sandbox for Faqeh Store. No system can be guaranteed fully immune.",
    "Pangkalan data virus belum dimuat turun (dikemas kini automatik apabila ada internet dan ruang).": "The virus database has not been downloaded yet (updated automatically when internet and space are available).",
    "Enjin AI (rantaian penyedia)": "AI engine (provider chain)",
    "Susun mengikut keutamaan (atas = dicuba dahulu; letakkan model terbaik di atas). Jika kuota habis atau ralat, FaqehOS bertukar automatik ke penyedia seterusnya. Kunci disimpan pada peranti ini sahaja dan tidak dipaparkan semula.":
      "Order by priority (top = tried first; put the best model on top). If a quota runs out or an error occurs, FaqehOS switches automatically to the next provider. Keys are stored on this device only and never shown again.",
    "Anthropic (Claude)": "Anthropic (Claude)", "OpenAI": "OpenAI", "Kimi (Moonshot)": "Kimi (Moonshot)", "DeepSeek": "DeepSeek", "Ollama (tempatan)": "Ollama (local)", "Mock (demo)": "Mock (demo)",
    "Kunci tersimpan (taip untuk ganti)": "Key stored (type to replace)", "Tidak perlu kunci": "No key needed", "Tampal kunci API": "Paste API key", "kunci ada": "key present", "Uji sambungan": "Test connection",
    "Penjanaan 3D: Meshy": "3D generation: Meshy", "Tampal kunci API Meshy": "Paste Meshy API key", "Kunci Meshy disimpan": "Meshy key saved",
    "Ruang simpanan untuk kunci API Meshy (penjanaan model 3D daripada teks/imej). Sambungan ke Meshy akan ditambah kemudian; kunci disimpan dengan selamat sekarang.":
      "Placeholder for the Meshy API key (3D model generation from text/images). The Meshy connection will be added later; the key is stored safely for now.",
    "Claude": "Claude", "Claude Code": "Claude Code", "Claude Desktop": "Claude Desktop", "internet ada": "internet available", "tiada internet": "no internet",
    "Pasang Claude Desktop": "Install Claude Desktop", "Kemas kini Claude Desktop": "Update Claude Desktop", "Pasang Claude Code": "Install Claude Code", "Kemas kini Claude Code": "Update Claude Code",
    "Buka Claude Code": "Open Claude Code", "Buka folder kerja": "Open work folder", "Memasang Claude Desktop…": "Installing Claude Desktop…", "Memasang/mengemas kini Claude Code…": "Installing/updating Claude Code…",
    "Doktor FaqehOS (ejen pencari bug)": "FaqehOS Doctor (bug-hunting agent)", "Jalankan sekarang": "Run now", "Jalankan sekali sehari (menggunakan kuota AI)": "Run once a day (uses AI quota)", "Menganalisis…": "Analysing…",
    "Mengumpul log sistem (kunci dan token disembunyikan), meminta AI menganalisis dan menghasilkan laporan serta cadangan pembaikan. Ia hanya mencadangkan; tiada apa diubah tanpa anda.":
      "Collects system logs (keys and tokens are hidden), asks the AI to analyse them and produce a report with suggested fixes. It only suggests; nothing is changed without you.",
    "Bayaran (Stripe)": "Payments (Stripe)", "Aktifkan Bayaran": "Enable Payments", "Fungsi ini dimatikan sehingga anda mengaktifkannya.": "This feature stays off until you enable it.",
    "Dengan Stripe anda boleh menerima bayaran, contohnya apabila menjual app atau model 3D ciptaan anda. Pengguna memerlukan akaun Stripe sendiri.": "With Stripe you can receive payments, for example when selling apps or 3D models you created. Each user needs their own Stripe account.",
    "Panduan: dapatkan akaun Stripe": "Guide: get a Stripe account", "Daftar akaun di Stripe dan lengkapkan pengesahan perniagaan/individu.": "Sign up for a Stripe account and complete business/individual verification.",
    "Buka Developers → API keys. Salin Publishable key (pk_) dan cipta Restricted key (rk_) dengan kebenaran baca untuk Charges dan Balance (lebih selamat daripada kunci rahsia penuh).": "Open Developers → API keys. Copy the Publishable key (pk_) and create a Restricted key (rk_) with read permission for Charges and Balance (safer than a full secret key).",
    "Untuk webhook: Developers → Webhooks, salin Signing secret (whsec_). Penerimaan webhook memerlukan pelayan awam (Mod Pelayan, akan datang).": "For webhooks: Developers → Webhooks, copy the Signing secret (whsec_). Receiving webhooks needs a public server (Server Mode, coming soon).",
    "Tampal kunci di bawah, tekan Simpan, kemudian Uji sambungan.": "Paste the keys below, press Save, then Test connection.", "Buka pendaftaran Stripe": "Open Stripe sign-up", "Buka halaman API keys": "Open API keys page",
    "Kunci Stripe": "Stripe keys", "Publishable key": "Publishable key", "Secret / Restricted key": "Secret / Restricted key", "Webhook signing secret": "Webhook signing secret",
    "Disimpan pada peranti ini (kebenaran fail 600) dan tidak dipaparkan semula.": "Stored on this device (file permission 600) and never shown again.", "Padam kunci": "Delete keys", "Padam": "Delete",
    "Padam semua kunci Stripe daripada peranti ini?": "Delete all Stripe keys from this device?", "Dashboard kewangan": "Financial dashboard", "7 hari": "7 days", "30 hari": "30 days", "90 hari": "90 days", "Muat": "Load",
    "Memuatkan…": "Loading…", "Baki tersedia": "Available balance", "Baki tertangguh": "Pending balance", "Tiada transaksi dalam tempoh ini.": "No transactions in this period.", "Transaksi terkini": "Recent transactions",
    "Mod Pelayan (akan datang)": "Server Mode (coming soon)", "Aktifkan Mod Pelayan": "Enable Server Mode", "Mod Pelayan belum tersedia": "Server Mode is not available yet", "Dimatikan: ciri ini belum dibina.": "Off: this feature has not been built yet.",
    "Matlamat: menjadikan peranti anda pelayan web (Apache/Nginx, Node.js, PHP, MySQL/PostgreSQL, tugas cron, WebSocket) dengan perlindungan seperti Cloudflare dan tembok api yang ketat. Peranti perlu dihidupkan 24/7.":
      "Goal: turn your device into a web server (Apache/Nginx, Node.js, PHP, MySQL/PostgreSQL, cron jobs, WebSocket) with Cloudflare-style protection and a strict firewall. The device must stay on 24/7.",
    "Nota lesen: cPanel/WHM ialah produk berlesen komersial dan tidak boleh disertakan percuma. FaqehOS akan menyediakan alternatif sumber terbuka (contohnya panel kawalan lain) dan memaklumkan jika lesen perlu dibeli oleh pengguna. Mendedahkan peranti rumah ke internet membawa risiko keselamatan; ciri ini akan dibina dengan teliti dan diuji sebelum dibuka.":
      "Licence note: cPanel/WHM is a commercial licensed product and cannot be bundled for free. FaqehOS will provide open-source alternatives (for example other control panels) and tell you if a licence must be bought by the user. Exposing a home device to the internet carries security risks; this feature will be built carefully and tested before release.",
    "Kemas kini FaqehOS": "FaqehOS update", "Versi semasa": "Current version", "Semak kemas kini": "Check for updates", "Lihat log kemas kini": "View update log", "Menyemak…": "Checking…", "Versi terkini": "Latest version",
    "Versi baharu tersedia": "New version available", "FaqehOS anda sudah terkini": "FaqehOS is up to date", "Kemas kini sekarang": "Update now", "Kemas kini dimulakan": "Update started", "Kemas kini automatik": "Automatic updates",
    "Mulakan kemas kini FaqehOS sekarang? Pastikan komputer dipasang kuasa dan jangan matikan.": "Start the FaqehOS update now? Keep the computer plugged in and do not switch it off.", "(belum ada log)": "(no log yet)",
    "Kemas kini keselamatan sistem, Blender, Flatpak dan Claude dijalankan secara automatik apabila ada internet dan ruang cakera. Kemas kini versi FaqehOS (shell dan servis) dimuat turun daripada keluaran rasmi pembangun.":
      "System security updates, Blender, Flatpak and Claude run automatically when internet and disk space are available. FaqehOS version updates (shell and service) are downloaded from the developer's official releases.",
    "Lesen": "Licence", "Sokong pembangun": "Support the developer", "💛 Derma / Sokong": "💛 Donate / Support", ". Semua hak terpelihara.": ". All rights reserved.", "Sistem pengendalian dengan AI di terasnya.": "An operating system with AI at its core.",
    "FaqehOS percuma digunakan untuk kegunaan peribadi. Teks lesen penuh akan dikemas kini oleh pemilik (ruang simpanan: sila semak dengan penasihat undang-undang sebelum diedarkan).": "FaqehOS is free for personal use. The full licence text will be updated by the owner (placeholder: please check with a legal adviser before distribution).",
    "FaqehOS dibina di atas komponen sumber terbuka. Lesen asal setiap komponen kekal terpakai; kod sumber komponen berlesen GPL boleh diperoleh daripada repositori Debian atau projek masing-masing.": "FaqehOS is built on open-source components. The original licence of each component still applies; source code for GPL-licensed components is available from the Debian repositories or the respective projects.",
    "pelbagai lesen": "various licences", "Debian GNU/Linux (pakej pelbagai)": "Debian GNU/Linux (various packages)",
    "Derma menyokong pembangunan FaqehOS. Pembayaran dibuat melalui Stripe (kad, FPX atau kaedah lain yang diaktifkan pembangun).": "Donations support FaqehOS development. Payments are made through Stripe (card, FPX or other methods enabled by the developer).",
    "Pautan derma belum ditetapkan oleh pembangun. (Pembangun: tetapkan donate_url dalam branding.json dengan Stripe Payment Link; aktifkan FPX dan kad dalam Stripe untuk MYR.)": "The donation link has not been set by the developer. (Developer: set donate_url in branding.json to a Stripe Payment Link; enable FPX and cards in Stripe for MYR.)",
    /* shell, menu mula, desktop */
    "Tanya FaqehOS": "Ask FaqehOS", "Tanya FaqehOS…": "Ask FaqehOS…", "Tukar antara tanya AI dan arahkan Blender": "Switch between asking the AI and commanding Blender", "Arahkan Blender: contoh, buat 5 kubus bersusun": "Command Blender: e.g. make 5 stacked cubes",
    "Berfikir…": "Thinking…", "Selesai.\n": "Done.\n", "Ralat dalam Blender:\n": "Error in Blender:\n", "Cari aplikasi": "Search apps", "Cari aplikasi…": "Search apps…", "Disematkan": "Pinned", "Semua aplikasi": "All apps", "Hasil carian": "Search results",
    "Tiada aplikasi sepadan.": "No matching apps.", "Kuasa": "Power", "Log keluar": "Log out", "Mulakan semula": "Restart", "Matikan": "Shut down",
    "Ikon kecil": "Small icons", "Ikon sederhana": "Medium icons", "Ikon besar": "Large icons", "Susun ikut nama": "Sort by name", "Segar semula": "Refresh", "🖥️ Tetapan paparan": "🖥️ Display settings", "🎨 Peribadikan": "🎨 Personalize",
    "Nyahpin daripada desktop": "Unpin from desktop", "Pin ke desktop": "Pin to desktop", "Nyahpin": "Unpin", "Dinyahpin daripada desktop": "Unpinned from desktop", "Dipin ke desktop": "Pinned to desktop",
    "Tetapan bar tugas": "Taskbar settings", "Terminal": "Terminal", "Fail": "Files", "📈 Pengurus Tugas": "📈 Task Manager", "⌨️ Terminal": "⌨️ Terminal", "📁 Fail": "📁 Files", "🛍️ Faqeh Store": "🛍️ Faqeh Store", "🧩 My Faqeh App": "🧩 My Faqeh App",
    "CPU": "CPU", "Memori": "Memory", "Nama": "Name", "CPU %": "CPU %", "Tamatkan": "End task", "sistem": "system", "Ditamatkan": "Ended",
    /* store dan app */
    "Cari dalam Faqeh Store…": "Search Faqeh Store…", "Semua": "All", "Memasang…": "Installing…", "Pasang": "Install", "Buang": "Remove", "Dibuang": "Removed", "Pemasangan dimulakan": "Installation started",
    "Aplikasi dipasang daripada Flathub dan berjalan dalam sandbox. Pemasangan memerlukan internet dan ruang cakera (sekurang-kurangnya 1.8 GB). Dalam sesi live tanpa persistence, aplikasi disimpan dalam RAM.": "Apps are installed from Flathub and run in a sandbox. Installing needs internet and disk space (at least 1.8 GB). In a live session without persistence, apps are kept in RAM.",
    "Flatpak tidak dipasang pada sistem ini, jadi pemasangan tidak tersedia.": "Flatpak is not installed on this system, so installation is unavailable.",
    "Make a Software": "Make a Software", "Cipta app": "Create app", "Import .faqehapp": "Import .faqehapp", "Terangkan app yang anda mahu. FaqehOS akan membinanya dan memasangnya ke sini.": "Describe the app you want. FaqehOS will build it and install it here.",
    "Contoh: app belanjawan bulanan dengan graf, atau pemandang 3D dengan three.js": "Example: a monthly budget app with a chart, or a 3D scene with three.js", "Bina": "Build", "Membina…": "Building…", "Ubah": "Revise", "Buang draf": "Discard draft",
    "Mahu ubah sesuatu? Contoh: tambah mod gelap": "Want to change something? E.g. add dark mode", "Pasang app": "Install app", "Pratonton": "Preview", "Pratonton (hanya storan aktif)": "Preview (storage only)", "App dipasang ke My Faqeh App": "App installed to My Faqeh App",
    "App import: semak kebenaran dengan teliti": "Imported app: review permissions carefully", "Pasang juga": "Install anyway", "Eksport": "Export", "Nyahpasang": "Uninstall", "Belum ada app. Tekan “Cipta app” untuk mula.": "No apps yet. Press “Create app” to start.",
    "Tiada penyedia AI aktif. Buka Tetapan → AI & API dan masukkan kunci API (atau aktifkan “mock” untuk demo).": "No AI provider active. Open Settings → AI & API and enter an API key (or enable “mock” for a demo).",
    "Simpan data ": "Store data ", "AI": "AI", "Printer": "Printer",
    /* pengurus fail */
    "Laluan": "Path", "Tapis…": "Filter…", "Kembali": "Back", "Ke hadapan": "Forward", "Folder atas": "Up one folder", "＋ Baharu ▾": "＋ New ▾", "✂ Potong": "✂ Cut", "⧉ Salin": "⧉ Copy", "📋 Tampal": "📋 Paste", "✎ Namakan": "✎ Rename", "🗑 Padam": "🗑 Delete",
    "↶ Undo": "↶ Undo", "↷ Redo": "↷ Redo", "↩ Pulihkan": "↩ Restore", "Kosongkan tong sampah": "Empty trash", "☷ Paparan": "☷ View", "👁 Fail tersembunyi": "👁 Hidden files", "📁 Folder baharu": "📁 New folder", "📄 Fail baharu": "📄 New file",
    "Diubah suai": "Modified", "Saiz": "Size", "Rumah": "Home", "Dokumen": "Documents", "Muat turun": "Downloads", "Gambar": "Pictures", "Video": "Videos", "Muzik": "Music", "🗑 Tong sampah": "🗑 Trash",
    "Potong": "Cut", "Tampal": "Paste", "Namakan semula": "Rename", "Buka dengan Chrome": "Open with Chrome", "Buka dengan Blender": "Open with Blender", "Buka dengan Pemain Media": "Open with Media Player", "Buka Terminal di sini": "Open Terminal here",
    "Nama baharu": "New name", "Nama folder baharu": "New folder name", "Nama fail baharu": "New file name", "Folder baharu": "New folder", "Fail baharu.txt": "New file.txt", "Kosongkan tong sampah secara kekal? Ini tidak boleh dibatalkan.": "Empty the trash permanently? This cannot be undone.", "Kosongkan": "Empty",
    /* mesej daripada servis */
    "NetworkManager tidak dipasang": "NetworkManager is not installed", "Operasi rangkaian tamat masa": "The network operation timed out", "SSID tidak sah": "Invalid SSID",
    "Kata laluan Wi-Fi mestilah 8 hingga 63 aksara": "The Wi-Fi password must be 8 to 63 characters", "Kunci rahsia Stripe belum ditetapkan": "The Stripe secret key has not been set",
    "Tiada akses internet ke Anthropic. Sambung ke internet dan cuba lagi.": "No internet access to Anthropic. Connect to the internet and try again.", "Proses tidak boleh ditamatkan": "This process cannot be ended",
    "Proses sistem ini dilindungi": "This system process is protected", "Hanya pautan https yang sah dibenarkan": "Only valid https links are allowed", "Aplikasi tidak dikenali": "Unknown application",
    "App belum dipasang. Pasang dari Faqeh Store.": "App is not installed. Install it from Faqeh Store.", "Pemasang hanya tersedia dalam sesi live": "The installer is only available in a live session",
    "Tiada penyedia AI diaktifkan. Buka Tetapan → AI dan masukkan sekurang-kurangnya satu kunci API.": "No AI provider is enabled. Open Settings → AI and enter at least one API key.",
    "Repositori kemas kini belum ditetapkan oleh pembangun (branding.json → update_repo).": "The update repository has not been set by the developer (branding.json → update_repo).",
    "Flatpak tidak dipasang pada sistem ini": "Flatpak is not installed on this system", "App tidak dalam katalog Faqeh Store": "App is not in the Faqeh Store catalogue",
    "Imbasan kod menunjukkan risiko TINGGI": "The code scan shows HIGH risk", "ClamAV tidak dipasang pada sistem ini": "ClamAV is not installed on this system",
    "Pangkalan data virus belum dimuat turun. Sambung ke internet dan tunggu kemas kini automatik (beberapa minit selepas boot).": "The virus database has not been downloaded. Connect to the internet and wait for the automatic update (a few minutes after boot).",
    "Blender belum dibuka. Buka Blender daripada FaqehOS dahulu.": "Blender is not open. Open Blender from FaqehOS first.", "Tiada yang boleh dibatalkan": "Nothing to undo", "Tiada yang boleh diulang": "Nothing to redo",
    "Laluan di luar kawasan yang dibenarkan": "Path is outside the allowed area", "Nama tidak sah": "Invalid name", "Kunci API belum ditetapkan.": "The API key has not been set.",
    "Pemain Media": "Media Player", "App Windows": "Windows Apps", "Pelayar": "Browser", "Gagal: ": "Failed: ", "Dipilih": "Selected"
  };
  const RULES = [
    [/^(\d+) item$/, "$1 items"], [/^(\d+) dipilih(.*)$/, "$1 selected$2"], [/^Disalin: (\d+)$/, "Copied: $1"], [/^Dipotong: (\d+)$/, "Cut: $1"],
    [/^(\d+) item (disalin|dipotong)$/, (m, n, a) => n + " items " + (a === "disalin" ? "copied" : "cut")], [/^(\d+) item dialihkan ke tong sampah \(Ctrl\+Z untuk batal\)$/, "$1 items moved to trash (Ctrl+Z to undo)"],
    [/^Alihkan (\d+) item ke tong sampah\?$/, "Move $1 items to trash?"], [/^(\d+) teras$/, "$1 cores"], [/^(.+) GB bebas daripada (.+) GB$/, "$1 GB free of $2 GB"], [/^Skala (.+)×$/, "Scale $1×"],
    [/^Enjin AI aktif: (.*) \(bertukar automatik jika kuota habis\)\.$/, "AI engine active: $1 (switches automatically if the quota runs out)."], [/^rehat → (.*)$/, "paused until $1"],
    [/^Mengimbas (.*)… \(boleh mengambil masa beberapa minit\)$/, "Scanning $1… (may take a few minutes)"], [/^Kata laluan untuk (.*)$/, "Password for $1"], [/^Buang (.*)\?$/, "Remove $1?"],
    [/^Nyahpasang “(.*)” dan padam datanya\?$/, "Uninstall “$1” and delete its data?"], [/^Bersambung ke (.*)$/, "Connected to $1"], [/^Disimpan di (.*)$/, "Saved to $1"],
    [/^(.+): dibenarkan$/, (m, a) => (EN[a] || a) + ": allowed"], [/^(.+): disekat$/, (m, a) => (EN[a] || a) + ": blocked"], [/^(.+): dipasang$/, (m, a) => (EN[a] || a) + ": installed"],
    [/^(.+): belum dipasang$/, (m, a) => (EN[a] || a) + ": not installed"], [/^(.+): aktif$/, (m, a) => (EN[a] || a) + ": active"], [/^(.+): tidak aktif$/, (m, a) => (EN[a] || a) + ": inactive"],
    [/^Imbasan kod: risiko rendah$/, "Code scan: low risk"], [/^Imbasan kod: risiko sederhana$/, "Code scan: medium risk"], [/^Imbasan kod: risiko tinggi$/, "Code scan: high risk"],
    [/^Imbasan kod menunjukkan risiko TINGGI \((.*)\)\. Pasang juga\?$/, "The code scan shows HIGH risk ($1). Install anyway?"], [/^Pangkalan data virus: (.*)$/, "Virus database: $1"],
    [/^Hasil kasar (\w+) \((\d+) hari\)$/, "Gross revenue $1 ($2 days)"], [/^(\d+) transaksi, bayaran balik (.*)$/, "$1 transactions, refunds $2"], [/^Kemas kini terakhir: (.*)$/, "Last update: $1"],
    [/^Sambungan berjaya \((mod sebenar|mod ujian)\)$/, (m, x) => "Connection successful (" + (x === "mod sebenar" ? "live mode" : "test mode") + ")"], [/^Model \(lalai: (.*)\)$/, "Model (default: $1)"],
    [/^Tersimpan: (.*) \(taip untuk ganti\)$/, "Stored: $1 (type to replace)"], [/^Fail: (.*)$/, "Files: $1"], [/^Jawapan: (.*)$/, "Answer: $1"], [/^(\d+)\. (.+)$/, (m, n, t) => n + ". " + (EN[t] || t)],
    [/^Claude Desktop rasmi \(beta\) dipasang daripada repositori apt Anthropic dan Claude Code daripada pemasang rasmi Claude\. Pemasangan dan kemas kini automatik berjalan apabila ada internet dan ruang cakera\. Folder kerja Claude: (.*) \(input, arahan, about, md, bahan, output\)\.$/,
      "The official Claude Desktop (beta) is installed from Anthropic's apt repository and Claude Code from Claude's official installer. Installation and automatic updates run when internet and disk space are available. Claude work folder: $1 (input, arahan, about, md, bahan, output)."],
    [/^© 2026 (.*)\. Semua hak terpelihara\.$/, "© 2026 $1. All rights reserved."]
  ];
  let lang = "ms", busy = false;
  const orig = new WeakMap(), mine = new WeakMap();
  function tr(text) {
    const k = text.trim(); if (!k) return text;
    if (Object.prototype.hasOwnProperty.call(EN, k)) return text.replace(k, EN[k]);
    for (const [re, rep] of RULES) if (re.test(k)) return text.replace(k, k.replace(re, rep));
    return text;
  }
  function applyText(n) {
    if (mine.has(n) && n.nodeValue !== mine.get(n)) orig.set(n, n.nodeValue);     // diubah oleh kod: simpan teks asal baharu
    if (!orig.has(n)) orig.set(n, n.nodeValue);
    const o = orig.get(n), t = lang === "en" ? tr(o) : o;
    if (n.nodeValue !== t) { busy = true; n.nodeValue = t; busy = false; }
    mine.set(n, t);
  }
  const ATTRS = ["placeholder", "title", "aria-label"];
  function applyAttr(e, a) {
    const ok = "_o_" + a, mk = "_m_" + a, cur = e.getAttribute(a);
    if (cur == null) return;
    if (e[mk] !== undefined && cur !== e[mk]) e[ok] = cur;
    if (e[ok] === undefined) e[ok] = cur;
    const t = lang === "en" ? tr(e[ok]) : e[ok];
    if (cur !== t) { busy = true; e.setAttribute(a, t); busy = false; }
    e[mk] = t;
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) return applyText(root);
    if (root.nodeType !== 1) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {acceptNode: n => /^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT});
    let n; while ((n = w.nextNode())) applyText(n);
    const els = [root, ...root.querySelectorAll("[placeholder],[title],[aria-label]")];
    for (const e of els) for (const a of ATTRS) if (e.hasAttribute && e.hasAttribute(a)) applyAttr(e, a);
  }
  const mo = new MutationObserver(muts => {
    if (busy) return;
    for (const m of muts) {
      if (m.type === "childList") m.addedNodes.forEach(walk);
      else if (m.type === "characterData") applyText(m.target);
      else if (m.type === "attributes") applyAttr(m.target, m.attributeName);
    }
  });
  function start() { if (document.body) mo.observe(document.body, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS}); }
  window.I18N = {
    set(l) { lang = l === "en" ? "en" : "ms"; walk(document.body); },
    tr: s => (lang === "en" ? tr(s) : s), dict: EN, get lang() { return lang; }
  };
  if (document.body) start(); else addEventListener("DOMContentLoaded", start);
})();
