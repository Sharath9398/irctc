// src/windows/automation-renderer.js

(async () => {
  const userSelect = document.getElementById('userSelect');
  const ticketSelect = document.getElementById('ticketSelect');
  const startAutomationBtn = document.getElementById('startAutomationBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const selectedUserDiv = document.getElementById('selectedUser');
  const selectedTicketDiv = document.getElementById('selectedTicket');
  const statusLog = document.getElementById('statusLog');

  let users = [];
  let tickets = [];
  let selectedUser = null;
  let selectedTicket = null;

  // Load data on startup
  await loadData();

  // Event listeners
  userSelect.addEventListener('change', handleUserSelection);
  ticketSelect.addEventListener('change', handleTicketSelection);
  startAutomationBtn.addEventListener('click', startAutomation);
  refreshBtn.addEventListener('click', loadData);

  // Load users and tickets from database
  async function loadData() {
    try {
      statusLog.textContent = 'Loading data...';
      
      // Load users
      const usersResult = await window.api.invoke('db:getUsers');
      if (usersResult.success) {
        users = usersResult.rows;
        populateUserSelect();
      } else {
        throw new Error('Failed to load users: ' + usersResult.error);
      }

      // Load tickets
      const ticketsResult = await window.api.invoke('db:getTickets');
      if (ticketsResult.success) {
        tickets = ticketsResult.rows;
        populateTicketSelect();
      } else {
        throw new Error('Failed to load tickets: ' + ticketsResult.error);
      }

      statusLog.textContent = `Loaded ${users.length} users - Ready for login test`;
    } catch (error) {
      console.error('Load data error:', error);
      statusLog.textContent = 'Error loading data: ' + error.message;
    }
  }

  // Populate user dropdown
  function populateUserSelect() {
    userSelect.innerHTML = '<option value="">Select a user...</option>';
    users.forEach(user => {
      const option = document.createElement('option');
      option.value = user.id;
      option.textContent = `${user.name} (${user.password})`;
      userSelect.appendChild(option);
    });
  }

  // Populate ticket dropdown
  function populateTicketSelect() {
    ticketSelect.innerHTML = '<option value="">Select a ticket...</option>';
    tickets.forEach(ticket => {
      const option = document.createElement('option');
      option.value = ticket.id;
      option.textContent = `${ticket.source} → ${ticket.destination} | ${ticket.train_no} | ${ticket.travel_date}`;
      ticketSelect.appendChild(option);
    });
  }

  // Handle user selection
  function handleUserSelection() {
    const userId = parseInt(userSelect.value);
    selectedUser = users.find(u => u.id === userId);
    
    if (selectedUser) {
      selectedUserDiv.innerHTML = `
        <strong>Username:</strong> ${selectedUser.name}<br>
        <strong>Password:</strong> ${selectedUser.password}<br>
        <strong>PIN:</strong> ${selectedUser.pin ? '****' : 'Missing'}<br>
        <strong>Created:</strong> ${new Date(selectedUser.created_at).toLocaleDateString()}
      `;
    } else {
      selectedUserDiv.textContent = 'No user selected';
    }
    
    updateStartButton();
  }

  // Handle ticket selection
  function handleTicketSelection() {
    const ticketId = parseInt(ticketSelect.value);
    selectedTicket = tickets.find(t => t.id === ticketId);
    
    if (selectedTicket) {
      selectedTicketDiv.innerHTML = `
        <strong>Route:</strong> ${selectedTicket.source} → ${selectedTicket.destination}<br>
        <strong>Train:</strong> ${selectedTicket.train_no}<br>
        <strong>Class:</strong> ${selectedTicket.train_class || 'Not specified'}<br>
        <strong>Date:</strong> ${selectedTicket.travel_date}<br>
        <strong>Mobile:</strong> ${selectedTicket.mob_no || 'Not specified'}<br>
        <strong>Email:</strong> ${selectedTicket.email || 'Not specified'}
      `;
    } else {
      selectedTicketDiv.textContent = 'No ticket selected';
    }
    
    updateStartButton();
  }

  // Update start button state
  function updateStartButton() {
    startAutomationBtn.disabled = !selectedUser;
  }

  // Start automation process - LOGIN ONLY
  async function startAutomation() {
    if (!selectedUser) {
      alert('Please select a user');
      return;
    }

    try {
      startAutomationBtn.disabled = true;
      startAutomationBtn.textContent = 'LOGGING IN...';
      
      statusLog.textContent = 'Starting mobile login...\n';
      
      // Step 1: Connect to mobile device
      appendToLog('Connecting to mobile device...');
      const connectResult = await window.api.invoke('mobile:connect');
      
      if (!connectResult.success) {
        throw new Error('Failed to connect to device: ' + connectResult.error);
      }
      
      appendToLog('Connected to mobile device');
      
      // Step 2: Login with captcha handling
      appendToLog(`Starting login for user: ${selectedUser.name}`);
      appendToLog('Entering credentials and waiting for captcha...');
      const loginResult = await window.api.invoke('mobile:loginWithCaptcha', {
        username: selectedUser.name,
        password: selectedUser.password,
        pin: selectedUser.pin
      });
      
      if (!loginResult.success) {
        throw new Error('Login failed: ' + loginResult.error);
      }
      
      appendToLog('✓ Login completed successfully!');
      appendToLog('Ready for next steps...');
      
    } catch (error) {
      console.error('Automation error:', error);
      appendToLog('✗ Login failed: ' + error.message);
      alert('Login failed: ' + error.message);
    } finally {
      startAutomationBtn.disabled = false;
      startAutomationBtn.textContent = 'START LOGIN';
    }
  }

  // Append message to status log
  function appendToLog(message) {
    const timestamp = new Date().toLocaleTimeString();
    statusLog.textContent += `[${timestamp}] ${message}\n`;
    statusLog.scrollTop = statusLog.scrollHeight;
  }
})();