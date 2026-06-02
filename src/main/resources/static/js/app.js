// =================================================================
// --- VARIABEL KONTROL GLOBAL ENGINE ---
// =================================================================
let currentFilter = 'all'; // Dipakai konsisten sebagai state filter utama
let timerInterval = null;
let timeLeft = 0;
let calendar = null;
let searchQuery = '';
let displayLimit = 10;
let productivityChart = null;
let activeTaskId = null;

// --- HELPER FUNCTION: DEBOUNCE ENGINE ---
function debounce(func, delay) {
    let debounceTimer;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => func.apply(context, args), delay);
    }
}

// =================================================================
// --- TAMENG OTOMATIS: GLOBAL FETCH HIJACKER (MONKEY PATCHING) ---
// =================================================================
(function() {
    // 1. Simpan fungsi fetch asli bawaan browser ke dalam variabel rahasia
    const originalFetch = window.fetch;

    // 2. Timpa fungsi fetch bawaan browser dengan logika aman kita
    window.fetch = async function(url, options = {}) {
        try {
            // Jalankan fetch asli
            const response = await originalFetch(url, options);

            // Logika interceptor frontend kamu
            if (!response.ok) {
                if (response.status === 401) {
                    showToast("Sesi habis, silakan login ulang.", "warning");
                    setTimeout(() => window.location.href = '/login.html', 2000);
                    return response;
                }
                throw new Error(`Error ${response.status}`);
            }
            return response;
        } catch (error) {
            console.error("Fetch Intercepted Error:", error);
            showToast("Gagal terhubung ke backend Java!", "error");
            throw error;
        }
    };
})();

