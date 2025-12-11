// Payment Details Renderer
(async () => {
  const gatewayInput = document.getElementById("gateway");
  const upiIdInput = document.getElementById("upiId");
  const btnAdd = document.getElementById("btnAdd");
  let listEl = document.getElementById("bank-list");
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabPanels = document.querySelectorAll(".tab-panel");
  const btnAddDebit = document.getElementById("btnAddDebit");
  const gatewayDebitInput = document.getElementById("debitGateway");
  const debitCardTypeInput = document.getElementById("debitCardType");
  const debitCardNumberInput = document.getElementById("debitCardNo");
  const debitExpiryMonthInput = document.getElementById("debitExpiryMonth");
  const debitExpiryYearInput = document.getElementById("debitExpiryYear");
  const debitNameOnCard = document.getElementById("debitNameOnCard");
  const debitPinInput = document.getElementById("debitPin");
  const debitCvvInput = document.getElementById("debitCvv");
  const debitListEl = document.getElementById("debit-list");
  const debitNameToSaveInput = document.getElementById("debitNameToSave");

  let currentTab = "bank";



  function showLoading() {
    listEl.innerHTML =
      '<div style="padding:12px;color:#aaffc2">Loading...</div>';
  }

  // Tab switching
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const tabName = btn.getAttribute("data-tab");

      // Update active tab button
      tabBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      // Update active tab panel
      tabPanels.forEach((panel) => panel.classList.remove("active"));
      document.getElementById(`${tabName}-tab`).classList.add("active");

      currentTab = tabName;
      
      // Update list element reference
      listEl = document.getElementById(`${tabName}-list`);
      
      // Reload list for the selected tab
      await loadList();
    });
  });

  async function loadList() {
    showLoading();
    try {
      const res = await window.api.invoke("db:getPaymentDetails", currentTab);
      if (!res || !res.success) {
        listEl.innerHTML = `<div style="padding:12px;color:#ffb3b3">Failed to load: ${res && res.error ? res.error : "unknown"}</div>`;
        return;
      }
      const rows = res.rows || [];
      if (rows.length === 0) {
        listEl.innerHTML =
          `<div style="padding:12px;color:#99ffb3">No ${currentTab} payment details saved</div>`;
        return;
      }

      listEl.innerHTML = "";
      rows.forEach((row) => {
        const r = document.createElement("div");
        r.className = "row";
        
        if (row.type === 'bank') {
          r.innerHTML = `<div class="col-gateway">${row.gateway}</div>
                         <div class="col-upi">${row.upi_id || ""}</div>
                         <div class="col-actions">
                           <button class="btn-edit" data-id="${row.id}">Edit</button>
                           <button class="btn-delete" data-id="${row.id}">Delete</button>
                         </div>`;
        } else {
          r.innerHTML = `<div class="col-gateway">${row.gateway}</div>
                         <div class="col-card-info">${row.name_to_save || row.card_type}</div>
                         <div class="col-actions">
                           <button class="btn-edit" data-id="${row.id}">Edit</button>
                           <button class="btn-delete" data-id="${row.id}">Delete</button>
                         </div>`;
        }
        
        listEl.appendChild(r);
      });
    } catch (err) {
      console.error("loadList error", err);
      listEl.innerHTML = `<div style="padding:12px;color:#ffb3b3">Error loading list</div>`;
    }
  }

  // Add handler
  if (btnAdd) {
    btnAdd.addEventListener("click", async () => {
      const gateway = (gatewayInput.value || "").trim();
      const upiId = (upiIdInput.value || "").trim();
      if (!gateway || !upiId) {
        alert("Gateway and UPI ID required");
        return;
      }
      try {
        const res = await window.api.invoke("db:addPaymentDetail", {
          gateway,
          upi_id: upiId,
          type: currentTab,
        });
        if (res && res.success) {
          upiIdInput.value = "";
          await loadList();
        } else {
          alert("Add failed: " + (res && res.error ? res.error : "unknown"));
        }
      } catch (err) {
        console.error("add error", err);
        alert("Add error: " + err.message);
      }
    });
  }
  // Debit card elements
  const debit3dPassword = document.getElementById("debit3dPassword");
  
  // Credit card elements
  const btnAddCredit = document.getElementById("btnAddCredit");
  const creditGateway = document.getElementById("creditGateway");
  const creditCardType = document.getElementById("creditCardType");
  const creditCardNo = document.getElementById("creditCardNo");
  const creditExpiryMonth = document.getElementById("creditExpiryMonth");
  const creditExpiryYear = document.getElementById("creditExpiryYear");
  const creditNameOnCard = document.getElementById("creditNameOnCard");
  const creditPin = document.getElementById("creditPin");
  const creditCvv = document.getElementById("creditCvv");
  const credit3dPassword = document.getElementById("credit3dPassword");
  const creditNameToSave = document.getElementById("creditNameToSave");

  if (btnAddDebit) {
    btnAddDebit.addEventListener("click", async () => {
      const gateway = (gatewayDebitInput.value || "").trim();
      const cardType = (debitCardTypeInput.value || "").trim();
      const cardNo = (debitCardNumberInput.value || "").trim();
      const expiryMonth = (debitExpiryMonthInput.value || "").trim();
      const expiryYear = (debitExpiryYearInput.value || "").trim();
      const nameOnCard = (debitNameOnCard.value || "").trim();
      const pin = (debitPinInput.value || "").trim();
      const cvv = (debitCvvInput.value || "").trim();
      const password3d = (debit3dPassword.value || "").trim();
      const nameToSave = (debitNameToSaveInput.value || "").trim();

      if (!gateway || !cardType || !cardNo || !expiryMonth || !expiryYear || !nameOnCard || !pin || !cvv || !password3d || !nameToSave) {
        alert("All fields are required for Debit Card details");
        return;
      }
      
      try {
        const res = await window.api.invoke("db:addPaymentDetail", {
          gateway,
          card_type: cardType,
          card_no: cardNo,
          expiry_month: expiryMonth,
          expiry_year: expiryYear,
          name_on_card: nameOnCard,
          pin,
          cvv,
          password_3d: password3d,
          name_to_save: nameToSave,
          type: "debit"
        });
        
        if (res && res.success) {
          // Clear form
          debitCardNumberInput.value = "";
          debitNameOnCard.value = "";
          debitPinInput.value = "";
          debitCvvInput.value = "";
          debit3dPassword.value = "";
          debitNameToSaveInput.value = "";
          await loadList();
        } else {
          alert("Add failed: " + (res && res.error ? res.error : "unknown"));
        }
      } catch (err) {
        console.error("add error", err);
        alert("Add error: " + err.message);
      }
    });
  }

  if (btnAddCredit) {
    btnAddCredit.addEventListener("click", async () => {
      const gateway = (creditGateway.value || "").trim();
      const cardType = (creditCardType.value || "").trim();
      const cardNo = (creditCardNo.value || "").trim();
      const expiryMonth = (creditExpiryMonth.value || "").trim();
      const expiryYear = (creditExpiryYear.value || "").trim();
      const nameOnCard = (creditNameOnCard.value || "").trim();
      const pin = (creditPin.value || "").trim();
      const cvv = (creditCvv.value || "").trim();
      const password3d = (credit3dPassword.value || "").trim();
      const nameToSave = (creditNameToSave.value || "").trim();

      if (!gateway || !cardType || !cardNo || !expiryMonth || !expiryYear || !nameOnCard || !pin || !cvv || !password3d || !nameToSave) {
        alert("All fields are required for Credit Card details");
        return;
      }
      
      try {
        const res = await window.api.invoke("db:addPaymentDetail", {
          gateway,
          card_type: cardType,
          card_no: cardNo,
          expiry_month: expiryMonth,
          expiry_year: expiryYear,
          name_on_card: nameOnCard,
          pin,
          cvv,
          password_3d: password3d,
          name_to_save: nameToSave,
          type: "credit"
        });
        
        if (res && res.success) {
          // Clear form
          creditCardNo.value = "";
          creditNameOnCard.value = "";
          creditPin.value = "";
          creditCvv.value = "";
          credit3dPassword.value = "";
          creditNameToSave.value = "";
          await loadList();
        } else {
          alert("Add failed: " + (res && res.error ? res.error : "unknown"));
        }
      } catch (err) {
        console.error("add error", err);
        alert("Add error: " + err.message);
      }
    });
  }

  // Edit/Delete handlers using event delegation
  document.addEventListener("click", async (e) => {
    const id = e.target.getAttribute("data-id");
    if (!id) return;

    if (e.target.classList.contains("btn-edit")) {
      editPaymentDetail(parseInt(id));
    } else if (e.target.classList.contains("btn-delete")) {
      if (confirm("Are you sure you want to delete this payment detail?")) {
        try {
          const res = await window.api.invoke("db:deletePaymentDetail", parseInt(id));
          if (res && res.success) {
            await loadList();
          } else {
            alert("Delete failed: " + (res && res.error ? res.error : "unknown"));
          }
        } catch (err) {
          console.error("delete error", err);
          alert("Delete error: " + err.message);
        }
      }
    }
  });

  async function editPaymentDetail(id) {
    try {
      const res = await window.api.invoke('db:getPaymentDetails');
      if (res && res.success) {
        const payment = res.rows.find(p => p.id === id);
        if (payment) {
          if (payment.type === 'bank') {
            showPaymentEditModal(payment, async (updatedPayment) => {
              const updateRes = await window.api.invoke('db:updatePaymentDetail', id, updatedPayment);
              if (updateRes && updateRes.success) {
                await loadList();
              } else {
                alert('Update failed: ' + (updateRes && updateRes.error ? updateRes.error : 'unknown'));
              }
            });
          } else {
            alert('Card editing requires opening a new form. Please delete and re-add for now.');
          }
        }
      }
    } catch (err) {
      console.error('edit error', err);
      alert('Edit error: ' + err.message);
    }
  }

  function showPaymentEditModal(payment, onSave) {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:1000';
    
    modal.innerHTML = `
      <div style="background:#1e293b;border:1px solid #475569;padding:24px;width:400px;border-radius:12px;backdrop-filter:blur(10px)">
        <h3 style="color:#f8fafc;margin-top:0;margin-bottom:20px">Edit Payment Detail</h3>
        <div style="margin-bottom:16px">
          <label style="color:#cbd5e1;display:block;margin-bottom:6px">Gateway:</label>
          <input id="editGateway" style="width:100%;padding:10px;background:#0f172a;border:1px solid #475569;color:#f8fafc;border-radius:6px;box-sizing:border-box" value="${payment.gateway}" />
        </div>
        <div style="margin-bottom:20px">
          <label style="color:#cbd5e1;display:block;margin-bottom:6px">UPI ID:</label>
          <input id="editUpiId" style="width:100%;padding:10px;background:#0f172a;border:1px solid #475569;color:#f8fafc;border-radius:6px;box-sizing:border-box" value="${payment.upi_id}" />
        </div>
        <div style="text-align:right">
          <button id="editCancel" style="background:#64748b;color:white;border:none;padding:10px 20px;margin-right:10px;border-radius:6px;cursor:pointer">Cancel</button>
          <button id="editSave" style="background:#667eea;color:white;border:none;padding:10px 20px;border-radius:6px;cursor:pointer">Save</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const gatewayInput = modal.querySelector('#editGateway');
    const upiIdInput = modal.querySelector('#editUpiId');
    const cancelBtn = modal.querySelector('#editCancel');
    const saveBtn = modal.querySelector('#editSave');
    
    gatewayInput.focus();
    
    cancelBtn.onclick = () => document.body.removeChild(modal);
    
    saveBtn.onclick = () => {
      const gateway = gatewayInput.value.trim();
      const upi_id = upiIdInput.value.trim();
      if (gateway && upi_id) {
        document.body.removeChild(modal);
        onSave({ gateway, upi_id, type: 'bank' });
      } else {
        alert('Both fields are required');
      }
    };
  }

  // Initial render
  await loadList();
})();
