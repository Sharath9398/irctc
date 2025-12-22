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
  async function handleTicketSelection() {
    const ticketId = parseInt(ticketSelect.value);
    selectedTicket = tickets.find(t => t.id === ticketId);
    
    if (selectedTicket) {
      // Get payment details if payment_id exists
      let paymentInfo = 'Not specified';
      let upiId = null;
      if (selectedTicket.payment_id) {
        try {
          const paymentResult = await window.api.invoke('db:getPaymentDetails');
          if (paymentResult.success) {
            const payment = paymentResult.rows.find(p => p.id === selectedTicket.payment_id);
            if (payment) {
              paymentInfo = `${payment.type} (${payment.gateway})`;
              selectedTicket.payment_type = payment.type; // Add payment type to ticket
              selectedTicket.payment_gateway = payment.gateway; // Store gateway for automation
              
              // Extract UPI ID from payment details
              upiId = payment.upi_id || payment.upiId || payment.account_number || payment.details;
              if (upiId) {
                selectedTicket.upi_id = upiId;
              }
            }
          }
        } catch (e) {
          console.error('Failed to get payment details:', e);
        }
      }
      
      selectedTicketDiv.innerHTML = `
        <strong>Route:</strong> ${selectedTicket.source} → ${selectedTicket.destination}<br>
        <strong>Train:</strong> ${selectedTicket.train_no}<br>
        <strong>Class:</strong> ${selectedTicket.train_class || 'Not specified'}<br>
        <strong>Date:</strong> ${selectedTicket.travel_date}<br>
        <strong>Mobile:</strong> ${selectedTicket.mob_no || 'Not specified'}<br>
        <strong>Email:</strong> ${selectedTicket.email || 'Not specified'}<br>
        <strong>Payment:</strong> ${paymentInfo}<br>
        <strong>Auto Upgrade:</strong> ${selectedTicket.consider_auto_upgrade ? 'Yes' : 'No'}
      `;
    } else {
      selectedTicketDiv.textContent = 'No ticket selected';
    }
    
    updateStartButton();
  }

  // Update start button state
  function updateStartButton() {
    startAutomationBtn.disabled = !selectedUser || !selectedTicket;
  }

  // Start automation process - COMPLETE FLOW
  async function startAutomation() {
    if (!selectedUser) {
      alert('Please select a user');
      return;
    }
    
    if (!selectedTicket) {
      alert('Please select a ticket');
      return;
    }

    try {
      startAutomationBtn.disabled = true;
      startAutomationBtn.textContent = 'AUTOMATING...';
      
      statusLog.textContent = 'Starting automation...\n';
      
      // Step 1: Connect to mobile device
      appendToLog('Connecting to mobile device...');
      const connectResult = await window.api.invoke('mobile:connect');
      
      if (!connectResult.success) {
        throw new Error('Failed to connect to device: ' + connectResult.error);
      }
      
      appendToLog('Connected to mobile device');
      
      // Step 2: Start complete automation flow
      appendToLog(`Starting automation for user: ${selectedUser.name}`);
      appendToLog(`Ticket: ${selectedTicket.source} → ${selectedTicket.destination}`);
      
      const automationResult = await window.api.invoke('automation:startBooking', {
        credentials: {
          username: selectedUser.name,
          password: selectedUser.password,
          pin: selectedUser.pin
        },
        ticketData: {
          fromStation: selectedTicket.source,
          toStation: selectedTicket.destination,
          travelDate: selectedTicket.travel_date,
          trainNumber: selectedTicket.train_no,
          trainClass: selectedTicket.train_class,
          passengers: selectedTicket.passengers,
          consider_auto_upgrade: selectedTicket.consider_auto_upgrade,
          payment_id: selectedTicket.payment_id,
          payment_type: selectedTicket.payment_type,
          payment_gateway: selectedTicket.payment_gateway,
          upi_id: selectedTicket.upi_id
        }
      });
      
      if (!automationResult.success) {
        throw new Error('Automation failed: ' + automationResult.error);
      }
      
      appendToLog('✓ Automation completed successfully!');
      
    } catch (error) {
      console.error('Automation error:', error);
      appendToLog('✗ Automation failed: ' + error.message);
      alert('Automation failed: ' + error.message);
    } finally {
      startAutomationBtn.disabled = false;
      startAutomationBtn.textContent = 'START AUTOMATION';
    }
  }

  // Append message to status log
  function appendToLog(message) {
    const timestamp = new Date().toLocaleTimeString();
    statusLog.textContent += `[${timestamp}] ${message}\n`;
    statusLog.scrollTop = statusLog.scrollHeight;
  }
})();