// ============================================================
// CONFIGURATION
// ============================================================
const CONFIG = {
    ADMIN_PASSWORD: 'Admin_Invoice',
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
// AUTHENTICATION
// ============================================================
function checkAuth() {
    const auth = sessionStorage.getItem('invoice_auth');
    if (auth === 'true') {
        state.auth = true;
        const overlay = document.getElementById('auth-overlay');
        const app = document.getElementById('app');
        if (overlay) overlay.style.display = 'none';
        if (app) app.style.display = 'block';
        initApp();
        startSessionTimer();
    }
}

function handleLogin() {
    const passwordInput = document.getElementById('password-input');
    if (!passwordInput) return;
    
    const password = passwordInput.value;
    if (password === CONFIG.ADMIN_PASSWORD) {
        state.auth = true;
        sessionStorage.setItem('invoice_auth', 'true');
        sessionStorage.setItem('invoice_login_time', Date.now().toString());
        
        const overlay = document.getElementById('auth-overlay');
        const app = document.getElementById('app');
        const error = document.getElementById('auth-error');
        
        if (overlay) overlay.style.display = 'none';
        if (app) app.style.display = 'block';
        if (error) error.style.display = 'none';
        
        initApp();
        startSessionTimer();
    } else {
        const error = document.getElementById('auth-error');
        if (error) error.style.display = 'block';
        if (passwordInput) {
            passwordInput.value = '';
            passwordInput.focus();
        }
    }
}

function handleLogout() {
    sessionStorage.removeItem('invoice_auth');
    sessionStorage.removeItem('invoice_login_time');
    state.auth = false;
    
    const app = document.getElementById('app');
    const overlay = document.getElementById('auth-overlay');
    const passwordInput = document.getElementById('password-input');
    const error = document.getElementById('auth-error');
    
    if (app) app.style.display = 'none';
    if (overlay) overlay.style.display = 'flex';
    if (passwordInput) passwordInput.value = '';
    if (error) error.style.display = 'none';
}

function startSessionTimer() {
    const loginTime = parseInt(sessionStorage.getItem('invoice_login_time'));
    if (!loginTime) return;
    
    const now = Date.now();
    const elapsed = (now - loginTime) / (1000 * 60);
    
    if (elapsed > CONFIG.SESSION_TIMEOUT) {
        handleLogout();
        alert('Session expired. Please login again.');
        return;
    }
    
    setInterval(() => {
        const loginTime2 = parseInt(sessionStorage.getItem('invoice_login_time'));
        if (!loginTime2) return;
        const now2 = Date.now();
        const elapsed2 = (now2 - loginTime2) / (1000 * 60);
        if (elapsed2 > CONFIG.SESSION_TIMEOUT) {
            handleLogout();
            alert('Session expired. Please login again.');
        }
    }, 60000);
}

// DOM Ready - Auth Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    const passwordInput = document.getElementById('password-input');
    const authBtn = document.getElementById('auth-btn');
    const logoutBtn = document.getElementById('logout-btn');
    
    if (passwordInput) {
        passwordInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                handleLogin();
            }
        });
    }
    
    if (authBtn) {
        authBtn.addEventListener('click', handleLogin);
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
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
            const display = document.getElementById('invoice-number');
            if (display) display.textContent = data.invoice_number;
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
    const display = document.getElementById('invoice-number');
    if (display) display.textContent = invoiceNumber;
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
// HELPER FUNCTIONS
// ============================================================
function getCurrency() {
    const el = document.getElementById('currency');
    return el ? el.value : '₦';
}

function formatCurrency(amount) {
    const currency = getCurrency();
    return `${currency}${amount.toFixed(2)}`;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '--';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
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
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    state.items.forEach((item, index) => {
        const tr = document.createElement('tr');
        const amount = calculateItemTotal(item);
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
            <td class="item-amount text-right">${formatCurrency(amount)}</td>
            <td class="text-center">
                <button type="button" class="remove-item-btn" data-index="${index}">×</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    // Event listeners - use event delegation instead
    tbody.querySelectorAll('.item-desc, .item-qty, .item-rate, .item-discount').forEach(input => {
        input.removeEventListener('input', handleItemInput);
        input.addEventListener('input', handleItemInput);
    });
    
    tbody.querySelectorAll('.remove-item-btn').forEach(btn => {
        btn.removeEventListener('click', handleRemoveItem);
        btn.addEventListener('click', handleRemoveItem);
    });
}

function handleItemInput(e) {
    const input = e.target;
    const index = parseInt(input.dataset.index);
    const className = input.className;
    const field = className.includes('desc') ? 'desc' : 
                  className.includes('qty') ? 'qty' : 
                  className.includes('rate') ? 'rate' : 'discount';
    
    if (field === 'desc') {
        state.items[index].description = input.value;
    } else {
        state.items[index][field] = parseFloat(input.value) || 0;
        calculateTotals();
        // Update the amount column for this row
        const row = input.closest('tr');
        const amountCell = row.querySelector('.item-amount');
        if (amountCell) {
            const amount = calculateItemTotal(state.items[index]);
            amountCell.textContent = formatCurrency(amount);
        }
    }
}

function handleRemoveItem(e) {
    const index = parseInt(e.target.dataset.index);
    removeItem(index);
}

function calculateItemTotal(item) {
    const subtotal = (item.qty || 0) * (item.rate || 0);
    const discountAmount = subtotal * ((item.discount || 0) / 100);
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
    if (!tbody) return;
    
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
    
    tbody.querySelectorAll('.ref-bank, .ref-account').forEach(input => {
        input.removeEventListener('input', handleRefInput);
        input.addEventListener('input', handleRefInput);
    });
    
    tbody.querySelectorAll('.remove-ref-btn').forEach(btn => {
        btn.removeEventListener('click', handleRemoveRef);
        btn.addEventListener('click', handleRemoveRef);
    });
}

function handleRefInput(e) {
    const input = e.target;
    const index = parseInt(input.dataset.index);
    const field = input.className.includes('bank') ? 'bank' : 'account';
    state.paymentRefs[index][field] = input.value;
}

function handleRemoveRef(e) {
    const index = parseInt(e.target.dataset.index);
    removePaymentRef(index);
}

// ============================================================
// CALCULATIONS
// ============================================================
function calculateTotals() {
    const currency = getCurrency();
    let subtotal = 0;
    let totalDiscount = 0;
    
    state.items.forEach(item => {
        const itemSubtotal = (item.qty || 0) * (item.rate || 0);
        const itemDiscount = itemSubtotal * ((item.discount || 0) / 100);
        subtotal += itemSubtotal;
        totalDiscount += itemDiscount;
    });
    
    const grandTotal = subtotal - totalDiscount;
    
    const subtotalEl = document.getElementById('subtotal');
    const discountEl = document.getElementById('total-discount');
    const grandTotalEl = document.getElementById('grand-total');
    
    if (subtotalEl) subtotalEl.textContent = `${currency}${subtotal.toFixed(2)}`;
    if (discountEl) discountEl.textContent = `${currency}${totalDiscount.toFixed(2)}`;
    if (grandTotalEl) grandTotalEl.textContent = `${currency}${grandTotal.toFixed(2)}`;
    
    return { subtotal, totalDiscount, grandTotal };
}

// ============================================================
// GENERATE INVOICE
// ============================================================
function generateInvoice() {
    const clientName = document.getElementById('client-name');
    if (!clientName) {
        alert('Client name field not found.');
        return;
    }
    
    const name = clientName.value.trim();
    if (!name) {
        alert('Please enter a client name.');
        clientName.focus();
        return;
    }
    
    if (state.items.length === 0 || state.items.every(item => (item.rate || 0) === 0)) {
        alert('Please add at least one item with a rate.');
        return;
    }
    
    const clientEmail = document.getElementById('client-email');
    const clientAddress = document.getElementById('client-address');
    const invoiceDate = document.getElementById('invoice-date');
    const dueDate = document.getElementById('due-date');
    const currency = getCurrency();
    const totals = calculateTotals();
    
    const formattedDate = invoiceDate ? formatDate(invoiceDate.value) : '--';
    const formattedDueDate = dueDate ? formatDate(dueDate.value) : '--';
    
    // Update invoice template - with null checks
    const renderInvNum = document.getElementById('render-inv-num');
    const renderDate = document.getElementById('render-date');
    const renderDue = document.getElementById('render-due');
    const renderCurrency = document.getElementById('render-currency');
    const renderClientName = document.getElementById('render-client-name');
    const renderClientAddress = document.getElementById('render-client-address');
    const renderClientEmail = document.getElementById('render-client-email');
    const renderSubtotal = document.getElementById('render-subtotal');
    const renderTotal = document.getElementById('render-total');
    
    if (renderInvNum) renderInvNum.textContent = state.currentInvoiceNumber || 'AIIS/20260101/001';
    if (renderDate) renderDate.textContent = formattedDate;
    if (renderDue) renderDue.textContent = formattedDueDate;
    if (renderCurrency) renderCurrency.textContent = currency;
    if (renderClientName) renderClientName.textContent = name || 'Client Company / Name';
    if (renderClientAddress) renderClientAddress.textContent = (clientAddress ? clientAddress.value : '') || 'Client Address Line';
    if (renderClientEmail) renderClientEmail.textContent = (clientEmail ? clientEmail.value : '') || 'client@email.com';
    if (renderSubtotal) renderSubtotal.textContent = `${currency}${totals.subtotal.toFixed(2)}`;
    if (renderTotal) renderTotal.textContent = `${currency}${totals.grandTotal.toFixed(2)}`;
    
    // Render items in template
    const tbody = document.getElementById('render-rows');
    if (tbody) {
        tbody.innerHTML = '';
        state.items.forEach((item, index) => {
            const tr = document.createElement('tr');
            const amount = calculateItemTotal(item);
            tr.innerHTML = `
                <td class="text-center">${index + 1}</td>
                <td>${escapeHtml(item.description) || '-'}</td>
                <td class="text-center">${item.qty || 0}</td>
                <td class="text-right">${(item.rate || 0).toFixed(2)}</td>
                <td class="text-center">${(item.discount || 0)}%</td>
                <td class="text-right">${formatCurrency(amount)}</td>
            `;
            tbody.appendChild(tr);
        });
    }
    
    // Render payment references
    const refsContainer = document.getElementById('render-payment-refs');
    if (refsContainer) {
        refsContainer.innerHTML = '';
        if (state.paymentRefs.length === 0) {
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
    }
    
    // Show invoice container
    const container = document.getElementById('invoice-container');
    if (container) container.style.display = 'block';
    
    const status = document.getElementById('preview-status');
    if (status) {
        status.textContent = '✅ Generated';
        status.className = 'preview-status active';
    }
    
    // Enable download buttons
    const pdfBtn = document.getElementById('download-pdf-btn');
    const pngBtn = document.getElementById('download-png-btn');
    if (pdfBtn) pdfBtn.disabled = false;
    if (pngBtn) pngBtn.disabled = false;
    
    // Fetch next invoice number
    getNextInvoiceNumber();
}

// ============================================================
// EXPORT FUNCTIONS - FIXED PDF
// ============================================================
function downloadPDF() {
    const element = document.getElementById('invoice-template');
    if (!element) {
        alert('Invoice template not found. Please generate the invoice first.');
        return;
    }
    
    const invoiceNum = state.currentInvoiceNumber || 'invoice';
    const safeFilename = invoiceNum.replace(/\//g, '-');
    
    const btn = document.getElementById('download-pdf-btn');
    if (btn) {
        btn.textContent = '⏳ Generating PDF...';
        btn.disabled = true;
    }
    
    // Check if jsPDF is loaded
    if (typeof window.jspdf === 'undefined') {
        alert('PDF library not loaded. Please check your internet connection and refresh.');
        if (btn) {
            btn.textContent = '📥 Download PDF';
            btn.disabled = false;
        }
        return;
    }
    
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
        
        if (btn) {
            btn.textContent = '📥 Download PDF';
            btn.disabled = false;
        }
    }).catch(error => {
        console.error('PDF generation error:', error);
        alert('Error generating PDF. Please try again or use PNG export.');
        if (btn) {
            btn.textContent = '📥 Download PDF';
            btn.disabled = false;
        }
    });
}

function downloadPNG() {
    const element = document.getElementById('invoice-template');
    if (!element) {
        alert('Invoice template not found. Please generate the invoice first.');
        return;
    }
    
    const invoiceNum = state.currentInvoiceNumber || 'invoice';
    const safeFilename = invoiceNum.replace(/\//g, '-');
    
    const btn = document.getElementById('download-png-btn');
    if (btn) {
        btn.textContent = '⏳ Generating PNG...';
        btn.disabled = true;
    }
    
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
        if (btn) {
            btn.textContent = '🖼️ Download PNG';
            btn.disabled = false;
        }
    }).catch(error => {
        console.error('PNG generation error:', error);
        alert('Error generating PNG. Please try again.');
        if (btn) {
            btn.textContent = '🖼️ Download PNG';
            btn.disabled = false;
        }
    });
}

// ============================================================
// RESET COUNTER
// ============================================================
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

// ============================================================
// INITIALIZATION
// ============================================================
function initApp() {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    
    const invoiceDate = document.getElementById('invoice-date');
    if (invoiceDate) invoiceDate.value = todayStr;
    
    const dueDate = document.getElementById('due-date');
    if (dueDate) {
        const due = new Date(today);
        due.setDate(due.getDate() + 14);
        dueDate.value = due.toISOString().slice(0, 10);
    }
    
    getNextInvoiceNumber();
    addItem('', 1, 0, 0);
    
    // Add event listeners - with null checks
    const addItemBtn = document.getElementById('add-item-btn');
    if (addItemBtn) {
        addItemBtn.addEventListener('click', function() {
            addItem('', 1, 0, 0);
        });
    }
    
    const addRefBtn = document.getElementById('add-ref-btn');
    if (addRefBtn) {
        addRefBtn.addEventListener('click', function() {
            addPaymentRef('', '');
        });
    }
    
    const generateBtn = document.getElementById('generate-btn');
    if (generateBtn) {
        generateBtn.addEventListener('click', generateInvoice);
    }
    
    const pdfBtn = document.getElementById('download-pdf-btn');
    if (pdfBtn) {
        pdfBtn.addEventListener('click', downloadPDF);
    }
    
    const pngBtn = document.getElementById('download-png-btn');
    if (pngBtn) {
        pngBtn.addEventListener('click', downloadPNG);
    }
    
    const resetBtn = document.getElementById('reset-counter-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetCounter);
    }
    
    const currencyEl = document.getElementById('currency');
    if (currencyEl) {
        currencyEl.addEventListener('change', function() {
            calculateTotals();
            const container = document.getElementById('invoice-container');
            if (container && container.style.display !== 'none') {
                generateInvoice();
            }
        });
    }
    
    console.log('✅ Invoice System initialized');
    console.log('📄 Next Invoice:', state.currentInvoiceNumber);
}