const state = {
    currentJob: null,
    isVerified: false,
    uploadedFile: null,
    uploadedPhoto: null
};

// Toggle Education Other Field
function toggleEduOther() {
    const list = document.getElementById('edu-list');
    const other = document.getElementById('edu-other');
    if (list.value === 'Other') {
        other.classList.remove('hidden');
        other.required = true;
    } else {
        other.classList.add('hidden');
        other.required = false;
        other.value = '';
    }
}

// --- FIREBASE REMOVED ---
// Using Custom Node.js OTP System

// Category Switching (Removed in favor of Vertical Layout)
// function switchCategory(cat) { ... }

// Navigation Logic
function showSection(sectionId) {
    const sections = ['selection', 'registration', 'form', 'success', 'tracking', 'profile'];
    sections.forEach(s => {
        const el = document.getElementById(`${s}-section`);
        if (el) el.classList.add('hidden');
    });
    const target = document.getElementById(`${sectionId}-section`);
    if (target) target.classList.remove('hidden');
    window.scrollTo(0, 0);
}

// Job Selection
function selectJob(jobType) {
    state.currentJob = jobType;
    const titles = {
        clerk: "منتدب – كاتب",
        legal: "باحث قانوني (عقد استعانة)",
        driver: "سائق (عقد استعانة)"
    };
    const titleEl = document.getElementById('form-job-title');
    if (titleEl) titleEl.innerText = titles[jobType];

    renderDynamicFields(jobType);
    showSection('registration');
}

// 1. Start Verification (Check DB -> Send OTP)
async function startVerification() {
    const nid = document.getElementById('reg-nid').value;
    const email = document.getElementById('reg-email').value;
    const phone = document.getElementById('reg-phone').value;
    const job = state.currentJob;

    // Basic Validation
    if (nid.length !== 14) return showToast("يرجى إدخال الرقم القومي صحيحاً", "error");
    if (!email.includes('@')) return showToast("يرجى إدخال بريد إلكتروني صحيح", "error");
    if (phone.length !== 11) return showToast("يرجى إدخال رقم هاتف صحيح", "error");

    showLoader(true);

    try {
        // A. Check Backend (DB) First
        const checkRes = await fetch('/applications/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nationalId: nid, jobType: job, email: email, phone: phone })
        });
        const checkData = await checkRes.json();

        // Case: Already Registered -> Redirect
        if (checkData.status === 'found') {
            showLoader(false);
            if (checkData.appStatus === 'Approved') {
                showToast("تم قبول طلبك مسبقاً! عرض التفاصيل...", "success");
            } else {
                showToast("أنت مسجل بالفعل! جاري التحويل للمتابعة...", "success");
            }
            setTimeout(() => {
                const trackInput = document.getElementById('track-id');
                if (trackInput) trackInput.value = checkData.applicationId;
                showSection('tracking');
                trackApplication();
            }, 1500);
            return;
        }

        // Case: Conflict -> Block
        if (checkData.status === 'conflict') {
            showLoader(false);
            showToast(checkData.message, "error");
            return;
        }

        // Case: OK -> Send API OTP
        const otpRes = await fetch('/auth/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, nationalId: nid, phone })
        });
        const otpData = await otpRes.json();
        showLoader(false);

        if (otpData.success) {
            showToast("تم إرسال رمز التحقق إلى بريدك الإلكتروني", "success");

            // Show OTP UI
            const btn = document.getElementById('otp-btn');
            if (btn) {
                btn.innerText = "تم الإرسال";
                btn.disabled = true;
            }
            const container = document.getElementById('otp-container');
            if (container) container.classList.remove('hidden');
        } else {
            showToast("فشل إرسال الرمز: " + otpData.message, "error");
        }

    } catch (e) {
        console.error(e);
        showLoader(false);
        showToast("خطأ في الاتصال", "error");
    }
}

