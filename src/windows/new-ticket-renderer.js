// New Ticket Renderer
(async () => {
  const irctcIdSelect = document.getElementById("irctcId");
  const paymentSelect = document.getElementById("payment");
  const btnSaveTicket = document.getElementById("btnSaveTicket");
  const btnFindTrain = document.getElementById("btnFindTrain");
  const sourceInput = document.getElementById("source");
  const destinationInput = document.getElementById("destination");
  
  let stations = [];
  let editingTicketId = null;

  async function loadTicketForEdit(id) {
    try {
      const res = await window.api.invoke("db:getTickets");
      if (res && res.success) {
        const ticket = res.rows.find(t => t.id === id);
        if (ticket) {
          document.getElementById('source').value = ticket.source;
          document.getElementById('destination').value = ticket.destination;
          document.getElementById('trainNo').value = ticket.train_no;
          document.getElementById('trainClass').value = ticket.train_class;
          document.getElementById('quota').value = ticket.quota;
          document.getElementById('travelDate').value = ticket.travel_date;
          document.getElementById('mobNo').value = ticket.mob_no || '';
          document.getElementById('email').value = ticket.email || '';
          document.getElementById('ticketName').value = ticket.ticket_name || '';
          document.getElementById('ptFareLimit').value = ticket.pt_fare_limit || '';
          document.getElementById('irctcId').value = ticket.irctc_id || '';
          document.getElementById('payment').value = ticket.payment_id || '';
          document.getElementById('considerAutoUpgrade').checked = ticket.consider_auto_upgrade;
          document.getElementById('bookOnlyIfConfirm').checked = ticket.book_only_if_confirm;
          
          const passengers = ticket.passengers ? JSON.parse(ticket.passengers) : [];
          const passengerRows = document.querySelectorAll('.passenger-row');
          passengers.forEach((passenger, index) => {
            if (passengerRows[index]) {
              passengerRows[index].querySelector('.passenger-name').value = passenger.name;
              passengerRows[index].querySelector('.passenger-age').value = passenger.age;
              passengerRows[index].querySelector('.passenger-gender').value = passenger.gender;
              passengerRows[index].querySelector('.passenger-berth').value = passenger.berth;
              passengerRows[index].querySelector('.passenger-food').value = passenger.food;
            }
          });
          
          btnSaveTicket.textContent = 'Update Ticket';
        }
      }
    } catch (err) {
      console.error('Failed to load ticket for edit:', err);
    }
  }

  // Global message listener for train selection
  window.addEventListener('message', (event) => {
    if (event.data.type === 'trainSelected') {
      const data = event.data.data;
      document.getElementById('trainNo').value = data.train.trainNumber;
      
      // Auto-fill other details
      if (data.source) document.getElementById('source').value = data.source;
      if (data.destination) document.getElementById('destination').value = data.destination;
      if (data.date) document.getElementById('travelDate').value = data.date;
      if (data.quota) document.getElementById('quota').value = data.quota;
    } else if (event.data.type === 'trainWithClassSelected') {
      const data = event.data.data;
      document.getElementById('trainNo').value = data.trainNumber;
      document.getElementById('trainClass').value = data.trainClass;
      
      // Auto-fill other details
      if (data.source) document.getElementById('source').value = data.source;
      if (data.destination) document.getElementById('destination').value = data.destination;
      if (data.date) document.getElementById('travelDate').value = data.date;
      if (data.quota) document.getElementById('quota').value = data.quota;
    }
  });

  // Load IRCTC IDs from users table
  async function loadIrctcIds() {
    try {
      const res = await window.api.invoke("db:getUsers");
      if (res && res.success) {
        irctcIdSelect.innerHTML = '<option value="">Select IRCTC ID</option>';
        res.rows.forEach(user => {
          const option = document.createElement('option');
          option.value = user.id;
          option.textContent = user.name;
          irctcIdSelect.appendChild(option);
        });
      }
    } catch (err) {
      console.error('Failed to load IRCTC IDs:', err);
    }
  }

  // Load Payment details
  async function loadPaymentDetails() {
    try {
      const res = await window.api.invoke("db:getPaymentDetails");
      if (res && res.success) {
        paymentSelect.innerHTML = '<option value="">Select Payment</option>';
        res.rows.forEach(payment => {
          const option = document.createElement('option');
          option.value = payment.id;
          if (payment.type === 'bank') {
            option.textContent = `${payment.gateway} - ${payment.upi_id}`;
          } else {
            option.textContent = `${payment.gateway} - ${payment.name_to_save}`;
          }
          paymentSelect.appendChild(option);
        });
      }
    } catch (err) {
      console.error('Failed to load payment details:', err);
    }
  }

  // Find Train handler
  if (btnFindTrain) {
    btnFindTrain.addEventListener("click", () => {
      const source = sourceInput.value.trim();
      const destination = destinationInput.value.trim();
      const date = document.getElementById('travelDate').value;
      const quotaValue = document.getElementById('quota').value;
      
      if (!source || !destination) {
        alert('Please select source and destination stations');
        return;
      }
      
      // Open train search window
      const params = new URLSearchParams({
        from: source,
        to: destination,
        date: date || '',
        quota: quotaValue || 'GN'
      });
      
      const trainWindow = window.open(
        `train-search.html?${params.toString()}`,
        'trainSearch',
        'width=1000,height=700,scrollbars=yes,resizable=yes'
      );
      
      // Listen for train selection
      window.addEventListener('message', (event) => {
        if (event.data.type === 'trainSelected') {
          const data = event.data.data;
          document.getElementById('trainNo').value = data.train.trainNumber;
          
          // Auto-fill other details
          if (data.source) document.getElementById('source').value = data.source;
          if (data.destination) document.getElementById('destination').value = data.destination;
          if (data.date) document.getElementById('travelDate').value = data.date;
          if (data.quota) document.getElementById('quota').value = data.quota;
        } else if (event.data.type === 'trainWithClassSelected') {
          const data = event.data.data;
          document.getElementById('trainNo').value = data.trainNumber;
          document.getElementById('trainClass').value = data.trainClass;
          
          // Auto-fill other details
          if (data.source) document.getElementById('source').value = data.source;
          if (data.destination) document.getElementById('destination').value = data.destination;
          if (data.date) document.getElementById('travelDate').value = data.date;
          if (data.quota) document.getElementById('quota').value = data.quota;
        }
      });
    });
  }

  // Save Ticket handler
  if (btnSaveTicket) {
    btnSaveTicket.addEventListener("click", async () => {
      // Get all form values
      const ticketData = {
        source: document.getElementById("source").value.trim(),
        destination: document.getElementById("destination").value.trim(),
        trainNo: document.getElementById("trainNo").value.trim(),
        trainClass: document.getElementById("trainClass").value,
        quota: document.getElementById("quota").value,
        travelDate: document.getElementById("travelDate").value,
        mobNo: document.getElementById("mobNo").value.trim(),
        email: document.getElementById("email").value.trim(),
        ticketName: document.getElementById("ticketName").value.trim(),
        ptFareLimit: document.getElementById("ptFareLimit").value.trim(),
        irctcId: irctcIdSelect.value,
        payment: paymentSelect.value,
        considerAutoUpgrade: document.getElementById("considerAutoUpgrade").checked,
        bookOnlyIfConfirm: document.getElementById("bookOnlyIfConfirm").checked
      };

      // Get passenger details
      const passengerRows = document.querySelectorAll('.passenger-row');
      const passengers = [];
      passengerRows.forEach(row => {
        const name = row.querySelector('.passenger-name').value.trim();
        const age = row.querySelector('.passenger-age').value.trim();
        const gender = row.querySelector('.passenger-gender').value;
        const berth = row.querySelector('.passenger-berth').value;
        const food = row.querySelector('.passenger-food').value;
        
        if (name && age) {
          passengers.push({ name, age, gender, berth, food });
        }
      });

      // Debug log to check values
      console.log('Ticket data before validation:', {
        source: ticketData.source,
        destination: ticketData.destination,
        trainNo: ticketData.trainNo,
        travelDate: ticketData.travelDate
      });

      // Validation
      if (!ticketData.source || !ticketData.destination || !ticketData.trainNo || !ticketData.travelDate) {
        alert("Please fill all required fields: Source, Destination, Train No, Date");
        return;
      }

      if (passengers.length === 0) {
        alert("Please add at least one passenger");
        return;
      }

      if (!ticketData.irctcId) {
        alert("Please select an IRCTC ID");
        return;
      }

      if (!ticketData.payment) {
        alert("Please select a payment method");
        return;
      }

      // Extract station codes for saving
      const extractCode = (stationString) => {
        const match = stationString.match(/\(([^)]+)\)$/);
        return match ? match[1] : stationString;
      };
      
      const finalTicketData = {
        ...ticketData,
        source: extractCode(ticketData.source),
        destination: extractCode(ticketData.destination),
        train_no: ticketData.trainNo,
        train_class: ticketData.trainClass,
        travel_date: ticketData.travelDate,
        mob_no: ticketData.mobNo,
        ticket_name: ticketData.ticketName,
        pt_fare_limit: ticketData.ptFareLimit,
        irctc_id: ticketData.irctcId,
        payment_id: ticketData.payment,
        consider_auto_upgrade: ticketData.considerAutoUpgrade,
        book_only_if_confirm: ticketData.bookOnlyIfConfirm
      };
      
      try {
        let res;
        if (editingTicketId) {
          res = await window.api.invoke("db:updateTicket", editingTicketId, {
            ...finalTicketData,
            passengers: JSON.stringify(passengers)
          });
        } else {
          res = await window.api.invoke("db:addTicket", {
            ...finalTicketData,
            passengers: JSON.stringify(passengers)
          });
        }
        
        if (res && res.success) {
          alert(editingTicketId ? "Ticket updated successfully!" : "Ticket saved successfully!");
          window.close();
        } else {
          alert("Failed to save ticket: " + (res && res.error ? res.error : "unknown"));
        }
      } catch (err) {
        console.error("save error", err);
        alert("Save error: " + err.message);
      }
    });
  }

  // Load stations data
  async function loadStations() {
    try {
      const response = await fetch('../../stations.json');
      stations = await response.json();
    } catch (err) {
      console.error('Failed to load stations:', err);
    }
  }

  // Create dropdown for station selection
  function createStationDropdown(input) {
    const dropdown = document.createElement('div');
    dropdown.className = 'station-dropdown';
    dropdown.style.cssText = `
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      display: none;
    `;
    input.parentNode.appendChild(dropdown);
    return dropdown;
  }

  // Filter and show stations
  function showStations(input, dropdown, query) {
    if (query.length < 2) {
      dropdown.style.display = 'none';
      return;
    }

    const filtered = stations.filter(station => 
      station['Station Name'].toLowerCase().includes(query.toLowerCase()) ||
      station.Code.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 10);

    if (filtered.length === 0) {
      dropdown.style.display = 'none';
      return;
    }

    dropdown.innerHTML = '';
    filtered.forEach(station => {
      const item = document.createElement('div');
      item.style.cssText = `
        padding: 8px 12px;
        cursor: pointer;
        border-bottom: 1px solid #eee;
      `;
      item.innerHTML = `<strong>${station['Station Name']}</strong> (${station.Code})`;
      
      item.addEventListener('mouseenter', () => {
        item.style.backgroundColor = '#f0f0f0';
      });
      
      item.addEventListener('mouseleave', () => {
        item.style.backgroundColor = 'white';
      });
      
      item.addEventListener('click', () => {
        input.value = `${station['Station Name']} (${station.Code})`;
        dropdown.style.display = 'none';
      });
      
      dropdown.appendChild(item);
    });
    
    dropdown.style.display = 'block';
  }

  // Setup station input with dropdown
  function setupStationInput(input) {
    const dropdown = createStationDropdown(input);
    
    input.addEventListener('input', (e) => {
      showStations(input, dropdown, e.target.value);
    });
    
    input.addEventListener('focus', (e) => {
      if (e.target.value.length >= 2) {
        showStations(input, dropdown, e.target.value);
      }
    });
    
    // Hide dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });
  }

  // Initial load
  await loadStations();
  await loadIrctcIds();
  await loadPaymentDetails();
  
  // Setup station dropdowns
  setupStationInput(sourceInput);
  setupStationInput(destinationInput);

  // Check if editing existing ticket
  const urlParams = new URLSearchParams(window.location.search);
  const editId = urlParams.get('editId');
  if (editId) {
    editingTicketId = parseInt(editId);
    document.title = "Edit Ticket";
    if (document.querySelector(".title")) {
      document.querySelector(".title").textContent = "EDIT TICKET";
    }
    await loadTicketForEdit(editingTicketId);
  }
})();