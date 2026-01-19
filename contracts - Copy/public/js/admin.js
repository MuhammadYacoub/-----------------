
// State Management
let applicationState = {
    data: [], // All fetched data
    filteredData: [], // Data after filters applied
    filters: {
        search: '',
        job: '',
        gov: '',
        status: ''
    },
    sort: {
        column: 'CreatedAt',
        direction: 'desc' // or 'asc'
    },
    pagination: {
        currentPage: 1,
        itemsPerPage: 10
    }
};

// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
    checkLogin();
});

// --- Login Logic ---

function checkLogin() {
    if (localStorage.getItem('admin_auth') === 'true') {
        document.getElementById('login-modal').classList.add('hidden');
        document.getElementById('login-modal').classList.remove('flex'); // Remove flex to hide properly
        document.getElementById('dashboard-content').classList.remove('hidden');
        document.getElementById('dashboard-content').classList.add('flex'); // Add flex to show

        // Show Sidebar on large screens
        const sidebar = document.querySelector('aside');
        if (window.innerWidth >= 768) {
            sidebar.classList.remove('hidden');
            sidebar.classList.add('flex');
        }

        fetchData();
    } else {
        document.getElementById('login-modal').classList.remove('hidden');
        document.getElementById('login-modal').classList.add('flex');
    }
}

function adminLogin() {
    const pass = document.getElementById('admin-pass').value;
    if (pass === 'admin123') {
        localStorage.setItem('admin_auth', 'true');
        checkLogin();
    } else {
        alert('كلمة المرور غير صحيحة');
    }
}

function adminLogout() {
    localStorage.removeItem('admin_auth');
    location.reload();
}

// Sidebar Toggle (Mobile)
function toggleSidebar() {
    const sidebar = document.getElementById('main-sidebar');
    if (sidebar.classList.contains('hidden')) {
        sidebar.classList.remove('hidden');
        sidebar.classList.add('flex');
    } else {
        sidebar.classList.add('hidden');
        sidebar.classList.remove('flex');
    }
}

// --- Data Fetching ---

async function fetchData() {
    try {
        const res = await fetch('/dashboard/applications');
        if (!res.ok) throw new Error('Network response was not ok');

        const data = await res.json();

        applicationState.data = data;

        // Populate Filters
        populateGovFilter(data);

        // Initial Process
        processData();

    } catch (e) {
        console.error(e);
        alert('حدث خطأ في جلب البيانات، يرجى المحاولة مرة أخرى.');
    }
}

function populateGovFilter(data) {
    const govs = [...new Set(data.map(a => a.Governorate).filter(g => g))].sort();
    const govSelect = document.getElementById('filter-gov');
    // Keep first option
    govSelect.innerHTML = '<option value="">كل المحافظات</option>';

    govs.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g;
        opt.innerText = g;
        govSelect.appendChild(opt);
    });
}

// --- Core Logic (Filter -> Sort -> Paginate) ---

function processData() {
    let result = [...applicationState.data];

    // 1. Filter
    const f = applicationState.filters;
    if (f.search) {
        const q = f.search.toLowerCase();
        result = result.filter(item =>
            (item.FullName && item.FullName.toLowerCase().includes(q)) ||
            (item.NationalId && item.NationalId.includes(q)) ||
            (item.Phone && item.Phone.includes(q))
        );
    }
    if (f.job) {
        result = result.filter(item => item.JobType === f.job);
    }
    if (f.gov) {
        result = result.filter(item => item.Governorate === f.gov);
    }
    if (f.status) {
        result = result.filter(item => item.Status === f.status);
    }

    applicationState.filteredData = result;

    // 2. Sort
    const s = applicationState.sort;
    result.sort((a, b) => {
        let valA = a[s.column] || '';
        let valB = b[s.column] || '';

        // Int Check
        if (s.column === 'Id') {
            valA = parseInt(valA);
            valB = parseInt(valB);
        }

        if (valA < valB) return s.direction === 'asc' ? -1 : 1;
        if (valA > valB) return s.direction === 'asc' ? 1 : -1;
        return 0;
    });

    // 3. Stats (on total or filtered? Let's do Global Stats for headers, filtered updates maybe?)
    // Request asked for interactive capabilities. Let's update global stats based on ALL data once?
    updateStats(applicationState.data);

    // 4. Render
    renderData();
}

