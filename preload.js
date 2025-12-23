// preload.js
const { contextBridge, ipcRenderer } = require('electron');

try {
  console.log('[preload] preload.js loaded');
} catch (e) { /* ignore */ }

contextBridge.exposeInMainWorld('api', {
  // open native file dialog
  openFileDialog: async (options) => {
    return ipcRenderer.invoke('app:openFileDialog', options);
  },

  // open users window
  openUsersWindow: async () => {
    return ipcRenderer.invoke('app:openUsers');
  },
  openProxyDetailsWindow: async () => {
    return ipcRenderer.invoke('app:openProxyDetails');
  },

  // open payment details window
  openPaymentDetailsWindow: async () => {
    return ipcRenderer.invoke('app:openPaymentDetails');
  },

  // open new ticket window
  openNewTicketWindow: async () => {
    return ipcRenderer.invoke('app:openNewTicket');
  },

  // open tickets window
  openTicketsWindow: async () => {
    return ipcRenderer.invoke('app:openTickets');
  },

  // generic invoke with safe whitelist
  invoke: async (channel, ...args) => {
    const allowed = [
      'db:getUsers',
      'db:addUser',
      'db:updateUser',
      'db:deleteUser',
      'db:getPaymentDetails',
      'db:addPaymentDetail',
      'db:updatePaymentDetail',
      'db:deletePaymentDetail',
      'db:getProxies',
      'db:addProxy',
      'db:updateProxy',
      'db:deleteProxy',
      'db:getTickets',
      'db:updateTicket',
      'db:deleteTicket',
      'db:addTicket',
      'app:bulkImportUsers',
      'automation:startBooking',
      'mobile:connect',
      'mobile:disconnect',
      'mobile:login',
      'mobile:loginWithCaptcha',
      'app:openAutomation',
      'setup:start',
      'setup:complete'
    ];
    if (!allowed.includes(channel)) {
      throw new Error(`Channel "${channel}" is not allowed`);
    }
    return ipcRenderer.invoke(channel, ...args);
  },

  onSetupStatus: (callback) => ipcRenderer.on('setup:status', callback)


});