// --- ENGINE FLOATING TOAST NOTIFICATION (ELASTIC GACHA STYLE) ---
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `flex items-center gap-3 p-4 rounded-xl shadow-xl border text-xs font-black tracking-wide translate-x-full transition-all duration-400 cubic-bezier(0.175, 0.885, 0.32, 1.275) pointer-events-auto bg-white dark:bg-slate-900 z-[9999]`;

    let icon = '🔔';
    if (type === 'success') {
        icon = '✨';
        toast.classList.add('border-emerald-400', 'text-emerald-600', 'dark:text-emerald-400', 'shadow-emerald-500/5');
    } else if (type === 'info') {
        icon = '⚡';
        toast.classList.add('border-cyan-400', 'text-cyan-600', 'dark:text-cyan-400', 'shadow-cyan-500/5');
    } else if (type === 'warning') {
        icon = '⚠️';
        toast.classList.add('border-pink-400', 'text-pink-600', 'dark:text-pink-400', 'shadow-pink-500/5');
    } else if (type === 'error') {
        icon = '❌';
        toast.classList.add('border-red-400', 'text-red-600', 'dark:text-red-400', 'shadow-red-500/5');
    }

    toast.innerHTML = `
        <div class="text-base font-normal animate-bounce">${icon}</div>
        <div class="flex-1 leading-relaxed text-slate-700 dark:text-slate-300">${message.toUpperCase()}</div>
        <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-pink-500 transition cursor-pointer text-sm font-bold ml-2">✕</button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('translate-x-full');
    }, 10);

    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.add('translate-x-full', 'opacity-0');
            setTimeout(() => toast.remove(), 400);
        }
    }, 4000);
}

// --- INITIALIZER KETIKA HALAMAN SELESAI DIMUAT ---
document.addEventListener('DOMContentLoaded', async () => {
    if (document.getElementById('dueDate')) {
        document.getElementById('dueDate').valueAsDate = new Date();
    }

    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }

    const checkUser = await fetch('/api/user/me');
    if (!checkUser.ok) {
        window.location.href = '/login.html';
        return;
    }

    const activeUser = await checkUser.text();

    if (document.getElementById('profileName')) document.getElementById('profileName').innerText = activeUser;
    if (document.getElementById('headerGreeting')) document.getElementById('headerGreeting').innerText = `Halo, ${activeUser}!`;
    if (document.getElementById('userInitial')) document.getElementById('userInitial').innerText = activeUser.charAt(0).toUpperCase();

    // LOGIC DETEKSI TEMA DINAMIS
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.documentElement.classList.remove('dark');
        if (document.getElementById('themeIcon')) document.getElementById('themeIcon').innerText = '☀️';
        if (document.getElementById('themeIconMobile')) document.getElementById('themeIconMobile').innerText = '☀️';
    } else {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
        if (document.getElementById('themeIcon')) document.getElementById('themeIcon').innerText = '🌙';
        if (document.getElementById('themeIconMobile')) document.getElementById('themeIconMobile').innerText = '🌙';
    }

    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');

    if (searchInput && clearSearchBtn) {
        searchInput.addEventListener('input', debounce((e) => {
            searchQuery = e.target.value.toLowerCase();
            displayLimit = 10;
            if (searchQuery.trim() !== '') {
                clearSearchBtn.classList.remove('hidden');
            } else {
                clearSearchBtn.classList.add('hidden');
            }
            loadTasks();
        }, 300));

        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            searchQuery = '';
            displayLimit = 10;
            clearSearchBtn.classList.add('hidden');
            loadTasks();
            showToast("Pencarian di-reset", "info");
        });
    }

    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            displayLimit += 10;
            loadTasks();
        });
    }

    // Set listener form submit ke handler utama kita
    const taskForm = document.getElementById('taskForm');
    if (taskForm) {
        taskForm.onsubmit = handleAddTaskSubmit;
    }

    // Load data tugas pertama kali halaman dibuka
    loadTasks();
});

// --- ENGINE PEMBUAT SUARA ALARM (WEB AUDIO API) ---
function playAudioChime() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        let osc1 = audioCtx.createOscillator();
        let gain1 = audioCtx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(659.25, audioCtx.currentTime);
        gain1.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc1.connect(gain1);
        gain1.connect(audioCtx.destination);
        osc1.start(audioCtx.currentTime);
        osc1.stop(audioCtx.currentTime + 0.4);

        setTimeout(() => {
            let osc2 = audioCtx.createOscillator();
            let gain2 = audioCtx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(880.00, audioCtx.currentTime);
            gain2.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
            osc2.connect(gain2);
            gain2.connect(audioCtx.destination);
            osc2.start(audioCtx.currentTime);
            osc2.stop(audioCtx.currentTime + 0.6);
        }, 150);
    } catch (e) {
        console.error("Gagal memutar audio:", e);
    }
}

function checkAndNotifyDeadlines(tasks) {
    const sekarang = new Date();
    tasks.forEach(t => {
        if (!t.completed && t.dueDate) {
            const selisihWaktu = new Date(t.dueDate) - sekarang;
            const selisihJam = selisihWaktu / (1000 * 60 * 60);
            if (selisihJam >= -12 && selisihJam <= 24) {
                if ("Notification" in window && Notification.permission === "granted") {
                    new Notification("⚠️ GACHA MISSION ALERT!", {
                        body: `Quest "${t.title}" akan segera kedaluwarsa!`,
                    });
                }
            }
        }
    });
}

// --- CORE SYSTEM: RE-RENDER LOGIC & FIXED VISIBILITY ---
async function loadTasks() {
    try {
        const sort = document.getElementById('sortBy')?.value || 'smart';

        // FETCH DATA REAL DARI API BACKEND
        const res = await fetch(`/api/tasks`);
        const rawTasks = await res.json();

        if (!Array.isArray(rawTasks)) return;

        if (typeof checkAndNotifyDeadlines === 'function') {
            checkAndNotifyDeadlines(rawTasks);
        }

        // =================================================================
        // HITUNG STATISTIK UTK COUNTER
        // =================================================================
        const murniSelesai = rawTasks.filter(t => {
            return t.completed === true || String(t.completed).toLowerCase() === 'true' || t.completed === 1;
        });

        const murniBelumSelesai = rawTasks.filter(t => {
            return t.completed === false || String(t.completed).toLowerCase() === 'false' || t.completed === 0 || !t.completed;
        });

        const total = rawTasks.length;
        const completed = murniSelesai.length;
        const pending = murniBelumSelesai.length;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

        if (document.getElementById('statTotal')) document.getElementById('statTotal').innerText = total.toString().padStart(2, '0');
        if (document.getElementById('statCompleted')) document.getElementById('statCompleted').innerText = completed.toString().padStart(2, '0');
        if (document.getElementById('statPending')) document.getElementById('statPending').innerText = pending.toString().padStart(2, '0');
        if (document.getElementById('statPercentText')) document.getElementById('statPercentText').innerText = `${percent}%`;
        if (document.getElementById('progressCircle')) document.getElementById('progressCircle').setAttribute('stroke-dasharray', `${percent}, 100`);

        // =================================================================
        // LOGIKA FILTER TAB (FIXED & SINKRON)
        // =================================================================
        let tasks = [];
        const activeFilter = (typeof currentFilter === 'string') ? currentFilter.toLowerCase().trim() : 'all';

        if (activeFilter === 'completed') {
            tasks = murniSelesai;
        } else if (activeFilter === 'do-first') {
            tasks = murniBelumSelesai.filter(t => {
                const matrixValue = t.matrix ? t.matrix.toLowerCase().trim() : '';
                return matrixValue === 'do-first';
            });
        } else if (activeFilter === 'all') {
            tasks = murniBelumSelesai;
        } else {
            tasks = murniBelumSelesai.filter(t => {
                const matrixValue = t.matrix ? t.matrix.toLowerCase().trim() : '';
                return matrixValue === activeFilter;
            });
        }

        // =================================================================
        // URUTAN DATA (SORTING)
        // =================================================================
        if (sort === 'smart') {
            const matrixWeights = { 'do-first': 4, 'schedule': 3, 'delegate': 2, 'eliminate': 1, 'auto': 2 };
            tasks.sort((a, b) => {
                const weightA = matrixWeights[a.matrix] || 1;
                const weightB = matrixWeights[b.matrix] || 1;
                if (weightB !== weightA) return weightB - weightA;

                const dateA = a.dueDate ? new Date(a.dueDate) : new Date('2099-12-31');
                const dateB = b.dueDate ? new Date(b.dueDate) : new Date('2099-12-31');
                return dateA - dateB;
            });
        } else if (sort === 'date') {
            tasks.sort((a, b) => {
                const dateA = a.dueDate ? new Date(a.dueDate) : new Date('2099-12-31');
                const dateB = b.dueDate ? new Date(b.dueDate) : new Date('2099-12-31');
                return dateA - dateB;
            });
        }

        // Jalankan Filter Pencarian jika query ada nilainya
        if (searchQuery && searchQuery.trim() !== '') {
            const query = searchQuery.toLowerCase().trim();
            tasks = tasks.filter(t =>
                (t.title && t.title.toLowerCase().includes(query)) ||
                (t.category && t.category.toLowerCase().includes(query))
            );
        }

        // Pengaturan Pagination Limit Load More
        const totalFilteredTasks = tasks.length;
        tasks = tasks.slice(0, displayLimit);

        const loadMoreBtn = document.getElementById('loadMoreBtn');
        if (loadMoreBtn) {
            if (totalFilteredTasks > displayLimit) {
                loadMoreBtn.classList.remove('hidden');
            } else {
                loadMoreBtn.classList.add('hidden');
            }
        }

        // INJEKSI KE DOM CONTAINER
        const container = document.getElementById('taskList');
        if (!container) return;
        container.innerHTML = '';

        if (tasks.length === 0) {
            container.innerHTML = `<div class="text-center py-14 text-xs text-slate-400 font-bold tracking-widest uppercase animate-pulse">--- Tidak Ada Tugas yang Ditemukan ---</div>`;
            return;
        }

        window.renderedTasksMap = window.renderedTasksMap || {};

        // RENDER SETIAP CARD TUGAS
        tasks.forEach(t => {
            window.renderedTasksMap[t.id] = t;

            let matrixBadge = '';
            let neonBorderSide = 'border-l-slate-400';

            if (t.matrix === 'do-first') {
                matrixBadge = '<span class="px-2.5 py-0.5 rounded text-[9px] font-black tracking-wider bg-pink-500/10 text-pink-500 border border-pink-500/20 uppercase">PENTING</span>';
                neonBorderSide = 'border-l-pink-500 dark:border-l-pink-500';
            } else if (t.matrix === 'schedule') {
                matrixBadge = '<span class="px-2.5 py-0.5 rounded text-[9px] font-black tracking-wider bg-cyan-500/10 text-cyan-500 border border-cyan-500/20 uppercase">TERJADWAL</span>';
                neonBorderSide = 'border-l-cyan-500 dark:border-l-cyan-500';
            } else if (t.matrix === 'delegate') {
                matrixBadge = '<span class="px-2.5 py-0.5 rounded text-[9px] font-black tracking-wider bg-purple-500/10 text-purple-500 border border-purple-500/20 uppercase">DELEGASI</span>';
                neonBorderSide = 'border-l-purple-500';
            } else {
                matrixBadge = '<span class="px-2.5 py-0.5 rounded text-[9px] font-black tracking-wider bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 uppercase">OPSIONAL</span>';
                neonBorderSide = 'border-l-slate-400';
            }

            const displayDuration = t.durationMinutes !== undefined ? t.durationMinutes : (t.duration || 0);
            const safeTitle = (t.title || '').replace(/'/g, "\\'");
            const isCompleted = t.completed === true || t.completed === 1 || String(t.completed).toLowerCase() === 'true';

            const card = document.createElement('div');
            card.className = `task-card flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 bg-white dark:bg-[#111625] border border-slate-100 dark:border-slate-800/80 ${neonBorderSide} border-l-[4px] rounded-xl shadow-xs gap-4 w-full min-w-0 transition-all duration-300`;

            card.innerHTML = `
                <div class="flex items-start gap-4 w-full sm:w-auto min-w-0">
                    <input type="checkbox" ${isCompleted ? 'checked' : ''} onclick="toggleTask('${t.id}')" class="task-checkbox mt-1 w-4 h-4 rounded border-slate-300 text-cyan-500 focus:ring-cyan-400 cursor-pointer flex-shrink-0">
                    <div class="min-w-0 flex-1">
                        <h4 class="text-sm font-black text-slate-800 dark:text-slate-100 break-words tracking-wide ${isCompleted ? 'line-through !text-slate-400 dark:!text-slate-600' : ''}">${t.title || 'Tanpa Judul'}</h4>
                        <div class="flex flex-wrap items-center gap-2 mt-2.5">
                            <span class="tag-category px-2 py-0.5 rounded text-[9px] font-extrabold tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 truncate max-w-[120px] uppercase">${t.category || 'UMUM'}</span>
                            ${matrixBadge}
                            <span class="text-[10px] text-slate-400 dark:text-slate-500 font-bold flex items-center gap-1 ml-1">📅 ${t.dueDate || 'HARI INI'}</span>
                        </div>
                    </div>
                </div>
                <div class="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto border-t sm:border-0 pt-3 sm:pt-0 border-slate-50 dark:border-slate-800/40 flex-shrink-0">
                    <span class="text-[10px] font-mono bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded text-slate-500 dark:text-slate-400 font-bold">⏳ ${displayDuration} MENIT</span>
                    <div class="flex gap-2">
                        <button onclick="openEditModalFromId('${t.id}')" class="action-btn text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 p-1 rounded text-xs transition">✏️</button>
                        ${!isCompleted ? `<button onclick="startFocus('${t.id}', '${safeTitle}', ${displayDuration})" class="action-btn text-slate-400 hover:text-cyan-500 dark:hover:text-cyan-400 p-1 rounded text-xs transition">⏱️</button>` : ''}
                        <button onclick="deleteTask('${t.id}')" class="action-btn text-slate-400 hover:text-pink-500 dark:hover:text-pink-400 p-1 rounded text-xs transition">🗑️</button>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (error) {
        console.error("Error loading tasks:", error);
    }
}

// --- FUNGSI TOGGLE TASK (OPTIMISTIC UPDATE FIX) ---
async function toggleTask(id) {
    try {
        if (window.renderedTasksMap && window.renderedTasksMap[id]) {
            const task = window.renderedTasksMap[id];
            task.completed = !task.completed;

            const checkboxes = document.querySelectorAll(`input[onclick="toggleTask('${id}')"]`);
            checkboxes.forEach(cb => {
                const titleEl = cb.nextElementSibling?.querySelector('h4');
                if (titleEl) {
                    if (task.completed) {
                        titleEl.classList.add('line-through', '!text-slate-400', 'dark:!text-slate-600');
                    } else {
                        titleEl.classList.remove('line-through', '!text-slate-400', 'dark:!text-slate-600');
                    }
                }
            });
        }

        await fetch(`/api/tasks/${id}/toggle`, { method: 'PUT' });
        await loadTasks();
        showToast("Quest data synced!", "success");
    } catch (error) {
        console.error("Error toggling task:", error);
        loadTasks();
    }
}

// --- FUNGSI EXPORT TO EXCEL ---
async function exportToExcel() {
    try {
        const userRes = await fetch('/api/user/me');
        if (!userRes.ok) {
            showToast("Gagal export: Sesi login habis!", "warning");
            return;
        }
        const activeUser = await userRes.text();
        showToast("Generating Excel file...", "info");
        window.open(`/api/tasks/export-excel?username=${encodeURIComponent(activeUser)}`, '_blank');
    } catch (error) {
        console.error("Error exporting Excel:", error);
    }
}

// --- FUNGSI TOGGLE MODE (LIGHT / DARK THEME FIX) ---
function toggleTheme() {
    try {
        const html = document.documentElement;
        const themeIcon = document.getElementById('themeIcon');
        const themeIconMobile = document.getElementById('themeIconMobile');

        if (html.classList.contains('dark')) {
            html.classList.remove('dark');
            localStorage.setItem('theme', 'light');
            if (themeIcon) themeIcon.innerText = '☀️';
            if (themeIconMobile) themeIconMobile.innerText = '☀️';
            showToast("Sistem beralih ke Mode Terang", "info");
        } else {
            html.classList.add('dark');
            localStorage.setItem('theme', 'dark');
            if (themeIcon) themeIcon.innerText = '🌙';
            if (themeIconMobile) themeIconMobile.innerText = '🌙';
            showToast("Sistem beralih ke Mode Gelap", "info");
        }

        if (typeof initAnalyticsEngine === 'function' && document.getElementById('productivityChart')) {
            initAnalyticsEngine();
        }
    } catch (error) {
        console.error("Gagal mengubah tema:", error);
    }
}

// --- OPERASI DASAR MODAL EDIT, DELETE, RESET, LOGOUT ---
function openEditModalFromId(id) {
    if (window.renderedTasksMap && window.renderedTasksMap[id]) {
        openEditModal(window.renderedTasksMap[id]);
    }
}

// --- MODAL ENGINE ---
function openModal() {
    const m = document.getElementById('taskModal');
    if (!m) return;
    m.classList.remove('hidden');
    setTimeout(() => {
        m.classList.remove('opacity-0');
        const content = m.querySelector('div');
        if (content) content.classList.remove('scale-95');
    }, 10);
}

function closeModal() {
    const m = document.getElementById('taskModal');
    if (!m) return;
    m.classList.add('opacity-0');
    const content = m.querySelector('div');
    if (content) content.classList.add('scale-95');
    setTimeout(() => {
        m.classList.add('hidden');
    }, 300);
}

// --- FUNGSI RENDERTASKS FALLBACK UTK SUBMIT ---
function renderTasks(data) {
    loadTasks();
}

// =================================================================
// --- ENGINE HANDLER SUBMIT TUGAS (VALIDASI & REALTIME SPINNER) ---
// =================================================================
async function handleAddTaskSubmit(event) {
    if (event) event.preventDefault();

    const titleInput = document.getElementById('title');
    const durationInput = document.getElementById('duration');
    const categoryInput = document.getElementById('category');
    const matrixInput = document.getElementById('matrix');
    const dueDateInput = document.getElementById('dueDate');

    if (!titleInput || !durationInput || !categoryInput || !matrixInput || !dueDateInput) {
        showToast("Gagal mendeteksi form input di HTML!", "error");
        return;
    }

    const titleValue = titleInput.value.trim();
    const durationValue = parseInt(durationInput.value);
    const categoryValue = categoryInput.value.trim() || "UMUM";
    const matrixValue = matrixInput.value;
    const dueDateValue = dueDateInput.value;

    // Validasi dasar
    if (!titleValue) {
        showToast("⚠️ Judul tugas tidak boleh kosong!", "warning");
        titleInput.focus();
        return;
    }

    const payload = {
        title: titleValue,
        durationMinutes: durationValue,
        category: categoryValue,
        matrix: matrixValue,
        dueDate: dueDateValue
    };

    const submitBtn = event ? event.target.querySelector('button[type="submit"]') : null;

    // --- AKTIFKAN LOADING STATE ---
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.dataset.oldText = submitBtn.innerHTML;
        submitBtn.innerHTML = `
            <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Menyimpan...
        `;
        submitBtn.classList.add('opacity-75', 'cursor-not-allowed');
    }

    try {
        const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error("Gagal menyimpan tugas ke server.");
        }

        // TAMPILKAN HASIL HANYA JIKA RESPONS SERVER BERHASIL (200 OK)
        closeModal();
        if (event && event.target.reset) event.target.reset();
        await loadTasks();
        showToast("Tugas baru berhasil disimpan!", "success");

    } catch (error) {
        console.error(error);
        showToast(error.message, "error");
    } finally {
        // --- MATIKAN LOADING STATE ---
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = submitBtn.dataset.oldText || 'SIMPAN TUGAS';
            submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
        }
    }
}

// --- FUNGSI EDIT TUGAS (OVERRIDE FORM SUBMIT) ---
function openEditModal(task) {
    // 1. Isi input form dengan data tugas yang akan diedit
    document.getElementById('title').value = task.title || '';
    document.getElementById('dueDate').value = task.dueDate || '';
    document.getElementById('duration').value = task.durationMinutes || 0;
    document.getElementById('matrix').value = task.matrix || 'auto';
    document.getElementById('category').value = task.category || 'UMUM';

    const form = document.getElementById('taskForm');
    if (!form) return;

    // 2. Override handler submit khusus untuk mode EDIT
    form.onsubmit = async (e) => {
        e.preventDefault();

        const submitBtn = form.querySelector('button[type="submit"]');

        // --- AKTIFKAN LOADING STATE (EDIT) ---
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.dataset.oldText = submitBtn.innerHTML;
            submitBtn.innerHTML = `
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Memperbarui...
            `;
            submitBtn.classList.add('opacity-75', 'cursor-not-allowed');
        }

        try {
            const payload = {
                title: document.getElementById('title').value.trim(),
                dueDate: document.getElementById('dueDate').value,
                durationMinutes: parseInt(document.getElementById('duration').value) || 0,
                matrix: document.getElementById('matrix').value,
                category: document.getElementById('category').value.trim()
            };

            // Kirim data ke backend
            const response = await fetch(`/api/tasks/${task.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // Validasi response dari server
            if (!response.ok) {
                throw new Error("Gagal memperbarui data di server.");
            }

            // JIKA BERHASIL:
            closeModal();
            await loadTasks();
            showToast("Quest successfully updated!", "success");

            // Kembalikan handler form ke fungsi tambah utama kamu (handleAddTaskSubmit)
            if (typeof handleAddTaskSubmit === 'function') {
                form.onsubmit = handleAddTaskSubmit;
            }

        } catch (error) {
            // JIKA GAGAL:
            console.error(error);
            showToast("Gagal memperbarui quest!", "warning");
        } finally {
            // --- MATIKAN LOADING STATE (KEMBALI NORMAL) ---
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = submitBtn.dataset.oldText || 'SIMPAN TUGAS';
                submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
            }
        }
    };

    openModal();
}