function updateStats(data) {
    // These specific IDs are for the top cards. 
    // Usually these show TOTAL system state, not filtered state.
    const total = data.length;
    const approved = data.filter(i => i.Status === 'Approved').length;
    const pending = data.filter(i => i.Status === 'Pending' || !i.Status).length;

    animateValue('stat-total', parseInt(document.getElementById('stat-total').innerText), total, 1000);
    animateValue('stat-approved', parseInt(document.getElementById('stat-approved').innerText), approved, 1000);
    animateValue('stat-pending', parseInt(document.getElementById('stat-pending').innerText), pending, 1000);

    // Bars
    if (total > 0) {
        document.getElementById('stat-approved-bar').style.width = `${(approved / total) * 100}%`;
        document.getElementById('stat-pending-bar').style.width = `${(pending / total) * 100}%`;
    }
}

// Simple counter animation
function animateValue(id, start, end, duration) {
    if (start === end) return;
    const range = end - start;
    let current = start;
    const increment = end > start ? 1 : -1;
    const stepTime = Math.abs(Math.floor(duration / range));
    const obj = document.getElementById(id);
    const timer = setInterval(function () {
        current += increment;
        obj.innerHTML = current;
        if (current == end) {
            clearInterval(timer);
        }
    }, stepTime > 0 ? stepTime : 10);
}


function renderData() {
    const { filteredData, pagination } = applicationState;

    // Pagination Slice
    const start = (pagination.currentPage - 1) * pagination.itemsPerPage;
    const end = start + pagination.itemsPerPage;
    const pageData = filteredData.slice(start, end);

    // Render Table
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';

    if (pageData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-400">لا توجد نتائج مطابقة للبحث</td></tr>`;
    } else {
        pageData.forEach(app => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 group';
            tr.innerHTML = `
                <td class="px-6 py-4">
                     <span class="font-mono text-xs font-semibold text-primary-600 bg-primary-50 px-2 py-1 rounded-md">#${app.Id}</span>
                </td>
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                         ${app.ProfileImagePath ?
                    `<img src="${app.ProfileImagePath}" class="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm">` :
                    `<div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xs">${getInitials(app.FullName)}</div>`
                }
                        <div>
                            <p class="font-bold text-slate-800 text-sm group-hover:text-primary-600 transition-colors">${app.FullName}</p>
                            <p class="text-xs text-slate-400 font-mono">${app.NationalId}</p>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <div class="text-xs text-slate-600 space-y-1">
                        <p class="flex items-center gap-2"><i class="fa-solid fa-phone text-slate-300 w-4"></i> ${app.Phone || '-'}</p>
                        <p class="flex items-center gap-2"><i class="fa-solid fa-location-dot text-slate-300 w-4"></i> ${app.Governorate || '-'}</p>
                    </div>
                </td>
                <td class="px-6 py-4">
                     <div>
                        <span class="block text-sm font-medium text-slate-700">${translateJob(app.JobType)}</span>
                        <span class="block text-xs text-slate-400 mt-0.5 truncate max-w-[150px]" title="${app.Qualification}">${app.Qualification || 'غير محدد'}</span>
                     </div>
                </td>
                <td class="px-6 py-4">
                   ${getStatusBadge(app.Status)}
                </td>
                <td class="px-6 py-4">
                    <button onclick="viewDetails(${app.Id})" class="text-slate-400 hover:text-primary-600 hover:bg-primary-50 p-2 rounded-lg transition-all" title="عرض التفاصيل">
                        <i class="fa-regular fa-eye text-lg"></i>
                    </button>
                    ${app.Status === 'Pending' || !app.Status ? `
                    <button onclick="quickAction(${app.Id}, 'Approved')" class="text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 p-2 rounded-lg transition-all" title="قبول سريع">
                        <i class="fa-solid fa-check text-lg"></i>
                    </button>
                    ` : ''}
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Render Pagination Info
    document.getElementById('showing-count').innerText = pageData.length;
    document.getElementById('total-results').innerText = filteredData.length;

    renderPaginationControls();
}

function renderPaginationControls() {
    const { filteredData, pagination } = applicationState;
    const totalPages = Math.ceil(filteredData.length / pagination.itemsPerPage);
    const container = document.getElementById('pagination-controls');

    container.innerHTML = '';

    if (totalPages <= 1) return;

    // Previous
    const prevBtn = document.createElement('button');
    prevBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
    prevBtn.className = `w-8 h-8 flex items-center justify-center rounded-lg text-xs transition-colors ${pagination.currentPage === 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-200'}`;
    prevBtn.onclick = () => { if (pagination.currentPage > 1) updatePage(pagination.currentPage - 1); };
    container.appendChild(prevBtn);

    // Page Numbers (Simple version: 1..N)
    // For large N, we would implement ellipsis logic, but sticking to simple for now
    let pagesToShow = [];
    if (totalPages <= 5) {
        pagesToShow = Array.from({ length: totalPages }, (_, i) => i + 1);
    } else {
        // Show start, end, current +/- 1
        if (pagination.currentPage <= 3) pagesToShow = [1, 2, 3, 4, '...', totalPages];
        else if (pagination.currentPage >= totalPages - 2) pagesToShow = [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
        else pagesToShow = [1, '...', pagination.currentPage - 1, pagination.currentPage, pagination.currentPage + 1, '...', totalPages];
    }

    pagesToShow.forEach(p => {
        if (p === '...') {
            const span = document.createElement('span');
            span.innerText = '...';
            span.className = 'px-2 text-slate-400 text-xs';
            container.appendChild(span);
        } else {
            const btn = document.createElement('button');
            btn.innerText = p;
            btn.className = `w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all ${pagination.currentPage === p ? 'bg-primary-600 text-white shadow-md shadow-primary-200' : 'text-slate-600 hover:bg-slate-100'}`;
            btn.onclick = () => updatePage(p);
            container.appendChild(btn);
        }
    });


    // Next
    const nextBtn = document.createElement('button');
    nextBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
    nextBtn.className = `w-8 h-8 flex items-center justify-center rounded-lg text-xs transition-colors ${pagination.currentPage === totalPages ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-200'}`;
    nextBtn.onclick = () => { if (pagination.currentPage < totalPages) updatePage(pagination.currentPage + 1); };
    container.appendChild(nextBtn);
}


// --- Interaction Functions ---

function applyFilters() {
    applicationState.filters.job = document.getElementById('filter-job').value;
    applicationState.filters.gov = document.getElementById('filter-gov').value;
    applicationState.filters.status = document.getElementById('filter-status').value;

    applicationState.pagination.currentPage = 1; // Reset to page 1
    processData();
}

let searchTimeout;
function debounceSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        applicationState.filters.search = document.getElementById('search-input').value;
        applicationState.pagination.currentPage = 1;
        processData();
    }, 300);
}

