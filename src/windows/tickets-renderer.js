// Tickets Renderer
(async () => {
  const ticketsList = document.getElementById("ticketsList");

  async function loadTickets() {
    try {
      const res = await window.api.invoke("db:getTickets");
      if (!res || !res.success) {
        ticketsList.innerHTML = `<div class="error">Failed to load tickets: ${res && res.error ? res.error : "unknown"}</div>`;
        return;
      }

      const tickets = res.rows || [];
      if (tickets.length === 0) {
        ticketsList.innerHTML = '<div class="empty">No tickets saved</div>';
        return;
      }

      ticketsList.innerHTML = "";
      tickets.forEach((ticket) => {
        const ticketDiv = document.createElement("div");
        ticketDiv.className = "ticket-item";
        
        const passengers = ticket.passengers ? JSON.parse(ticket.passengers) : [];
        const passengerNames = passengers.map(p => p.name).join(", ");
        
        ticketDiv.innerHTML = `
          <div class="ticket-header">
            <h3>${ticket.ticket_name || 'Unnamed Ticket'}</h3>
            <span class="ticket-id">#${ticket.id}</span>
          </div>
          <div class="ticket-details">
            <div class="route">
              <strong>${ticket.source} → ${ticket.destination}</strong>
            </div>
            <div class="train-info">
              Train: ${ticket.train_no} | Class: ${ticket.train_class} | Date: ${ticket.travel_date}
            </div>
            <div class="passengers">
              Passengers: ${passengerNames}
            </div>
          </div>
          <div class="ticket-actions">
            <button class="btn-edit" data-id="${ticket.id}">Edit</button>
            <button class="btn-delete" data-id="${ticket.id}">Delete</button>
          </div>
        `;
        
        ticketsList.appendChild(ticketDiv);
      });
    } catch (err) {
      console.error("loadTickets error", err);
      ticketsList.innerHTML = `<div class="error">Error loading tickets</div>`;
    }
  }

  // Edit/Delete ticket handlers
  document.addEventListener("click", async (e) => {
    const id = e.target.getAttribute("data-id");
    if (!id) return;

    if (e.target.classList.contains("btn-edit")) {
      editTicket(parseInt(id));
    } else if (e.target.classList.contains("btn-delete")) {
      if (confirm("Are you sure you want to delete this ticket?")) {
        try {
          const res = await window.api.invoke("db:deleteTicket", parseInt(id));
          if (res && res.success) {
            await loadTickets();
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

  function editTicket(id) {
    const params = new URLSearchParams({ editId: id });
    window.open(`new-ticket.html?${params.toString()}`, 'editTicket', 'width=1100,height=700');
  }

  // Initial load
  await loadTickets();
})();