// --- PROSES HAPUS SATU TUGAS (MODAL SYSTEM CONFIRM) ---
function deleteTask(id) {
    const modal = document.getElementById('systemConfirmModal');
    const iconEl = document.getElementById('systemConfirmIcon');
    const titleEl = document.getElementById('systemConfirmTitle');
    const msgEl = document.getElementById('systemConfirmMessage');
    const btnCancel = document.getElementById('systemConfirmCancel');
    const btnExecute = document.getElementById('systemConfirmExecute');

    if (!modal || !msgEl) return;

    if (iconEl) iconEl.innerText = "🗑️";
    if (titleEl) titleEl.innerText = "HAPUS QUEST LOG";
    msgEl.innerHTML = `Apakah Anda yakin ingin melenyapkan log <span class="font-black text-pink-500">Quest</span> ini dari database secara permanen?`;

    if (btnExecute) {
        btnExecute.className = "bg-pink-500 hover:bg-pink-600 text-white py-2.5 rounded-xl text-xs font-black tracking-wider uppercase transition shadow-md shadow-pink-500/20";
        btnExecute.innerText = "HAPUS PERMANEN";
        btnExecute.disabled = false;
        btnExecute.classList.remove('opacity-50', 'cursor-not-allowed');
    }

    modal.classList.remove('hidden');

    if (btnExecute) {
        btnExecute.onclick = null; // Clear handler sebelumnya
        btnExecute.onclick = async function() {

            // --- AKTIFKAN LOADING STATE ---
            btnExecute.disabled = true;
            btnExecute.innerText = "MEMPROSES...";
            btnExecute.classList.add('opacity-50', 'cursor-not-allowed');

            try {
                const response = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });

                if (!response.ok) {
                    throw new Error("Gagal menghapus quest dari server.");
                }

                modal.classList.add('hidden');
                await loadTasks();
                showToast("Quest permanently deleted", "warning");

            } catch (err) {
                console.error(err);
                showToast("Gagal menghapus quest!", "error");
            } finally {
                // --- MATIKAN LOADING STATE ---
                btnExecute.disabled = false;
                btnExecute.innerText = "HAPUS PERMANEN";
                btnExecute.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        };
    }

    if (btnCancel) {
        btnCancel.onclick = null;
        btnCancel.onclick = function() { modal.classList.add('hidden'); };
    }
}

