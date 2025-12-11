// Proxy Details Renderer
(async () => {
  const proxyIpInput = document.getElementById("proxyIp");
  const proxyPortInput = document.getElementById("proxyPort");
  const proxyUsernameInput = document.getElementById("proxyUsername");
  const proxyPasswordInput = document.getElementById("proxyPassword");
  const checkIrctcInput = document.getElementById("checkIrctc");
  const btnSave = document.getElementById("btnSave");
  const proxySelect = document.getElementById("proxySelect");
  const btnCheck = document.getElementById("btnCheck");
  const btnDelete = document.getElementById("btnDelete");
  const bulkInput = document.getElementById("bulkInput");
  const btnBulkAdd = document.getElementById("btnBulkAdd");
  const listEl = document.getElementById("list");

  function showLoading() {
    listEl.innerHTML = '<div style="padding:12px;color:#aaffc2">Loading...</div>';
  }

  async function loadList() {
    showLoading();
    try {
      const res = await window.api.invoke("db:getProxies");
      if (!res || !res.success) {
        listEl.innerHTML = `<div style="padding:12px;color:#ffb3b3">Failed to load: ${res && res.error ? res.error : "unknown"}</div>`;
        return;
      }
      const rows = res.rows || [];
      
      // Update dropdown
      proxySelect.innerHTML = '<option value="">Select Proxy</option>';
      rows.forEach(row => {
        const option = document.createElement('option');
        option.value = row.id;
        option.textContent = `${row.host}:${row.port}`;
        proxySelect.appendChild(option);
      });

      // Update list
      if (rows.length === 0) {
        listEl.innerHTML = '<div style="padding:12px;color:#99ffb3">No proxies saved</div>';
        return;
      }

      listEl.innerHTML = "";
      rows.forEach((row) => {
        const r = document.createElement("div");
        r.className = "row";
        r.innerHTML = `<div class="col-ip">${row.host}</div>
                       <div class="col-port">${row.port}</div>
                       <div class="col-username">${row.username || ""}</div>
                       <div class="col-actions">
                         <button class="btn-row-edit" data-id="${row.id}">Edit</button>
                         <button class="btn-row-delete" data-id="${row.id}">Delete</button>
                       </div>`;
        listEl.appendChild(r);
      });
    } catch (err) {
      console.error("loadList error", err);
      listEl.innerHTML = `<div style="padding:12px;color:#ffb3b3">Error loading list</div>`;
    }
  }

  // Save handler
  if (btnSave) {
    btnSave.addEventListener("click", async () => {
      const host = (proxyIpInput.value || "").trim();
      const port = (proxyPortInput.value || "").trim();
      const username = (proxyUsernameInput.value || "").trim();
      const password = (proxyPasswordInput.value || "").trim();
      
      if (!host || !port) {
        alert("IP and Port are required");
        return;
      }
      
      try {
        const res = await window.api.invoke("db:addProxy", {
          host,
          port: parseInt(port),
          username,
          password
        });
        
        if (res && res.success) {
          // Clear form
          proxyIpInput.value = "";
          proxyPortInput.value = "";
          proxyUsernameInput.value = "";
          proxyPasswordInput.value = "";
          checkIrctcInput.checked = false;
          await loadList();
        } else {
          alert("Save failed: " + (res && res.error ? res.error : "unknown"));
        }
      } catch (err) {
        console.error("save error", err);
        alert("Save error: " + err.message);
      }
    });
  }

  // Check handler
  if (btnCheck) {
    btnCheck.addEventListener("click", () => {
      const selectedId = proxySelect.value;
      if (!selectedId) {
        alert("Please select a proxy to check");
        return;
      }
      alert("Proxy check");
    });
  }

  // Delete selected proxy handler
  if (btnDelete) {
    btnDelete.addEventListener("click", async () => {
      const selectedId = proxySelect.value;
      if (!selectedId) {
        alert("Please select a proxy to delete");
        return;
      }
      
      if (confirm("Are you sure you want to delete this proxy?")) {
        try {
          const res = await window.api.invoke("db:deleteProxy", parseInt(selectedId));
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
    });
  }

  // Bulk add handler
  if (btnBulkAdd) {
    btnBulkAdd.addEventListener("click", () => {
      const bulkData = bulkInput.value.trim();
      if (!bulkData) {
        alert("Please enter proxy data");
        return;
      }
      
      const lines = bulkData.split('\n').filter(line => line.trim());
      const proxies = [];
      
      for (const line of lines) {
        const parts = line.split(':').map(s => s.trim());
        if (parts.length >= 2) {
          const host = parts[0];
          const port = parseInt(parts[1]);
          const username = parts[2] || "";
          const password = parts[3] || "";
          
          if (host && port) {
            proxies.push({ host, port, username, password });
          }
        }
      }
      
      if (proxies.length === 0) {
        alert("No valid proxies found. Use format: IP:PORT:USERNAME:PASS");
        return;
      }
      
      // Add first proxy to form fields
      const firstProxy = proxies[0];
      proxyIpInput.value = firstProxy.host;
      proxyPortInput.value = firstProxy.port;
      proxyUsernameInput.value = firstProxy.username;
      proxyPasswordInput.value = firstProxy.password;
      
      bulkInput.value = "";
      alert(`Added first proxy to form. Total ${proxies.length} proxies processed.`);
    });
  }

  // Edit/Delete handlers using event delegation
  document.addEventListener("click", async (e) => {
    const id = e.target.getAttribute("data-id");
    if (!id) return;

    if (e.target.classList.contains("btn-row-edit")) {
      editProxy(parseInt(id));
    } else if (e.target.classList.contains("btn-row-delete")) {
      if (confirm("Are you sure you want to delete this proxy?")) {
        try {
          const res = await window.api.invoke("db:deleteProxy", parseInt(id));
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

  async function editProxy(id) {
    try {
      const res = await window.api.invoke('db:getProxies');
      if (res && res.success) {
        const proxy = res.rows.find(p => p.id === id);
        if (proxy) {
          showProxyEditModal(proxy, async (updatedProxy) => {
            const updateRes = await window.api.invoke('db:updateProxy', id, updatedProxy);
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

  function showProxyEditModal(proxy, onSave) {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:1000';
    
    modal.innerHTML = `
      <div style="background:#1e293b;border:1px solid #475569;padding:24px;width:400px;border-radius:12px;backdrop-filter:blur(10px)">
        <h3 style="color:#f8fafc;margin-top:0;margin-bottom:20px">Edit Proxy</h3>
        <div style="margin-bottom:16px">
          <label style="color:#cbd5e1;display:block;margin-bottom:6px">Host/IP:</label>
          <input id="editHost" style="width:100%;padding:10px;background:#0f172a;border:1px solid #475569;color:#f8fafc;border-radius:6px;box-sizing:border-box" value="${proxy.host}" />
        </div>
        <div style="margin-bottom:16px">
          <label style="color:#cbd5e1;display:block;margin-bottom:6px">Port:</label>
          <input id="editPort" type="number" style="width:100%;padding:10px;background:#0f172a;border:1px solid #475569;color:#f8fafc;border-radius:6px;box-sizing:border-box" value="${proxy.port}" />
        </div>
        <div style="margin-bottom:16px">
          <label style="color:#cbd5e1;display:block;margin-bottom:6px">Username (optional):</label>
          <input id="editUsername" style="width:100%;padding:10px;background:#0f172a;border:1px solid #475569;color:#f8fafc;border-radius:6px;box-sizing:border-box" value="${proxy.username || ''}" />
        </div>
        <div style="margin-bottom:20px">
          <label style="color:#cbd5e1;display:block;margin-bottom:6px">Password (optional):</label>
          <input id="editPassword" type="password" style="width:100%;padding:10px;background:#0f172a;border:1px solid #475569;color:#f8fafc;border-radius:6px;box-sizing:border-box" value="${proxy.password || ''}" />
        </div>
        <div style="text-align:right">
          <button id="editCancel" style="background:#64748b;color:white;border:none;padding:10px 20px;margin-right:10px;border-radius:6px;cursor:pointer">Cancel</button>
          <button id="editSave" style="background:#667eea;color:white;border:none;padding:10px 20px;border-radius:6px;cursor:pointer">Save</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const hostInput = modal.querySelector('#editHost');
    const portInput = modal.querySelector('#editPort');
    const usernameInput = modal.querySelector('#editUsername');
    const passwordInput = modal.querySelector('#editPassword');
    const cancelBtn = modal.querySelector('#editCancel');
    const saveBtn = modal.querySelector('#editSave');
    
    hostInput.focus();
    
    cancelBtn.onclick = () => document.body.removeChild(modal);
    
    saveBtn.onclick = () => {
      const host = hostInput.value.trim();
      const port = parseInt(portInput.value.trim());
      if (host && port) {
        document.body.removeChild(modal);
        onSave({
          host,
          port,
          username: usernameInput.value.trim() || null,
          password: passwordInput.value.trim() || null
        });
      } else {
        alert('Host and Port are required');
      }
    };
  }

  // Initial render
  await loadList();
})();