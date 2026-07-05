// ============================================================
// CONFIGURATION
// ============================================================
const CONFIG = {
    ADMIN_PASSWORD: 'admin123',
    INVOICE_PREFIX: 'AIIS',
    INVOICE_SEPARATOR: '/',
    PADDING_LENGTH: 3,
    SESSION_TIMEOUT: 60,
};

// ============================================================
// STATE
// ============================================================
let state = {
    items: [],
    paymentRefs: [],
    currentInvoiceNumber: null,
    auth: false,
};

// ============================================================
// AUTHENTICATION (unchanged)
// ============================================================
function checkAuth() {
    const auth = sessionStorage.getItem('invoice_auth');
    if (auth === 'true') {
        state.auth = true;
        document.getElementById('auth-overlay').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        initApp();
        startSessionTimer();
    }
}

function handleLogin() {
    const password = document.getElementById('password-input').value;
    if (password === CONFIG.ADMIN_PASSWORD) {
        state.auth = true;
        sessionStorage.setItem('invoice_auth', 'true');
        sessionStorage.setItem('invoice_login_time', Date.now().toString());
        document.getElementById('auth-overlay').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        document.getElementById('auth-error').style.display = 'none';
        initApp();
        startSessionTimer();
    } else {
        document.getElementById('auth-error').style.display = 'block';
        document.getElementById('password-input').value = '';
        document.getElementById('password-input').focus();
    }
}

function handleLogout() {
    sessionStorage.removeItem('invoice_auth');
    sessionStorage.removeItem('invoice_login_time');
    state.auth = false;
    document.getElementById('app').style.display = 'none';
    document.getElementById('auth-overlay').style.display = 'flex';
    document.getElementById('password-input').value = '';
    document.getElementById('auth-error').style.display = 'none';
}

function startSessionTimer() {
    const loginTime = parseInt(sessionStorage.getItem('invoice_login_time'));
    const now = Date.now();
    const elapsed = (now - loginTime) / (1000 * 60);
    
    if (elapsed > CONFIG.SESSION_TIMEOUT) {
        handleLogout();
        alert('Session expired. Please login again.');
        return;
    }
    
    setInterval(() => {
        const loginTime2 = parseInt(sessionStorage.getItem('invoice_login_time'));
        const now2 = Date.now();
        const elapsed2 = (now2 - loginTime2) / (1000 * 60);
        if (elapsed2 > CONFIG.SESSION_TIMEOUT) {
            handleLogout();
            alert('Session expired. Please login again.');
        }
    }, 60000);
}

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('password-input').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            handleLogin();
        }
    });
    
    document.getElementById('auth-btn').addEventListener('click', handleLogin);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    
    checkAuth();
});

// ============================================================
// INVOICE NUMBER MANAGEMENT
// ============================================================
async function getNextInvoiceNumber() {
    try {
        const response = await fetch('/api/invoice');
        const data = await response.json();
        if (data.success) {
            state.currentInvoiceNumber = data.invoice_number;
            document.getElementById('invoice-number').textContent = data.invoice_number;
            return data;
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        console.error('Error fetching invoice number:', error);
        return getLocalInvoiceNumber();
    }
}

function getLocalInvoiceNumber() {
    let lastId = parseInt(localStorage.getItem('invoice_last_id') || '0');
    const nextId = lastId + 1;
    const invoiceNumber = generateInvoiceNumber(nextId);
    localStorage.setItem('invoice_last_id', nextId.toString());
    state.currentInvoiceNumber = invoiceNumber;
    document.getElementById('invoice-number').textContent = invoiceNumber;
    return { invoice_number: invoiceNumber, id: nextId };
}

function generateInvoiceNumber(id) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const datePart = `${year}${month}${day}`;
    const paddedId = String(id).padStart(CONFIG.PADDING_LENGTH, '0');
    return `${CONFIG.INVOICE_PREFIX}${CONFIG.INVOICE_SEPARATOR}${datePart}${CONFIG.INVOICE_SEPARATOR}${paddedId}`;
}

// ============================================================
// ITEM MANAGEMENT
// ============================================================
function addItem(description = '', qty = 1, rate = 0, discount = 0) {
    state.items.push({ description, qty, rate, discount });
    renderItems();
    calculateTotals();
}

function removeItem(index) {
    state.items.splice(index, 1);
    renderItems();
    calculateTotals();
}