// --- PROSES RESET DATA TUGAS (MODAL SYSTEM CONFIRM) ---
function resetSystem() {
    const modal = document.getElementById('systemConfirmModal');
    const iconEl = document.getElementById('systemConfirmIcon');
    const titleEl = document.getElementById('systemConfirmTitle');
    const msgEl = document.getElementById('systemConfirmMessage');
    const btnCancel = document.getElementById('systemConfirmCancel');
    const btnExecute = document.getElementById('systemConfirmExecute');

    if (!modal || !msgEl) return;

    if (iconEl) iconEl.innerText = "⚠️";
    if (titleEl) titleEl.innerText = "WIPE OUT SYSTEM DATABASE";
    msgEl.innerHTML = `<span class="font-black text-pink-600">PERINGATAN SECTOR KERAS!</span> Tindakan ini akan menghapus seluruh core data quest aktif maupun selesai secara total. Anda yakin?`;

    if (btnExecute) {
        btnExecute.className = "bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-xs font-black tracking-wider uppercase transition shadow-md shadow-red-500/20";
        btnExecute.innerText = "WIPE OUT DATABASE";
    }

    modal.classList.remove('hidden');

    if (btnExecute) {
        btnExecute.onclick = null;
        btnExecute.onclick = async function() {
            modal.classList.add('hidden');
            try {
                await fetch('/api/tasks/reset', { method: 'DELETE' });
                loadTasks();
                showToast("Database system wiped cleanly", "warning");
            } catch (err) {
                console.error(err);
                showToast("Gagal mengosongkan database!", "warning");
            }
        };
    }

    if (btnCancel) {
        btnCancel.onclick = null;
        btnCancel.onclick = function() { modal.classList.add('hidden'); };
    }
}

