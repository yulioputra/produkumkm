document.addEventListener("DOMContentLoaded", function () {
    const LS_MY_ORDERS = "umkm_my_orders";
    const LS_MEMBER_ORDERS = "umkm_member_orders";
    const SS_ADMIN_TOKEN = "umkm_admin_token";
    const SS_MEMBER_USER = "umkm_member_user";
    const WA_NUMBER = "6287856866682";

    let adminToken = sessionStorage.getItem(SS_ADMIN_TOKEN) || null;
    let memberUser = sessionStorage.getItem(SS_MEMBER_USER) || null;

    function isAdmin() {
        return !!adminToken;
    }

    function isMember() {
        return !!memberUser || !!adminToken;
    }

    function escapeHtml(str) {
        return String(str).replace(/[&<>"']/g, function (c) {
            return {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            }[c];
        });
    }

    function rupiah(n) {
        return "Rp " + Number(n).toLocaleString("id-ID");
    }

    function formatTime(iso) {
        return new Date(iso).toLocaleString("id-ID", {
            dateStyle: "medium",
            timeStyle: "short"
        });
    }

    // Detail Produk Database (Khas Desa Pegandon)
    const productDetails = {
        "KLN-001": {
            name: "Risoles Mayo Pegandon (Isi 5)",
            desc: "Risoles buatan tangan warga Desa Pegandon dengan balutan kulit pastry renyah digoreng keemasan, berisi ragout lembut, telur rebus pilihan, smoked beef, dan keju mozarella melted.",
            ingredients: [
                "Tepung Terigu Protein Sedang",
                "Daging Sapi Asap (Smoked Beef)",
                "Telur Ayam Segar",
                "Keju Melted & Mayones Spesial",
                "Susu Sapi Murni & Mentega"
            ]
        },
        "KLN-002": {
            name: "Kopi Tubruk Pegandon",
            desc: "Kopi tubruk khas Desa Pegandon diseduh bersama rempah-rempah pilihan seperti kapulaga, cengkeh, dan kayu manis alami, menghasilkan aroma wangi khas pedesaan.",
            ingredients: [
                "Biji Kopi Robusta & Arabika Pilihan",
                "Kayu Manis Ceylon Asli",
                "Kapulaga & Cengkeh Pilihan",
                "Gula Aren Murni Pegandon"
            ]
        },
        "KLN-003": {
            name: "Keripik Singkong Pegandon",
            desc: "Irisan singkong segar hasil panen petani Desa Pegandon yang digoreng renyah garing dengan bumbu balado rahasia bercita rasa pedas manis.",
            ingredients: [
                "Singkong Segar Panen Lokal Pegandon",
                "Cabai Merah Keriting Asli",
                "Gula Merah Aren",
                "Bawang Putih & Daun Jeruk Purut"
            ]
        },
        "KLN-004": {
            name: "Pempek Pegandon (Promo)",
            desc: "Pempek ikan tenggiri asli tanpa pengawet buatan dapur Pegandon dengan isian telur utuh, disajikan bersama kuah cuko kental asam pedas manis.",
            ingredients: [
                "Ikan Tenggiri Segar Pilihan",
                "Tepung Sagu Berkualitas",
                "Bawang Putih & Ebi Pilihan",
                "Gula Batok & Asam Jawa Asli"
            ]
        },
        "KLN-005": {
            name: "Es Cendol Pegandon",
            desc: "Minuman segar tradisional berisikan cendol tepung beras suji buatan warga Pegandon, santan murni, gula aren cair, serta topping daging durian dan nangka.",
            ingredients: [
                "Tepung Beras & Ekstrak Daun Suji",
                "Santan Kelapa Murni",
                "Gula Aren Asli",
                "Daging Buah Durian & Nangka Segar"
            ]
        },
        "KLN-006": {
            name: "Kue Lumpur Pegandon (Isi 4)",
            desc: "Kue basah tradisional khas Desa Pegandon yang bertekstur sangat lembut dan lumer di mulut karena menggunakan adonan kentang kukus berpadu santan murni.",
            ingredients: [
                "Kentang Kukus Pilihan",
                "Tepung Terigu & Telur Ayam",
                "Santan Murni & Mentega",
                "Topping Kismis & Keju Cheddar Parut"
            ]
        }
    };

    const fallbackImgMap = {
        "KLN-001": "https://nurse-grin-ql608.hostmora.app/images/risoles.jpg",
        "KLN-002": "https://nurse-grin-ql608.hostmora.app/images/kopi-tubruk.jpg",
        "KLN-003": "https://nurse-grin-ql608.hostmora.app/images/keripik-singkong.jpg",
        "KLN-004": "https://nurse-grin-ql608.hostmora.app/images/pempek.jpg",
        "KLN-005": "https://nurse-grin-ql608.hostmora.app/images/es-cendol.jpg",
        "KLN-006": "https://nurse-grin-ql608.hostmora.app/images/kue-lumpur.jpg"
    };

    const LS_STOCKS = "umkm_stocks";
    const LS_CUSTOM_MENU = "umkm_custom_menu_pegandon";
    const LS_ORDERS = "umkm_orders";
    const LS_LOGS = "umkm_stock_logs";
    const ADMIN_USER = "yulio";
    const ADMIN_PASS = "admin123";
    const LOCAL_TOKEN = "local-admin-session";

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
        } catch (e) {
            return fallback;
        }
    }

    function lsSet(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) { }
    }

    function httpError(status, message) {
        return { status: status, message: message };
    }

    function purgeExpiredGuestOrders() {
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        const guestRecords = lsGet(LS_MY_ORDERS, []);
        const validGuestIds = guestRecords
            .filter(function (rec) {
                return rec && typeof rec === "object" && (now - new Date(rec.time).getTime()) < dayMs;
            })
            .map(function (rec) {
                return rec.id;
            });
        lsSet(LS_MY_ORDERS, guestRecords.filter(function (rec) {
            return rec && validGuestIds.includes(rec.id);
        }));

        const memberMap = lsGet(LS_MEMBER_ORDERS, {});
        const allMemberOrderIds = Object.values(memberMap).flat();
        const allOrders = lsGet(LS_ORDERS, []);
        const keptOrders = allOrders.filter(function (o) {
            if (allMemberOrderIds.includes(o.id)) return true;
            return (now - new Date(o.time).getTime()) < dayMs;
        });
        lsSet(LS_ORDERS, keptOrders);
    }

    function localStock(id) {
        const st = lsGet(LS_STOCKS, {});
        return st[id] !== undefined ? st[id] : products[id].initialStock;
    }

    let cart = [];

    function applySavedMenuEdits() {
        const customMenu = lsGet(LS_CUSTOM_MENU, {});
        Object.keys(customMenu).forEach(function (id) {
            const item = customMenu[id];
            if (!item) return;

            if (products[id]) {
                if (item.name) products[id].name = item.name;
                if (typeof item.price === "number" && item.price > 0) products[id].price = item.price;
            }
            if (productDetails[id] && item.name) {
                productDetails[id].name = item.name;
            }

            const row = document.querySelector('.data-table tbody tr[data-id="' + id + '"]');
            if (row) {
                if (item.name) {
                    row.dataset.name = item.name;
                    const nameStrong = row.querySelector(".product-name-cell strong");
                    if (nameStrong) nameStrong.textContent = item.name;
                }
                if (typeof item.price === "number" && item.price > 0) {
                    row.dataset.price = String(item.price);
                    const priceCell = row.querySelector(".price-cell");
                    if (priceCell) {
                        priceCell.dataset.price = String(item.price);
                        priceCell.innerHTML = rupiah(item.price);
                    }
                }
            }

            document.querySelectorAll('.product-card[data-detail-id="' + id + '"]').forEach(function (card) {
                if (item.name) {
                    const cardTitle = card.querySelector(".card-title");
                    if (cardTitle) cardTitle.textContent = item.name;
                }
                if (typeof item.price === "number" && item.price > 0) {
                    const curPrice = card.querySelector(".current-price");
                    if (curPrice) curPrice.textContent = rupiah(item.price);
                    const oldPrice = card.querySelector(".old-price");
                    if (oldPrice) oldPrice.remove();
                }
                const buyBtn = card.querySelector(".add-to-cart-btn");
                if (buyBtn) {
                    if (item.name) buyBtn.dataset.name = item.name;
                    if (typeof item.price === "number" && item.price > 0) buyBtn.dataset.price = String(item.price);
                }
            });

            cart.forEach(function (cartItem) {
                if (cartItem.id === id) {
                    if (item.name) cartItem.name = item.name;
                    if (typeof item.price === "number" && item.price > 0) cartItem.price = item.price;
                }
            });
        });
    }

    function openEditMenuDialog(id) {
        if (!isAdmin() || !products[id]) return;
        const p = products[id];

        openDialog(`
            <div class="custom-dialog-icon"><i class="fa-solid fa-pen-to-square"></i></div>
            <h3>Edit Nama & Harga Menu</h3>
            <p>Ubah nama jajanan/minuman serta harga jual untuk kode <strong>${escapeHtml(id)}</strong>.</p>
            <label class="form-label" for="editMenuNameInput">Nama Jajanan / Minuman</label>
            <input type="text" id="editMenuNameInput" value="${escapeHtml(p.name)}" maxlength="80" placeholder="Nama jajanan atau minuman">
            <label class="form-label" for="editMenuPriceInput">Harga (Rp)</label>
            <input type="number" id="editMenuPriceInput" value="${p.price}" min="100" step="500" placeholder="Contoh: 15000">
            <p id="editMenuErr" style="display:none; color:var(--accent); font-size:0.8rem; font-weight:700; margin-top:-0.2rem; margin-bottom:0.8rem;"></p>
            <div class="custom-dialog-buttons">
                <button type="button" class="custom-dialog-btn btn-dialog-cancel" id="dialogCancelBtn">Batal</button>
                <button type="button" class="custom-dialog-btn btn-dialog-confirm" id="saveMenuEditBtn">Simpan Perubahan</button>
            </div>
        `);

        bindClose("dialogCancelBtn");
        document.getElementById("saveMenuEditBtn").onclick = function () {
            const newName = document.getElementById("editMenuNameInput").value.trim();
            const newPrice = parseInt(document.getElementById("editMenuPriceInput").value, 10);
            const errEl = document.getElementById("editMenuErr");

            if (newName.length < 2) {
                errEl.textContent = "Nama jajanan atau minuman minimal 2 karakter.";
                errEl.style.display = "block";
                return;
            }
            if (isNaN(newPrice) || newPrice < 100) {
                errEl.textContent = "Masukkan harga valid (minimal Rp 100).";
                errEl.style.display = "block";
                return;
            }

            const customMenu = lsGet(LS_CUSTOM_MENU, {});
            customMenu[id] = { name: newName, price: newPrice };
            lsSet(LS_CUSTOM_MENU, customMenu);

            applySavedMenuEdits();
            renderStocks();
            updateCartUI();
            closeDialog();
            infoDialog("fa-solid fa-circle-check", "#16a34a", "Menu Diperbarui", 'Nama dan harga "' + newName + '" (' + rupiah(newPrice) + ") berhasil disimpan.");
        };
    }

    function localChangeStock(id, newQty, actor, note) {
        const before = localStock(id);
        if (before === newQty) return;
        const st = lsGet(LS_STOCKS, {});
        st[id] = newQty;
        lsSet(LS_STOCKS, st);
        const logs = lsGet(LS_LOGS, []);
        logs.unshift({
            time: new Date().toISOString(),
            id: id,
            name: products[id].name,
            before: before,
            after: newQty,
            actor: actor,
            note: note || ""
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
            customer: customer,
            phone: phone,
            address: address,
            note: note,
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
        raw.forEach(function (it) {
            const qty = Number(it && it.qty);
            if (!it || !products[it.id] || !Number.isInteger(qty) || qty < 1 || qty > 1000) {
                throw httpError(400, "Data pesanan tidak valid.");
            }
            wanted[it.id] = (wanted[it.id] || 0) + qty;
        });

        const shortages = [];
        Object.keys(wanted).forEach(function (id) {
            const s = localStock(id);
            if (s < wanted[id]) shortages.push(products[id].name + " (sisa " + s + ", diminta " + wanted[id] + ")");
        });
        if (shortages.length) throw httpError(409, "Stok tidak mencukupi: " + shortages.join("; ") + ".");

        const items = Object.keys(wanted).map(function (id) {
            return { id: id, name: products[id].name, price: products[id].price, qty: wanted[id] };
        });
        const order = Object.assign({
            id: "ORD-" + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 256).toString(16).toUpperCase().padStart(2, "0"),
            time: new Date().toISOString(),
            total: items.reduce(function (sum, i) { return sum + i.price * i.qty; }, 0),
            status: "Menunggu Konfirmasi WhatsApp"
        }, info, { items: items });

        items.forEach(function (it) {
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
            return Object.keys(products).map(function (id) {
                return { id: id, name: products[id].name, price: products[id].price, unit: products[id].unit, stock: localStock(id) };
            });
        }
        if (route === "/login" && method === "POST") {
            if (body.username === ADMIN_USER && body.password === ADMIN_PASS) return { token: LOCAL_TOKEN, user: ADMIN_USER };
            throw httpError(401, "Username atau password salah!");
        }
        if (route === "/logout" && method === "POST") return { ok: true };

        const m = route.match(/^\/products\/([^/]+)\/stock$/);
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
            purgeExpiredGuestOrders();
            const all = lsGet(LS_ORDERS, []);
            if (admin) return all;
            const ids = (query.get("ids") || "").split(",");
            return all.filter(function (o) { return ids.indexOf(o.id) !== -1; });
        }
        if (route === "/stock-logs" && method === "GET") {
            needAdmin();
            return lsGet(LS_LOGS, []);
        }
        throw httpError(404, "Endpoint tidak ditemukan");
    }

    function getMyOrderIds() {
        purgeExpiredGuestOrders();
        const guestIds = lsGet(LS_MY_ORDERS, []).map(function (r) { return typeof r === "string" ? r : r.id; });
        if (memberUser) {
            const memberMap = lsGet(LS_MEMBER_ORDERS, {});
            const mIds = memberMap[memberUser] || [];
            return Array.from(new Set(mIds.concat(guestIds)));
        }
        return guestIds;
    }

    function rememberOrder(order) {
        if (memberUser) {
            const memberMap = lsGet(LS_MEMBER_ORDERS, {});
            const list = memberMap[memberUser] || [];
            list.unshift(order.id);
            memberMap[memberUser] = list.slice(0, 200);
            lsSet(LS_MEMBER_ORDERS, memberMap);
        } else {
            const guestRecords = lsGet(LS_MY_ORDERS, []);
            guestRecords.unshift({ id: order.id, time: order.time });
            lsSet(LS_MY_ORDERS, guestRecords.slice(0, 50));
        }
    }

    // Visitor Counter
    const visitorEl = document.getElementById("visitorCount");
    if (visitorEl) {
        const hasVisitedSession = sessionStorage.getItem("umkm_session_visited");
        const endpoint = hasVisitedSession
            ? "https://api.counterapi.dev/v1/kuliner-pegandon-desa/visits"
            : "https://api.counterapi.dev/v1/kuliner-pegandon-desa/visits/up";
        fetch(endpoint)
            .then(function (res) { return res.json(); })
            .then(function (data) {
                if (data && typeof data.count === "number") {
                    visitorEl.textContent = data.count.toLocaleString("id-ID");
                    sessionStorage.setItem("umkm_session_visited", "true");
                }
            })
            .catch(function () { visitorEl.textContent = "1"; });
    }

    // Products Mapping
    const products = {};
    document.querySelectorAll(".data-table tbody tr").forEach(function (row) {
        const raw = row.querySelector(".stock-cell").textContent.trim();
        products[row.dataset.id] = {
            id: row.dataset.id,
            name: row.dataset.name,
            price: parseInt(row.dataset.price, 10),
            img: row.dataset.img,
            unit: raw.replace(/[0-9]/g, "").trim() || "Pcs",
            initialStock: parseInt(raw.replace(/[^0-9]/g, ""), 10) || 0
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
            list.forEach(function (p) {
                stocks[p.id] = p.stock;
                if (products[p.id]) {
                    products[p.id].unit = p.unit;
                    products[p.id].price = p.price;
                }
            });
            applySavedMenuEdits();
            renderStocks();
            updateCartUI();
        } catch (e) { }
    }

    const customDialogOverlay = document.getElementById("customDialogOverlay");
    const customDialogBox = document.getElementById("customDialogBox");

    function openDialog(html, mode) {
        const cls = mode === true ? "wide" : (mode || "");
        customDialogBox.className = "custom-dialog" + (cls ? " " + cls : "");
        customDialogBox.innerHTML = '<button type="button" class="dialog-close-x" id="dialogTopCloseBtn" title="Keluar Pratinjau"><i class="fa-solid fa-xmark"></i></button>' + html;
        customDialogOverlay.classList.add("active");
        const topClose = document.getElementById("dialogTopCloseBtn");
        if (topClose) topClose.onclick = closeDialog;
    }

    function closeDialog() {
        customDialogOverlay.classList.remove("active");
    }

    customDialogOverlay.addEventListener("click", function (e) {
        if (e.target === customDialogOverlay) closeDialog();
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
                <button type="button" class="custom-dialog-btn btn-dialog-confirm" id="dialogOkBtn">OK</button>
            </div>
        `);
        bindClose("dialogOkBtn");
    }

    function errorDialog(title, e) {
        infoDialog("fa-solid fa-triangle-exclamation", "var(--accent)", title, (e && e.message) || "Terjadi kesalahan.");
    }

    // Detail Modal Trigger
    document.addEventListener("click", function (e) {
        const trigger = e.target.closest(".open-detail");
        if (!trigger) return;
        const id = trigger.dataset.id;
        const info = productDetails[id];
        const p = products[id];
        if (!info || !p) return;

        openDialog(`
            <div class="detail-modal-body">
                <img src="${p.img}" alt="${escapeHtml(info.name)}" class="detail-modal-img" onerror="this.src='${fallbackImgMap[id] || ''}'">
                <h3>${escapeHtml(info.name)}</h3>
                <div class="detail-section-title">Deskripsi Kuliner Desa Pegandon</div>
                <div class="detail-desc">${escapeHtml(info.desc)}</div>
                <div class="detail-section-title">Komposisi & Bahan Alami</div>
                <ul class="ingredient-list">
                    ${info.ingredients.map(function (ing) { return "<li>" + escapeHtml(ing) + "</li>"; }).join("")}
                </ul>
                <div style="margin-top:1.2rem; display:flex; justify-content:space-between; align-items:center; border-top:1px solid #f1f5f9; padding-top:0.9rem; gap:8px; flex-wrap:wrap;">
                    <span style="font-size:1.15rem; font-weight:800; color:var(--dark);">${rupiah(p.price)}</span>
                    <div style="display:flex; gap:8px;">
                        <button type="button" class="custom-dialog-btn btn-dialog-cancel" id="detailCloseBtn" style="padding:0.55rem 0.95rem;">
                            <i class="fa-solid fa-arrow-left"></i> Keluar Pratinjau
                        </button>
                        <button type="button" class="custom-dialog-btn btn-dialog-confirm add-to-cart-btn" data-id="${p.id}" data-name="${escapeHtml(p.name)}" data-price="${p.price}" data-img="${p.img}" style="padding:0.55rem 1rem;" id="detailBuyBtn">
                            <i class="fa-solid fa-cart-plus"></i> Beli
                        </button>
                    </div>
                </div>
            </div>
        `);
        bindClose("detailCloseBtn");
    });

    function updateMemberUIState() {
        const memberNavText = document.getElementById("memberNavText");
        if (memberNavText) memberNavText.textContent = memberUser ? ("Member: " + memberUser) : "Login Member";
    }

    function updateAdminUIState() {
        const navText = document.getElementById("adminNavText");
        if (navText) navText.textContent = isAdmin() ? "Admin (Logout)" : "Login Admin";
        const stockLogItem = document.getElementById("stockLogNavItem");
        if (stockLogItem) stockLogItem.style.display = isAdmin() ? "" : "none";
        renderStocks();
    }

    function forceLogout() {
        sessionStorage.removeItem(SS_ADMIN_TOKEN);
        sessionStorage.removeItem(SS_MEMBER_USER);
        adminToken = null;
        memberUser = null;
        updateMemberUIState();
        updateAdminUIState();
    }

    function renderStocks() {
        document.querySelectorAll(".data-table tbody tr").forEach(function (row) {
            const id = row.dataset.id;
            const p = products[id];
            const stockNum = getStock(id);
            const stockCell = row.querySelector(".stock-cell");
            const statusBadge = row.querySelector(".status-badge");
            const actionCell = row.querySelector(".action-cell");

            if (isAdmin()) {
                const active = document.activeElement;
                if (!(active && stockCell.contains(active))) {
                    stockCell.innerHTML = `
                        <div class="stock-edit-wrap">
                            <input type="number" class="stock-input" value="${stockNum}" min="0" data-id="${id}">
                            <button type="button" class="btn-save-stock save-stock-btn" title="Simpan Stok"><i class="fa-solid fa-check"></i></button>
                        </div>`;
                }
                const nameCell = row.querySelector(".product-name-cell");
                if (nameCell && !nameCell.querySelector(".edit-menu-btn")) {
                    const btn = document.createElement("button");
                    btn.type = "button";
                    btn.className = "btn-edit-menu edit-menu-btn";
                    btn.dataset.id = id;
                    btn.innerHTML = '<i class="fa-solid fa-pen"></i> Edit Nama & Harga';
                    nameCell.appendChild(btn);
                }
            } else {
                stockCell.textContent = stockNum + " " + p.unit;
                const editBtn = row.querySelector(".edit-menu-btn");
                if (editBtn) editBtn.remove();
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
                        <button type="button" class="btn-table-action add-to-cart-btn" data-id="${id}" data-name="${escapeHtml(p.name)}" data-price="${p.price}" data-img="${p.img}" title="Masukan Keranjang">
                            <i class="fa-solid fa-cart-plus"></i>
                        </button>`;
                }
            }
        });
    }

    document.addEventListener("click", async function (e) {
        const editMenuBtn = e.target.closest(".edit-menu-btn");
        if (editMenuBtn && isAdmin()) {
            openEditMenuDialog(editMenuBtn.dataset.id);
            return;
        }

        const saveBtn = e.target.closest(".save-stock-btn");
        if (!saveBtn || !isAdmin()) return;
        const row = saveBtn.closest("tr");
        const id = row.dataset.id;
        const val = parseInt(row.querySelector(".stock-input").value, 10);
        if (isNaN(val) || val < 0) {
            infoDialog("fa-solid fa-triangle-exclamation", "var(--accent)", "Stok Tidak Valid", "Isi stok dengan angka 0 atau lebih.");
            return;
        }
        try {
            await api("/products/" + encodeURIComponent(id) + "/stock", {
                method: "PUT",
                body: JSON.stringify({ stock: val })
            });
        } catch (err) {
            errorDialog("Gagal Menyimpan Stok", err);
        }
        await refreshStocks();
    });

    // Menu Search & Category Filter
    const menuSearchInput = document.getElementById("menuSearchInput");
    const menuCategoryFilter = document.getElementById("menuCategoryFilter");
    const menuSearchBtn = document.getElementById("menuSearchBtn");
    const noMenuFound = document.getElementById("noMenuFound");

    function filterMenuTable() {
        const query = (menuSearchInput ? menuSearchInput.value : "").trim().toLowerCase();
        const cat = menuCategoryFilter ? menuCategoryFilter.value : "";
        const rows = document.querySelectorAll("#menuDataTable tbody tr");
        let visibleCount = 0;

        rows.forEach(function (row) {
            const nameText = row.textContent.toLowerCase();
            const rowCat = row.dataset.category || "";
            const matchText = !query || nameText.includes(query);
            const matchCat = !cat || rowCat === cat;
            if (matchText && matchCat) {
                row.style.display = "";
                visibleCount++;
            } else {
                row.style.display = "none";
            }
        });

        if (noMenuFound) {
            noMenuFound.style.display = visibleCount === 0 ? "block" : "none";
        }
    }

    if (menuSearchInput) menuSearchInput.addEventListener("input", filterMenuTable);
    if (menuCategoryFilter) menuCategoryFilter.addEventListener("change", filterMenuTable);
    if (menuSearchBtn) menuSearchBtn.addEventListener("click", filterMenuTable);

    // Member Login / Register Modal
    const memberLoginNavBtn = document.getElementById("memberLoginNavBtn");
    if (memberLoginNavBtn) {
        memberLoginNavBtn.addEventListener("click", function (e) {
            e.preventDefault();
            if (memberUser) {
                openDialog(`
                    <div class="custom-dialog-icon"><i class="fa-solid fa-user-check"></i></div>
                    <h3>Akun Member Aktif (${escapeHtml(memberUser)})</h3>
                    <p>Riwayat pesanan Anda tersimpan permanen dan tidak akan terhapus otomatis.</p>
                    <div class="custom-dialog-buttons">
                        <button type="button" class="custom-dialog-btn btn-dialog-cancel" id="dialogCancelBtn">Tutup</button>
                        <button type="button" class="custom-dialog-btn btn-dialog-confirm" id="dialogLogoutBtn" style="background:var(--accent);">Logout Member</button>
                    </div>
                `);
                bindClose("dialogCancelBtn");
                document.getElementById("dialogLogoutBtn").onclick = function () {
                    sessionStorage.removeItem(SS_MEMBER_USER);
                    memberUser = null;
                    updateMemberUIState();
                    closeDialog();
                };
                return;
            }
            showMemberAuthModal(false);
        });
    }

    function showMemberAuthModal(isRegister) {
        openDialog(`
            <div class="custom-dialog-icon"><i class="fa-solid fa-user-circle"></i></div>
            <h3>${isRegister ? "Daftar Member Baru" : "Login Member"}</h3>
            <p>${isRegister ? "Buat akun member (bebas username & password) agar riwayat pesanan tidak hilang dalam 24 jam." : "Masuk sebagai member (bebas username/email & password) untuk menyimpan riwayat pesanan."}</p>
            <input type="text" id="authUser" placeholder="Username / Email (bebas)">
            <input type="password" id="authPass" placeholder="Password (bebas)">
            <p class="form-error" id="authError" style="display:none; color:var(--accent); font-size:0.8rem; font-weight:700; margin-bottom:8px;"></p>
            <div class="custom-dialog-buttons">
                <button type="button" class="custom-dialog-btn btn-dialog-cancel" id="dialogCancelBtn">Batal</button>
                <button type="button" class="custom-dialog-btn btn-dialog-confirm" id="authSubmitBtn">${isRegister ? "Daftar & Masuk" : "Login Member"}</button>
            </div>
            <div style="margin-top:1rem; font-size:0.82rem; text-align:center;">
                ${isRegister ? 'Sudah punya akun? <a href="#" id="switchToLogin" style="color:var(--primary); font-weight:700;">Login di sini</a>' : 'Belum punya akun? <a href="#" id="switchToRegister" style="color:var(--primary); font-weight:700;">Sign Up / Daftar</a>'}
            </div>
        `);
        bindClose("dialogCancelBtn");

        const subBtn = document.getElementById("authSubmitBtn");
        subBtn.onclick = function () {
            const userVal = document.getElementById("authUser").value.trim();
            const passVal = document.getElementById("authPass").value.trim();
            const errEl = document.getElementById("authError");
            if (!userVal || !passVal) {
                errEl.textContent = "Isi username dan password (bebas apa saja).";
                errEl.style.display = "block";
                return;
            }
            const guestOrders = lsGet(LS_MY_ORDERS, []).map(function (r) { return typeof r === "string" ? r : r.id; });
            const memberMap = lsGet(LS_MEMBER_ORDERS, {});
            memberMap[userVal] = Array.from(new Set((memberMap[userVal] || []).concat(guestOrders)));
            lsSet(LS_MEMBER_ORDERS, memberMap);

            memberUser = userVal;
            sessionStorage.setItem(SS_MEMBER_USER, memberUser);
            updateMemberUIState();
            closeDialog();
            infoDialog("fa-solid fa-circle-check", "#16a34a", "Login Member Berhasil", "Selamat datang, " + userVal + "! Riwayat pesanan kuliner Pegandon Anda kini tersimpan permanen.");
        };

        const swReg = document.getElementById("switchToRegister");
        if (swReg) swReg.onclick = function (e) { e.preventDefault(); showMemberAuthModal(true); };
        const swLog = document.getElementById("switchToLogin");
        if (swLog) swLog.onclick = function (e) { e.preventDefault(); showMemberAuthModal(false); };
    }

    // Admin Login Modal
    const adminLoginNavBtn = document.getElementById("adminLoginNavBtn");
    if (adminLoginNavBtn) {
        adminLoginNavBtn.addEventListener("click", async function (e) {
            e.preventDefault();
            if (isAdmin()) {
                try { await api("/logout", { method: "POST" }); } catch (err) { }
                sessionStorage.removeItem(SS_ADMIN_TOKEN);
                adminToken = null;
                updateAdminUIState();
                return;
            }

            openDialog(`
                <div class="custom-dialog-icon"><i class="fa-solid fa-user-shield"></i></div>
                <h3>Login Admin</h3>
                <p>Masukkan kredensial administrator untuk mengelola stok dan menu.</p>
                <input type="text" id="adminUser" placeholder="Username" autocomplete="off" style="margin-bottom:8px;">
                <div style="position:relative; margin-bottom:1.2rem;">
                    <input type="password" id="adminPass" placeholder="Password" autocomplete="new-password" style="margin-bottom:0; padding-right:40px;">
                    <button type="button" id="togglePassBtn" style="position:absolute; right:12px; top:50%; transform:translateY(-50%); background:none; border:none; color:var(--dark-muted); cursor:pointer; font-size:1rem;" title="Tampilkan/Sembunyikan Password">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                </div>
                <div class="custom-dialog-buttons">
                    <button type="button" class="custom-dialog-btn btn-dialog-cancel" id="dialogCancelBtn">Batal</button>
                    <button type="button" class="custom-dialog-btn btn-dialog-confirm" id="dialogLoginBtn">Login</button>
                </div>
            `);

            const passInput = document.getElementById("adminPass");
            const togglePassBtn = document.getElementById("togglePassBtn");
            togglePassBtn.onclick = function () {
                const show = passInput.type === "password";
                passInput.type = show ? "text" : "password";
                togglePassBtn.innerHTML = show ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
            };
            bindClose("dialogCancelBtn");
            document.getElementById("dialogLoginBtn").onclick = async function () {
                const u = document.getElementById("adminUser").value.trim();
                const p = document.getElementById("adminPass").value.trim();
                try {
                    const data = await api("/login", { method: "POST", body: JSON.stringify({ username: u, password: p }) });
                    adminToken = data.token;
                    sessionStorage.setItem(SS_ADMIN_TOKEN, adminToken);
                    closeDialog();
                    updateAdminUIState();
                } catch (err) {
                    let errEl = customDialogBox.querySelector(".login-err");
                    if (!errEl) {
                        errEl = document.createElement("p");
                        errEl.className = "login-err";
                        errEl.style.cssText = "color:var(--accent);font-size:0.8rem;font-weight:700;";
                        customDialogBox.insertBefore(errEl, customDialogBox.querySelector(".custom-dialog-buttons"));
                    }
                    errEl.textContent = err.message;
                }
            };
        });
    }

    // Cart Logic
    const openCartBtn = document.getElementById("openCartBtn");
    const closeCartBtn = document.getElementById("closeCartBtn");
    const addMoreItemsBtn = document.getElementById("addMoreItemsBtn");
    const cartOverlay = document.getElementById("cartOverlay");
    const cartDrawer = document.getElementById("cartDrawer");
    const cartCounter = document.getElementById("cartCounter");
    const cartDrawerBody = document.getElementById("cartDrawerBody");
    const cartTotalPrice = document.getElementById("cartTotalPrice");
    const checkoutWhatsappBtn = document.getElementById("checkoutWhatsappBtn");
    const selectAllCart = document.getElementById("selectAllCart");
    const selectedCountEl = document.getElementById("selectedCount");

    function toggleCart(open) {
        cartDrawer.classList.toggle("active", open);
        cartOverlay.classList.toggle("active", open);
    }

    openCartBtn.addEventListener("click", function () { toggleCart(true); });
    closeCartBtn.addEventListener("click", function () { toggleCart(false); });
    cartOverlay.addEventListener("click", function () { toggleCart(false); });
    addMoreItemsBtn.addEventListener("click", function () { toggleCart(false); });

    function syncCartWithStock() {
        cart = cart.filter(function (item) {
            const s = getStock(item.id);
            if (s <= 0) return false;
            if (item.qty > s) item.qty = s;
            return true;
        });
    }

    function getSelectedCartItems() {
        return cart.filter(function (item) {
            const cb = cartDrawerBody.querySelector('.cart-item-checkbox[data-id="' + item.id + '"]');
            return cb ? cb.checked : true;
        });
    }

    function cartTotal() {
        const selected = getSelectedCartItems();
        return selected.reduce(function (sum, i) { return sum + i.price * i.qty; }, 0);
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
        const existing = cart.find(function (i) { return i.id === p.id; });
        const currentInCart = existing ? existing.qty : 0;
        const remainingStock = maxStock - currentInCart;

        if (remainingStock <= 0) {
            infoDialog(
                "fa-solid fa-triangle-exclamation",
                "var(--accent)",
                "Stok Maksimal Tercapai",
                "Stok untuk " + p.name + " sisa " + maxStock + ". Anda sudah memasukkan semuanya ke keranjang!"
            );
            return;
        }

        openDialog(`
            <div class="custom-dialog-icon"><i class="fa-solid fa-basket-shopping"></i></div>
            <h3>Masukkan Jumlah</h3>
            <p>Berapa porsi / buah <strong>${escapeHtml(p.name)}</strong> yang ingin dibeli?<br><small style="color:var(--primary);">Stok tersedia: ${maxStock} (di keranjang: ${currentInCart})</small></p>
            <input type="number" id="promptQtyInput" value="1" min="1" max="${remainingStock}" style="text-align:center;">
            <p id="promptQtyErr" style="display:none; color:var(--accent); font-size:0.8rem; font-weight:700; margin-top:-0.4rem; margin-bottom:0.8rem;"></p>
            <div class="custom-dialog-buttons">
                <button type="button" class="custom-dialog-btn btn-dialog-cancel" id="dialogCancelBtn">Batal</button>
                <button type="button" class="custom-dialog-btn btn-dialog-confirm" id="dialogConfirmBtn">Masukan Keranjang</button>
            </div>
        `);

        const input = document.getElementById("promptQtyInput");
        const errEl = document.getElementById("promptQtyErr");
        input.focus();
        input.select();
        bindClose("dialogCancelBtn");
        document.getElementById("dialogConfirmBtn").onclick = function () {
            const rawVal = input.value.trim();
            const qty = parseInt(rawVal, 10);
            if (rawVal === "" || isNaN(qty) || qty < 1) {
                errEl.textContent = "Jumlah pembelian minimal 1! Tidak boleh 0 atau kosong.";
                errEl.style.display = "block";
                input.focus();
                return;
            }
            const finalQty = qty > remainingStock ? remainingStock : qty;
            addToCart(p, finalQty);
            closeDialog();
            toggleCart(true);
        };
    }

    function addToCart(p, qty) {
        const existing = cart.find(function (i) { return i.id === p.id; });
        if (existing) existing.qty += qty;
        else cart.push({ id: p.id, name: p.name, price: p.price, img: p.img, qty: qty, checked: true });
        updateCartUI();
    }

    function updateCartUI() {
        syncCartWithStock();
        cartCounter.textContent = cart.reduce(function (sum, i) { return sum + i.qty; }, 0);

        if (cart.length === 0) {
            cartDrawerBody.innerHTML = `
                <div class="cart-empty-state">
                    <i class="fa-solid fa-basket-shopping"></i>
                    <p>Keranjang belanjaan Anda masih kosong.</p>
                </div>`;
            cartTotalPrice.textContent = "Rp 0";
            if (selectedCountEl) selectedCountEl.textContent = "0";
            checkoutWhatsappBtn.classList.add("disabled");
            if (selectAllCart) selectAllCart.checked = false;
            return;
        }

        cartDrawerBody.innerHTML = cart.map(function (item) {
            return `
                <div class="cart-item">
                    <input type="checkbox" class="cart-item-checkbox" data-id="${item.id}" ${item.checked !== false ? "checked" : ""}>
                    <img src="${item.img}" alt="${escapeHtml(item.name)}" class="cart-item-img" onerror="this.src='${fallbackImgMap[item.id] || ''}'">
                    <div class="cart-item-info">
                        <div class="cart-item-title">${escapeHtml(item.name)}</div>
                        <div class="cart-item-price">${rupiah(item.price)}</div>
                        <div class="cart-item-controls">
                            <button type="button" class="qty-btn decrease-qty" data-id="${item.id}">-</button>
                            <span class="cart-item-qty">${item.qty}</span>
                            <button type="button" class="qty-btn increase-qty" data-id="${item.id}">+</button>
                        </div>
                    </div>
                    <button type="button" class="cart-item-remove remove-item" data-id="${item.id}" title="Hapus"><i class="fa-solid fa-trash-can"></i></button>
                </div>`;
        }).join("");

        const selected = getSelectedCartItems();
        if (selectedCountEl) selectedCountEl.textContent = selected.reduce(function (sum, i) { return sum + i.qty; }, 0);
        cartTotalPrice.textContent = rupiah(cartTotal());

        if (selected.length > 0) {
            checkoutWhatsappBtn.classList.remove("disabled");
        } else {
            checkoutWhatsappBtn.classList.add("disabled");
        }

        if (selectAllCart) {
            selectAllCart.checked = selected.length === cart.length && cart.length > 0;
        }
    }

    if (selectAllCart) {
        selectAllCart.addEventListener("change", function () {
            const isChecked = this.checked;
            cart.forEach(function (item) { item.checked = isChecked; });
            cartDrawerBody.querySelectorAll(".cart-item-checkbox").forEach(function (cb) { cb.checked = isChecked; });
            updateCartUI();
        });
    }

    cartDrawerBody.addEventListener("change", function (e) {
        if (e.target.classList.contains("cart-item-checkbox")) {
            const id = e.target.dataset.id;
            const item = cart.find(function (i) { return i.id === id; });
            if (item) item.checked = e.target.checked;
            updateCartUI();
        }
    });

    cartDrawerBody.addEventListener("click", function (e) {
        const inc = e.target.closest(".increase-qty");
        const dec = e.target.closest(".decrease-qty");
        const rem = e.target.closest(".remove-item");
        const btn = inc || dec || rem;
        if (!btn) return;
        const id = btn.dataset.id;
        const item = cart.find(function (i) { return i.id === id; });
        if (!item) return;

        if (inc) {
            if (item.qty < getStock(id)) item.qty += 1;
        } else if (dec) {
            item.qty -= 1;
            if (item.qty <= 0) cart = cart.filter(function (i) { return i.id !== id; });
        } else {
            cart = cart.filter(function (i) { return i.id !== id; });
        }
        updateCartUI();
    });

    // Checkout Flow
    checkoutWhatsappBtn.addEventListener("click", function () {
        const selected = getSelectedCartItems();
        if (selected.length === 0) return;
        showCheckoutForm();
    });

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
        try { localStorage.setItem(LS_PROFILE, JSON.stringify({ name: d.name, phone: d.phone, address: d.address })); } catch (e) { }
    }

    function randomDigits(n) {
        let out = "";
        for (let i = 0; i < n; i++) out += Math.floor(Math.random() * 10);
        return out;
    }

    function payMethod(id) {
        return PAY_METHODS.find(function (m) { return m.id === id; });
    }

    function showCheckoutForm(prefill) {
        const selected = getSelectedCartItems();
        const d = Object.assign({}, loadProfile(), prefill || {});
        const summary = selected.map(function (i) {
            return "<div><span>" + escapeHtml(i.name) + " &times; " + i.qty + "</span><span>" + rupiah(i.price * i.qty) + "</span></div>";
        }).join("");

        openDialog(`
            <h3><i class="fa-solid fa-bag-shopping"></i> Data Pemesan & Pembayaran</h3>
            <div class="checkout-summary">${summary}<div class="sum-total"><span>Total (${selected.reduce(function (s, i) { return s + i.qty; }, 0)} item)</span><span>${rupiah(cartTotal())}</span></div></div>

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
                ${PAY_METHODS.map(function (m) {
                    return `
                        <label class="pay-option">
                            <input type="radio" name="payMethod" value="${m.id}" ${d.method === m.id ? "checked" : ""}>
                            <i class="${m.icon}"></i>
                            <span><strong>${m.label}</strong><small>${m.desc}</small></span>
                        </label>`;
                }).join("")}
            </div>
            <p class="form-error" id="coError" style="display:none; color:var(--accent); font-size:0.8rem; font-weight:700; margin-bottom:8px;"></p>
            <div class="custom-dialog-buttons">
                <button type="button" class="custom-dialog-btn btn-dialog-cancel" id="dialogCancelBtn">Batal</button>
                <button type="button" class="custom-dialog-btn btn-dialog-whatsapp" id="coNextBtn">Lanjut</button>
            </div>
        `, "checkout");
        bindClose("dialogCancelBtn");

        const radios = customDialogBox.querySelectorAll('input[name="payMethod"]');
        const nextBtn = document.getElementById("coNextBtn");
        function updateNextLabel() {
            const sel = customDialogBox.querySelector('input[name="payMethod"]:checked');
            nextBtn.textContent = sel && sel.value === "cod" ? "Buat Pesanan" : "Lanjut Pembayaran";
        }
        radios.forEach(function (r) { r.addEventListener("change", updateNextLabel); });
        updateNextLabel();

        nextBtn.onclick = function () {
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
            if (err) {
                errEl.textContent = err;
                errEl.style.display = "block";
                return;
            }

            checkoutData = data;
            saveProfile(data);
            if (payMethod(data.method).type === "cod") finalizeOrder(nextBtn);
            else showPaymentSimulation();
        };
    }

    function showPaymentSimulation() {
        const m = payMethod(checkoutData.method);
        checkoutData.paymentRef = m.type === "va" ? (m.prefix + randomDigits(10)) : ("QRIS-" + randomDigits(8));

        openDialog(`
            <div class="sim-banner"><i class="fa-solid fa-flask"></i> MODE SIMULASI &mdash; tidak ada uang sungguhan yang dipindahkan</div>
            <h3>Pembayaran ${m.label}</h3>
            <div class="pay-center">
                ${m.type === "va"
                    ? '<p>Nomor Virtual Account</p><div class="va-number">' + checkoutData.paymentRef + "</div>"
                    : '<div class="qris-box"><i class="fa-solid fa-qrcode"></i></div><p>Kode: ' + checkoutData.paymentRef + "</p>"}
                <div class="pay-total">Total: ${rupiah(cartTotal())}</div>
            </div>
            <div class="custom-dialog-buttons">
                <button type="button" class="custom-dialog-btn btn-dialog-cancel" id="payBackBtn">Kembali</button>
                <button type="button" class="custom-dialog-btn btn-dialog-whatsapp" id="payDoneBtn">Simulasikan Bayar</button>
            </div>
        `, "checkout");

        document.getElementById("payBackBtn").onclick = function () { showCheckoutForm(checkoutData); };
        const doneBtn = document.getElementById("payDoneBtn");
        doneBtn.onclick = function () { finalizeOrder(doneBtn); };
    }

    async function finalizeOrder(btn) {
        btn.disabled = true;
        const isCod = checkoutData.method === "cod";
        btn.textContent = isCod ? "Memproses..." : "Memproses pembayaran...";
        const waWindow = window.open("about:blank", "_blank");
        if (!isCod) await new Promise(function (r) { setTimeout(r, 1200); });

        const order = await processCheckout(checkoutData);
        if (!order) {
            if (waWindow && waWindow.close) waWindow.close();
            return;
        }

        const waUrl = "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(buildWaMessage(order));
        let opened = false;
        if (waWindow && waWindow.location) {
            waWindow.location.href = waUrl;
            opened = true;
        }
        toggleCart(false);

        openDialog(`
            <div class="pay-center">
                <div class="custom-dialog-icon" style="color:#25d366;"><i class="fa-solid fa-circle-check"></i></div>
                <h3>Pesanan Berhasil Dibuat</h3>
                <p>Nomor pesanan <strong>${escapeHtml(order.id)}</strong><br>
                Pembayaran: ${escapeHtml(order.paymentMethod)} &mdash; ${escapeHtml(order.paymentStatus)}<br>
                Rincian lengkap dikirim ke WhatsApp penjual.
                ${opened ? "" : '<br><a href="' + waUrl + '" target="_blank" rel="noopener noreferrer" style="color:var(--primary);font-weight:700;">WhatsApp belum terbuka? Klik di sini</a>'}</p>
            </div>
            <div class="custom-dialog-buttons">
                <button type="button" class="custom-dialog-btn btn-dialog-cancel" id="dialogHistoryBtn">Lihat Riwayat</button>
                <button type="button" class="custom-dialog-btn btn-dialog-confirm" id="dialogOkBtn">Tutup</button>
            </div>
        `, "checkout");
        bindClose("dialogOkBtn");
        document.getElementById("dialogHistoryBtn").onclick = showOrderHistory;
    }

    function buildWaMessage(order) {
        let msg = "Halo Admin, saya ingin memesan dari Kuliner Desa Pegandon.\n\n";
        msg += "*No. Pesanan:* " + order.id + "\n";
        msg += "*Waktu:* " + formatTime(order.time) + "\n\n";
        msg += "*DATA PEMESAN*\n";
        msg += "Nama: " + order.customer + "\n";
        msg += "No. HP: " + order.phone + "\n";
        msg += "Alamat: " + order.address + "\n";
        if (order.note) msg += "Catatan: " + order.note + "\n";
        msg += "\n*PESANAN*\n";
        order.items.forEach(function (it, i) {
            msg += (i + 1) + ". " + it.name + " (" + it.qty + "x @ " + rupiah(it.price) + ") = " + rupiah(it.price * it.qty) + "\n";
        });
        msg += "\n*Total: " + rupiah(order.total) + "*\n\n";
        msg += "*PEMBAYARAN*\n";
        msg += "Metode: " + order.paymentMethod + "\n";
        if (order.paymentRef) msg += "Kode: " + order.paymentRef + "\n";
        msg += "Status: " + order.paymentStatus + "\n\n";
        msg += "Terima kasih!";
        return msg;
    }

    async function processCheckout(info) {
        const selected = getSelectedCartItems();
        if (selected.length === 0) {
            infoDialog("fa-solid fa-circle-xmark", "var(--accent)", "Pilih Produk", "Belum ada produk yang dicentang untuk dibeli.");
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
                    items: selected.map(function (i) { return { id: i.id, qty: i.qty }; })
                })
            });
            rememberOrder(order);
            const selectedIds = selected.map(function (i) { return i.id; });
            cart = cart.filter(function (i) { return !selectedIds.includes(i.id); });
            checkoutData = null;
            await refreshStocks();
            updateCartUI();
            return order;
        } catch (err) {
            await refreshStocks();
            errorDialog("Pesanan Gagal", err);
            return null;
        }
    }

    async function showOrderHistory() {
        let list = [];
        try {
            if (isAdmin()) {
                list = await api("/orders");
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
            body = '<p style="text-align:center;margin:1.5rem 0;">Belum ada riwayat pesanan.</p>';
        } else {
            body = list.map(function (o) {
                return `
                    <div class="history-item">
                        <div class="history-head">
                            <strong>${escapeHtml(o.id)}</strong>
                            <span class="history-badge">${escapeHtml(o.status)}</span>
                        </div>
                        <div class="history-meta">${formatTime(o.time)}${o.customer ? " &bull; " + escapeHtml(o.customer) : ""}</div>
                        <ul>${o.items.map(function (it) { return "<li>" + escapeHtml(it.name) + " &times; " + it.qty + " <span>" + rupiah(it.price * it.qty) + "</span></li>"; }).join("")}</ul>
                        <div class="history-total">Total: ${rupiah(o.total)}</div>
                        ${(o.address || o.paymentMethod) ? `
                            <div class="history-detail">
                                ${o.phone ? "<div>HP: " + escapeHtml(o.phone) + "</div>" : ""}
                                ${o.address ? "<div>Alamat: " + escapeHtml(o.address) + "</div>" : ""}
                                ${o.note ? "<div>Catatan: " + escapeHtml(o.note) + "</div>" : ""}
                                ${o.paymentMethod ? "<div>Pembayaran: " + escapeHtml(o.paymentMethod) + " &mdash; " + escapeHtml(o.paymentStatus || "") + "</div>" : ""}
                            </div>` : ""}
                    </div>`;
            }).join("");
        }

        const noticeHtml = !isMember()
            ? `
                <div class="history-notice">
                    <i class="fa-solid fa-clock"></i> Riwayat pesanan akan otomatis hilang dalam <strong>24 jam</strong>. Silakan <strong>Sign In</strong> atau <strong>Sign In Up</strong> terlebih dahulu agar riwayat tersimpan permanen.
                    <div class="history-notice-actions">
                        <button type="button" id="noticeLoginBtn"><i class="fa-solid fa-right-to-bracket"></i> Sign In</button>
                        <button type="button" id="noticeRegisterBtn"><i class="fa-solid fa-user-plus"></i> Sign In Up</button>
                    </div>
                </div>`
            : '<div style="background:#dcfce7; border:1px solid #86efac; color:#15803d; padding:0.55rem 0.8rem; border-radius:8px; font-size:0.8rem; margin-bottom:1rem; text-align:center; font-weight:700;"><i class="fa-solid fa-shield-check"></i> Mode Member Aktif: Riwayat pesanan Anda tersimpan permanen.</div>';

        openDialog(`
            <h3><i class="fa-solid fa-clock-rotate-left"></i> Riwayat Pesanan${isAdmin() ? " (Semua)" : ""}</h3>
            ${noticeHtml}
            <div class="history-scroll">${body}</div>
            <div class="custom-dialog-buttons">
                <button type="button" class="custom-dialog-btn btn-dialog-confirm" id="dialogOkBtn">Tutup</button>
            </div>
        `, true);
        bindClose("dialogOkBtn");

        const nLog = document.getElementById("noticeLoginBtn");
        if (nLog) nLog.onclick = function () { closeDialog(); showMemberAuthModal(false); };
        const nReg = document.getElementById("noticeRegisterBtn");
        if (nReg) nReg.onclick = function () { closeDialog(); showMemberAuthModal(true); };
    }

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
            body = '<p style="text-align:center;margin:1.5rem 0;">Belum ada perubahan stok.</p>';
        } else {
            body = `
                <div class="history-table-wrap">
                    <table class="history-table">
                        <thead><tr><th>Waktu</th><th>Produk</th><th>Stok</th><th>Diubah oleh</th><th>Keterangan</th></tr></thead>
                        <tbody>${logs.map(function (l) {
                            const diff = l.after - l.before;
                            return `
                                <tr>
                                    <td>${formatTime(l.time)}</td>
                                    <td>${escapeHtml(l.name)}</td>
                                    <td>${l.before} &rarr; ${l.after} <span class="${diff < 0 ? "diff-minus" : "diff-plus"}">(${diff > 0 ? "+" : ""}${diff})</span></td>
                                    <td>${escapeHtml(l.actor)}</td>
                                    <td>${escapeHtml(l.note || "")}</td>
                                </tr>`;
                        }).join("")}</tbody>
                    </table>
                </div>`;
        }
        openDialog(`
            <h3><i class="fa-solid fa-boxes-stacked"></i> Riwayat Perubahan Stok</h3>
            <div class="history-scroll">${body}</div>
            <div class="custom-dialog-buttons">
                <button type="button" class="custom-dialog-btn btn-dialog-confirm" id="dialogOkBtn">Tutup</button>
            </div>
        `, true);
        bindClose("dialogOkBtn");
    }

    const orderHistoryNavBtn = document.getElementById("orderHistoryNavBtn");
    if (orderHistoryNavBtn) orderHistoryNavBtn.addEventListener("click", function (e) { e.preventDefault(); showOrderHistory(); });
    const heroHistoryBtn = document.getElementById("heroHistoryBtn");
    if (heroHistoryBtn) heroHistoryBtn.addEventListener("click", function (e) { e.preventDefault(); showOrderHistory(); });
    const stockLogNavBtn = document.getElementById("stockLogNavBtn");
    if (stockLogNavBtn) stockLogNavBtn.addEventListener("click", function (e) { e.preventDefault(); showStockLog(); });

    // =========================================================================
    // HERO SLIDER SEARAH (UNIDIRECTIONAL SMOOTH LOOP)
    // =========================================================================
    const heroSection = document.getElementById("beranda");
    const heroSlidesEl = document.getElementById("heroSlides");
    const heroDots = document.querySelectorAll(".hero-dot");
    const realSlideCount = heroDots.length;
    let currentSlideIndex = 0;
    let heroAutoTimer = null;

    function updateHeroDots(idx) {
        const activeDotIdx = idx % realSlideCount;
        heroDots.forEach(function (dot, i) { dot.classList.toggle("active", i === activeDotIdx); });
    }

    function advanceHeroSlide(targetIndex) {
        if (!heroSlidesEl) return;
        currentSlideIndex = targetIndex;
        heroSlidesEl.classList.remove("no-transition");
        heroSlidesEl.style.transform = "translateX(-" + (currentSlideIndex * 100) + "%)";
        updateHeroDots(currentSlideIndex);
    }

    if (heroSlidesEl) {
        heroSlidesEl.addEventListener("transitionend", function () {
            if (currentSlideIndex >= realSlideCount) {
                heroSlidesEl.classList.add("no-transition");
                currentSlideIndex = 0;
                heroSlidesEl.style.transform = "translateX(0%)";
                void heroSlidesEl.offsetWidth;
            }
        });
    }

    function startHeroAuto() {
        stopHeroAuto();
        heroAutoTimer = setInterval(function () {
            advanceHeroSlide(currentSlideIndex + 1);
        }, 4200);
    }

    function stopHeroAuto() {
        if (heroAutoTimer) {
            clearInterval(heroAutoTimer);
            heroAutoTimer = null;
        }
    }

    heroDots.forEach(function (dot) {
        dot.addEventListener("click", function () {
            const target = parseInt(dot.dataset.slide, 10) || 0;
            advanceHeroSlide(target);
            startHeroAuto();
        });
    });

    if (heroSection) {
        heroSection.addEventListener("mouseenter", stopHeroAuto);
        heroSection.addEventListener("mouseleave", startHeroAuto);
    }
    startHeroAuto();

    // =========================================================================
    // MENU FAVORIT: SMOOTH UNIDIRECTIONAL CONTINUOUS SCROLL + HOVER ZOOM + DRAG/SCROLL
    // =========================================================================
    const favScroller = document.getElementById("favScrollerWrapper");
    const favTrack = document.getElementById("favTrack");

    if (favScroller && favTrack) {
        const originalCardsHTML = favTrack.innerHTML;
        favTrack.innerHTML = originalCardsHTML + originalCardsHTML;

        let isHoveringFav = false;
        let isDraggingFav = false;
        let favDragStartX = 0;
        let favStartScrollLeft = 0;
        let favHasDragged = false;
        const scrollSpeed = 0.75;

        function animateFavScroll() {
            if (!isHoveringFav && !isDraggingFav) {
                favScroller.scrollLeft += scrollSpeed;
                const halfWidth = favTrack.scrollWidth / 2;
                if (favScroller.scrollLeft >= halfWidth) {
                    favScroller.scrollLeft -= halfWidth;
                }
            }
            requestAnimationFrame(animateFavScroll);
        }
        requestAnimationFrame(animateFavScroll);

        favScroller.addEventListener("mouseenter", function () { isHoveringFav = true; });
        favScroller.addEventListener("mouseleave", function () {
            isHoveringFav = false;
            isDraggingFav = false;
            favScroller.classList.remove("grabbing");
        });

        favScroller.addEventListener("mousedown", function (e) {
            if (e.button !== 0) return;
            isDraggingFav = true;
            favHasDragged = false;
            favDragStartX = e.pageX - favScroller.offsetLeft;
            favStartScrollLeft = favScroller.scrollLeft;
            favScroller.classList.add("grabbing");
        });

        window.addEventListener("mousemove", function (e) {
            if (!isDraggingFav) return;
            const x = e.pageX - favScroller.offsetLeft;
            const walk = (x - favDragStartX) * 1.4;
            if (Math.abs(walk) > 6) favHasDragged = true;
            favScroller.scrollLeft = favStartScrollLeft - walk;

            const halfWidth = favTrack.scrollWidth / 2;
            if (favScroller.scrollLeft >= halfWidth) {
                favScroller.scrollLeft -= halfWidth;
                favStartScrollLeft -= halfWidth;
            } else if (favScroller.scrollLeft <= 0) {
                favScroller.scrollLeft += halfWidth;
                favStartScrollLeft += halfWidth;
            }
        });

        window.addEventListener("mouseup", function () {
            if (!isDraggingFav) return;
            isDraggingFav = false;
            favScroller.classList.remove("grabbing");
        });

        favScroller.addEventListener("click", function (e) {
            if (favHasDragged) {
                e.preventDefault();
                e.stopPropagation();
                favHasDragged = false;
            }
        }, true);

        favScroller.addEventListener("wheel", function (e) {
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                e.preventDefault();
                favScroller.scrollLeft += e.deltaY;
                const halfWidth = favTrack.scrollWidth / 2;
                if (favScroller.scrollLeft >= halfWidth) favScroller.scrollLeft -= halfWidth;
                if (favScroller.scrollLeft < 0) favScroller.scrollLeft += halfWidth;
            }
        }, { passive: false });

        favScroller.addEventListener("touchstart", function () { isDraggingFav = true; }, { passive: true });
        favScroller.addEventListener("touchend", function () {
            setTimeout(function () { isDraggingFav = false; }, 1200);
        }, { passive: true });
        favScroller.addEventListener("scroll", function () {
            const halfWidth = favTrack.scrollWidth / 2;
            if (halfWidth > 0) {
                if (favScroller.scrollLeft >= halfWidth) {
                    favScroller.scrollLeft -= halfWidth;
                } else if (favScroller.scrollLeft <= 0 && isDraggingFav) {
                    favScroller.scrollLeft += halfWidth;
                }
            }
        }, { passive: true });
    }

    purgeExpiredGuestOrders();
    applySavedMenuEdits();
    updateMemberUIState();
    updateAdminUIState();
    updateCartUI();
    refreshStocks();
    setInterval(refreshStocks, 15000);
});
