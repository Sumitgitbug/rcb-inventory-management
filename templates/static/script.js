// --- App State ---
const API = location.origin.startsWith('http') ? location.origin : 'http://127.0.0.1:5000';
const $ = id => document.getElementById(id);
const bootstrap = window.bootstrap;

const state = {
  assets: [],
  employees: [],
  issues: [],
  transfers: [],
  categories: [],
  subcategories: [],
};

let preferredCategoryId = '';
let editingAssetId = null;
let editingEmployeeId = null;
let editingIssueId = null;
let editingTransferId = null;
let filePreviewModalInstance = null;

const VIEW_LABELS = {
  'assets-overview': 'Assets',
  'stock-view': 'Stock View',
  'add-asset': 'Add Asset',
  'employees': 'Employee',
  'issue-return': 'Issue / Return',
  'transfer': 'Transfer',
};

let assetInvoiceObjectUrl = '';

// --- Initial Defaults ---
const today = () => new Date().toISOString().slice(0, 10);
$('assetPurchaseDate').value = today();
$('issueDate').value = today();
$('transferDate').value = today();

// --- API Helper ---
async function api(path, options) {
  const res = await fetch(`${API}${path}`, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// --- Small Helpers ---
function badge(status) {
  return status === 'WORKING'
    ? 'bg-success'
    : status === 'FAULTY'
      ? 'bg-danger'
      : status === 'ISSUED'
        ? 'bg-warning text-dark'
        : 'bg-secondary';
}

function clearInvoicePreviewObjectUrl() {
  if (assetInvoiceObjectUrl) {
    URL.revokeObjectURL(assetInvoiceObjectUrl);
    assetInvoiceObjectUrl = '';
  }
}

function isPdfUrl(url) {
  return String(url || '').toLowerCase().split('?')[0].endsWith('.pdf');
}

function getFileNameFromUrl(url) {
  const clean = String(url || '').split('?')[0];
  return clean.split('/').pop() || 'file';
}

function toastClass(variant) {
  return variant === 'success'
    ? 'text-bg-success'
    : variant === 'warning'
      ? 'text-bg-warning'
      : variant === 'danger'
        ? 'text-bg-danger'
        : 'text-bg-primary';
}

function showToast(message, variant = 'success') {
  const container = $('toastContainer');
  if (!container || !window.bootstrap) return;

  const node = document.createElement('div');
  node.className = `toast align-items-center ${toastClass(variant)} border-0`;
  node.setAttribute('role', 'alert');
  node.setAttribute('aria-live', 'assertive');
  node.setAttribute('aria-atomic', 'true');
  node.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${message}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
  `;
  container.appendChild(node);

  const toast = bootstrap.Toast.getOrCreateInstance(node, { delay: 2600 });
  node.addEventListener('hidden.bs.toast', () => node.remove(), { once: true });
  toast.show();
}

function ensureFilePreviewModal() {
  if (!filePreviewModalInstance && $('filePreviewModal') && window.bootstrap) {
    filePreviewModalInstance = bootstrap.Modal.getOrCreateInstance($('filePreviewModal'));
  }
  return filePreviewModalInstance;
}

function openFilePreview(url, title) {
  const body = $('filePreviewBody');
  const titleEl = $('filePreviewTitle');
  if (!body || !titleEl) return;

  const safeUrl = String(url || '');
  const fileTitle = title || getFileNameFromUrl(safeUrl);
  titleEl.textContent = fileTitle;
  body.innerHTML = isPdfUrl(safeUrl)
    ? `<iframe src="${safeUrl}" title="${fileTitle}" class="file-preview-frame"></iframe>`
    : `<img src="${safeUrl}" alt="${fileTitle}" class="file-preview-image">`;

  const modal = ensureFilePreviewModal();
  if (modal) modal.show();
}

function assetLabel(asset) {
  return `${String(asset.asset_id).padStart(3, '0')} | ${asset.category_name} / ${asset.subcategory_name} / ${asset.serial_no}`;
}

function employeeLabel(employee) {
  return `#${employee.employee_id} - ${employee.employee_name} (${employee.employee_code})`;
}

function setOptions(selectId, items, placeholder, selectedValue = '') {
  const select = $(selectId);
  const current = String(selectedValue || select.value || '');
  const options = [`<option value="">${placeholder}</option>`]
    .concat(items.map(item => `<option value="${item.value}">${item.label}</option>`))
    .join('');
  select.innerHTML = options;

  if (current && items.some(item => String(item.value) === current)) {
    select.value = current;
  }
}

// --- View Switching ---
function showView(viewName) {
  const panel = document.querySelector(`[data-view-panel="${viewName}"]`);
  if (!panel) return;

  document.querySelectorAll('[data-view-panel]').forEach(el => {
    el.classList.toggle('active-view', el === panel);
  });
  document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });
  const assetsToggle = $('assetsNavToggle');
  const assetsSubmenu = $('assetsSubmenu');
  if (assetsToggle && assetsSubmenu) {
    const parentActive = viewName === 'assets-overview' || viewName === 'stock-view';
    assetsToggle.classList.toggle('active', parentActive);
    if (viewName === 'assets-overview' || viewName === 'stock-view') {
      assetsSubmenu.classList.add('open');
      assetsToggle.setAttribute('aria-expanded', 'true');
    } else if (!parentActive) {
      assetsSubmenu.classList.remove('open');
      assetsToggle.setAttribute('aria-expanded', 'false');
    }
  }

  document.title = `${VIEW_LABELS[viewName] || 'Inventory'} - Inventory Dashboard`;
  history.replaceState(null, '', `#${viewName}`);
}