function setFilter(filterType, element) {
    currentFilter = filterType;
    const buttons = document.querySelectorAll('#filterGroup button');
    buttons.forEach(btn => {
        btn.className = "bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 px-4 py-1.5 rounded-lg text-xs font-black tracking-wide uppercase transition";
    });
    if (element) {
        element.className = "bg-cyan-500 text-white px-4 py-1.5 rounded-lg text-xs font-black tracking-wide uppercase shadow-md shadow-cyan-500/20 transition";
    }
    loadTasks();
}

// --- PROSES KELUAR SESI / LOGOUT (MODAL SYSTEM CONFIRM) ---
function handleLogout() {
    const modal = document.getElementById('systemConfirmModal');
    const iconEl = document.getElementById('systemConfirmIcon');
    const titleEl = document.getElementById('systemConfirmTitle');
    const msgEl = document.getElementById('systemConfirmMessage');
    const btnCancel = document.getElementById('systemConfirmCancel');
    const btnExecute = document.getElementById('systemConfirmExecute');

    if (!modal || !msgEl) return;

    if (iconEl) iconEl.innerText = "🚪";
    if (titleEl) titleEl.innerText = "AKHIRI PENJELAJAHAN SESI";
    msgEl.innerHTML = `Apakah Anda yakin ingin mengamankan enkripsi, memutuskan koneksi, dan keluar dari sistem dashboard?`;

    if (btnExecute) {
        btnExecute.className = "bg-cyan-500 hover:bg-cyan-600 text-slate-900 py-2.5 rounded-xl text-xs font-black tracking-wider uppercase transition shadow-md shadow-cyan-500/20";
        btnExecute.innerText = "KELUAR SESI";
    }

    modal.classList.remove('hidden');

    if (btnExecute) {
        btnExecute.onclick = null;
        btnExecute.onclick = async function() {
            modal.classList.add('hidden');
            try {
                await fetch('/api/logout', { method: 'POST' });
                window.location.href = '/login.html';
            } catch (err) {
                console.error(err);
                showToast("Gagal memproses logout!", "warning");
            }
        };
    }

    if (btnCancel) {
        btnCancel.onclick = null;
        btnCancel.onclick = function() { modal.classList.add('hidden'); };
    }
}

