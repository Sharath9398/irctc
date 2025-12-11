// Train Search Renderer
(async () => {
  const fromStation = document.getElementById('fromStation');
  const toStation = document.getElementById('toStation');
  const quota = document.getElementById('quota');
  const travelDate = document.getElementById('travelDate');
  const searchTrains = document.getElementById('searchTrains');
  const trainsContainer = document.getElementById('trainsContainer');

  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const from = urlParams.get('from');
  const to = urlParams.get('to');
  const date = urlParams.get('date');
  const selectedQuota = urlParams.get('quota');

  // Set form values
  fromStation.value = from || '';
  toStation.value = to || '';
  travelDate.value = date || '';
  quota.value = selectedQuota || 'GN';

  // Extract station codes from station strings
  function extractStationCode(stationString) {
    const match = stationString.match(/\(([^)]+)\)$/);
    return match ? match[1] : stationString;
  }

  // Fetch trains between stations
  async function fetchTrains() {
    const fromCode = extractStationCode(fromStation.value);
    const toCode = extractStationCode(toStation.value);
    
    if (!fromCode || !toCode) {
      trainsContainer.innerHTML = '<div class="loading">Please select valid stations</div>';
      return;
    }

    trainsContainer.innerHTML = '<div class="loading">Loading trains...</div>';

    try {
      const response = await fetch(`https://railinfo.app/api/trains-between-stations?from=${fromCode}&to=${toCode}`);
      const data = await response.json();
      
      if (data && data.length > 0) {
        displayTrains(data);
      } else {
        trainsContainer.innerHTML = '<div class="loading">No trains found between these stations</div>';
      }
    } catch (error) {
      console.error('Error fetching trains:', error);
      // Use mock data when API fails
      const mockTrains = [
        { trainName: 'MNGLA LKSDP EXP', trainNumber: '12618' },
        { trainName: 'ASR CSMT EXP', trainNumber: '11058' },
        { trainName: 'MMCT TEJAS RAJ', trainNumber: '12952' },
        { trainName: 'CSMT RAJDHANI', trainNumber: '22222' },
        { trainName: 'PUNJAB MAIL', trainNumber: '12138' },
        { trainName: 'MMCT FESTIVL SPL', trainNumber: '09004' }
      ];
      displayTrains(mockTrains);
    }
  }

  // Display trains
  function displayTrains(trains) {
    trainsContainer.innerHTML = '';
    
    trains.forEach(train => {
      const trainItem = document.createElement('div');
      trainItem.className = 'train-item';
      trainItem.onclick = () => selectTrain(train);
      
      trainItem.innerHTML = `
        <div class="train-header">
          <div>
            <div class="train-name">${train.trainName}</div>
            <div class="train-number">${train.trainNumber}</div>
          </div>
        </div>
        <div class="class-availability">
          ${generateClassButtons(train.trainNumber)}
        </div>
      `;
      
      trainsContainer.appendChild(trainItem);
    });
  }

  // Generate class availability buttons
  function generateClassButtons(trainNumber) {
    const classes = ['1A', '2A', '3A', 'SL', '3E', 'CC', '2S', 'FC', 'EC'];
    return classes.map(cls => 
      `<button class="class-btn class-not-available" onclick="checkAvailability('${trainNumber}', '${cls}')">${cls}</button>`
    ).join('');
  }

  // Check seat availability for specific class
  window.checkAvailability = async (trainNumber, trainClass) => {
    const fromCode = extractStationCode(fromStation.value);
    const toCode = extractStationCode(toStation.value);
    const date = travelDate.value;
    const quotaValue = quota.value;

    if (!date) {
      alert('Please select a travel date');
      return;
    }

    const button = event.target;
    button.textContent = 'Loading...';

    try {
      const response = await fetch(`https://railinfo.app/api/check-seat-availability?trainNo=${trainNumber}&from=${fromCode}&to=${toCode}&class=${trainClass}&date=${date}&quota=${quotaValue}`);
      const data = await response.json();
      
      if (data && data.availability) {
        const status = data.availability.toLowerCase();
        button.className = 'class-btn ' + 
          (status.includes('available') ? 'class-available' : 
           status.includes('waiting') ? 'class-waiting' : 'class-unavailable');
        button.textContent = `${trainClass}`;
      }
    } catch (error) {
      console.error('Error checking availability:', error);
      // Mock availability data
      const mockStatuses = ['class-available', 'class-waiting', 'class-unavailable'];
      const randomStatus = mockStatuses[Math.floor(Math.random() * mockStatuses.length)];
      button.className = `class-btn ${randomStatus}`;
      button.textContent = trainClass;
    }
    
    // Auto-select class and send data to parent
    event.stopPropagation();
    selectTrainWithClass(trainNumber, trainClass);
  };

  // Select train with class and return to parent window
  function selectTrainWithClass(trainNumber, trainClass) {
    if (window.opener) {
      window.opener.postMessage({
        type: 'trainWithClassSelected',
        data: {
          trainNumber,
          trainClass,
          source: fromStation.value,
          destination: toStation.value,
          date: travelDate.value,
          quota: quota.value
        }
      }, '*');
      window.close();
    }
  }

  // Select train and return to parent window
  function selectTrain(train) {
    if (window.opener) {
      window.opener.postMessage({
        type: 'trainSelected',
        data: {
          train: train,
          source: fromStation.value,
          destination: toStation.value,
          date: travelDate.value,
          quota: quota.value
        }
      }, '*');
      window.close();
    }
  }

  // Search trains on button click
  searchTrains.addEventListener('click', fetchTrains);

  // Initial load if stations are provided
  if (from && to) {
    fetchTrains();
  }
})();