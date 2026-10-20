const SUPABASE_URL = "https://eaqzjeexeduceevexmmb.supabase.co";
const SUPABASE_KEY = "sb_publishable_Uh7k-VG0YDuMxcvLbZmbog_006UtmzW";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentStaffUser = "";
let gymRegistryBook = [];
let staffAvatars = {};
let activePrintMode = "All";
let targetPrintDate = "";

async function selectUser(user) {
    currentStaffUser = user;
    document.getElementById('currentUserLabel').innerText = user;
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('datePaid').value = new Date().toISOString().split('T')[0];
    
    await downloadCloudData();
    calculateAutoPrice();
}

async function downloadCloudData() {
    let { data: dps, error: err1 } = await supabaseClient.from('springfield_gym_dps').select('*');
    if (!err1 && dps) {
        dps.forEach(d => { staffAvatars[d.staff_name] = d.avatar_base64; });
    }
    
    if (staffAvatars[currentStaffUser]) {
        document.getElementById('staffAvatarPreview').src = staffAvatars[currentStaffUser];
    }

    let { data: book, error: err2 } = await supabaseClient.from('springfield_gym_book').select('*').order('created_at', { ascending: false });
    if (!err2 && book) {
        gymRegistryBook = book;
    }
    renderLogBook();
}

async function handleDpUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async function() {
        const base64String = reader.result;
        
        const { error } = await supabaseClient
            .from('springfield_gym_dps')
            .upsert({ staff_name: currentStaffUser, avatar_base64: base64String });

        if (!error) {
            staffAvatars[currentStaffUser] = base64String;
            document.getElementById('staffAvatarPreview').src = base64String;
            renderLogBook();
        } else {
            alert("Database upload failed.");
        }
    };
    reader.readAsDataURL(file);
}

function calculateAutoPrice() {
    const gender = document.getElementById('gender').value;
    const trainer = document.getElementById('trainerOpt').value;
    const plan = document.getElementById('paymentPlan').value;
    let price = 0;
    
    if (trainer === "With Trainer") {
        if (plan === "Session") { price = 100; } 
        else { price = (gender === "Male") ? 1000 : 1200; }
    } else {
        if (plan === "Session") { price = 50; } 
        else { price = 600; }
    }
    document.getElementById('totalDue').value = price;
    calculateBalance();
}

function calculateBalance() {
    const total = Number(document.getElementById('totalDue').value) || 0;
    const paid = Number(document.getElementById('amountPaid').value) || 0;
    document.getElementById('remainingBalance').value = total - paid;
}

function toggleMpesaField() {
    const method = document.getElementById('payMethod').value;
    const mpesaGroup = document.getElementById('mpesaCodeGroup');
    if (method === "M-Pesa") { mpesaGroup.classList.remove('hidden'); } 
    else {
        mpesaGroup.classList.add('hidden');
        document.getElementById('mpesaCode').value = '';
    }
}

