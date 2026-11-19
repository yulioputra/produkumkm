document.addEventListener("DOMContentLoaded", function () {
    // ============================================================
    // 0. Utilitas & Pemanggil API
    // ============================================================
    const LS_MY_ORDERS = "umkm_my_orders";   // hanya menyimpan nomor pesanan milik browser ini
    const SS_ADMIN_TOKEN = "umkm_admin_token";
    const WA_NUMBER = "6285725752267";

    let adminToken = sessionStorage.getItem(SS_ADMIN_TOKEN) || null;
    function isAdmin() { return !!adminToken; }

    function escapeHtml(str) {
        return String(str).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }
    function rupiah(n) { return "Rp " + Number(n).toLocaleString("id-ID"); }
    function formatTime(iso) {
        return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
    }

    // ------------------------------------------------------------
    // "Server mini" di dalam browser (localStorage), tanpa backend.
    // Bentuk fungsi api() sama seperti versi server, jadi sisa kode tidak berubah.
    // ------------------------------------------------------------
    const LS_STOCKS = "umkm_stocks";
    const LS_ORDERS = "umkm_orders";
    const LS_LOGS = "umkm_stock_logs";
    const ADMIN_USER = "yulio";
    const LS_MEMBERS = "umkm_members";
    const LS_SESSION = "umkm_member_session";
    const ADMIN_PASS = "admin123";
    const LOCAL_TOKEN = "local-admin-session";

    // Metode pembayaran SIMULASI: tidak ada uang sungguhan yang diproses.
    const PAYMENT_METHODS = {
        bca:  { label: "BCA Virtual Account", paid: true },
        bri:  { label: "BRI Virtual Account", paid: true },
        qris: { label: "QRIS", paid: true },
        cod:  { label: "COD (Bayar di Tempat)", paid: false }
    };

    function lsGet(key, fallback) {
        try {
            const v = JSON.parse(localStorage.getItem(key));
            return v === null || v === undefined ? fallback : v;
        } catch (e) { return fallback; }
    }
    function lsSet(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* abaikan */ }
    }
    function httpError(status, message) { return { status: status, message: message }; }

    function localStock(id) {
        const st = lsGet(LS_STOCKS, {});
        return st[id] !== undefined ? st[id] : products[id].initialStock;
    }

    // Satu-satunya pintu untuk mengubah stok, selalu mencatat riwayat.
    function localChangeStock(id, newQty, actor, note) {
        const before = localStock(id);
        if (before === newQty) return;
        const st = lsGet(LS_STOCKS, {});
        st[id] = newQty;
        lsSet(LS_STOCKS, st);
        const logs = lsGet(LS_LOGS, []);
        logs.unshift({
            time: new Date().toISOString(), id: id, name: products[id].name,
            before: before, after: newQty, actor: actor, note: note || ""
        });
        if (logs.length > 300) logs.length = 300;
        lsSet(LS_LOGS, logs);
    }

    function validateCheckoutInfo(body) {
        const customer = String(body.customer || "").trim().slice(0, 40);
        const phone = String(body.phone || "").replace(/[\s-]/g, "");
        const address = String(body.address || "").trim();
        const note = String(body.note || "").trim().slice(0, 150);
        const method = PAYMENT_METHODS[body.paymentMethod];
        if (customer.length < 2) throw httpError(400, "Nama pemesan wajib diisi.");
        if (!/^\+?[0-9]{8,15}$/.test(phone)) throw httpError(400, "Nomor HP tidak valid (8-15 angka).");
        if (address.length < 10 || address.length > 200) throw httpError(400, "Alamat lengkap wajib diisi (10-200 karakter).");
        if (!method) throw httpError(400, "Pilih metode pembayaran yang valid.");
        let ref = String(body.paymentRef || "").trim().slice(0, 30);
        if (!/^[A-Za-z0-9 -]*$/.test(ref)) ref = "";
        return {
            customer: customer, phone: phone, address: address, note: note,
            paymentMethod: method.label,
            paymentStatus: method.paid ? "Lunas (Simulasi)" : "Belum Dibayar (COD)",
            paymentRef: method.paid ? ref : ""
        };
    }

    function localCreateOrder(body) {
        const info = validateCheckoutInfo(body);
        const raw = body.items;
        if (!Array.isArray(raw) || raw.length === 0) throw httpError(400, "Keranjang kosong.");

        const wanted = {};
        raw.forEach(it => {
            const qty = Number(it && it.qty);
            if (!it || !products[it.id] || !Number.isInteger(qty) || qty < 1 || qty > 1000) {
                throw httpError(400, "Data pesanan tidak valid.");
            }
            wanted[it.id] = (wanted[it.id] || 0) + qty;
        });

        // Cek semua stok dulu sebelum ada yang dikurangi
        const shortages = [];
        Object.keys(wanted).forEach(id => {
            const s = localStock(id);
            if (s < wanted[id]) shortages.push(`${products[id].name} (sisa ${s}, diminta ${wanted[id]})`);
        });
        if (shortages.length) throw httpError(409, "Stok tidak mencukupi: " + shortages.join("; ") + ".");

        const items = Object.keys(wanted).map(id => ({ id: id, name: products[id].name, price: products[id].price, qty: wanted[id] }));
        const order = Object.assign({
            id: "ORD-" + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 256).toString(16).toUpperCase().padStart(2, "0"),
            time: new Date().toISOString(),
            total: items.reduce((sum, i) => sum + i.price * i.qty, 0),
            status: "Menunggu Konfirmasi WhatsApp",
            owner: body.owner ? String(body.owner) : null
        }, info, { items: items });

        items.forEach(it => {
            localChangeStock(it.id, localStock(it.id) - it.qty, "Pelanggan (" + order.customer + ")", "Pesanan " + order.id);
        });
        const orders = lsGet(LS_ORDERS, []);
        orders.unshift(order);
        lsSet(LS_ORDERS, orders);
        return order;
    }

    async function api(path, options) {
        options = options || {};
        const method = (options.method || "GET").toUpperCase();
        const body = options.body ? JSON.parse(options.body) : {};
        const parts = path.split("?");
        const route = parts[0];
        const query = new URLSearchParams(parts[1] || "");
        const admin = adminToken === LOCAL_TOKEN;

        function needAdmin() {
            if (!admin) {
                if (adminToken) forceLogout();
                throw httpError(401, "Sesi admin tidak valid. Silakan login lagi.");
            }
        }

        if (route === "/products" && method === "GET") {
            return Object.keys(products).map(id => ({
                id: id, name: products[id].name, price: products[id].price, unit: products[id].unit, stock: localStock(id)
            }));
        }
        if (route === "/login" && method === "POST") {
            if (body.username === ADMIN_USER && body.password === ADMIN_PASS) return { token: LOCAL_TOKEN, user: ADMIN_USER };
            throw httpError(401, "Username atau password salah!");
        }
        if (route === "/logout" && method === "POST") return { ok: true };

        let m = route.match(/^\/products\/([^/]+)\/stock$/);
        if (m && method === "PUT") {
            needAdmin();
            const id = decodeURIComponent(m[1]);
            const stock = Number(body.stock);
            if (!products[id]) throw httpError(404, "Produk tidak ditemukan");
            if (!Number.isInteger(stock) || stock < 0 || stock > 100000) throw httpError(400, "Stok harus bilangan bulat 0 atau lebih.");
            localChangeStock(id, stock, "Admin (" + ADMIN_USER + ")", "Edit stok manual");
            return { id: id, stock: stock };
        }
        if (route === "/orders" && method === "POST") return localCreateOrder(body);
        if (route === "/orders" && method === "GET") {
            const all = lsGet(LS_ORDERS, []);
            if (admin) return all;
            if (session && query.get("owner") === session.username) return all.filter(o => o.owner === session.username);
            const ids = (query.get("ids") || "").split(",");
            return all.filter(o => ids.indexOf(o.id) !== -1);
        }
        if (route === "/stock-logs" && method === "GET") {
            needAdmin();
            return lsGet(LS_LOGS, []);
        }
        throw httpError(404, "Endpoint tidak ditemukan");
    }

    // Pesanan non-member: hanya diingat 24 jam
    function guestOrders() {
        const now = Date.now();
        const fresh = lsGet(LS_MY_ORDERS, [])
            .map(e => typeof e === "string" ? { id: e, t: now } : e)
            .filter(e => now - e.t < 24 * 3600 * 1000);
        lsSet(LS_MY_ORDERS, fresh);
        return fresh;
    }
    function getMyOrderIds() { return guestOrders().map(e => e.id); }
    function rememberOrder(id) {
        const a = guestOrders();
        a.unshift({ id: id, t: Date.now() });
        lsSet(LS_MY_ORDERS, a.slice(0, 50));
    }

    // Member
    let session = lsGet(LS_SESSION, null);   // { username, name }
    function isMember() { return !!session; }
    async function hashPw(s) {
        try {
            const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("umkm:" + s));
            return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, "0")).join("");
        } catch (e) { return "b64:" + btoa(unescape(encodeURIComponent(s))); }
    }
    function claimGuestOrders(u) {
        const ids = getMyOrderIds();
        if (!ids.length) return;
        const all = lsGet(LS_ORDERS, []);
        all.forEach(o => { if (ids.indexOf(o.id) !== -1 && !o.owner) o.owner = u; });
        lsSet(LS_ORDERS, all);
        lsSet(LS_MY_ORDERS, []);
    }
    function guestWarnHtml() {
        return `<div class="guest-warn"><i class="fa-solid fa-triangle-exclamation"></i> Anda belum login sebagai member. Riwayat pesanan akan terhapus otomatis dalam 24 jam. <a href="#" class="warn-login">Login / Daftar</a> agar tersimpan permanen.</div>`;
    }

    // ============================================================
    // 1. Penghitung Pengunjung
    // ============================================================
    const visitorEl = document.getElementById("visitorCount");
    if (visitorEl) {
        const hasVisitedSession = sessionStorage.getItem("umkm_session_visited");
        const endpoint = hasVisitedSession
            ? "https://api.counterapi.dev/v1/kuliner-nusantara-umkm/visits"
            : "https://api.counterapi.dev/v1/kuliner-nusantara-umkm/visits/up";
        fetch(endpoint)
            .then(res => res.json())
            .then(data => {
                if (data && typeof data.count === "number") {
                    visitorEl.textContent = data.count.toLocaleString("id-ID");
                    sessionStorage.setItem("umkm_session_visited", "true");
                }
            })
            .catch(() => { visitorEl.textContent = "1"; });
    }

    // ============================================================
    // 2. Data Produk & Stok (disimpan di browser)
    // ============================================================
    const products = {};
    document.querySelectorAll(".data-table tbody tr").forEach(row => {
        const raw = row.querySelector(".stock-cell").textContent.trim();
        products[row.dataset.id] = {
            id: row.dataset.id,
            name: row.dataset.name,
            price: parseInt(row.dataset.price),
            img: row.dataset.img,
            unit: raw.replace(/[0-9]/g, "").trim() || "Pcs",
            initialStock: parseInt(raw.replace(/[^0-9]/g, "")) || 0
        };
    });

    const stocks = {};
    function getStock(id) {
        if (stocks[id] === undefined) return products[id] ? products[id].initialStock : 0;
        return stocks[id];
    }

    async function refreshStocks() {
        try {
            const list = await api("/products");
            list.forEach(p => {
                stocks[p.id] = p.stock;
                if (products[p.id]) { products[p.id].unit = p.unit; products[p.id].price = p.price; }
            });
            renderStocks();
            updateCartUI();
        } catch (e) { /* server belum aktif: tampilan memakai data awal HTML */ }
    }

    // ============================================================
    // 3. Dialog Helper
    // ============================================================
    const customDialogOverlay = document.getElementById("customDialogOverlay");
    const customDialogBox = document.getElementById("customDialogBox");

    function openDialog(html, mode) {
        // mode: true / "wide" = dialog lebar (riwayat), "checkout" = formulir checkout
        const cls = mode === true ? "wide" : (mode || "");
        customDialogBox.className = "custom-dialog" + (cls ? " " + cls : "");
        customDialogBox.innerHTML = html;
        customDialogOverlay.classList.add("active");
    }
    function closeDialog() { customDialogOverlay.classList.remove("active"); }
    customDialogOverlay.addEventListener("click", e => {
        if (e.target === customDialogOverlay && customDialogBox.classList.contains("detail")) closeDialog();
    });
    document.addEventListener("keydown", e => {
        if (e.key === "Escape" && customDialogBox.classList.contains("detail")) closeDialog();
    });
    function bindClose(id) {
        const el = document.getElementById(id);
        if (el) el.onclick = closeDialog;
    }
    function infoDialog(icon, color, title, message) {
        openDialog(`
            <div class="custom-dialog-icon" style="color:${color};"><i class="${icon}"></i></div>
            <h3>${title}</h3>
            <p>${escapeHtml(message)}</p>
            <div class="custom-dialog-buttons">
                <button class="custom-dialog-btn btn-dialog-confirm" id="dialogOkBtn">OK</button>
            </div>`);
        bindClose("dialogOkBtn");
    }
    function errorDialog(title, e) {
        infoDialog("fa-solid fa-triangle-exclamation", "var(--accent)", title, (e && e.message) || "Terjadi kesalahan.");
    }

    // ============================================================
    // 4. Status Admin & Tampilan Stok di Tabel
    // ============================================================
    function updateAdminUIState() {
        const navText = document.getElementById("adminNavText");
        if (navText) navText.textContent = isAdmin() ? "Admin (Logout)" : (isMember() ? "Hai, " + session.name.split(" ")[0] + " (Logout)" : "Login / Daftar");
        const stockLogItem = document.getElementById("stockLogNavItem");
        if (stockLogItem) stockLogItem.style.display = isAdmin() ? "" : "none";
        renderStocks();
    }

    function forceLogout() {
        sessionStorage.removeItem(SS_ADMIN_TOKEN);
        adminToken = null;
        updateAdminUIState();
    }

    function renderStocks() {
        document.querySelectorAll(".data-table tbody tr").forEach(row => {
            const id = row.dataset.id;
            const p = products[id];
            const stockNum = getStock(id);
            const stockCell = row.querySelector(".stock-cell");
            const statusBadge = row.querySelector(".status-badge");
            const actionCell = row.querySelector(".action-cell");

            if (isAdmin()) {
                // Jangan timpa input jika admin sedang mengetik di baris ini
                const active = document.activeElement;
                if (!(active && stockCell.contains(active))) {
                    stockCell.innerHTML = `
                        <div class="stock-edit-wrap">
                            <input type="number" class="stock-input" value="${stockNum}" min="0" data-id="${id}">
                            <button class="btn-save-stock save-stock-btn" title="Simpan Stok"><i class="fa-solid fa-check"></i></button>
                        </div>`;
                }
            } else {
                stockCell.textContent = stockNum + " " + p.unit;
            }

            if (stockNum === 0) {
                statusBadge.className = "status-badge outofstock";
                statusBadge.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Habis';
                actionCell.innerHTML = '<span class="btn-table-action disabled"><i class="fa-solid fa-ban"></i></span>';
            } else {
                if (stockNum <= 5) {
                    statusBadge.className = "status-badge warning";
                    statusBadge.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Menipis';
                } else {
                    statusBadge.className = "status-badge available";
                    statusBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i> Ready Fresh';
                }
                if (!actionCell.querySelector(".add-to-cart-btn")) {
                    actionCell.innerHTML = `
                        <button class="btn-table-action add-to-cart-btn" data-id="${id}" data-name="${escapeHtml(p.name)}" data-price="${p.price}" data-img="${p.img}" title="Masukan Keranjang">
                            <i class="fa-solid fa-cart-plus"></i>
                        </button>`;
                }
            }
        });
    }

    // Simpan stok oleh admin (delegasi event)
    document.addEventListener("click", async function (e) {
        const saveBtn = e.target.closest(".save-stock-btn");
        if (!saveBtn || !isAdmin()) return;
        const row = saveBtn.closest("tr");
        const id = row.dataset.id;
        const val = parseInt(row.querySelector(".stock-input").value);
        if (isNaN(val) || val < 0) {
            infoDialog("fa-solid fa-triangle-exclamation", "var(--accent)", "Stok Tidak Valid", "Isi stok dengan angka 0 atau lebih.");
            return;
        }
        try {
            await api("/products/" + encodeURIComponent(id) + "/stock", { method: "PUT", body: JSON.stringify({ stock: val }) });
        } catch (err) {
            errorDialog("Gagal Menyimpan Stok", err);
        }
        await refreshStocks();
    });

    // ============================================================
    // 5. Login / Logout Admin
    // ============================================================
    const adminLoginNavBtn = document.getElementById("adminLoginNavBtn");
    if (adminLoginNavBtn) {
        adminLoginNavBtn.addEventListener("click", function (e) {
            e.preventDefault();
            if (isAdmin()) { forceLogout(); return; }
            if (isMember()) { session = null; localStorage.removeItem(LS_SESSION); updateAdminUIState(); return; }
            showAuthDialog("login");
        });
    }
    document.addEventListener("click", function (e) {
        if (e.target.closest(".warn-login")) { e.preventDefault(); showAuthDialog("login"); }
    });

    function startMember(u, name) {
        session = { username: u, name: name };
        lsSet(LS_SESSION, session);
        claimGuestOrders(u);
        closeDialog();
        updateAdminUIState();
    }

    function showAuthDialog(tab) {
        const reg = tab === "register";
        openDialog(`
            <h3><i class="fa-solid fa-user-lock"></i> ${reg ? "Daftar Member" : "Login"}</h3>
            <div class="auth-tabs">
                <button class="chip ${reg ? "" : "active"}" id="tabLogin">Login</button>
                <button class="chip ${reg ? "active" : ""}" id="tabReg">Daftar</button>
            </div>
            <p style="font-size:0.82rem;margin-bottom:0.9rem;">${reg ? "Buat akun member agar riwayat pesanan tersimpan permanen." : "Masuk sebagai member atau admin."}</p>
            ${reg ? `<label class="form-label" for="auName">Nama</label><input type="text" id="auName" maxlength="40" autocomplete="name">` : ""}
            <label class="form-label" for="auUser">Username</label>
            <input type="text" id="auUser" maxlength="20" autocomplete="username" autocapitalize="none">
            <label class="form-label" for="auPass">Password</label>
            <input type="password" id="auPass" autocomplete="${reg ? "new-password" : "current-password"}">
            <p class="form-error" id="auErr" style="display:none;"></p>
            <div class="custom-dialog-buttons">
                <button class="custom-dialog-btn btn-dialog-cancel" id="dialogCancelBtn">Batal</button>
                <button class="custom-dialog-btn btn-dialog-confirm" id="auSubmit">${reg ? "Daftar" : "Login"}</button>
            </div>`, "checkout");
        bindClose("dialogCancelBtn");
        document.getElementById("tabLogin").onclick = () => showAuthDialog("login");
        document.getElementById("tabReg").onclick = () => showAuthDialog("register");

        const fail = m => { const el = document.getElementById("auErr"); el.textContent = m; el.style.display = "block"; };
        const submit = async () => {
            const u = document.getElementById("auUser").value.trim().toLowerCase();
            const p = document.getElementById("auPass").value;
            if (!u || !p) return fail("Username dan password wajib diisi.");
            const members = lsGet(LS_MEMBERS, {});
            if (reg) {
                const name = document.getElementById("auName").value.trim();
                if (name.length < 2) return fail("Nama minimal 2 karakter.");
                if (!/^[a-z0-9_.]{3,20}$/.test(u)) return fail("Username 3-20 karakter: huruf, angka, titik, atau garis bawah.");
                if (p.length < 6) return fail("Password minimal 6 karakter.");
                if (u === ADMIN_USER || u === "admin" || members[u]) return fail("Username sudah dipakai.");
                members[u] = { name: name, hash: await hashPw(p) };
                lsSet(LS_MEMBERS, members);
                startMember(u, name);
            } else if (u === ADMIN_USER && p === ADMIN_PASS) {
                adminToken = LOCAL_TOKEN;
                sessionStorage.setItem(SS_ADMIN_TOKEN, adminToken);
                closeDialog();
                updateAdminUIState();
            } else if (members[u] && members[u].hash === await hashPw(p)) {
                startMember(u, members[u].name);
            } else {
                fail("Username atau password salah!");
            }
        };
        document.getElementById("auSubmit").onclick = submit;
        ["auUser", "auPass"].forEach(id => { document.getElementById(id).onkeydown = ev => { if (ev.key === "Enter") submit(); }; });
        document.getElementById(reg ? "auName" : "auUser").focus();
    }

    // ============================================================
    // 6. Keranjang Belanja
    // ============================================================
    let cart = [];

    const openCartBtn = document.getElementById("openCartBtn");
    const closeCartBtn = document.getElementById("closeCartBtn");
    const addMoreItemsBtn = document.getElementById("addMoreItemsBtn");
    const cartOverlay = document.getElementById("cartOverlay");
    const cartDrawer = document.getElementById("cartDrawer");
    const cartCounter = document.getElementById("cartCounter");
    const cartDrawerBody = document.getElementById("cartDrawerBody");
    const cartTotalPrice = document.getElementById("cartTotalPrice");
    const checkoutWhatsappBtn = document.getElementById("checkoutWhatsappBtn");

    function toggleCart(open) {
        cartDrawer.classList.toggle("active", open);
        cartOverlay.classList.toggle("active", open);
    }
    openCartBtn.addEventListener("click", () => toggleCart(true));
    closeCartBtn.addEventListener("click", () => toggleCart(false));
    cartOverlay.addEventListener("click", () => toggleCart(false));
    addMoreItemsBtn.addEventListener("click", () => toggleCart(false));

    // Pastikan isi keranjang tidak melebihi stok terbaru
    function syncCartWithStock() {
        cart = cart.filter(item => {
            const s = getStock(item.id);
            if (s <= 0) return false;
            if (item.qty > s) item.qty = s;
            return true;
        });
    }

    function selectedItems() { return cart.filter(i => i.checked); }
    function cartTotal() {
        return selectedItems().reduce((sum, i) => sum + i.price * i.qty, 0);
    }

    document.addEventListener("click", function (e) {
        const btn = e.target.closest(".add-to-cart-btn");
        if (!btn) return;
        const id = btn.dataset.id;
        const p = products[id];
        if (!p) return;

        if (getStock(id) <= 0) {
            infoDialog("fa-solid fa-circle-xmark", "var(--accent)", "Stok Habis", "Maaf, stok untuk produk ini sedang kosong (0).");
            return;
        }
        showQuantityPrompt(p);
    });

    function showQuantityPrompt(p) {
        const maxStock = getStock(p.id);
        const existing = cart.find(i => i.id === p.id);
        const currentInCart = existing ? existing.qty : 0;
        const remainingStock = maxStock - currentInCart;

        if (remainingStock <= 0) {
            infoDialog("fa-solid fa-triangle-exclamation", "var(--accent)", "Stok Maksimal Tercapai",
                `Stok untuk ${p.name} sisa ${maxStock}. Anda sudah memasukkan semuanya ke keranjang!`);
            return;
        }

        openDialog(`
            <div class="custom-dialog-icon"><i class="fa-solid fa-basket-shopping"></i></div>
            <h3>Masukkan Jumlah</h3>
            <p>Berapa porsi / buah <strong>${escapeHtml(p.name)}</strong> yang ingin dibeli?<br><small style="color:var(--primary);">Stok tersedia: ${maxStock} (di keranjang: ${currentInCart})</small></p>
            <input type="number" id="promptQtyInput" value="1" min="1" max="${remainingStock}">
            <p class="form-error" id="qtyErr" style="display:none;margin-top:-0.8rem;"></p>
            <div class="custom-dialog-buttons">
                <button class="custom-dialog-btn btn-dialog-cancel" id="dialogCancelBtn">Batal</button>
                <button class="custom-dialog-btn btn-dialog-confirm" id="dialogConfirmBtn">Masukan Keranjang</button>
            </div>`);

        const input = document.getElementById("promptQtyInput");
        input.focus();
        input.select();
        bindClose("dialogCancelBtn");
        const confirmBtn = document.getElementById("dialogConfirmBtn");
        confirmBtn.onclick = () => {
            const raw = input.value.trim();
            const qty = Number(raw);
            const errEl = document.getElementById("qtyErr");
            const bad = m => { errEl.textContent = m; errEl.style.display = "block"; input.focus(); };
            if (raw === "" || !Number.isInteger(qty) || qty < 1) return bad("Jumlah minimal 1. Tidak boleh 0 atau kosong.");
            if (qty > remainingStock) return bad("Jumlah melebihi stok. Maksimal " + remainingStock + ".");
            addToCart(p, qty);
            closeDialog();
            toggleCart(true);
        };
        input.onkeydown = ev => { if (ev.key === "Enter") confirmBtn.click(); };
    }

    function addToCart(p, qty) {
        const existing = cart.find(i => i.id === p.id);
        if (existing) existing.qty += qty;
        else cart.push({ id: p.id, name: p.name, price: p.price, img: p.img, qty: qty, checked: true });
        updateCartUI();
    }

    function updateCartUI() {
        syncCartWithStock();
        cartCounter.textContent = cart.reduce((sum, i) => sum + i.qty, 0);
        const ae = document.activeElement;
        if (ae && ae.classList && ae.classList.contains("cart-qty-input") && cart.length) {   // jangan timpa input yang sedang diketik
            cartTotalPrice.textContent = rupiah(cartTotal());
            return;
        }

        if (cart.length === 0) {
            cartDrawerBody.innerHTML = `
                <div class="cart-empty-state">
                    <i class="fa-solid fa-basket-shopping"></i>
                    <p>Keranjang belanjaan Anda masih kosong.</p>
                </div>`;
            cartTotalPrice.textContent = "Rp 0";
            checkoutWhatsappBtn.classList.add("disabled");
            return;
        }

        const chosen = selectedItems().length;
        cartDrawerBody.innerHTML = `
            <label class="cart-selectall"><input type="checkbox" class="cart-check" id="cartCheckAll" ${chosen === cart.length ? "checked" : ""}> Pilih semua (${chosen}/${cart.length} dipilih)</label>` +
            cart.map(item => `
            <div class="cart-item ${item.checked ? "" : "unchecked"}">
                <input type="checkbox" class="cart-check item-check" data-id="${item.id}" ${item.checked ? "checked" : ""} aria-label="Pilih ${escapeHtml(item.name)}">
                <img src="${item.img}" alt="${escapeHtml(item.name)}" class="cart-item-img" onerror="this.src='https://placehold.co/55x55/fed7aa/9a3412?text=Foto'">
                <div class="cart-item-info">
                    <div class="cart-item-title">${escapeHtml(item.name)}</div>
                    <div class="cart-item-price">${rupiah(item.price)}</div>
                    <div class="cart-item-controls">
                        <button class="qty-btn decrease-qty" data-id="${item.id}" ${item.qty <= 1 ? "disabled" : ""}>-</button>
                        <input type="number" class="cart-qty-input" data-id="${item.id}" value="${item.qty}" min="1" max="${getStock(item.id)}" aria-label="Jumlah">
                        <button class="qty-btn increase-qty" data-id="${item.id}">+</button>
                    </div>
                </div>
                <button class="cart-item-remove remove-item" data-id="${item.id}" title="Hapus"><i class="fa-solid fa-trash-can"></i></button>
            </div>`).join("");

        cartTotalPrice.textContent = rupiah(cartTotal());
        checkoutWhatsappBtn.classList.toggle("disabled", chosen === 0);
    }

    cartDrawerBody.addEventListener("click", function (e) {
        const btn = e.target.closest(".increase-qty, .decrease-qty, .remove-item");
        if (!btn) return;
        const id = btn.dataset.id;
        const item = cart.find(i => i.id === id);
        if (!item) return;
        if (btn.classList.contains("increase-qty")) { if (item.qty < getStock(id)) item.qty += 1; }
        else if (btn.classList.contains("decrease-qty")) { if (item.qty > 1) item.qty -= 1; }
        else cart = cart.filter(i => i.id !== id);
        updateCartUI();
    });

    cartDrawerBody.addEventListener("change", function (e) {
        const t = e.target;
        if (t.id === "cartCheckAll") { cart.forEach(i => { i.checked = t.checked; }); updateCartUI(); return; }
        const item = cart.find(i => i.id === t.dataset.id);
        if (!item) return;
        if (t.classList.contains("item-check")) {
            item.checked = t.checked;
        } else if (t.classList.contains("cart-qty-input")) {
            const raw = t.value.trim(), n = Number(raw), s = getStock(item.id);
            if (raw === "" || !Number.isInteger(n) || n < 1) {
                infoDialog("fa-solid fa-triangle-exclamation", "var(--accent)", "Jumlah Tidak Valid", "Jumlah minimal 1, tidak boleh 0 atau kosong. Pakai ikon tempat sampah untuk menghapus produk.");
            } else if (n > s) {
                item.qty = s;
                infoDialog("fa-solid fa-triangle-exclamation", "var(--accent)", "Stok Terbatas", `Stok ${item.name} hanya ${s}.`);
            } else {
                item.qty = n;
            }
        }
        updateCartUI();
    });

    // ============================================================
    // 7. Checkout: server yang mengurangi stok & mencatat pesanan
    // ============================================================
    checkoutWhatsappBtn.addEventListener("click", function () {
        if (cart.length === 0) return;
        if (selectedItems().length === 0) {
            infoDialog("fa-solid fa-circle-info", "var(--primary)", "Belum Ada Produk Dipilih", "Centang minimal satu produk di keranjang sebelum checkout.");
            return;
        }
        showCheckoutForm();
    });

    // Metode pembayaran SIMULASI (tidak ada uang sungguhan yang diproses)
    const PAY_METHODS = [
        { id: "bca",  label: "BCA Virtual Account",  type: "va",   icon: "fa-solid fa-building-columns",    desc: "Transfer ke nomor virtual account", prefix: "70012" },
        { id: "bri",  label: "BRI Virtual Account",  type: "va",   icon: "fa-solid fa-building-columns",    desc: "Transfer ke nomor virtual account", prefix: "88810" },
        { id: "qris", label: "QRIS",                 type: "qris", icon: "fa-solid fa-qrcode",              desc: "Scan dengan e-wallet apa pun" },
        { id: "cod",  label: "COD (Bayar di Tempat)", type: "cod",  icon: "fa-solid fa-hand-holding-dollar", desc: "Bayar saat pesanan diterima" }
    ];
    const LS_PROFILE = "umkm_checkout_profile";
    let checkoutData = null;

    function loadProfile() {
        try { return JSON.parse(localStorage.getItem(LS_PROFILE)) || {}; } catch (e) { return {}; }
    }
    function saveProfile(d) {
        try { localStorage.setItem(LS_PROFILE, JSON.stringify({ name: d.name, phone: d.phone, address: d.address })); } catch (e) { /* abaikan */ }
    }
    function randomDigits(n) {
        let out = "";
        for (let i = 0; i < n; i++) out += Math.floor(Math.random() * 10);
        return out;
    }
    function payMethod(id) { return PAY_METHODS.find(m => m.id === id); }

    // ---- Langkah 1: data pemesan + pilih metode pembayaran ----
    function showCheckoutForm(prefill) {
        const d = Object.assign({}, isMember() ? { name: session.name } : {}, loadProfile(), prefill || {});
        const summary = selectedItems().map(i => `<div><span>${escapeHtml(i.name)} &times; ${i.qty}</span><span>${rupiah(i.price * i.qty)}</span></div>`).join("");

        openDialog(`
            <h3><i class="fa-solid fa-bag-shopping"></i> Data Pemesan & Pembayaran</h3>
            ${isMember() ? "" : guestWarnHtml()}
            <div class="checkout-summary">${summary}<div class="sum-total"><span>Total</span><span>${rupiah(cartTotal())}</span></div></div>

            <label class="form-label" for="coName">Nama Pemesan *</label>
            <input type="text" id="coName" maxlength="40" placeholder="Nama lengkap" value="${escapeHtml(d.name || "")}">
            <label class="form-label" for="coPhone">Nomor HP / WhatsApp *</label>
            <input type="tel" id="coPhone" maxlength="16" placeholder="08xxxxxxxxxx" value="${escapeHtml(d.phone || "")}">
            <label class="form-label" for="coAddress">Alamat Lengkap *</label>
            <textarea id="coAddress" maxlength="200" placeholder="Jalan, nomor rumah, RT/RW, kelurahan, kota">${escapeHtml(d.address || "")}</textarea>
            <label class="form-label" for="coNote">Catatan (opsional)</label>
            <input type="text" id="coNote" maxlength="150" placeholder="Contoh: jangan terlalu pedas" value="${escapeHtml(d.note || "")}">

            <label class="form-label">Metode Pembayaran *</label>
            <div class="pay-options">
                ${PAY_METHODS.map(m => `
                    <label class="pay-option">
                        <input type="radio" name="payMethod" value="${m.id}" ${d.method === m.id ? "checked" : ""}>
                        <i class="${m.icon}"></i>
                        <span><strong>${m.label}</strong><small>${m.desc}</small></span>
                    </label>`).join("")}
            </div>
            <p class="form-error" id="coError" style="display:none;"></p>
            <div class="custom-dialog-buttons">
                <button class="custom-dialog-btn btn-dialog-cancel" id="dialogCancelBtn">Batal</button>
                <button class="custom-dialog-btn btn-dialog-whatsapp" id="coNextBtn">Lanjut</button>
            </div>`, "checkout");
        bindClose("dialogCancelBtn");

        const radios = customDialogBox.querySelectorAll('input[name="payMethod"]');
        const nextBtn = document.getElementById("coNextBtn");
        function updateNextLabel() {
            const sel = customDialogBox.querySelector('input[name="payMethod"]:checked');
            nextBtn.textContent = sel && sel.value === "cod" ? "Buat Pesanan" : "Lanjut Pembayaran";
        }
        radios.forEach(r => r.addEventListener("change", updateNextLabel));
        updateNextLabel();

        nextBtn.onclick = () => {
            const data = {
                name: document.getElementById("coName").value.trim(),
                phone: document.getElementById("coPhone").value.replace(/[\s-]/g, ""),
                address: document.getElementById("coAddress").value.trim(),
                note: document.getElementById("coNote").value.trim(),
                method: (customDialogBox.querySelector('input[name="payMethod"]:checked') || {}).value
            };
            let err = null;
            if (data.name.length < 2) err = "Nama pemesan wajib diisi.";
            else if (!/^\+?[0-9]{8,15}$/.test(data.phone)) err = "Nomor HP tidak valid (8-15 angka).";
            else if (data.address.length < 10) err = "Alamat lengkap minimal 10 karakter.";
            else if (!data.method) err = "Pilih metode pembayaran.";

            const errEl = document.getElementById("coError");
            if (err) { errEl.textContent = err; errEl.style.display = "block"; return; }

            checkoutData = data;
            saveProfile(data);
            if (payMethod(data.method).type === "cod") finalizeOrder(nextBtn);
            else showPaymentSimulation();
        };
    }

    // ---- Langkah 2: simulasi pembayaran (pura-pura) ----
    function showPaymentSimulation() {
        const m = payMethod(checkoutData.method);
        checkoutData.paymentRef = m.type === "va" ? m.prefix + randomDigits(10) : "QRIS-" + randomDigits(8);

        openDialog(`
            <div class="sim-banner"><i class="fa-solid fa-flask"></i> MODE SIMULASI &mdash; tidak ada uang sungguhan yang dipindahkan</div>
            <h3>Pembayaran ${m.label}</h3>
            <div class="pay-center">
                ${m.type === "va"
                    ? `<p>Nomor Virtual Account</p><div class="va-number">${checkoutData.paymentRef}</div>`
                    : `<div class="qris-box"><i class="fa-solid fa-qrcode"></i></div><p>Kode: ${checkoutData.paymentRef}</p>`}
                <div class="pay-total">Total: ${rupiah(cartTotal())}</div>
            </div>
            <div class="custom-dialog-buttons">
                <button class="custom-dialog-btn btn-dialog-cancel" id="payBackBtn">Kembali</button>
                <button class="custom-dialog-btn btn-dialog-whatsapp" id="payDoneBtn">Simulasikan Bayar</button>
            </div>`, "checkout");

        document.getElementById("payBackBtn").onclick = () => showCheckoutForm(checkoutData);
        const doneBtn = document.getElementById("payDoneBtn");
        doneBtn.onclick = () => finalizeOrder(doneBtn);
    }

    // ---- Langkah 3: buat pesanan di server, lalu kirim teks lengkap ke WhatsApp ----
    async function finalizeOrder(btn) {
        btn.disabled = true;                   // cegah klik ganda
        const isCod = checkoutData.method === "cod";
        btn.textContent = isCod ? "Memproses..." : "Memproses pembayaran...";
        // Buka tab kosong sekarang (masih dalam klik pengguna) agar tidak diblokir browser
        const waWindow = window.open("about:blank", "_blank");
        if (!isCod) await new Promise(r => setTimeout(r, 1200));   // jeda agar terasa seperti proses bayar

        const order = await processCheckout(checkoutData);
        if (!order) {
            if (waWindow && waWindow.close) waWindow.close();
            return;
        }

        const waUrl = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(buildWaMessage(order))}`;
        let opened = false;
        if (waWindow && waWindow.location) { waWindow.location.href = waUrl; opened = true; }
        toggleCart(false);

        openDialog(`
            <div class="pay-center">
                <div class="custom-dialog-icon" style="color:#25d366;"><i class="fa-solid fa-circle-check"></i></div>
                <h3>Pesanan Berhasil Dibuat</h3>
                <p>Nomor pesanan <strong>${escapeHtml(order.id)}</strong><br>
                Pembayaran: ${escapeHtml(order.paymentMethod)} &mdash; ${escapeHtml(order.paymentStatus)}<br>
                Rincian lengkap dikirim ke WhatsApp penjual.
                ${opened ? "" : `<br><a href="${waUrl}" target="_blank" style="color:var(--primary);font-weight:700;">WhatsApp belum terbuka? Klik di sini</a>`}</p>
            </div>
            <div class="custom-dialog-buttons">
                <button class="custom-dialog-btn btn-dialog-cancel" id="dialogHistoryBtn">Lihat Riwayat</button>
                <button class="custom-dialog-btn btn-dialog-confirm" id="dialogOkBtn">Tutup</button>
            </div>`, "checkout");
        bindClose("dialogOkBtn");
        document.getElementById("dialogHistoryBtn").onclick = showOrderHistory;
    }

    function buildWaMessage(order) {
        let msg = `Halo Admin, saya ingin memesan dari Katalog Kuliner Nusantara.\n\n`;
        msg += `*No. Pesanan:* ${order.id}\n`;
        msg += `*Waktu:* ${formatTime(order.time)}\n\n`;
        msg += `*DATA PEMESAN*\n`;
        msg += `Nama: ${order.customer}\n`;
        msg += `No. HP: ${order.phone}\n`;
        msg += `Alamat: ${order.address}\n`;
        if (order.note) msg += `Catatan: ${order.note}\n`;
        msg += `\n*PESANAN*\n`;
        order.items.forEach((it, i) => {
            msg += `${i + 1}. ${it.name} (${it.qty}x @ ${rupiah(it.price)}) = ${rupiah(it.price * it.qty)}\n`;
        });
        msg += `\n*Total: ${rupiah(order.total)}*\n\n`;
        msg += `*PEMBAYARAN*\n`;
        msg += `Metode: ${order.paymentMethod}\n`;
        if (order.paymentRef) msg += `Kode: ${order.paymentRef}\n`;
        msg += `Status: ${order.paymentStatus}\n\n`;
        msg += `Terima kasih!`;
        return msg;
    }

    async function processCheckout(info) {
        syncCartWithStock();
        const chosen = selectedItems();
        if (chosen.length === 0) {
            updateCartUI();
            infoDialog("fa-solid fa-circle-xmark", "var(--accent)", "Keranjang Kosong", "Tidak ada produk terpilih yang tersedia (stok habis atau belum dicentang).");
            return null;
        }
        try {
            const order = await api("/orders", {
                method: "POST",
                body: JSON.stringify({
                    customer: info.name,
                    phone: info.phone,
                    address: info.address,
                    note: info.note,
                    paymentMethod: info.method,
                    paymentRef: info.paymentRef || "",
                    owner: session ? session.username : "",
                    items: chosen.map(i => ({ id: i.id, qty: i.qty }))
                })
            });
            if (!session) rememberOrder(order.id);
            cart = cart.filter(i => !i.checked);   // hanya produk yang dicentang yang keluar dari keranjang
            checkoutData = null;
            await refreshStocks();     // stok terbaru dari server
            updateCartUI();
            return order;
        } catch (err) {
            await refreshStocks();     // stok mungkin sudah berubah, segarkan tampilan
            errorDialog("Pesanan Gagal", err);
            return null;
        }
    }

    // ============================================================
    // 8. Riwayat Pesanan
    //    Pelanggan: pesanan miliknya. Admin: semua pesanan.
    // ============================================================
    async function showOrderHistory() {
        let list = [];
        try {
            if (isAdmin()) {
                list = await api("/orders");
            } else if (isMember()) {
                list = await api("/orders?owner=" + encodeURIComponent(session.username));
            } else {
                const ids = getMyOrderIds();
                list = ids.length ? await api("/orders?ids=" + encodeURIComponent(ids.join(","))) : [];
            }
        } catch (err) {
            errorDialog("Gagal Memuat Riwayat", err);
            return;
        }

        let body;
        if (list.length === 0) {
            body = `<p style="text-align:center;margin:1.5rem 0;">Belum ada riwayat pesanan.</p>`;
        } else {
            body = list.map(o => `
                <div class="history-item">
                    <div class="history-head">
                        <strong>${escapeHtml(o.id)}</strong>
                        <span class="history-badge">${escapeHtml(o.status)}</span>
                    </div>
                    <div class="history-meta">${formatTime(o.time)}${o.customer ? " &bull; " + escapeHtml(o.customer) : ""}</div>
                    <ul>${o.items.map(it => `<li>${escapeHtml(it.name)} &times; ${it.qty} <span>${rupiah(it.price * it.qty)}</span></li>`).join("")}</ul>
                    <div class="history-total">Total: ${rupiah(o.total)}</div>
                    ${o.address || o.paymentMethod ? `<div class="history-detail">
                        ${o.phone ? `<div>HP: ${escapeHtml(o.phone)}</div>` : ""}
                        ${o.address ? `<div>Alamat: ${escapeHtml(o.address)}</div>` : ""}
                        ${o.note ? `<div>Catatan: ${escapeHtml(o.note)}</div>` : ""}
                        ${o.paymentMethod ? `<div>Pembayaran: ${escapeHtml(o.paymentMethod)} &mdash; ${escapeHtml(o.paymentStatus || "")}</div>` : ""}
                    </div>` : ""}
                </div>`).join("");
        }
        openDialog(`
            <h3><i class="fa-solid fa-clock-rotate-left"></i> Riwayat Pesanan${isAdmin() ? " (Semua)" : ""}</h3>
            ${!isAdmin() && !isMember() ? guestWarnHtml() : ""}
            <div class="history-scroll">${body}</div>
            <div class="custom-dialog-buttons">
                <button class="custom-dialog-btn btn-dialog-confirm" id="dialogOkBtn">Tutup</button>
            </div>`, true);
        bindClose("dialogOkBtn");
    }

    // ============================================================
    // 9. Riwayat Perubahan Stok (khusus admin)
    // ============================================================
    async function showStockLog() {
        if (!isAdmin()) return;
        let logs;
        try {
            logs = await api("/stock-logs");
        } catch (err) {
            errorDialog("Gagal Memuat Riwayat Stok", err);
            return;
        }

        let body;
        if (logs.length === 0) {
            body = `<p style="text-align:center;margin:1.5rem 0;">Belum ada perubahan stok.</p>`;
        } else {
            body = `<div class="history-table-wrap"><table class="history-table">
                <thead><tr><th>Waktu</th><th>Produk</th><th>Stok</th><th>Diubah oleh</th><th>Keterangan</th></tr></thead>
                <tbody>${logs.map(l => {
                    const diff = l.after - l.before;
                    return `<tr>
                        <td>${formatTime(l.time)}</td>
                        <td>${escapeHtml(l.name)}</td>
                        <td>${l.before} &rarr; ${l.after} <span class="${diff < 0 ? "diff-minus" : "diff-plus"}">(${diff > 0 ? "+" : ""}${diff})</span></td>
                        <td>${escapeHtml(l.actor)}</td>
                        <td>${escapeHtml(l.note || "")}</td>
                    </tr>`;
                }).join("")}</tbody></table></div>`;
        }
        openDialog(`
            <h3><i class="fa-solid fa-boxes-stacked"></i> Riwayat Perubahan Stok</h3>
            <div class="history-scroll">${body}</div>
            <div class="custom-dialog-buttons">
                <button class="custom-dialog-btn btn-dialog-confirm" id="dialogOkBtn">Tutup</button>
            </div>`, true);
        bindClose("dialogOkBtn");
    }

    const orderHistoryNavBtn = document.getElementById("orderHistoryNavBtn");
    if (orderHistoryNavBtn) orderHistoryNavBtn.addEventListener("click", e => { e.preventDefault(); showOrderHistory(); });
    const stockLogNavBtn = document.getElementById("stockLogNavBtn");
    if (stockLogNavBtn) stockLogNavBtn.addEventListener("click", e => { e.preventDefault(); showStockLog(); });

    // ============================================================
    // 11. Pencarian & Kategori
    // ============================================================
    let activeCat = "all";
    const searchInput = document.getElementById("menuSearch");
    function applyFilter() {
        const q = searchInput.value.trim().toLowerCase();
        let shown = 0;
        document.querySelectorAll(".data-table tbody tr").forEach(row => {
            const cat = row.querySelector(".category-tag").textContent.trim();
            const hay = (row.dataset.name + " " + row.querySelector(".product-name-cell small").textContent).toLowerCase();
            const ok = (activeCat === "all" || cat === activeCat) && (!q || hay.indexOf(q) !== -1);
            row.style.display = ok ? "" : "none";
            if (ok) shown++;
        });
        document.getElementById("noResult").style.display = shown ? "none" : "block";
    }
    if (searchInput) {
        searchInput.addEventListener("input", applyFilter);
        document.getElementById("catChips").addEventListener("click", e => {
            const chip = e.target.closest(".chip");
            if (!chip) return;
            activeCat = chip.dataset.cat;
            document.querySelectorAll("#catChips .chip").forEach(x => x.classList.toggle("active", x === chip));
            applyFilter();
        });
    }

    // ============================================================
    // 12. Modal Detail (komposisi bahan, tanpa lokasi/asal daerah)
    // ============================================================
    const DETAIL = {
        "KLN-001": ["Tepung terigu", "Telur ayam", "Susu segar", "Daging sapi asap", "Keju", "Mayones", "Bawang bombay", "Lada hitam", "Tepung panir"],
        "KLN-002": ["Biji kopi robusta", "Kapulaga", "Kayu manis", "Gula aren", "Air matang"],
        "KLN-003": ["Singkong segar", "Cabai merah", "Bawang putih", "Bawang merah", "Gula", "Garam", "Minyak nabati"],
        "KLN-004": ["Ikan tenggiri", "Tepung tapioka", "Telur ayam", "Bawang putih", "Garam", "Gula aren", "Cabai rawit", "Cuka"],
        "KLN-005": ["Tepung beras", "Daun suji", "Santan kelapa", "Gula aren", "Daging durian", "Nangka", "Es batu"],
        "KLN-006": ["Kentang", "Tepung terigu", "Santan kelapa", "Telur ayam", "Gula pasir", "Kismis", "Keju parut"]
    };

    function openDetail(id) {
        const p = products[id];
        if (!p) return;
        const row = document.querySelector(`.data-table tr[data-id="${id}"]`);
        const tag = row ? row.querySelector(".category-tag") : null;
        const sub = row ? row.querySelector(".product-name-cell small").textContent : "";
        const ing = (DETAIL[id] || []).map(x => `<li>${escapeHtml(x)}</li>`).join("");
        const stock = getStock(id);
        openDialog(`
            <button class="detail-close" id="detailX" aria-label="Tutup"><i class="fa-solid fa-xmark"></i></button>
            <img class="detail-img" src="${p.img}" alt="${escapeHtml(p.name)}" onerror="this.style.visibility='hidden'">
            <div class="detail-body">
                ${tag ? `<span class="${tag.className}">${escapeHtml(tag.textContent)}</span>` : ""}
                <h3>${escapeHtml(p.name)}</h3>
                <p class="detail-sub">${escapeHtml(sub)}</p>
                <div class="detail-price">${rupiah(p.price)} <small>&bull; Stok: ${stock} ${escapeHtml(p.unit)}</small></div>
                <h4>Komposisi Bahan Alami</h4>
                <ul class="ing-list">${ing}</ul>
                <div class="custom-dialog-buttons">
                    <button class="custom-dialog-btn btn-dialog-cancel" id="detailCloseBtn">Keluar Pratinjau</button>
                    <button class="custom-dialog-btn btn-dialog-confirm" id="detailAddBtn" ${stock <= 0 ? "disabled" : ""}>${stock <= 0 ? "Stok Habis" : "Tambah ke Keranjang"}</button>
                </div>
            </div>`, "detail");
        bindClose("detailX");
        bindClose("detailCloseBtn");
        document.getElementById("detailAddBtn").onclick = () => { if (getStock(id) > 0) showQuantityPrompt(products[id]); };
    }

    let favDragged = false;
    // Setelah menggeser, klik yang menyusul diabaikan (fase capture)
    document.addEventListener("click", e => { if (favDragged) { e.stopPropagation(); e.preventDefault(); } }, true);
    document.addEventListener("click", e => {
        const rowHit = e.target.closest(".data-table .img-box-table, .data-table .product-name-cell");
        if (rowHit) { openDetail(rowHit.closest("tr").dataset.id); return; }
        const card = e.target.closest(".product-card[data-detail]");
        if (card && e.target.closest(".card-image, .card-title, .card-desc")) openDetail(card.dataset.detail);
    });

    // ============================================================
    // 13. Menu Favorit: berjalan otomatis searah, berhenti saat disorot, bisa digeser
    // ============================================================
    (function initFavorites() {
        const vp = document.getElementById("favViewport");
        const track = document.getElementById("favTrack");
        if (!vp || !track) return;
        const n = track.children.length;
        for (let c = 0; c < 2; c++) {          // 3 salinan agar putaran mulus
            for (let i = 0; i < n; i++) {
                const k = track.children[i].cloneNode(true);
                k.setAttribute("aria-hidden", "true");
                track.appendChild(k);
            }
        }
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const SPEED = 40;                       // piksel per detik
        const period = () => track.children[n].offsetLeft - track.children[0].offsetLeft;
        let paused = false, down = false, sx = 0, sl = 0, pos = period(), last = 0, resumeTimer = 0;
        vp.scrollLeft = pos;

        function tick(t) {
            const dt = Math.min(t - (last || t), 50) / 1000;
            last = t;
            if (!paused && !down && !reduce) {
                const w = period();
                pos += SPEED * dt;
                if (pos >= 2 * w) pos -= w;
                vp.scrollLeft = pos;
            }
            requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);

        vp.addEventListener("scroll", () => {   // jaga posisi tetap di salinan tengah saat digeser manual
            if (!paused && !down) return;
            const w = period(), s = vp.scrollLeft;
            if (s < w) { vp.scrollLeft = s + w; sl += w; }
            else if (s >= 2 * w) { vp.scrollLeft = s - w; sl -= w; }
        });

        function resume() { pos = vp.scrollLeft; paused = false; }
        vp.addEventListener("mouseenter", () => { paused = true; });
        vp.addEventListener("mouseleave", () => { if (!down) resume(); });
        vp.addEventListener("touchstart", () => { clearTimeout(resumeTimer); paused = true; }, { passive: true });
        vp.addEventListener("touchend", () => { clearTimeout(resumeTimer); resumeTimer = setTimeout(resume, 1500); }, { passive: true });

        vp.addEventListener("pointerdown", e => {
            if (e.pointerType !== "mouse" || e.button !== 0) return;
            down = true; sx = e.clientX; sl = vp.scrollLeft; favDragged = false;
        });
        window.addEventListener("pointermove", e => {
            if (!down) return;
            const dx = e.clientX - sx;
            if (Math.abs(dx) > 5) { favDragged = true; vp.classList.add("dragging"); }
            vp.scrollLeft = sl - dx;
        });
        window.addEventListener("pointerup", () => {
            if (!down) return;
            down = false;
            vp.classList.remove("dragging");
            pos = vp.scrollLeft;
            setTimeout(() => { favDragged = false; }, 0);
        });
    })();

    // ============================================================
    // 10. Inisialisasi
    // ============================================================
    getMyOrderIds();                     // bersihkan riwayat tamu yang lewat 24 jam
    updateAdminUIState();
    updateCartUI();
    refreshStocks();
    setInterval(refreshStocks, 15000);   // stok selalu mengikuti data terbaru di server
});