function switchTab(tabName) {
    const tabDash = document.getElementById('tabDashboard');
    const tabCal = document.getElementById('tabCalendar');
    const tabAnal = document.getElementById('tabAnalytics');

    const menuDash = document.getElementById('menuDashboard');
    const menuCal = document.getElementById('menuCalendar');
    const menuAnal = document.getElementById('menuAnalytics');

    if (tabDash) tabDash.classList.add('hidden');
    if (tabCal) tabCal.classList.add('hidden');
    if (tabAnal) tabAnal.classList.add('hidden');

    const passiveClass = "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 uppercase tracking-wider transition";
    const activeClass = "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-black bg-cyan-500/10 text-cyan-500 border border-cyan-500/20 uppercase tracking-wider transition";

    if (menuDash) menuDash.className = passiveClass;
    if (menuCal) menuCal.className = passiveClass;
    if (menuAnal) menuAnal.className = passiveClass;

    if (tabName === 'dashboard') {
        if (tabDash) tabDash.classList.remove('hidden');
        if (menuDash) menuDash.className = activeClass;
        loadTasks();
    } else if (tabName === 'calendar') {
        if (tabCal) tabCal.classList.remove('hidden');
        if (menuCal) menuCal.className = activeClass;
        initCalendarEngine();
    } else if (tabName === 'analytics') {
        if (tabAnal) tabAnal.classList.remove('hidden');
        if (menuAnal) menuAnal.className = activeClass;
        initAnalyticsEngine();
    }
}