// --- Renderers ---
function renderCategorySelects() {
  const categories = state.categories.map(x => ({ value: x.category_id, label: x.category_name }));
  setOptions('assetCategory', categories, 'Select Category', $('assetCategory').value || preferredCategoryId);
  setOptions('filterCategory', categories, 'All Categories', $('filterCategory').value);
  setOptions('stockFilterCategory', categories, 'All Categories', $('stockFilterCategory').value);
  renderStockSubcategorySelects();
}

function renderStockSubcategorySelects() {
  const selectedCategory = $('stockFilterCategory').value;
  const subcategories = state.assets
    .filter(asset => !selectedCategory || String(asset.category_id) === selectedCategory)
    .reduce((acc, asset) => {
      const key = String(asset.subcategory_id);
      if (!acc.some(item => String(item.value) === key)) {
        acc.push({ value: asset.subcategory_id, label: asset.subcategory_name });
      }
      return acc;
    }, [])
    .sort((a, b) => a.label.localeCompare(b.label));

  setOptions('stockFilterSubcategory', subcategories, 'All Subcategories', $('stockFilterSubcategory').value);
}

function renderSubcategorySelects() {
  const selectedCategory = $('assetCategory').value;
  if (!selectedCategory) {
    $('assetSubcategory').innerHTML = '<option value="">Select Subcategory</option>';
    return;
  }

  const subs = state.subcategories.map(x => ({ value: x.subcategory_id, label: x.subcategory_name }));
  setOptions('assetSubcategory', subs, 'Select Subcategory', $('assetSubcategory').value);
}

function renderEmployeeSelects() {
  const items = state.employees.map(e => ({ value: e.employee_id, label: employeeLabel(e) }));
  setOptions('issueEmployee', items, 'Select Employee', $('issueEmployee').value);
  setOptions('transferFromEmployee', items, 'Optional', $('transferFromEmployee').value);
  setOptions('transferToEmployee', items, 'Optional', $('transferToEmployee').value);
}

function renderAssetPickers() {
  const items = state.assets.map(a => ({ value: a.asset_id, label: assetLabel(a) }));
  setOptions('issueAsset', items, 'Select Asset', $('issueAsset').value);
  setOptions('transferAsset', items, 'Select Asset', $('transferAsset').value);
}