function renderItems() {
    const tbody = document.getElementById('items-body');
    tbody.innerHTML = '';
    
    state.items.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="text-center">${index + 1}</td>
            <td>
                <input type="text" class="item-desc" value="${escapeHtml(item.description)}" data-index="${index}" placeholder="Item description">
            </td>
            <td>
                <input type="number" class="item-qty" value="${item.qty}" data-index="${index}" step="1" min="1">
            </td>
            <td>
                <input type="number" class="item-rate" value="${item.rate}" data-index="${index}" step="0.01" min="0">
            </td>
            <td>
                <input type="number" class="item-discount" value="${item.discount}" data-index="${index}" step="1" min="0" max="100">
            </td>
            <td class="item-amount text-right">${formatCurrency(calculateItemTotal(item))}</td>
            <td class="text-center">
                <button type="button" class="remove-item-btn" data-index="${index}">×</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    document.querySelectorAll('.item-desc, .item-qty, .item-rate, .item-discount').forEach(input => {
        input.addEventListener('input', function() {
            const index = parseInt(this.dataset.index);
            const field = this.className.split('-')[1];
            if (field === 'desc') {
                state.items[index].description = this.value;
            } else {
                state.items[index][field] = parseFloat(this.value) || 0;
                calculateTotals();
                renderItems();
            }
        });
    });
    
    document.querySelectorAll('.remove-item-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            removeItem(index);
        });
    });
}

function calculateItemTotal(item) {
    const subtotal = item.qty * item.rate;
    const discountAmount = subtotal * (item.discount / 100);
    return subtotal - discountAmount;
}

// ============================================================
// PAYMENT REFERENCES MANAGEMENT
// ============================================================
function addPaymentRef(bank = '', account = '') {
    state.paymentRefs.push({ bank, account });
    renderPaymentRefs();
}

function removePaymentRef(index) {
    state.paymentRefs.splice(index, 1);
    renderPaymentRefs();
}

function renderPaymentRefs() {
    const tbody = document.getElementById('refs-body');
    tbody.innerHTML = '';
    
    state.paymentRefs.forEach((ref, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="text-center">${index + 1}</td>
            <td>
                <input type="text" class="ref-bank" value="${escapeHtml(ref.bank)}" data-index="${index}" placeholder="Bank Name">
            </td>
            <td>
                <input type="text" class="ref-account" value="${escapeHtml(ref.account)}" data-index="${index}" placeholder="Account Number">
            </td>
            <td class="text-center">
                <button type="button" class="remove-ref-btn" data-index="${index}">×</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    document.querySelectorAll('.ref-bank, .ref-account').forEach(input => {
        input.addEventListener('input', function() {
            const index = parseInt(this.dataset.index);
            const field = this.className.split('-')[1];
            state.paymentRefs[index][field] = this.value;
        });
    });
    
    document.querySelectorAll('.remove-ref-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            removePaymentRef(index);
        });
    });
}

// ============================================================
// CALCULATIONS
// ============================================================
function calculateTotals() {
    const currency = document.getElementById('currency').value;
    let subtotal = 0;
    let totalDiscount = 0;
    
    state.items.forEach(item => {
        const itemSubtotal = item.qty * item.rate;
        const itemDiscount = itemSubtotal * (item.discount / 100);
        subtotal += itemSubtotal;
        totalDiscount += itemDiscount;
    });
    
    const grandTotal = subtotal - totalDiscount;
    
    document.getElementById('subtotal').textContent = `${currency}${subtotal.toFixed(2)}`;
    document.getElementById('total-discount').textContent = `${currency}${totalDiscount.toFixed(2)}`;
    document.getElementById('grand-total').textContent = `${currency}${grandTotal.toFixed(2)}`;
    
    return { subtotal, totalDiscount, grandTotal };
}

