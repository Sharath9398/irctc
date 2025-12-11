// src/renderer.js
(async () => {
  const statusEl = document.getElementById('status');
  const managePassengersBtn = document.getElementById('managePassengersBtn');
  const viewPaymentDetailsBtn = document.getElementById('viewPaymentDetailsBtn');
  const newTicketDetailsBtn = document.getElementById('newTicketDetailsBtn');
  const proxyDetailsBtn = document.getElementById('proxyDetailsBtn');
  const viewTicketsBtn = document.getElementById('viewTicketsBtn');
  const startAutomationBtn = document.getElementById('startAutomationBtn');

  function show(msg) {
    if (statusEl) statusEl.textContent = typeof msg === 'string' ? msg : JSON.stringify(msg);
    console.log('[renderer] status:', msg);
  }

  // Defensive check: ensure preload exposed the API
  if (typeof window.api === 'undefined') {
    const errMsg = 'window.api is undefined — preload did not load. Make sure you run inside Electron and preload.js path is correct.';
    show(errMsg);
    console.error(errMsg);
    return;
  }
  if(proxyDetailsBtn){
    proxyDetailsBtn.addEventListener('click', async()=>{
      result = await window.api.openProxyDetailsWindow();
    })
  }

  if (managePassengersBtn) {
    managePassengersBtn.addEventListener('click', async () => {
      try {
        if (!window.api || typeof window.api.openUsersWindow !== 'function') {
          const msg = 'openUsersWindow is not available on window.api';
          show(msg);
          console.error(msg, window.api);
          return;
        }

        const res = await window.api.openUsersWindow();
        if (res && res.success) {
          show('');
        } else {
          show('Failed to open users window: ' + (res && res.error ? res.error : 'unknown'));
        }
      } catch (err) {
        show('Failed to open users window: ' + err.message);
      }
    });
  }

  if (viewPaymentDetailsBtn) {
    viewPaymentDetailsBtn.addEventListener('click', async () => {
      try {
        if (!window.api || typeof window.api.openPaymentDetailsWindow !== 'function') {
          const msg = 'openPaymentDetailsWindow is not available on window.api';
          show(msg);
          console.error(msg, window.api);
          return;
        }

        const res = await window.api.openPaymentDetailsWindow();
        if (res && res.success) {
          show('');
        } else {
          show('Failed to open payment details window: ' + (res && res.error ? res.error : 'unknown'));
        }
      } catch (err) {
        show('Failed to open payment details window: ' + err.message);
      }
    });
  }

  if (newTicketDetailsBtn) {
    newTicketDetailsBtn.addEventListener('click', async () => {
      try {
        if (!window.api || typeof window.api.openNewTicketWindow !== 'function') {
          const msg = 'openNewTicketWindow is not available on window.api';
          show(msg);
          console.error(msg, window.api);
          return;
        }

        const res = await window.api.openNewTicketWindow();
        if (res && res.success) {
          show('');
        } else {
          show('Failed to open new ticket window: ' + (res && res.error ? res.error : 'unknown'));
        }
      } catch (err) {
        show('Failed to open new ticket window: ' + err.message);
      }
    });
  }

  if (viewTicketsBtn) {
    viewTicketsBtn.addEventListener('click', async () => {
      try {
        const res = await window.api.openTicketsWindow();
        if (res && res.success) {
          show('');
        } else {
          show('Failed to open tickets window: ' + (res && res.error ? res.error : 'unknown'));
        }
      } catch (err) {
        show('Failed to open tickets window: ' + err.message);
      }
    });
  }

  if (startAutomationBtn) {
    startAutomationBtn.addEventListener('click', async () => {
      try {
        const res = await window.api.invoke('app:openAutomation');
        if (res && res.success) {
          show('');
        } else {
          show('Failed to open automation window: ' + (res && res.error ? res.error : 'unknown'));
        }
      } catch (err) {
        show('Failed to open automation window: ' + err.message);
      }
    });
  }
})();