function renderAssets() {
  const q = $('searchAsset').value.trim().toLowerCase();
  const cat = $('filterCategory').value;
  const data = state.assets.filter(asset =>
    (!cat || String(asset.category_id) === cat) &&
    (!q || [
      asset.category_name,
      asset.subcategory_name,
      asset.serial_no,
      asset.make,
      asset.model_no,
      asset.invoice_no,
      asset.current_employee_name,
      asset.current_employee_code,
    ].some(value => String(value || '').toLowerCase().includes(q)))
  );

  $('assetRows').innerHTML = data.length
    ? data.map(asset => `
      <tr>
        <td>${String(asset.asset_id).padStart(3, '0')}</td>
        <td>${asset.category_name}</td>
        <td>${asset.subcategory_name}</td>
        <td>${asset.make} / ${asset.model_no}</td>
        <td>${asset.serial_no}</td>
        <td>${asset.invoice_no || '-'}</td>
        <td>
          ${asset.invoice_photo_url
            ? isPdfUrl(asset.invoice_photo_url)
              ? `<button type="button" class="btn btn-sm btn-outline-dark" data-action="preview-file" data-url="${asset.invoice_photo_url}" data-title="Invoice ${asset.invoice_no || asset.serial_no}">
                   PDF
                 </button>`
              : `<button type="button" class="btn p-0 border-0 bg-transparent" data-action="preview-file" data-url="${asset.invoice_photo_url}" data-title="Invoice ${asset.invoice_no || asset.serial_no}">
                   <img src="${asset.invoice_photo_url}" alt="Invoice photo" class="img-thumbnail" style="max-width:72px; max-height:72px; object-fit:cover;">
                 </button>`
            : '-'}
        </td>
        <td>
          <div class="d-flex gap-2 flex-wrap">
            <button type="button" class="btn btn-sm btn-outline-secondary" data-action="edit-asset" data-id="${asset.asset_id}">Edit</button>
            <button type="button" class="btn btn-sm btn-outline-danger" data-action="delete-asset" data-id="${asset.asset_id}">Delete</button>
            <button type="button" class="btn btn-sm btn-outline-warning" data-action="issue-asset" data-id="${asset.asset_id}">Issue</button>
            ${asset.current_transaction_id ? `<button type="button" class="btn btn-sm btn-outline-success" data-action="return-issue" data-id="${asset.current_transaction_id}">Return</button>` : ''}
            <button type="button" class="btn btn-sm btn-outline-primary" data-action="transfer-asset" data-id="${asset.asset_id}">Transfer</button>
          </div>
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="8" class="text-center text-muted py-4">No assets found</td></tr>';

  $('totalAssets').innerText = state.assets.length;
  $('workingAssets').innerText = state.assets.filter(x => x.status === 'WORKING').length;
  $('faultyAssets').innerText = state.assets.filter(x => x.status === 'FAULTY').length;
  $('issuedAssets').innerText = state.assets.filter(x => x.status === 'ISSUED').length;
}

function renderStockView() {
  const q = $('stockSearchAsset').value.trim().toLowerCase();
  const cat = $('stockFilterCategory').value;
  const subcat = $('stockFilterSubcategory').value;
  const visibleAssets = state.assets.filter(asset =>
    asset.status === 'WORKING' &&
    (!cat || String(asset.category_id) === cat) &&
    (!subcat || String(asset.subcategory_id) === subcat) &&
    (!q || [
      asset.category_name,
      asset.subcategory_name,
      asset.serial_no,
      asset.make,
      asset.model_no,
      asset.invoice_no,
      asset.current_employee_name,
      asset.current_employee_code,
    ].some(value => String(value || '').toLowerCase().includes(q)))
  );

  const categories = new Map();
  visibleAssets.forEach(asset => {
    const categoryKey = String(asset.category_id);
    const subcategoryKey = `${asset.category_id}:${asset.subcategory_id}`;
    const itemKey = `${subcategoryKey}:${asset.make}:${asset.model_no}`;
    const qty = Number(asset.quantity || 1) || 1;

    if (!categories.has(categoryKey)) {
      categories.set(categoryKey, {
        category_id: asset.category_id,
        category_name: asset.category_name,
        totalQty: 0,
        subcategories: new Map(),
      });
    }

    const category = categories.get(categoryKey);
    category.totalQty += qty;

    if (!category.subcategories.has(subcategoryKey)) {
      category.subcategories.set(subcategoryKey, {
        subcategory_id: asset.subcategory_id,
        subcategory_name: asset.subcategory_name,
        totalQty: 0,
        items: new Map(),
      });
    }

    const subcategory = category.subcategories.get(subcategoryKey);
    subcategory.totalQty += qty;

    if (!subcategory.items.has(itemKey)) {
      subcategory.items.set(itemKey, {
        make: asset.make,
        model_no: asset.model_no,
        totalQty: 0,
        assets: [],
      });
    }

    const item = subcategory.items.get(itemKey);
    item.totalQty += qty;
    item.assets.push(asset);
  });

  const categoryList = [...categories.values()].sort((a, b) => a.category_name.localeCompare(b.category_name));
  $('stockTree').innerHTML = categoryList.length
    ? categoryList.map(category => `
      <details class="stock-category" open>
        <summary>
          <div>
            <div class="stock-row-title">${category.category_name}</div>
            <div class="stock-row-meta">Working stock available in this category</div>
          </div>
          <div class="stock-row-count">${category.totalQty}</div>
        </summary>
        <div class="stock-subcategory-body">
          ${[...category.subcategories.values()].sort((a, b) => a.subcategory_name.localeCompare(b.subcategory_name)).map(subcategory => `
            <details class="stock-subcategory">
              <summary>
                <div>
                  <div class="stock-row-title">${subcategory.subcategory_name}</div>
                  <div class="stock-row-meta">Make / Model groups</div>
                </div>
                <div class="stock-row-count">${subcategory.totalQty}</div>
              </summary>
              <div class="stock-subcategory-body">
                ${[...subcategory.items.values()].sort((a, b) => `${a.make} ${a.model_no}`.localeCompare(`${b.make} ${b.model_no}`)).map(item => `
                  <details class="stock-item">
                    <summary>
                      <div>
                        <div class="stock-row-title">${item.make} / ${item.model_no}</div>
                        <div class="stock-row-meta">${item.totalQty} item(s)</div>
                      </div>
                      <div class="stock-row-count">${item.totalQty}</div>
                    </summary>
                    <div class="stock-item-body">
                      <div class="stock-serials">
                        ${item.assets.map(asset => `
                          <div class="stock-serial-chip">
                            <span>${asset.serial_no}</span>
                            ${asset.invoice_photo_url ? `<button type="button" class="btn btn-sm btn-outline-secondary" data-action="preview-file" data-url="${asset.invoice_photo_url}" data-title="Invoice ${asset.invoice_no || asset.serial_no}">Invoice</button>` : ''}
                          </div>
                        `).join('')}
                      </div>
                      <div class="table-responsive mt-3">
                        <table class="table table-sm align-middle mb-0 stock-mini-table">
                          <thead class="table-light">
                            <tr>
                              <th>ID</th>
                              <th>Serial No</th>
                              <th>Invoice No</th>
                              <th>Qty</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${item.assets.map(asset => `
                              <tr>
                                <td>${String(asset.asset_id).padStart(3, '0')}</td>
                                <td>${asset.serial_no}</td>
                                <td>${asset.invoice_no || '-'}</td>
                                <td>${asset.quantity || 1}</td>
                                <td>
                                  <div class="d-flex gap-2 flex-wrap">
                                    <button type="button" class="btn btn-sm btn-outline-secondary" data-action="edit-asset" data-id="${asset.asset_id}">Edit</button>
                                    <button type="button" class="btn btn-sm btn-outline-danger" data-action="delete-asset" data-id="${asset.asset_id}">Delete</button>
                                    <button type="button" class="btn btn-sm btn-outline-warning" data-action="issue-asset" data-id="${asset.asset_id}">Issue</button>
                                    ${asset.current_transaction_id ? `<button type="button" class="btn btn-sm btn-outline-success" data-action="return-issue" data-id="${asset.current_transaction_id}">Return</button>` : ''}
                                    <button type="button" class="btn btn-sm btn-outline-primary" data-action="transfer-asset" data-id="${asset.asset_id}">Transfer</button>
                                  </div>
                                </td>
                              </tr>
                            `).join('')}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </details>
                `).join('')}
              </div>
            </details>
          `).join('')}
        </div>
      </details>
    `).join('')
    : '<div class="stock-empty">No available stock found.</div>';
}

function renderEmployees() {
  $('employeeRows').innerHTML = state.employees.length
    ? state.employees.map(employee => `
      <tr>
        <td>${employee.employee_code}</td>
        <td>${employee.employee_name}</td>
        <td>${employee.department || '-'}</td>
        <td>${employee.designation || '-'}</td>
        <td>${employee.phone || '-'}</td>
        <td>${employee.email || '-'}</td>
        <td>
          <div class="d-flex gap-2">
            <button type="button" class="btn btn-sm btn-outline-secondary" data-action="edit-employee" data-id="${employee.employee_id}">Edit</button>
            <button type="button" class="btn btn-sm btn-outline-danger" data-action="delete-employee" data-id="${employee.employee_id}">Delete</button>
          </div>
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="7" class="text-center text-muted py-4">No employees</td></tr>';

  renderEmployeeSelects();
}

function renderIssues() {
  $('issueRows').innerHTML = state.issues.length
    ? state.issues.map(issue => `
      <tr>
        <td>${issue.transaction_id}</td>
        <td>${issue.asset_id}</td>
        <td>${issue.employee_name} (${issue.employee_code})</td>
        <td>${issue.issue_date}</td>
        <td>${issue.return_date || '-'}</td>
        <td>${issue.quantity}</td>
        <td><span class="badge ${issue.status === 'ISSUED' ? 'bg-warning text-dark' : 'bg-success'}">${issue.status}</span></td>
        <td>
          <div class="d-flex gap-2 flex-wrap">
            ${issue.status === 'ISSUED' ? `<button type="button" class="btn btn-sm btn-outline-success" data-action="return-issue" data-id="${issue.transaction_id}">Return</button>` : ''}
            <button type="button" class="btn btn-sm btn-outline-secondary" data-action="edit-issue" data-id="${issue.transaction_id}">Edit</button>
            <button type="button" class="btn btn-sm btn-outline-danger" data-action="delete-issue" data-id="${issue.transaction_id}">Delete</button>
          </div>
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="8" class="text-center text-muted py-4">No issue history</td></tr>';
}

function renderTransfers() {
  $('transferRows').innerHTML = state.transfers.length
    ? state.transfers.map(transfer => `
      <tr>
        <td>${transfer.transfer_id}</td>
        <td>${transfer.asset_id}</td>
        <td>${transfer.serial_no}</td>
        <td>${transfer.quantity}</td>
        <td>${transfer.transfer_date}</td>
        <td>${transfer.from_employee ? `${transfer.from_employee}${transfer.from_employee_code ? ` (${transfer.from_employee_code})` : ''}` : '-'}</td>
        <td>${transfer.to_employee ? `${transfer.to_employee}${transfer.to_employee_code ? ` (${transfer.to_employee_code})` : ''}` : '-'}</td>
        <td>
          <div class="d-flex gap-2 flex-wrap">
            <button type="button" class="btn btn-sm btn-outline-secondary" data-action="edit-transfer" data-id="${transfer.transfer_id}">Edit</button>
            <button type="button" class="btn btn-sm btn-outline-danger" data-action="delete-transfer" data-id="${transfer.transfer_id}">Delete</button>
          </div>
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="8" class="text-center text-muted py-4">No transfer history</td></tr>';

  $('transferCount').innerText = state.transfers.length;
}

// --- Data Loading ---
async function loadCategories() {
  state.categories = await api('/categories');
  renderCategorySelects();
  const preferred = state.categories.find(x => x.category_name === 'IT' || x.category_name === 'COMPUTERS/PERIPHERALS');
  preferredCategoryId = preferred ? String(preferred.category_id) : '';
  if (preferredCategoryId) $('assetCategory').value = preferredCategoryId;
}

async function loadSubcategories(categoryId) {
  if (!categoryId) {
    state.subcategories = [];
    renderSubcategorySelects();
    return;
  }
  state.subcategories = await api(`/subcategories/${categoryId}`);
  renderSubcategorySelects();
}

async function loadAll() {
  [state.assets, state.employees, state.issues, state.transfers] = await Promise.all([
    api('/assets'),
    api('/employees'),
    api('/issue'),
    api('/transfers'),
  ]);

  renderAssets();
  renderStockSubcategorySelects();
  renderStockView();
  renderEmployees();
  renderIssues();
  renderTransfers();
  renderAssetPickers();
}

async function refreshAll() {
  await loadAll();
}

// --- Prefill Helpers ---
async function prefillIssue(assetId) {
  $('issueAsset').value = String(assetId);
  showView('issue-return');
  $('issueForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function prefillTransfer(assetId) {
  $('transferAsset').value = String(assetId);
  const asset = state.assets.find(x => x.asset_id === assetId);
  if (asset && asset.current_employee_id) {
    $('transferFromEmployee').value = String(asset.current_employee_id);
  }
  showView('transfer');
  $('transferForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// --- Form Modes ---
function setAssetFormMode(editing) {
  $('assetSubmitBtn').innerText = editing ? 'Update Asset' : 'Save Asset';
  $('assetCancelEditBtn').style.display = editing ? 'inline-block' : 'none';
}

function clearAssetEdit() {
  editingAssetId = null;
  setAssetFormMode(false);
  $('assetForm').reset();
  $('assetPurchaseDate').value = today();
  clearInvoicePreviewObjectUrl();
  $('assetInvoicePreview').innerHTML = '';
  if (preferredCategoryId) {
    $('assetCategory').value = preferredCategoryId;
    loadSubcategories(preferredCategoryId);
  }
}

function editAsset(assetId) {
  const asset = state.assets.find(x => x.asset_id === assetId);
  if (!asset) return;
  editingAssetId = assetId;
  showView('add-asset');
  $('assetCategory').value = String(asset.category_id);
  loadSubcategories(asset.category_id).then(() => {
    $('assetSubcategory').value = String(asset.subcategory_id);
  });
  $('assetMake').value = asset.make;
  $('assetModel').value = asset.model_no;
  $('assetSerial').value = asset.serial_no;
  $('assetPurchaseDate').value = asset.purchase_date || today();
  $('assetInvoiceNo').value = asset.invoice_no || '';
  $('assetInvoicePreview').innerHTML = asset.invoice_photo_url
    ? isPdfUrl(asset.invoice_photo_url)
      ? `Current invoice file: <button type="button" class="btn btn-sm btn-outline-dark ms-2" data-action="preview-file" data-url="${asset.invoice_photo_url}" data-title="Invoice ${asset.invoice_no || asset.serial_no}">Open PDF</button>`
      : `Current invoice file: <button type="button" class="btn p-0 border-0 bg-transparent ms-2" data-action="preview-file" data-url="${asset.invoice_photo_url}" data-title="Invoice ${asset.invoice_no || asset.serial_no}">
           <img src="${asset.invoice_photo_url}" alt="Invoice photo" class="img-thumbnail mt-2" style="max-width:180px;">
         </button>`
    : '';
  setAssetFormMode(true);
  $('assetForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function setEmployeeFormMode(editing) {
  $('employeeSubmitBtn').innerText = editing ? 'Update Employee' : 'Save Employee';
  $('employeeCancelEditBtn').style.display = editing ? 'inline-block' : 'none';
}

function clearEmployeeEdit() {
  editingEmployeeId = null;
  setEmployeeFormMode(false);
  $('employeeForm').reset();
}

function editEmployee(employeeId) {
  const employee = state.employees.find(x => x.employee_id === employeeId);
  if (!employee) return;
  editingEmployeeId = employeeId;
  showView('employees');
  $('empCode').value = employee.employee_code;
  $('empName').value = employee.employee_name;
  $('empDepartment').value = employee.department || '';
  $('empDesignation').value = employee.designation || '';
  $('empPhone').value = employee.phone || '';
  $('empEmail').value = employee.email || '';
  setEmployeeFormMode(true);
  $('employeeForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function setIssueFormMode(editing) {
  $('issueSubmitBtn').innerText = editing ? 'Update Issue' : 'Issue Asset';
  $('issueCancelEditBtn').style.display = editing ? 'inline-block' : 'none';
}

function clearIssueEdit() {
  editingIssueId = null;
  setIssueFormMode(false);
  $('issueForm').reset();
  $('issueDate').value = today();
}

function editIssue(transactionId) {
  const issue = state.issues.find(x => x.transaction_id === transactionId);
  if (!issue) return;
  editingIssueId = transactionId;
  showView('issue-return');
  $('issueAsset').value = String(issue.asset_id);
  $('issueEmployee').value = String(issue.employee_id);
  $('issueDate').value = issue.issue_date;
  $('issueQuantity').value = issue.quantity;
  $('issueRemarks').value = issue.remarks || '';
  setIssueFormMode(true);
  $('issueForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function setTransferFormMode(editing) {
  $('transferSubmitBtn').innerText = editing ? 'Update Transfer' : 'Save Transfer';
  $('transferCancelEditBtn').style.display = editing ? 'inline-block' : 'none';
}

function clearTransferEdit() {
  editingTransferId = null;
  setTransferFormMode(false);
  $('transferForm').reset();
  $('transferDate').value = today();
}

function editTransfer(transferId) {
  const transfer = state.transfers.find(x => x.transfer_id === transferId);
  if (!transfer) return;
  editingTransferId = transferId;
  showView('transfer');
  $('transferAsset').value = String(transfer.asset_id);
  $('transferFromEmployee').value = transfer.from_employee_id ? String(transfer.from_employee_id) : '';
  $('transferToEmployee').value = transfer.to_employee_id ? String(transfer.to_employee_id) : '';
  $('transferDate').value = transfer.transfer_date;
  $('transferQuantity').value = transfer.quantity;
  $('transferNote').value = transfer.note || '';
  setTransferFormMode(true);
  $('transferForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// --- Delete Helpers ---
async function deleteEmployee(employeeId) {
  if (!confirm('Delete this employee?')) return;
  await api(`/employees/${employeeId}`, { method: 'DELETE' });
  showToast('Employee deleted successfully', 'success');
  await refreshAll();
}

async function deleteAsset(assetId) {
  if (!confirm('Delete this asset?')) return;
  await api(`/assets/${assetId}`, { method: 'DELETE' });
  showToast('Asset deleted successfully', 'success');
  await refreshAll();
}

async function deleteIssue(transactionId) {
  if (!confirm('Delete this issue record?')) return;
  await api(`/issue/${transactionId}`, { method: 'DELETE' });
  showToast('Issue record deleted successfully', 'success');
  await refreshAll();
}

async function deleteTransfer(transferId) {
  if (!confirm('Delete this transfer record?')) return;
  await api(`/transfer/${transferId}`, { method: 'DELETE' });
  showToast('Transfer record deleted successfully', 'success');
  await refreshAll();
}

async function returnIssue(transactionId) {
  const result = await api(`/return/${transactionId}`, { method: 'PUT' });
  showToast(result.message || 'Asset returned successfully', 'success');
  await refreshAll();
}

// --- Filters ---
function resetFilters() {
  $('filterCategory').value = '';
  $('searchAsset').value = '';
  renderAssets();
}

function resetStockFilters() {
  $('stockFilterCategory').value = '';
  $('stockFilterSubcategory').value = '';
  $('stockSearchAsset').value = '';
  renderStockSubcategorySelects();
  renderStockView();
}

window.badge = badge;
window.resetFilters = resetFilters;
window.resetStockFilters = resetStockFilters;

// --- DOM Wiring ---
$('assetCategory').addEventListener('change', async e => {
  await loadSubcategories(e.target.value);
});

$('filterCategory').addEventListener('change', renderAssets);
$('searchAsset').addEventListener('input', renderAssets);
$('stockFilterCategory').addEventListener('change', () => {
  renderStockSubcategorySelects();
  renderStockView();
});
$('stockFilterSubcategory').addEventListener('change', renderStockView);
$('stockSearchAsset').addEventListener('input', renderStockView);

$('assetsNavToggle').addEventListener('click', () => {
  const submenu = $('assetsSubmenu');
  submenu.classList.add('open');
  $('assetsNavToggle').setAttribute('aria-expanded', 'true');
});

document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
  btn.addEventListener('click', () => showView(btn.dataset.view));
});

document.addEventListener('click', e => {
  const previewBtn = e.target.closest('button[data-action="preview-file"]');
  if (!previewBtn) return;
  e.preventDefault();
  openFilePreview(previewBtn.dataset.url, previewBtn.dataset.title);
});

$('assetRows').addEventListener('click', async e => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const id = Number(btn.dataset.id);
  const action = btn.dataset.action;
  if (action === 'edit-asset') return editAsset(id);
  if (action === 'delete-asset') return deleteAsset(id);
  if (action === 'issue-asset') return prefillIssue(id);
  if (action === 'transfer-asset') return prefillTransfer(id);
  if (action === 'return-issue') return returnIssue(id);
});

$('stockTree').addEventListener('click', async e => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const id = Number(btn.dataset.id);
  const action = btn.dataset.action;
  if (action === 'edit-asset') return editAsset(id);
  if (action === 'delete-asset') return deleteAsset(id);
  if (action === 'issue-asset') return prefillIssue(id);
  if (action === 'transfer-asset') return prefillTransfer(id);
  if (action === 'return-issue') return returnIssue(id);
});

$('employeeRows').addEventListener('click', e => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const id = Number(btn.dataset.id);
  const action = btn.dataset.action;
  if (action === 'edit-employee') return editEmployee(id);
  if (action === 'delete-employee') return deleteEmployee(id);
});

$('issueRows').addEventListener('click', e => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const id = Number(btn.dataset.id);
  const action = btn.dataset.action;
  if (action === 'edit-issue') return editIssue(id);
  if (action === 'delete-issue') return deleteIssue(id);
  if (action === 'return-issue') return returnIssue(id);
});

$('transferRows').addEventListener('click', e => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const id = Number(btn.dataset.id);
  const action = btn.dataset.action;
  if (action === 'edit-transfer') return editTransfer(id);
  if (action === 'delete-transfer') return deleteTransfer(id);
});

// --- Forms ---
$('assetForm').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const body = new FormData();
    body.append('category_id', $('assetCategory').value);
    body.append('subcategory_id', $('assetSubcategory').value);
    body.append('make', $('assetMake').value);
    body.append('model_no', $('assetModel').value);
    body.append('serial_no', $('assetSerial').value);
    body.append('purchase_date', $('assetPurchaseDate').value);
    if ($('assetInvoiceNo').value.trim()) {
      body.append('invoice_no', $('assetInvoiceNo').value.trim());
    }
    const invoicePhoto = $('assetInvoicePhoto').files[0];
    if (invoicePhoto) {
      body.append('invoice_photo', invoicePhoto);
    }

    if (editingAssetId) {
      const result = await api(`/assets/${editingAssetId}`, {
        method: 'PUT',
        body,
      });
      showToast(result.message || 'Asset updated successfully', 'success');
    } else {
      const result = await api('/assets', {
        method: 'POST',
        body,
      });
      showToast(result.message || 'Asset added successfully', 'success');
    }

    clearAssetEdit();
    await refreshAll();
  } catch (err) {
    alert(err.message);
  }
});