function toggleLedgerVisibility() {
    const wrapper = document.getElementById('ledgerTableWrapper');
    const buttons = document.getElementById('ledgerAuditButtons');
    const arrow = document.getElementById('ledgerToggleArrow');
    if (wrapper.classList.contains('hidden')) {
        wrapper.classList.remove('hidden');
        buttons.classList.remove('hidden');
        arrow.classList.add('rotated');
    } else {
        wrapper.classList.add('hidden');
        buttons.classList.add('hidden');
        arrow.classList.remove('rotated');
    }
}
function renderLogBook() {
    const tbody = document.getElementById('logTableBody');
    tbody.innerHTML = '';
    
    let cashSum = 0, mpesaSum = 0, debtSum = 0;
    const today = new Date();
    today.setHours(0,0,0,0);

    gymRegistryBook.forEach(entry => {
        if (activePrintMode === "Daily" && entry.date !== targetPrintDate) return;
        if (activePrintMode === "Monthly" && entry.date.substring(0, 7) !== targetPrintDate.substring(0, 7)) return;

        cashSum += (entry.method === "Cash") ? Number(entry.paid) : 0;
        mpesaSum += (entry.method === "M-Pesa") ? Number(entry.paid) : 0;
        debtSum += Number(entry.balance);

        const tr = document.createElement('tr');
        const planBadge = entry.plan === 'Session' ? 'badge-session' : 'badge-monthly';
        let renewalMarkup = "";

        if (entry.plan === "Session") {
            renewalMarkup = `<span class="badge badge-active">Session Pass</span>`;
        } else {
            const entryDateObj = new Date(entry.date);
            const expiryDate = new Date(entryDateObj);
            expiryDate.setDate(expiryDate.getDate() + 30);
            const daysLeft = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
            renewalMarkup = daysLeft < 0 ? `<span class="badge badge-expired">Expired</span> <span class="text-action-required">Add Money</span>` : `<span class="badge badge-active">Active</span> <small style="display:block;color:var(--text-muted);margin-top:2px;">${daysLeft} Days Left</small>`;
        }

        const mpesaInfo = entry.method === "M-Pesa" ? `M-Pesa<small style="display:block;color:var(--text-muted);text-transform:uppercase;">${entry.code || 'NO CODE'}</small>` : 'Cash';
        const phoneDisplay = entry.phone ? entry.phone : '<span style="color:var(--text-muted);font-style:italic;">None</span>';
        const creatorDp = staffAvatars[entry.staff] || "https://placeholder.com";

        tr.innerHTML = `
            <td>
                <div style="display:flex; align-items:center;">
                    <img class="table-avatar" src="${creatorDp}" alt="DP" style="width:32px; height:32px; border-radius:50%; margin-right:8px; object-fit:cover;">
                    <div>
                        <strong>${entry.name}</strong>
                        <small style="display:block;color:var(--text-muted);margin-top:2px;">Phone: ${phoneDisplay}</small>
                        <span class="logged-by-text" style="display:block; font-size:0.75rem; color:var(--text-muted);">Logged by: ${entry.staff}</span>
                    </div>
                </div>
            </td>
            <td><span class="badge ${planBadge}">${entry.plan}</span><small style="display:block;color:var(--text-muted);margin-top:2px;">${entry.trainer}</small></td>
            <td>Due: ${entry.total}<br>Paid: <strong>${entry.paid}</strong><br><span style="${Number(entry.balance) > 0 ? 'color:var(--primary);font-weight:bold;' : ''}">Bal: ${entry.balance}</span></td>
            <td>${mpesaInfo}</td>
            <td>${entry.date}</td>
            <td>${renewalMarkup}</td>
            <td class="no-print"><button class="btn-print-row" onclick="printSingleReceipt('${entry.name}', '${entry.date}', ${entry.id})" style="cursor:pointer;">Receipt</button></td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('totalCashSum').innerText = `Ksh ${cashSum.toLocaleString()}`;
    document.getElementById('totalMpesaSum').innerText = `Ksh ${mpesaSum.toLocaleString()}`;
    document.getElementById('totalDebtSum').innerText = `Ksh ${debtSum.toLocaleString()}`;
}

document.getElementById('logForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const newEntry = {
        name: document.getElementById('memberName').value.trim(),
        phone: document.getElementById('phoneNo').value.trim(),
        gender: document.getElementById('gender').value,
        trainer: document.getElementById('trainerOpt').value,
        plan: document.getElementById('paymentPlan').value,
        method: document.getElementById('payMethod').value,
        code: document.getElementById('mpesaCode').value.trim(),
        total: Number(document.getElementById('totalDue').value),
        paid: Number(document.getElementById('amountPaid').value),
        balance: Number(document.getElementById('remainingBalance').value),
        date: document.getElementById('datePaid').value,
        staff: currentStaffUser
    };

    const { error } = await supabaseClient.from('springfield_gym_book').insert([newEntry]);

    if (!error) {
        document.getElementById('memberName').value = '';
        document.getElementById('phoneNo').value = '';
        document.getElementById('mpesaCode').value = '';
        document.getElementById('amountPaid').value = '';
        calculateAutoPrice();
        await downloadCloudData();
    } else {
        alert("Failed to sync entry to cloud.");
    }
});

function evaluateFinancialPrintState() {
    const includeTotals = document.getElementById('includeTotalsCheckbox').checked;
    if (!includeTotals) { document.body.classList.add('hide-print-totals'); } 
    else { document.body.classList.remove('hide-print-totals'); }
}

function printSingleReceipt(memberName, datePaid, id) {
    const match = gymRegistryBook.find(r => r.id === id);
    if (!match) return;
    evaluateFinancialPrintState();
    
    // EMBEDS THE MEMBER NAME AND DATE IN THE PRINT FILENAME AND HEADER TITLE
    document.title = "Receipt_" + memberName.replace(/\s+/g, '_') + "_" + datePaid;
    document.getElementById('printReportHeader').innerHTML = `<h2>SPRINGFIELD GYM - RECEIPT FOR ${memberName.toUpperCase()}</h2><p>Issued By: ${match.staff} | Payment Date: ${datePaid} | Print Run: ${new Date().toLocaleDateString()}</p>`;
    
    const originalMode = activePrintMode;
    const originalList = gymRegistryBook;
    
    gymRegistryBook = [match]; 
    activePrintMode = "All"; 
    renderLogBook();
    
    const wrapper = document.getElementById('ledgerTableWrapper');
    const wasHidden = wrapper.classList.contains('hidden');
    if (wasHidden) wrapper.classList.remove('hidden');
    document.getElementById('inputFormPanel').classList.add('hidden');
    
    window.print();
    
    if (wasHidden) wrapper.classList.add('hidden');
    document.getElementById('inputFormPanel').classList.remove('hidden');
    document.getElementById('printReportHeader').innerHTML = `<h2>SPRINGFIELD GYM - AUDIT SHEET</h2><p>Report Framework Generated On: <span id="livePrintTimestamp"></span></p>`;
    document.title = "Springfield Gym - Shared System";
    
    gymRegistryBook = originalList; 
    activePrintMode = originalMode; 
    renderLogBook();
    document.body.classList.remove('hide-print-totals');
}

function printDailyAudit() {
    const selectedDate = document.getElementById('datePaid').value;
    if (!selectedDate) return alert("Select a date in the form input box first.");
    evaluateFinancialPrintState();
    
    document.title = "Daily_Audit_" + selectedDate;
    activePrintMode = "Daily"; 
    targetPrintDate = selectedDate;
    document.getElementById('livePrintTimestamp').innerText = selectedDate;
    
    const wrapper = document.getElementById('ledgerTableWrapper');
    const wasHidden = wrapper.classList.contains('hidden');
    if (wasHidden) wrapper.classList.remove('hidden');
    
    renderLogBook(); 
    window.print();
    
    if (wasHidden) wrapper.classList.add('hidden');
    activePrintMode = "All"; 
    renderLogBook();
    document.body.classList.remove('hide-print-totals');
    document.title = "Springfield Gym - Shared System";
}

function printMonthlyAudit() {
    const selectedDate = document.getElementById('datePaid').value;
    if (!selectedDate) return alert("Select a date within the target month first.");
    evaluateFinancialPrintState();
    
    const yearMonth = selectedDate.substring(0, 7);
    document.title = "Monthly_Audit_" + yearMonth;
    activePrintMode = "Monthly"; 
    targetPrintDate = selectedDate;
    document.getElementById('livePrintTimestamp').innerText = "Month View: " + yearMonth;
    
    const wrapper = document.getElementById('ledgerTableWrapper');
    const wasHidden = wrapper.classList.contains('hidden');
    if (wasHidden) wrapper.classList.remove('hidden');
    
    renderLogBook(); 
    window.print();
    
    if (wasHidden) wrapper.classList.add('hidden');
    activePrintMode = "All"; 
    renderLogBook();
    document.body.classList.remove('hide-print-totals');
    document.title = "Springfield Gym - Shared System";
}