// --- ENGINE POMODORO DOCK CONTROLLER ---
function startFocus(id, title, duration) {
    const pomoDock = document.getElementById('pomoDock');
    const activeFocusTitle = document.getElementById('activeFocusTitle');

    if (pomoDock) pomoDock.classList.remove('hidden');
    if (activeFocusTitle) activeFocusTitle.innerText = title;

    activeTaskId = id;
    timeLeft = duration * 60;

    updateTimerDisplay();
    clearInterval(timerInterval);
    timerInterval = null;
    toggleTimer();
    showToast(`Focus session initialized: ${title}`, "info");
}

function toggleTimer() {
    const btn = document.getElementById('pomoBtn');
    const anim = document.getElementById('pomoIconAnim');

    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        if (btn) btn.innerText = 'RESUME';
        if (anim) anim.classList.remove('animate-pulse');
    } else {
        if (anim) anim.classList.add('animate-pulse');
        if (btn) btn.innerText = 'PAUSE';

        timerInterval = setInterval(() => {
            timeLeft--;
            updateTimerDisplay();

            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                timerInterval = null;

                if (anim) anim.classList.remove('animate-pulse');
                if (btn) btn.innerText = 'START';

                playAudioChime();

                if ("Notification" in window && Notification.permission === "granted") {
                    try {
                        new Notification("⏱️ MISSION TIMEOUT!", {
                            body: `Focus session untuk tugas kuliah telah berakhir.`
                        });
                    } catch (nErr) {
                        console.error("Notification error:", nErr);
                    }
                }

                showToast("Focus stream completed!", "success");

                const titleEl = document.getElementById('activeFocusTitle');
                const taskTitle = titleEl ? titleEl.innerText : 'Quest';
                const savedTaskId = activeTaskId;

                setTimeout(() => {
                    const modal = document.getElementById('pomoConfirmModal');
                    const msgEl = document.getElementById('pomoConfirmMessage');
                    const btnYes = document.getElementById('pomoConfirmYes');
                    const btnNo = document.getElementById('pomoConfirmNo');
                    const pomoDock = document.getElementById('pomoDock');

                    if (!modal || !msgEl) {
                        console.error("Elemen modal konfirmasi tidak ditemukan di HTML!");
                        return;
                    }

                    msgEl.innerHTML = `Did you manage to clear <span class="font-black text-cyan-400">"${taskTitle}"</span> successfully?`;
                    modal.classList.remove('hidden');

                    if (btnYes) {
                        btnYes.onclick = null;
                        btnYes.onclick = function() {
                            modal.classList.add('hidden');
                            if (pomoDock) pomoDock.classList.add('hidden');
                            if (savedTaskId) {
                                toggleTask(savedTaskId);
                            }
                        };
                    }

                    if (btnNo) {
                        btnNo.onclick = null;
                        btnNo.onclick = function() {
                            modal.classList.add('hidden');
                        };
                    }
                }, 500);
            }
        }, 1000);
    }
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    if (document.getElementById('timerDisplay')) {
        document.getElementById('timerDisplay').innerText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}

