const startBtn = document.getElementById('startBtn');
const statusText = document.getElementById('status-text');
const errorMsg = document.getElementById('error-msg');

const steps = {
    prereq: document.getElementById('step-prereq'),
    download: document.getElementById('step-download'),
    install: document.getElementById('step-install'),
    create: document.getElementById('step-create'),
};

const progressBars = {
    download: document.getElementById('progress-download').parentElement,
    install: document.getElementById('progress-install').parentElement,
    downloadFill: document.getElementById('progress-download'),
    installFill: document.getElementById('progress-install'),
};

startBtn.addEventListener('click', () => {
    startBtn.disabled = true;
    statusText.textContent = 'Starting setup...';
    window.api.invoke('setup:start'); // Needs to be added to allow-list in preload
});

// We need to listen to IPC events for progress, but our preload mainly exposes 'invoke'.
// Ideally we should use `ipcRenderer.on` in preload. 
// For now, let's assume we update preload to expose a listener or we rely on the main process to send status?
// Actually, standard practice: preload exposes `onSetupStatus` callback.

// Let's assume we will update preload to expose:
// window.api.onSetupStatus((event, data) => handleStatus(data));

window.api.onSetupStatus((event, data) => {
    console.log('Status update:', data);

    if (data.error) {
        errorMsg.textContent = data.error;
        statusText.textContent = 'Setup Failed';
        startBtn.disabled = false;
        startBtn.textContent = 'Retry';
        return;
    }

    if (data.step) {
        // Reset all to default first? No, simple state machine
        if (data.step === 'prereq') setActive('prereq');
        if (data.step === 'download') setActive('download');
        if (data.step === 'install') setActive('install');
        if (data.step === 'create') setActive('create');
    }

    if (data.message) {
        statusText.textContent = data.message;
    }

    if (data.progress) {
        if (data.step === 'download') {
            progressBars.download.style.display = 'block';
            progressBars.downloadFill.style.width = data.progress + '%';
        }
        if (data.step === 'install') {
            progressBars.install.style.display = 'block';
            // Installation progress is text based mostly, so strictly bars might be hard
            // If we send fake progress or indeterminate
            progressBars.installFill.style.width = '50%'; // Indeterminate look
        }
    }

    if (data.complete) {
        Object.keys(steps).forEach(k => steps[k].classList.add('done'));
        statusText.textContent = 'Setup Complete! Launching App...';
        setTimeout(() => {
            window.api.invoke('setup:complete');
        }, 1000);
    }
});

function setActive(stepName) {
    // Mark previous as done
    if (stepName === 'download') steps.prereq.classList.add('done');
    if (stepName === 'install') steps.download.classList.add('done');
    if (stepName === 'create') steps.install.classList.add('done');

    Object.values(steps).forEach(el => el.classList.remove('active'));
    steps[stepName].classList.add('active');
}
