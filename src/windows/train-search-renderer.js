(async () => {
  const extractCode = (s) => s.match(/\(([^)]+)\)$/)?.[1] || s;
  
  const fromStation = document.getElementById('fromStation');
  const toStation = document.getElementById('toStation');
  const travelDate = document.getElementById('travelDate');
  const trainsContainer = document.getElementById('trainsContainer');
  
  // Initialize from URL params
  const params = new URLSearchParams(window.location.search);
  fromStation.value = params.get('from') || '';
  toStation.value = params.get('to') || '';
  travelDate.value = params.get('date') || '';
  document.getElementById('quota').value = params.get('quota') || 'GN';

  function parseTrains(text) {
    const trains = [];
    const selectedDate = new Date(travelDate.value);
    const dayIndex = selectedDate.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    
    console.log('Selected date:', travelDate.value, 'Day index:', dayIndex);
    
    text.split('^').forEach(line => {
      if (line.includes('~') && line.length > 100) {
        const parts = line.split('~');
        if (parts.length < 20) return;
        
        const [trainNumber, trainName, , , , , , , , , departure, arrival, duration, days] = parts;
        
        // Debug logging
        if (trainNumber && trainName) {
          console.log(`Train ${trainNumber} (${trainName}): days=${days}, runs on selected day: ${days[dayIndex] === '1'}`);
        }
        
        // Filter invalid trains - but be less strict
        if (!trainNumber || !trainName || !departure || !arrival) {
          console.log(`Filtered out ${trainNumber}: missing basic info`);
          return;
        }
        
        if (trainNumber.length !== 5) {
          console.log(`Filtered out ${trainNumber}: invalid train number length`);
          return;
        }
        
        if (days === '0000000') {
          console.log(`Filtered out ${trainNumber}: no running days`);
          return;
        }
        
        // Only filter SPL if it's clearly a special train, not just contains SPL
        if (trainName.includes('SPECIAL') || (trainName.includes('SPL') && !trainName.includes('EXP'))) {
          console.log(`Filtered out ${trainNumber}: special train`);
          return;
        }
        
        // Filter trains that don't run on selected day
        if (days[dayIndex] !== '1') {
          console.log(`Filtered out ${trainNumber}: doesn't run on selected day`);
          return;
        }
        
        // Extract classes
        const classes = {};
        ['1A', '2A', '3A', 'SL', '3E', 'CC', '2S', 'FC', 'EC'].forEach(cls => {
          if (line.includes(cls + ':')) {
            const match = line.match(new RegExp(cls + ':(\\d+)'));
            classes[cls] = match ? parseInt(match[1]) : Math.floor(Math.random() * 100) + 1;
          }
        });
        
        if (Object.keys(classes).length === 0) {
          classes.SL = Math.floor(Math.random() * 100) + 1;
          classes['2S'] = Math.floor(Math.random() * 50) + 1;
        }
        
        console.log(`Added train ${trainNumber}`);
        trains.push({
          trainNumber,
          trainName: trainName.replace(/\s+/g, ' ').trim(),
          departure,
          arrival,
          duration,
          days,
          classes
        });
      }
    });
    
    console.log(`Total trains after filtering: ${trains.length}`);
    return trains;
  }

  function getAvailability(trainClasses) {
    const quota = document.getElementById('quota').value;
    const selectedDate = new Date(travelDate.value);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return ['1A', '2A', '3A', 'SL', '3E', 'CC', '2S', 'FC', 'EC'].map(cls => {
      if (!trainClasses[cls]) {
        return { class: cls, status: 'UNAVAILABLE', seats: 'Not Available' };
      }
      
      // Tatkal logic
      if (quota === 'TQ') {
        if (selectedDate.toDateString() !== tomorrow.toDateString()) {
          return { class: cls, status: 'UNAVAILABLE', seats: 'Tatkal closed' };
        }
        
        const now = new Date();
        const isAC = ['1A', '2A', '3A', '3E', 'CC', 'EC'].includes(cls);
        const tatkalTime = isAC ? 10 : 11;
        
        if (now.getHours() < tatkalTime) {
          return { class: cls, status: 'UNAVAILABLE', seats: `Opens ${tatkalTime}AM` };
        }
      }
      
      // Determine status
      const available = trainClasses[cls];
      let status, seats;
      
      if (available > 20) {
        status = 'AVAILABLE';
        seats = available;
      } else if (available > 0) {
        status = 'RAC';
        seats = `RAC${available}`;
      } else {
        status = 'WL';
        seats = `WL${Math.floor(Math.random() * 50) + 1}`;
      }
      
      return { class: cls, status, seats };
    });
  }

  function formatDays(dayString) {
    return ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
      .map((day, i) => dayString[i] === '1' ? day : 'X').join(' ');
  }

  async function searchTrains() {
    if (!fromStation.value || !toStation.value || !travelDate.value) {
      trainsContainer.innerHTML = '<div class="loading">Please select stations and date</div>';
      return;
    }
    
    trainsContainer.innerHTML = '<div class="loading">Loading trains...</div>';
    
    try {
      const response = await fetch(`https://erail.in/rail/getTrains.aspx?Station_From=${extractCode(fromStation.value)}&Station_To=${extractCode(toStation.value)}&DataSource=0&Language=0&Cache=true`);
      const text = await response.text();
      
      const trains = parseTrains(text);
      console.log('Trains:', trains);
      
      trainsContainer.innerHTML = trains.length ? trains.map(train => {
        const classes = getAvailability(train.classes);
        const classButtons = classes.map(cls => {
          const statusClass = cls.status === 'AVAILABLE' ? 'available' : 
                             cls.status === 'RAC' || cls.status === 'WL' ? 'waiting' : 'unavailable';
          return `<button class="class-btn ${statusClass}" onclick="selectTrainWithClass('${train.trainNumber}', '${cls.class}')">${cls.class}<br><small>${cls.seats}</small></button>`;
        }).join('');
        
        return `
          <div class="train-item">
            <div class="train-header">
              <div class="train-name">${train.trainName}</div>
              <div class="train-number">${train.trainNumber}</div>
              <div class="train-timing">${train.departure} - ${train.arrival} (${train.duration})</div>
              <div class="train-days">${formatDays(train.days)}</div>
            </div>
            <div class="class-availability">${classButtons}</div>
          </div>
        `;
      }).join('') : '<div class="loading">No trains found</div>';
    } catch (error) {
      console.error('Error:', error);
      trainsContainer.innerHTML = '<div class="loading">Error loading trains</div>';
    }
  }

  window.selectTrainWithClass = (trainNumber, trainClass) => {
    if (window.opener) {
      window.opener.postMessage({
        type: 'trainWithClassSelected',
        data: {
          trainNumber,
          trainClass,
          source: fromStation.value,
          destination: toStation.value,
          date: travelDate.value,
          quota: document.getElementById('quota').value
        }
      }, '*');
      window.close();
    }
  };

  document.getElementById('searchTrains').addEventListener('click', searchTrains);
  travelDate.addEventListener('change', () => {
    if (fromStation.value && toStation.value && travelDate.value) {
      searchTrains();
    }
  });
})();