function closePomodoro() {
    clearInterval(timerInterval);
    timerInterval = null;
    document.getElementById('pomoDock').classList.add('hidden');
    showToast("Focus session closed manually", "warning");
}

// --- ENGINE CALENDAR & ANALYTICS ---
async function initCalendarEngine() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;

    const resAll = await fetch(`/api/tasks`);
    const totalTasks = await resAll.json();

    const calendarEvents = totalTasks.map(t => {
        let colorTheme = '#64748b';
        if (t.matrix === 'do-first') colorTheme = '#FF007F';
        if (t.matrix === 'schedule') colorTheme = '#00D2FF';
        if (t.completed) colorTheme = '#10b981';
        return {
            id: t.id,
            title: (t.completed ? '✓ ' : '⚔️ ') + t.title,
            start: t.dueDate || new Date().toISOString().split('T')[0],
            backgroundColor: colorTheme,
            borderColor: colorTheme,
            extendedProps: { duration: t.durationMinutes, completed: t.completed }
        };
    });

    if (calendar) {
        calendar.destroy();
    }

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth'
        },
        events: calendarEvents,
        editable: false,
        height: 'auto',
        eventClick: function(info) {
            const props = info.event.extendedProps;
            if (props.completed) {
                showToast("Mission already accomplished!", "success");
            } else {
                const modal = document.getElementById('pomoConfirmModal');
                const msgEl = document.getElementById('pomoConfirmMessage');
                const btnYes = document.getElementById('pomoConfirmYes');
                const btnNo = document.getElementById('pomoConfirmNo');

                if (modal && msgEl) {
                    msgEl.innerHTML = `Mulai Sesi Fokus Pomodoro untuk tugas: <span class="font-black text-cyan-400">"${info.event.title.replace('⚔️ ', '')}"</span>?`;
                    modal.classList.remove('hidden');

                    if (btnYes) {
                        btnYes.onclick = null;
                        btnYes.onclick = function() {
                            modal.classList.add('hidden');
                            switchTab('dashboard');
                            startFocus(info.event.id, info.event.title.replace('⚔️ ', ''), props.duration);
                        };
                    }
                    if (btnNo) {
                        btnNo.onclick = null;
                        btnNo.onclick = function() { modal.classList.add('hidden'); };
                    }
                }
            }
        }
    });
    calendar.render();
}

async function initAnalyticsEngine() {
    const ctx = document.getElementById('productivityChart');
    if (!ctx) return;

    const res = await fetch('/api/tasks');
    const allTasks = await res.json();
    const completedTasks = allTasks.filter(t => t.completed === true || t.completed === 1 || String(t.completed).toLowerCase() === 'true');

    const labels = [];
    const taskCountPerDay = {};

    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateString = d.toISOString().split('T')[0];
        const labelText = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        labels.push(labelText);
        taskCountPerDay[dateString] = 0;
    }

    completedTasks.forEach(t => {
        if (t.dueDate && taskCountPerDay[t.dueDate] !== undefined) {
            taskCountPerDay[t.dueDate]++;
        }
    });

    const chartData = Object.keys(taskCountPerDay).map(key => taskCountPerDay[key]);

    if (productivityChart) {
        productivityChart.destroy();
    }

    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#94a3b8' : '#475569';
    const gridColor = isDark ? '#1e293b' : '#e2e8f0';
    const barColor = isDark ? '#00D2FF' : '#006B85';

    productivityChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Quest Cleared',
                data: chartData,
                backgroundColor: barColor,
                borderRadius: 5,
                barThickness: 16
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: textColor, font: { size: 10, weight: 'bold' } }
                },
                y: {
                    grid: { color: gridColor },
                    beginAtZero: true,
                    ticks: { color: textColor, font: { size: 10 }, stepSize: 1 }
                }
            }
        }
    });
}

// Gantilah 'inputTaskTitle' dengan ID elemen input judul tugas di HTML kamu
const taskInput = document.getElementById('inputTaskTitle');

if (taskInput) {
    // 1. Saat halaman dimuat, cek apakah ada draft yang tertinggal
    const savedDraft = localStorage.getItem('task_draft');
    if (savedDraft) {
        taskInput.value = savedDraft;
        // Opsional: Kasih tau user lewat toast kerenmu kalau draft dikembalikan
        setTimeout(() => showToast("✨ Draft ketikan sebelumnya dikembalikan!", "info"), 1000);
    }

    // 2. Setiap kali user mengetik, langsung simpan ke localStorage
    taskInput.addEventListener('input', (e) => {
        localStorage.setItem('task_draft', e.target.value);
    });

    // 3. Hapus draft kalau user berhasil submit tugas (bersihkan memori)
    // Panggil baris di bawah ini di dalam fungsi addTask() kamu yang sukses:
    // localStorage.removeItem('task_draft');
}