function formatCurrency(amount) {
    const currency = document.getElementById('currency').value;
    return `${currency}${amount.toFixed(2)}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================
// GENERATE INVOICE
// ============================================================
function generateInvoice() {
    const clientName = document.getElementById('client-name').value.trim();
    if (!clientName) {
        alert('Please enter a client name.');
        document.getElementById('client-name').focus();
        return;
    }
    
    if (state.items.length === 0 || state.items.every(item => item.rate === 0)) {
        alert('Please add at least one item with a rate.');
        return;
    }
    
    const clientEmail = document.getElementById('client-email').value.trim();
    const clientAddress = document.getElementById('client-address').value.trim();
    const invoiceDate = document.getElementById('invoice-date').value;
    const dueDate = document.getElementById('due-date').value;
    const currency = document.getElementById('currency').value;
    const totals = calculateTotals();
    
    const formattedDate = invoiceDate ? formatDate(invoiceDate) : '--';
    const formattedDueDate = dueDate ? formatDate(dueDate) : '--';
    
    // Update invoice template
    document.getElementById('render-inv-num').textContent = state.currentInvoiceNumber;
    document.getElementById('render-date').textContent = formattedDate;
    document.getElementById('render-due').textContent = formattedDueDate;
    document.getElementById('render-currency').textContent = currency;
    document.getElementById('render-client-name').textContent = clientName || 'Client Company / Name';
    document.getElementById('render-client-address').textContent = clientAddress || 'Client Address Line';
    document.getElementById('render-client-email').textContent = clientEmail || 'client@email.com';
    document.getElementById('render-subtotal').textContent = `${currency}${totals.subtotal.toFixed(2)}`;
    document.getElementById('render-total').textContent = `${currency}${totals.grandTotal.toFixed(2)}`;
    
    // Render items in template
    const tbody = document.getElementById('render-rows');
    tbody.innerHTML = '';
    state.items.forEach((item, index) => {
        const tr = document.createElement('tr');
        const amount = calculateItemTotal(item);
        tr.innerHTML = `
            <td class="text-center">${index + 1}</td>
            <td>${escapeHtml(item.description) || '-'}</td>
            <td class="text-center">${item.qty}</td>
            <td class="text-right">${item.rate.toFixed(2)}</td>
            <td class="text-center">${item.discount}%</td>
            <td class="text-right">${formatCurrency(amount)}</td>
        `;
        tbody.appendChild(tr);
    });
    
    // Render payment references
    const refsContainer = document.getElementById('render-payment-refs');
    refsContainer.innerHTML = '';
    if (state.paymentRefs.length === 0) {
        // Default payment info if no refs added
        refsContainer.innerHTML = `
            <p><strong>Bank Name:</strong> First City Monument Bank</p>
            <p><strong>Account Number:</strong> 2007876467</p>
            <p><strong>Account Name:</strong> ACE ICT INTEGRATED HUB</p>
        `;
    } else {
        state.paymentRefs.forEach(ref => {
            const p = document.createElement('p');
            if (ref.bank && ref.account) {
                p.innerHTML = `<strong>${escapeHtml(ref.bank)}:</strong> ${escapeHtml(ref.account)}`;
            } else if (ref.bank) {
                p.textContent = ref.bank;
            } else if (ref.account) {
                p.textContent = ref.account;
            }
            refsContainer.appendChild(p);
        });
    }
    
    // Show invoice container
    document.getElementById('invoice-container').style.display = 'block';
    document.getElementById('preview-status').textContent = '✅ Generated';
    document.getElementById('preview-status').className = 'preview-status active';
    
    // Enable download buttons
    document.getElementById('download-pdf-btn').disabled = false;
    document.getElementById('download-png-btn').disabled = false;
    
    // Fetch next invoice number
    getNextInvoiceNumber();
}

function formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}



function downloadPDF() {
    const element = document.getElementById('invoice-template');
    const invoiceNum = state.currentInvoiceNumber || 'invoice';
    const safeFilename = invoiceNum.replace(/\//g, '-');
    
    const btn = document.getElementById('download-pdf-btn');
    const originalText = btn.textContent;
    btn.textContent = '⏳ Generating PDF...';
    btn.disabled = true;
    
    html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: element.scrollWidth,
        height: element.scrollHeight,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight
    }).then(canvas => {
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        
        const imgWidth = 210;
        const pageHeight = 297;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        
        let heightLeft = imgHeight;
        let position = 0;
        
        doc.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        
        while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            doc.addPage();
            doc.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }
        
        doc.save(`Invoice_${safeFilename}.pdf`);
        
        btn.textContent = originalText;
        btn.disabled = false;
    }).catch(error => {
        console.error('PDF generation error:', error);
        alert('Error generating PDF. Please try again or use PNG export.');
        btn.textContent = originalText;
        btn.disabled = false;
    });
}

function downloadPNG() {
    const element = document.getElementById('invoice-template');
    const invoiceNum = state.currentInvoiceNumber || 'invoice';
    const safeFilename = invoiceNum.replace(/\//g, '-');
    
    html2canvas(element, { 
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `Invoice_${safeFilename}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    });
}


function resetCounter() {
    if (confirm('⚠️ Are you sure you want to reset the invoice counter?\n\nThis will set the next invoice number to AIIS/YYYYMMDD/001.\n\nAre you sure?')) {
        const confirmAgain = confirm('⚠️⚠️ FINAL WARNING:\n\nThis action cannot be undone.\n\nContinue?');
        if (confirmAgain) {
            localStorage.setItem('invoice_last_id', '0');
            getLocalInvoiceNumber();
            alert('✅ Counter reset successfully!\n\nNext invoice number: ' + state.currentInvoiceNumber);
        }
    }
}


function initApp() {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    document.getElementById('invoice-date').value = todayStr;
    
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + 14);
    document.getElementById('due-date').value = dueDate.toISOString().slice(0, 10);
    
    getNextInvoiceNumber();
    
    
    addItem('', 1, 0, 0);
    
    // Add first payment reference (optional - you can leave empty)
    // addPaymentRef('', '');
    
    // Event listeners
    document.getElementById('add-item-btn').addEventListener('click', function() {
        addItem('', 1, 0, 0);
    });
    
    document.getElementById('add-ref-btn').addEventListener('click', function() {
        addPaymentRef('', '');
    });
    
    document.getElementById('generate-btn').addEventListener('click', generateInvoice);
    document.getElementById('download-pdf-btn').addEventListener('click', downloadPDF);
    document.getElementById('download-png-btn').addEventListener('click', downloadPNG);
    document.getElementById('reset-counter-btn').addEventListener('click', resetCounter);
    
    document.getElementById('currency').addEventListener('change', function() {
        calculateTotals();
        if (document.getElementById('invoice-container').style.display !== 'none') {
            generateInvoice();
        }
    });
    
    console.log('✅ Invoice System initialized');
    console.log('📄 Next Invoice:', state.currentInvoiceNumber);
}