// 2. Verify OTP (Manual Entry)
async function verifyOTP() {
    const inputs = document.querySelectorAll('.otp-input');
    let code = '';
    inputs.forEach(input => code += input.value);

    if (code.length !== 6) {
        showToast("يرجى إدخال الرمز كاملاً (6 أرقام)", "error");
        return;
    }

    const email = document.getElementById('reg-email').value;
    showLoader(true);

    try {
        const res = await fetch('/auth/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code })
        });
        const data = await res.json();
        showLoader(false);

        if (data.success) {
            showToast("تم التحقق بنجاح!", "success");
            state.isVerified = true;

            // Auto-extract BirthDate
            extractBirthDate();

            setTimeout(() => {
                showSection('form');
            }, 1000);
        } else {
            showToast(data.message, "error");
        }

    } catch (e) {
        console.error(e);
        showLoader(false);
        showToast("حدث خطأ في النظام", "error");
    }
}

// Toggle Military Status
function toggleMilitaryStatus() {
    const gender = document.getElementById('field-gender').value;
    const div = document.getElementById('div-military');
    const field = document.getElementById('field-military');

    if (gender === 'Male') {
        div.classList.remove('opacity-50', 'pointer-events-none');
        field.required = true;
    } else {
        div.classList.add('opacity-50', 'pointer-events-none');
        field.required = false;
        field.value = "";
    }
}