function sortBy(col) {
    if (applicationState.sort.column === col) {
        // Toggle direction
        applicationState.sort.direction = applicationState.sort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        applicationState.sort.column = col;
        applicationState.sort.direction = 'asc';
    }
    processData();
}

function updatePage(p) {
    applicationState.pagination.currentPage = p;
    renderData();
}

// --- Helpers ---

function getGenderFromNID(nid) {
    if (!nid || nid.length !== 14) return '-';
    // 13th digit: Odd=Male, Even=Female
    const genderDigit = parseInt(nid.charAt(12));
    return (genderDigit % 2 !== 0) ? 'ذكر' : 'أنثى';
}

function getInitials(name) {
    return name ? name.split(' ').map(n => n[0]).slice(0, 2).join('') : '??';
}

function translateJob(job) {
    const map = {
        'clerk': 'منتدب - كاتب',
        'legal': 'باحث قانوني',
        'driver': 'سائق'
    };
    return map[job] || job;
}

function getStatusBadge(status) {
    switch (status) {
        case 'Approved':
            return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>مقبول مبدئياً</span>`;
        case 'Rejected':
            return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-100"><span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>مرفوض</span>`;
        default:
            return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100"><span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>قيد المراجعة</span>`;
    }
}

// --- Modal Details ---

