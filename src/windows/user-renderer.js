// src/windows/passengers_renderer.js
// Minimal: Add username/password, render list below. Bulk button is dummy (no action).

(async () => {
  const nameInput = document.getElementById('name');
  const passwordInput = document.getElementById('password');
  const pinInput = document.getElementById('pin');
  const btnAdd = document.getElementById('btnAdd');
  const btnBulk = document.getElementById('btnBulk');
  const listEl = document.getElementById('list');



  function showLoading(){ listEl.innerHTML = '<div style="padding:12px;color:#aaffc2">Loading...</div>'; }

  async function loadList() {
    showLoading();
    try {
      const res = await window.api.invoke('db:getUsers');
      if (!res || !res.success) {
        listEl.innerHTML = `<div style="padding:12px;color:#ffb3b3">Failed to load: ${res && res.error ? res.error : 'unknown'}</div>`;
        return;
      }
      const rows = res.rows || [];
      if (rows.length === 0) {
        listEl.innerHTML = '<div style="padding:12px;color:#99ffb3">No users saved</div>';
        return;
      }
      // render each row with delete button
      listEl.innerHTML = '';
      rows.forEach(row => {
        const r = document.createElement('div');
        r.className = 'row';
        r.innerHTML = `<div class="col-name">${row.name}</div>
                       <div class="col-pass">${row.password || ''}</div>
                       <div class="col-pin">${row.pin ? '****' : 'Missing'}</div>
                       <div class="col-actions">
                         <button class="btn-edit" data-id="${row.id}">Edit</button>
                         <button class="btn-delete" data-id="${row.id}">Delete</button>
                       </div>`;
        listEl.appendChild(r);
      });
    } catch (err) {
      console.error('loadList error', err);
      listEl.innerHTML = `<div style="padding:12px;color:#ffb3b3">Error loading list</div>`;
    }
  }

  // Add handler
  if (btnAdd) {
    btnAdd.addEventListener('click', async () => {
      const name = (nameInput.value || '').trim();
      const password = (passwordInput.value || '').trim();
      const pin = (pinInput.value || '').trim();
      if (!name || !password || !pin) {
        alert('Username, password and PIN are required');
        return;
      }
      if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
        alert('PIN must be exactly 4 digits');
        return;
      }
      try {
        const res = await window.api.invoke('db:addUser', { name, password, pin });
        if (res && res.success) {
          nameInput.value = '';
          passwordInput.value = '';
          pinInput.value = '';
          await loadList();
        } else {
          alert('Add failed: ' + (res && res.error ? res.error : 'unknown'));
        }
      } catch (err) {
        console.error('add error', err);
        alert('Add error: ' + err.message);
      }
    });
  }

  // Bulk Add functionality
  if (btnBulk) {
    btnBulk.addEventListener('click', () => {
      showBulkModal();
    });
  }
  
  function showBulkModal() {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:1000';
    
    modal.innerHTML = `
      <div style="background:#070707;border:2px solid #00ff33;padding:20px;width:500px;border-radius:8px">
        <h3 style="color:#00ff33;margin-top:0">Bulk Add Users</h3>
        <p style="color:#caffd6;font-size:14px">Enter users (one per line):<br>Format: username,password,pin (PIN required)</p>
        <textarea id="bulkInput" style="width:100%;height:200px;background:#001111;border:1px solid #003300;color:#caffd6;padding:8px;border-radius:4px;resize:vertical" placeholder="user1,pass1,1234\nuser2,pass2,5678\nuser3,pass3,9999"></textarea>
        <div style="margin-top:15px;text-align:right">
          <button id="bulkCancel" style="background:#666;color:white;border:none;padding:8px 16px;margin-right:10px;border-radius:4px;cursor:pointer">Cancel</button>
          <button id="bulkSubmit" style="background:#00c53a;color:#001000;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-weight:bold">Add All</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const textarea = modal.querySelector('#bulkInput');
    const cancelBtn = modal.querySelector('#bulkCancel');
    const submitBtn = modal.querySelector('#bulkSubmit');
    
    textarea.focus();
    
    cancelBtn.onclick = () => document.body.removeChild(modal);
    
    submitBtn.onclick = () => {
      const bulkData = textarea.value.trim();
      if (!bulkData) {
        alert('Please enter user data');
        return;
      }
      
      const lines = bulkData.split('\n').filter(line => line.trim());
      const users = [];
      
      for (const line of lines) {
        const [name, password, pin] = line.split(',').map(s => s.trim());
        if (name && password && pin && /^\d{4}$/.test(pin)) {
          users.push({ name, password, pin });
        }
      }
      
      if (users.length === 0) {
        alert('No valid users found. Use format: username,password,pin (PIN must be 4 digits)');
        return;
      }
      
      document.body.removeChild(modal);
      addBulkUsers(users);
    };
  }
  
  async function addBulkUsers(users) {
    try {
      let added = 0;
      for (const user of users) {
        const res = await window.api.invoke('db:addUser', user);
        if (res && res.success) added++;
      }
      alert(`Added ${added} out of ${users.length} users`);
      await loadList();
    } catch (err) {
      console.error('bulk add error', err);
      alert('Bulk add error: ' + err.message);
    }
  }

  // Edit/Delete handlers (event delegation)
  listEl.addEventListener('click', async (e) => {
    const id = e.target.getAttribute('data-id');
    if (!id) return;

    if (e.target.classList.contains('btn-edit')) {
      editUser(parseInt(id));
    } else if (e.target.classList.contains('btn-delete')) {
      if (confirm('Are you sure you want to delete this user?')) {
        try {
          const res = await window.api.invoke('db:deleteUser', parseInt(id));
          if (res && res.success) {
            await loadList();
          } else {
            alert('Delete failed: ' + (res && res.error ? res.error : 'unknown'));
          }
        } catch (err) {
          console.error('delete error', err);
          alert('Delete error: ' + err.message);
        }
      }
    }
  });

  async function editUser(id) {
    try {
      const res = await window.api.invoke('db:getUsers');
      if (res && res.success) {
        const user = res.rows.find(u => u.id === id);
        if (user) {
          showEditModal(user, async (updatedUser) => {
            const updateRes = await window.api.invoke('db:updateUser', id, updatedUser);
            if (updateRes && updateRes.success) {
              await loadList();
            } else {
              alert('Update failed: ' + (updateRes && updateRes.error ? updateRes.error : 'unknown'));
            }
          });
        }
      }
    } catch (err) {
      console.error('edit error', err);
      alert('Edit error: ' + err.message);
    }
  }

  function showEditModal(user, onSave) {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:1000';
    
    modal.innerHTML = `
      <div style="background:#1e293b;border:1px solid #475569;padding:24px;width:400px;border-radius:12px;backdrop-filter:blur(10px)">
        <h3 style="color:#f8fafc;margin-top:0;margin-bottom:20px">Edit User</h3>
        <div style="margin-bottom:16px">
          <label style="color:#cbd5e1;display:block;margin-bottom:6px">Username:</label>
          <input id="editName" style="width:100%;padding:10px;background:#0f172a;border:1px solid #475569;color:#f8fafc;border-radius:6px;box-sizing:border-box" value="${user.name}" />
        </div>
        <div style="margin-bottom:16px">
          <label style="color:#cbd5e1;display:block;margin-bottom:6px">Password:</label>
          <input id="editPassword" type="password" style="width:100%;padding:10px;background:#0f172a;border:1px solid #475569;color:#f8fafc;border-radius:6px;box-sizing:border-box" value="${user.password}" />
        </div>
        <div style="margin-bottom:20px">
          <label style="color:#cbd5e1;display:block;margin-bottom:6px">PIN *:</label>
          <input id="editPin" type="password" maxlength="4" required style="width:100%;padding:10px;background:#0f172a;border:1px solid #475569;color:#f8fafc;border-radius:6px;box-sizing:border-box" value="${user.pin || ''}" />
        </div>
        <div style="text-align:right">
          <button id="editCancel" style="background:#64748b;color:white;border:none;padding:10px 20px;margin-right:10px;border-radius:6px;cursor:pointer">Cancel</button>
          <button id="editSave" style="background:#667eea;color:white;border:none;padding:10px 20px;border-radius:6px;cursor:pointer">Save</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const nameInput = modal.querySelector('#editName');
    const passwordInput = modal.querySelector('#editPassword');
    const pinInput = modal.querySelector('#editPin');
    const cancelBtn = modal.querySelector('#editCancel');
    const saveBtn = modal.querySelector('#editSave');
    
    nameInput.focus();
    
    cancelBtn.onclick = () => document.body.removeChild(modal);
    
    saveBtn.onclick = () => {
      const name = nameInput.value.trim();
      const password = passwordInput.value.trim();
      const pin = pinInput.value.trim();
      if (name && password && pin) {
        if (!/^\d{4}$/.test(pin)) {
          alert('PIN must be exactly 4 digits');
          return;
        }
        document.body.removeChild(modal);
        onSave({ name, password, pin });
      } else {
        alert('Username, password and PIN are required');
      }
    };
  }

  // initial render
  await loadList();
})();