// Dynamic Form Fields Rendering
function renderDynamicFields(type) {
    const container = document.getElementById('dynamic-fields-container');
    if (!container) return;

    let html = '';

    if (type === 'clerk') {
        html = `
            <div class="grid md:grid-cols-2 gap-6 animate-fade-in">
                <div class="md:col-span-2"><h4 class="font-bold text-blue-800 mb-4 pb-2 border-b">بيانات الوظيفة الحالية (نظام الندب)</h4></div>
                
                <div class="md:col-span-2 bg-amber-50 border-r-4 border-amber-500 p-4 mb-4 rounded shadow-sm">
                    <p class="text-sm font-bold text-amber-900 mb-2 flex items-center gap-2">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        تنبيه هام بخصوص المستندات:
                    </p>
                    <p class="text-xs text-amber-800 leading-relaxed">
                        يجب دمج المستندات التالية في ملف PDF واحد:<br>
                        1. <b>بيان حالة وظيفية:</b> موضح به (المسمى الوظيفي، الدرجة، المجموعة النوعية، وأنه على درجة دائمة).<br>
                        2. <b>صورة البطاقة:</b> سارية (وجه وظهر).<br>
                        3. <b>بيان الجزاءات:</b> معتمد ومختوم (يوضح الجزاءات أو خلوها، وأسباب المحو إن وجدت).<br>
                        4. <b>بيان التمويل:</b> يفيد أن المذكور على درجة دائمة ممولة من الموازنة (باب أول أجور).
                    </p>
                </div>

                <div>
                    <label class="block text-sm font-bold mb-2">جهة العمل</label>
                    <input type="text" name="currentEmployer" required class="form-input" placeholder="مثال: وزارة العدل">
                </div>
                <div>
                    <label class="block text-sm font-bold mb-2">المسمى الوظيفي الحالي</label>
                    <input type="text" name="jobTitle" required class="form-input">
                </div>
                <div>
                    <label class="block text-sm font-bold mb-2">الدرجة الوظيفية</label>
                    <select name="jobGrade" required class="form-input">
                        <option value="">اختر الدرجة...</option>
                        <option>الثانية</option>
                        <option>الثالثة</option>
                        <option>الرابعة</option>
                        <option>الخامسة</option>
                    </select>
                </div>
                <div>
                     <label class="block text-sm font-bold mb-2">تاريخ التعيين</label>
                    <input type="date" name="appointmentDate" class="form-input">
                </div>
            </div>
        `;
        // Override Qualification Options for Clerk
        setTimeout(() => {
            const qualSelect = document.querySelector('select[name="qualification"]');
            if (qualSelect) {
                qualSelect.innerHTML = `
                    <option value="">اختر المؤهل...</option>
                    <option>دبلوم تجارة (نظام 3 سنوات)</option>
                    <option>دبلوم تجارة (نظام 5 سنوات)</option>
                    <option>معهد فني تجاري</option>
                    <option>دبلوم إدارة وخدمات</option>
                    <option>بكالوريوس تجارة (مؤهل عالي)</option>
                    <option>أخرى</option>
                 `;
            }
        }, 100);

    } else if (type === 'legal') {
        html = `
            <div class="grid md:grid-cols-2 gap-6 animate-fade-in">
                <div class="md:col-span-2"><h4 class="font-bold text-emerald-800 mb-4 pb-2 border-b">بيانات المؤهل (باحث قانوني)</h4></div>
                
                 <div class="md:col-span-2 bg-emerald-50 border-r-4 border-emerald-500 p-4 mb-4 rounded shadow-sm">
                    <p class="text-xs text-emerald-800 leading-relaxed font-bold">
                        المستندات المطلوبة (في ملف واحد PDF): صورة المؤهل - شهادة الميلاد - بطاقة الرقم القومي - شهادة الخدمة العسكرية (للذكور).
                    </p>
                </div>

                <div>
                    <label class="block text-sm font-bold mb-2">التقدير العام</label>
                    <select name="grade" required class="form-input">
                        <option value="">اختر التقدير...</option>
                        <option>مقبول</option>
                        <option>جيد</option>
                        <option>جيد جداً</option>
                        <option>امتياز</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-bold mb-2">سنة الحصول على الليسانس</label>
                    <input type="number" name="degreeYear" required class="form-input" min="2005" max="2026" value="2024">
                </div>
            </div>
        `;
    } else if (type === 'driver') {
        html = `
            <div class="grid md:grid-cols-2 gap-6 animate-fade-in">
                <div class="md:col-span-2"><h4 class="font-bold text-amber-800 mb-4 pb-2 border-b">بيانات الرخصة (سائق)</h4></div>
                 
                 <div class="md:col-span-2 bg-amber-50 border-r-4 border-amber-500 p-4 mb-4 rounded shadow-sm">
                    <p class="text-xs text-amber-800 leading-relaxed font-bold">
                        المستندات المطلوبة (في ملف واحد PDF): رخصة قيادة مهنية سارية - صورة المؤهل - الميلاد - الرقم القومي - الخدمة العسكرية.
                    </p>
                </div>

                <div>
                    <label class="block text-sm font-bold mb-2">درجة الرخصة المهنية</label>
                    <select name="licenseType" required class="form-input">
                        <option value="">اختر الدرجة...</option>
                        <option>درجة أولى</option>
                        <option>درجة ثانية</option>
                        <option>درجة ثالثة</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-bold mb-2">تاريخ انتهاء الرخصة</label>
                    <input type="date" name="licenseExpiry" required class="form-input">
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
}

// Age Calculation
function calculateAge() {
    const dob = document.getElementById('field-dob').value;
    if (!dob) return;
    const diff = new Date() - new Date(dob);
    const age = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
    document.getElementById('display-age').value = age + " سنة";
}

// File Upload Management
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileNameDisplay = document.getElementById('file-name-display');

if (dropZone && fileInput) {
    dropZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.type !== 'application/pdf') {
                showToast("يرجى اختيار ملف PDF فقط", "error");
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                showToast("حجم الملف يتعدى 10 ميجا بايت", "error");
                return;
            }
            state.uploadedFile = file;
            if (fileNameDisplay) {
                fileNameDisplay.innerText = "تم اختيار الملف: " + file.name;
                fileNameDisplay.classList.remove('hidden');
            }
            dropZone.classList.add('bg-emerald-50', 'border-emerald-400');
            dropZone.classList.remove('border-slate-300');
        }
    });
}

// Photo Upload Management
const photoZone = document.getElementById('photo-drop-zone');
const photoInput = document.getElementById('photo-input');
const photoNameDisplay = document.getElementById('photo-name-display');

if (photoZone && photoInput) {
    photoZone.addEventListener('click', () => photoInput.click());

    photoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                showToast("يرجى اختيار صورة صحيحة (JPG/PNG)", "error");
                return;
            }
            state.uploadedPhoto = file;
            if (photoNameDisplay) {
                photoNameDisplay.innerText = "تم اختيار الصورة: " + file.name;
                photoNameDisplay.classList.remove('hidden');
            }
            photoZone.classList.add('bg-emerald-50', 'border-emerald-400');
            photoZone.classList.remove('border-slate-300');
        }
    });
}

// Extract DOB Logic & Military Status
function extractBirthDate() {
    const nidField = document.getElementById('reg-nid');
    if (!nidField) return;
    const nid = nidField.value;

    if (nid.length !== 14) return;

    // 2990101... -> 1999-01-01
    // Century: 2 => 1900, 3 => 2000
    const century = nid[0];
    const yearPart = nid.substring(1, 3);
    const month = nid.substring(3, 5);
    const day = nid.substring(5, 7);

    let yearPrefix = (century === '2') ? '19' : '20';
    const fullYear = yearPrefix + yearPart;
    const isoDate = `${fullYear}-${month}-${day}`;

    // Set Hidden DOB
    const dobField = document.getElementById('field-dob');
    if (dobField) {
        dobField.value = isoDate;
        calculateAge();
        // Make it readonly to prevent tampering
        dobField.readOnly = true;
        dobField.classList.add('bg-slate-100');
    }
}

// Submit Application
async function submitApplication() {
    const form = document.getElementById('main-application-form');
    if (!form) return;

    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    // Ensure we have the basic identifiers from Registration step
    // (In case they are not in the form as hidden fields, we assume logic uses the ID from DOM)
    const nidVal = document.getElementById('reg-nid').value;
    if (!nidVal) {
        showToast("حدث خطأ في استعادة البيانات، يرجى إعادة التحميل", "error");
        return;
    }

    // 4. Age Check (Max 40)
    const ageVal = parseInt(document.getElementById('display-age').value) || 0;
    if (ageVal > 40) {
        showToast("عذراً، يجب أن لا يتجاوز السن 40 عاماً عند التقديم", "error");
        return;
    }

    // 5. Governorate Check for Legal/Driver
    if (state.currentJob === 'legal' || state.currentJob === 'driver') {
        const gov = form.elements['governorate'].value;
        const whitelistedGovs = ['القاهرة', 'الجيزة', 'الإسكندرية', 'البحيرة', 'القليوبية', 'الغربية', 'الشرقية', 'السويس', 'بورسعيد', 'الإسماعيلية', 'كفر الشيخ', 'سوهاج', 'قنا', 'المنيا', 'الأقصر', 'أسوان', 'دمياط', 'البحر الأحمر', 'جنوب سيناء'];
        if (!whitelistedGovs.includes(gov)) {
            showToast("عذراً، التقديم غير متاح لمحافظة الإقامة المختارة حالياً", "error");
            return;
        }
    }

    if (!state.uploadedFile) {
        showToast("يرجى رفع ملف المستندات (PDF)", "error");
        return;
    }
    if (!state.uploadedPhoto) {
        showToast("يرجى رفع الصورة الشخصية", "error");
        return;
    }

    showLoader(true);

    try {
        const formData = new FormData(form);

        // Append Registration Data (NID, Email, Phone) from the restored DOM elements
        formData.append('nationalId', nidVal);
        formData.append('email', document.getElementById('reg-email').value);
        formData.append('phone', document.getElementById('reg-phone').value);

        // Handle Education Entity
        const eduList = form.elements['educationEntityList'].value;
        const eduOther = form.elements['educationEntityOther'].value;
        const finalEdu = (eduList === 'Other') ? eduOther : eduList;
        formData.append('educationEntity', finalEdu);

        formData.append('jobType', state.currentJob);
        formData.append('file', state.uploadedFile);
        formData.append('photo', state.uploadedPhoto);

        // Collect extra dynamic fields
        const extra = {};
        // We iterate form elements to catch dynamic ones not automatically mapped if needed
        // But FormData usually catches all input/select with 'name' attribute.

        // Let's add specific dynamic fields to 'extra' just in case the backend expects a JSON string
        const dynamicInputs = document.querySelectorAll('#dynamic-fields-container input, #dynamic-fields-container select');
        dynamicInputs.forEach(input => {
            if (input.name) extra[input.name] = input.value;
        });
        formData.append('extraData', JSON.stringify(extra));

        const res = await fetch('/applications/submit', {
            method: 'POST',
            body: formData
        });

        const data = await res.json();

        if (!data.success) {
            if (data.code === 'DUPLICATE_ENTRY') {
                showToast("عذراً، هذا الرقم القومي مسجل من قبل في هذه الوظيفة", "error");
                return;
            }
            if (data.code === 'DUPLICATE_CONTACT') {
                showToast(data.message, "error");
                return;
            }
            throw new Error(data.message || 'Server Error');
        }

        const appIdLabel = document.getElementById('final-app-id');
        if (appIdLabel) appIdLabel.innerText = `SLA-${new Date().getFullYear()}-${data.applicationId}`;

        showSection('success');

    } catch (e) {
        console.error(e);
        showToast("حدث خطأ أثناء إرسال الطلب، حاول مرة أخرى", "error");
    } finally {
        showLoader(false);
    }
}

// Track Application
async function trackApplication() {
    const id = document.getElementById('track-id').value;
    if (!id) {
        showToast("يرجى إدخال رقم الطلب", "error");
        return;
    }

    // Extract ID (SLA-2024-123 -> 123)
    const dbId = id.split('-').pop();

    showLoader(true);

    try {
        const res = await fetch(`/applications/${dbId}`);
        if (!res.ok) {
            showLoader(false);
            showToast("الطلب غير موجود، يرجى التأكد من الرقم", "error");
            return;
        }
        const data = await res.json();
        showLoader(false);

        renderTrackingResult(data);

    } catch (e) {
        console.error(e);
        showLoader(false);
        showToast("خطأ في الاتصال بالسيرفر", "error");
    }
}

function renderTrackingResult(app) {
    const container = document.getElementById('track-result');
    if (!container) return;

    container.classList.remove('hidden');
    container.classList.add('fade-in');

    const statusMap = {
        'Submitted': { label: 'تم استلام الطلب', color: 'bg-emerald-500', desc: 'تم استلام طلبك بنجاح وجاري فحصه من قبل اللجنة المختصة.' },
        'Pending': { label: 'قيد المراجعة', color: 'bg-amber-500', desc: 'جاري مراجعة المستندات والبيانات للتأكد من صحتها.' },
        'Approved': { label: 'مقبول مبدئياً', color: 'bg-blue-500', desc: 'تم قبول الطلب مبدئياً، يرجى انتظار رسالة بموعد ومكان الاختبار.' },
        'Rejected': { label: 'غير مستوفي', color: 'bg-rose-500', desc: 'عذراً، الطلب غير مستوفي للشروط المعلنة.' }
    };

    const s = statusMap[app.Status] || statusMap['Pending'];
    const dateStr = new Date(app.CreatedAt).toLocaleDateString('ar-EG', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    // Determine timeline steps based on status
    let steps = '';

    // Step 1: Submitted (Always Done)
    steps += `
        <div class="relative flex gap-4 items-start">
            <div class="z-10 w-8 h-8 ${app.Status ? 'bg-emerald-500' : 'bg-slate-300'} rounded-full flex items-center justify-center text-white ring-8 ring-white shadow-lg shadow-emerald-100">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            </div>
            <div>
                <p class="font-bold text-lg text-slate-800">تم استلام الطلب</p>
                <p class="text-xs text-slate-500 font-mono mt-1">${dateStr}</p>
            </div>
        </div>
    `;

    // Step 2: Review (Active or Done)
    const isReview = app.Status === 'Pending' || app.Status === 'Approved' || app.Status === 'Rejected';
    const reviewColor = app.Status === 'Pending' ? 'bg-amber-500 animate-pulse' : (isReview ? 'bg-emerald-500' : 'bg-slate-200');
    const reviewIcon = app.Status === 'Rejected'
        ? '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>'
        : '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>';

    steps += `
        <div class="relative flex gap-4 items-start pt-10">
            <div class="z-10 w-8 h-8 ${reviewColor} rounded-full flex items-center justify-center text-white ring-8 ring-white shadow-lg">
                ${reviewIcon}
            </div>
            <div>
                <p class="font-bold text-lg text-slate-800">المراجعة والفحص</p>
                <p class="text-sm text-slate-600 mt-1 max-w-xs">${s.desc}</p>
            </div>
        </div>
    `;

    // Step 3: Result
    if (app.Status === 'Approved' || app.Status === 'Rejected') {
        const resultColor = app.Status === 'Approved' ? 'bg-blue-600' : 'bg-rose-600';
        const resultIcon = app.Status === 'Approved'
            ? '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
            : '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
        steps += `
            <div class="relative flex gap-4 items-start pt-10">
                <div class="z-10 w-8 h-8 ${resultColor} rounded-full flex items-center justify-center text-white ring-8 ring-white shadow-lg">
                     ${resultIcon}
                </div>
                <div>
                    <p class="font-bold text-lg ${app.Status === 'Approved' ? 'text-blue-700' : 'text-rose-700'}">${s.label}</p>
                    ${app.Status === 'Approved' ? '<p class="text-xs text-slate-500 mt-1">سيتم تحديد موعد الاختبار قريباً</p>' : ''}
                </div>
            </div>
         `;
    }

    container.innerHTML = `
        <div class="bg-slate-50 p-6 rounded-xl border border-slate-100 mb-8 shadow-sm">
             <div class="flex justify-between items-center mb-4 pb-4 border-b border-slate-200">
                <h3 class="font-bold text-slate-700">بيانات المتقدم</h3>
                <span class="font-mono text-sm bg-white px-3 py-1 rounded border text-slate-500">${app.NationalId}</span>
             </div>
             <p class="text-xl font-bold text-slate-900 mb-1">${app.FullName}</p>
             <p class="text-sm text-slate-500 font-medium">${translateJob(app.JobType)}</p>
        </div>

        <div class="relative pl-4 ml-2 border-r-2 border-slate-100 border-r-dashed md:border-r-0 md:border-l-2 md:pl-8 md:ml-0 md:mr-2">
            <div class="relative space-y-2 before:absolute before:right-[15px] before:top-4 before:bottom-4 before:w-[2px] before:bg-slate-200">
                ${steps}
             </div>
    `;

    // Store current app data in state for profile view
    state.currentAppData = app;
}

function viewProfileFromTracking() {
    if (!state.currentAppData) return;
    renderProfile(state.currentAppData);
    showSection('profile');
}

function renderProfile(app) {
    // 1. Header
    const set = (id, txt) => {
        const el = document.getElementById(id);
        if (el) el.innerText = txt || '-';
    };

    set('prof-name', app.FullName);
    set('prof-job', translateJob(app.JobType));
    set('prof-date', new Date(app.CreatedAt).toLocaleDateString('ar-EG'));
    set('prof-id-short', 'SLA-' + app.Id);

    // Status Badge
    const statusEl = document.getElementById('prof-status-badge');
    const statusMap = {
        'Submitted': { label: 'تم استلام الطلب', color: 'bg-emerald-400 text-emerald-900 border-white' },
        'Pending': { label: 'قيد المراجعة', color: 'bg-amber-400 text-amber-900 border-white' },
        'Approved': { label: 'مقبول', color: 'bg-blue-400 text-blue-900 border-white' },
        'Rejected': { label: 'مرفوض', color: 'bg-rose-400 text-rose-900 border-white' }
    };
    const s = statusMap[app.Status] || statusMap['Submitted'];
    statusEl.className = `absolute -bottom-3 inset-x-0 mx-auto w-max px-3 py-1 rounded-full text-xs font-bold shadow-sm border ${s.color}`;
    statusEl.innerText = s.label;

    // Image
    const imgEl = document.getElementById('prof-img');
    if (imgEl) {
        imgEl.src = app.ProfileImagePath ? `/${app.ProfileImagePath}` : 'images/logo.png';
    }

    // 2. Personal Info
    set('prof-nid', app.NationalId);
    set('prof-address', app.Address);
    set('prof-gov', app.Governorate);
    set('prof-military', app.MilitaryStatus || 'غير محدد');
    set('prof-gender', (app.Gender === 'Male' ? 'ذكر' : 'أنثى') || '-');

    // Calculate Age from NID (more accurate than static DB field if we had one) or use DB extra data?
    // We already have a logic for NID age in extractBirthDate, let's reuse it or just calc on fly.
    // NID: 2990101...
    if (app.NationalId && app.NationalId.length === 14) {
        const century = app.NationalId[0];
        const yearPart = app.NationalId.substring(1, 3);
        const yearPrefix = (century === '2') ? '19' : '20';
        const y = parseInt(yearPrefix + yearPart);
        const age = new Date().getFullYear() - y;
        set('prof-dob-age', `${y} (${age} سنة)`);
    }

    // 3. Education
    set('prof-qual', app.Qualification);
    set('prof-grad-year', app.GraduationYear);
    set('prof-uni', app.EducationEntity);

    // Extra Data Parsing
    let extra = {};
    try {
        extra = JSON.parse(app.ExtraData || '{}');
    } catch (e) { }

    // Special fields based on Job
    set('prof-grade', extra.grade || app.JobType === 'driver' ? (extra.licenseType || '-') : '-');

    // Resume/Work
    set('prof-exp-years', app.ExperienceYears ? app.ExperienceYears + ' سنوات' : 'لا يوجد');
    set('prof-prev-work', app.PreviousWork);

    // 4. Contact
    set('prof-phone', app.Phone);
    set('prof-email', app.Email);

    // 5. Skills
    set('prof-skills', app.Skills);

    // 6. File
    const fileLink = document.getElementById('prof-file-link');
    if (fileLink) {
        if (app.FilePath) {
            fileLink.href = `/${app.FilePath}`;
            fileLink.classList.remove('opacity-50', 'pointer-events-none');
        } else {
            fileLink.href = '#';
            fileLink.classList.add('opacity-50', 'pointer-events-none');
        }
    }
}

function translateJob(job) {
    const map = { 'clerk': 'منتدب - كاتب', 'legal': 'باحث قانوني', 'driver': 'سائق' };
    return map[job] || job;
}

// Helper: Toast Notification
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 left-4 px-6 py-4 rounded-xl shadow-2xl text-white font-bold transform transition-all duration-500 translate-y-20 z-[200] ${type === 'error' ? 'bg-rose-600' : 'bg-slate-800'}`;
    toast.innerText = message;

    // Add icon based on type
    if (type === 'success') toast.innerHTML = `<svg class="w-6 h-6 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> ${message}`;
    if (type === 'error') toast.innerHTML = `<svg class="w-6 h-6 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> ${message}`;

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-20');
    });

    setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0');
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

// Helper: Loader
function showLoader(show) {
    const loader = document.getElementById('global-loader');
    if (loader) {
        if (show) loader.classList.remove('hidden');
        else loader.classList.add('hidden');
    }
}