async function viewDetails(id) {
    // Ideally fetch fresh data, or find from local state.
    // Fetching fresh ensures we have everything including fields we might not show in table
    try {
        const res = await fetch(`/applications/${id}`);
        const app = await res.json();

        const content = document.getElementById('modal-content');
        content.innerHTML = `
            <div class="flex flex-col items-center mb-8">
                 ${app.ProfileImagePath ?
                `<img src="${app.ProfileImagePath}" class="w-24 h-24 rounded-full object-cover border-4 border-slate-50 shadow-md mb-4">` :
                `<div class="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-2xl mb-4 border-4 border-slate-50 shadow-md"><i class="fa-solid fa-user"></i></div>`
            }
                <h3 class="text-2xl font-bold text-slate-800">${app.FullName}</h3>
                <span class="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-sm mt-2 font-medium">${translateJob(app.JobType)}</span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <h4 class="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2"><i class="fa-regular fa-id-card text-primary-500"></i> المعلومات الشخصية</h4>
                    <div class="space-y-2 text-sm">
                        <p class="text-slate-500">الرقم القومي: <span class="text-slate-800 font-mono font-medium">${app.NationalId}</span></p>
                        <p class="text-slate-500">تاريخ الميلاد: <span class="text-slate-800 font-medium">${new Date(app.BirthDate).toLocaleDateString('ar-EG')}</span></p>
                         <p class="text-slate-500">الموقف التجنيدي: <span class="text-slate-800 font-medium">${app.MilitaryStatus || '-'}</span></p>
                         <p class="text-slate-500">النوع: <span class="text-slate-800 font-medium">${getGenderFromNID(app.NationalId)}</span></p>
                    </div>
                </div>

                <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <h4 class="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2"><i class="fa-solid fa-graduation-cap text-primary-500"></i> المؤهل والخبرة</h4>
                    <div class="space-y-2 text-sm">
                        <p class="text-slate-500">المؤهل: <span class="text-slate-800 font-medium">${app.Qualification}</span></p>
                        <p class="text-slate-500">الجهة: <span class="text-slate-800 font-medium">${app.EducationEntity || '-'}</span></p>
                        <p class="text-slate-500">سنة التخرج: <span class="text-slate-800 font-medium">${app.GraduationYear || '-'}</span></p>
                    </div>
                </div>
                 
                <div class="bg-slate-50 p-4 rounded-xl border border-slate-100 md:col-span-2">
                    <h4 class="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2"><i class="fa-solid fa-location-dot text-primary-500"></i> التواصل والعنوان</h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                         <p class="text-slate-500">الهاتف: <span class="text-slate-800 font-mono font-medium">${app.Phone}</span></p>
                         <p class="text-slate-500">البريد: <span class="text-slate-800 font-medium">${app.Email || '-'}</span></p>
                         <p class="text-slate-500 md:col-span-2">العنوان: <span class="text-slate-800 font-medium">${app.Address} - ${app.Governorate}</span></p>
                    </div>
                </div>
            </div>

            <div class="mb-8">
                 <a href="${app.FilePath}" target="_blank" class="flex items-center justify-center w-full p-4 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:border-primary-500 hover:text-primary-600 hover:bg-primary-50 transition-all gap-2 group">
                    <i class="fa-regular fa-file-pdf text-2xl group-hover:scale-110 transition-transform"></i>
                    <span class="font-bold">عرض مستندات الطلب (PDF)</span>
                </a>
            </div>

            <div class="border-t border-slate-100 pt-6">
                <h4 class="font-bold text-slate-900 mb-4">اتخاذ إجراء</h4>
                <div class="flex gap-3">
                    <button onclick="updateStatus(${app.Id}, 'Approved')" class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2">
                        <i class="fa-solid fa-check"></i> قبول الطلب
                    </button>
                    <button onclick="updateStatus(${app.Id}, 'Rejected')" class="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-rose-600/20 flex items-center justify-center gap-2">
                         <i class="fa-solid fa-xmark"></i> رفض الطلب
                    </button>
                </div>
            </div>
        `;

        document.getElementById('details-modal').classList.remove('hidden');

    } catch (e) {
        console.error(e);
        alert('حدث خطأ أثناء تحميل التفاصيل');
    }
}

function closeModal() {
    document.getElementById('details-modal').classList.add('hidden');
}

// Quick action from table
function quickAction(id, status) {
    // Just re-use updateStatus but maybe suppress some UI or confirming?
    updateStatus(id, status);
}

async function updateStatus(id, status) {
    const statusArabic = status === 'Approved' ? 'قبول' : 'رفض';
    if (!confirm(`هل أنت متأكد من ${statusArabic} هذا الطلب؟`)) return;

    try {
        const res = await fetch(`/dashboard/applications/${id}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });

        if (res.ok) {
            // Update local state to reflect change without full reload
            const index = applicationState.data.findIndex(a => a.Id == id);
            if (index !== -1) {
                applicationState.data[index].Status = status;
                // Update filtered data too if needed, or just re-process
                processData();
            }

            closeModal();

            // Show toast/notification (using alert for now)
            // alert(`تمت عملية الـ ${statusArabic} بنجاح`);
        } else {
            alert('حدث خطأ في تحديث الحالة');
        }
    } catch (e) {
        console.error(e);
        alert('network error');
    }
}