$('assetCancelEditBtn').addEventListener('click', clearAssetEdit);

$('assetInvoicePhoto').addEventListener('change', () => {
  const file = $('assetInvoicePhoto').files[0];
  if (file) {
    clearInvoicePreviewObjectUrl();
    assetInvoiceObjectUrl = URL.createObjectURL(file);
    $('assetInvoicePreview').innerHTML = isPdfUrl(file.name)
      ? `Selected file: ${file.name}<br><button type="button" class="btn btn-sm btn-outline-dark mt-2" data-action="preview-file" data-url="${assetInvoiceObjectUrl}" data-title="${file.name}">Open PDF preview</button>`
      : `Selected file: ${file.name}<br>
        <button type="button" class="btn p-0 border-0 bg-transparent" data-action="preview-file" data-url="${assetInvoiceObjectUrl}" data-title="${file.name}">
          <img src="${assetInvoiceObjectUrl}" alt="Selected invoice preview" class="img-thumbnail mt-2" style="max-width:180px;">
        </button>`;
  } else if (!editingAssetId) {
    clearInvoicePreviewObjectUrl();
    $('assetInvoicePreview').innerHTML = '';
  }
});

$('employeeForm').addEventListener('submit', async e => {
  e.preventDefault();
  const body = {
    employee_code: $('empCode').value,
    employee_name: $('empName').value,
    department: $('empDepartment').value,
    designation: $('empDesignation').value,
    phone: $('empPhone').value,
    email: $('empEmail').value,
  };

  if (editingEmployeeId) {
    const result = await api(`/employees/${editingEmployeeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    showToast(result.message || 'Employee updated successfully', 'success');
  } else {
    const result = await api('/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    showToast(result.message || 'Employee added successfully', 'success');
  }

  clearEmployeeEdit();
  await refreshAll();
});

$('employeeCancelEditBtn').addEventListener('click', clearEmployeeEdit);

$('issueForm').addEventListener('submit', async e => {
  e.preventDefault();
  const body = {
    asset_id: $('issueAsset').value,
    employee_id: $('issueEmployee').value,
    issue_date: $('issueDate').value,
    quantity: $('issueQuantity').value,
    remarks: $('issueRemarks').value,
  };

  if (editingIssueId) {
    const result = await api(`/issue/${editingIssueId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    showToast(result.message || 'Issue record updated successfully', 'success');
  } else {
    const result = await api('/issue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    showToast(result.message || 'Asset issued successfully', 'success');
  }

  clearIssueEdit();
  await refreshAll();
});

$('issueCancelEditBtn').addEventListener('click', clearIssueEdit);

$('transferForm').addEventListener('submit', async e => {
  e.preventDefault();
  const body = {
    asset_id: $('transferAsset').value,
    from_employee_id: $('transferFromEmployee').value,
    to_employee_id: $('transferToEmployee').value,
    transfer_date: $('transferDate').value,
    quantity: $('transferQuantity').value,
    note: $('transferNote').value,
  };

  if (editingTransferId) {
    const result = await api(`/transfer/${editingTransferId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    showToast(result.message || 'Transfer record updated successfully', 'success');
  } else {
    const result = await api('/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    showToast(result.message || 'Asset transferred successfully', 'success');
  }

  clearTransferEdit();
  await refreshAll();
});

$('transferCancelEditBtn').addEventListener('click', clearTransferEdit);

// --- Startup ---
(async function init() {
  try {
    const initialView = location.hash.replace('#', '') || 'assets-overview';
    showView(initialView);

    await loadCategories();
    if ($('assetCategory').value) {
      await loadSubcategories($('assetCategory').value);
    }
    await loadAll();
  } catch (err) {
    alert('Startup error: ' + err.message);
  }
})();
