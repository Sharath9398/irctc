const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const https = require('https');
const AdmZip = require('adm-zip');

const execAsync = promisify(exec);

class SdkInstaller {
    constructor() {
        this.sdkRoot = null;
        this.cmdlineToolsPath = null;
        this.avdName = 'IrctcBotAVD';
        this.systemImage = 'system-images;android-30;google_apis;x86_64'; // Android 11
        this.avdRoot = null;
    }

    init(userDataPath) {
        this.sdkRoot = path.join(userDataPath, 'android-sdk');
        this.avdRoot = path.join(userDataPath, 'android-avd'); // Private AVD home
        // cmdline-tools structure: cmdline-tools/latest/bin
        this.cmdlineToolsPath = path.join(this.sdkRoot, 'cmdline-tools', 'latest', 'bin');
    }

    getSdkRoot() {
        return this.sdkRoot;
    }

    getAvdRoot() {
        return this.avdRoot;
    }

    getAvdName() {
        return this.avdName;
    }

    async checkEnvironment() {
        if (!this.sdkRoot) throw new Error('SdkInstaller not initialized. Call init() first.');

        const emulatorPath = path.join(this.sdkRoot, 'emulator', 'emulator');
        // With custom ANDROID_AVD_HOME, AVD ini files will be in avdRoot
        // avdmanager creates [name].ini in root of AVD_HOME and [name].avd folder
        const avdIniPath = path.join(this.avdRoot, `${this.avdName}.ini`);

        const hasSdk = fs.existsSync(this.cmdlineToolsPath);
        const hasEmulator = fs.existsSync(emulatorPath);
        // Strict check: does our specific ini exist in our private folder?
        const hasAvd = fs.existsSync(avdIniPath);

        return {
            valid: hasSdk && hasEmulator && hasAvd,
            hasSdk,
            hasEmulator,
            hasAvd
        };
    }

    getEnv() {
        return {
            ...process.env,
            ANDROID_HOME: this.sdkRoot,
            ANDROID_SDK_ROOT: this.sdkRoot,
            ANDROID_AVD_HOME: this.avdRoot // Force custom AVD location
        };
    }

    async downloadFile(url, destPath, onProgress) {
        // Ensure dir exists
        const dirname = path.dirname(destPath);
        if (!fs.existsSync(dirname)) {
            fs.mkdirSync(dirname, { recursive: true });
        }

        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(destPath);
            https.get(url, (response) => {
                if (response.statusCode !== 200) {
                    return reject(new Error(`Failed to download: ${response.statusCode}`));
                }

                const totalSize = parseInt(response.headers['content-length'], 10);
                let downloaded = 0;

                response.on('data', (chunk) => {
                    downloaded += chunk.length;
                    file.write(chunk);
                    if (onProgress && totalSize) {
                        onProgress(downloaded, totalSize);
                    }
                });

                response.on('end', () => {
                    file.end();
                    resolve();
                });
            }).on('error', (err) => {
                fs.unlink(destPath, () => { });
                reject(err);
            });
        });
    }

    async downloadCmdlineTools(onProgress) {
        if (!this.sdkRoot) throw new Error('Init first');

        // Create SDK dir
        if (!fs.existsSync(this.sdkRoot)) {
            fs.mkdirSync(this.sdkRoot, { recursive: true });
        }

        // Determine URL based on OS
        const platform = os.platform();
        let url = '';
        // Links from developer.android.com/studio#command-tools (Latest known stable)
        if (platform === 'linux') url = 'https://dl.google.com/android/repository/commandlinetools-linux-10406996_latest.zip';
        else if (platform === 'win32') url = 'https://dl.google.com/android/repository/commandlinetools-win-10406996_latest.zip';
        else if (platform === 'darwin') url = 'https://dl.google.com/android/repository/commandlinetools-mac-10406996_latest.zip';
        else throw new Error(`Unsupported platform: ${platform}`);

        const zipPath = path.join(this.sdkRoot, 'cmdline-tools.zip');

        console.log('[SdkInstaller] Downloading tools from', url);
        await this.downloadFile(url, zipPath, onProgress);

        console.log('[SdkInstaller] Extracting tools...');
        const zip = new AdmZip(zipPath);

        // Extract to a temp folder first to handle the internal structure
        const extractPath = path.join(this.sdkRoot, 'cmdline-tools', 'temp');
        zip.extractAllTo(extractPath, true);

        const innerRoot = path.join(extractPath, 'cmdline-tools');
        const finalPath = path.join(this.sdkRoot, 'cmdline-tools', 'latest');

        // Clean previous
        if (fs.existsSync(finalPath)) {
            fs.rmSync(finalPath, { recursive: true, force: true });
        }
        fs.mkdirSync(path.dirname(finalPath), { recursive: true });

        fs.renameSync(innerRoot, finalPath);

        // Cleanup temp
        fs.rmSync(path.join(this.sdkRoot, 'cmdline-tools', 'temp'), { recursive: true, force: true });
        fs.unlinkSync(zipPath);

        // Fix permissions on Linux/Mac
        if (platform !== 'win32') {
            const binPath = path.join(finalPath, 'bin');
            fs.chmodSync(path.join(binPath, 'sdkmanager'), '755');
            fs.chmodSync(path.join(binPath, 'avdmanager'), '755');
        }

        return true;
    }

    async installPackagesWithLicenses(onProgress) {
        if (!this.cmdlineToolsPath) throw new Error('SDK tools not found');
        const sdkmanager = path.join(this.cmdlineToolsPath, 'sdkmanager');
        const packages = [
            'platform-tools',
            'emulator',
            this.systemImage
        ];

        const args = packages.map(p => `"${p}"`).join(' ');
        const cmd = `"${sdkmanager}" --sdk_root="${this.sdkRoot}" ${args}`;

        console.log('[SdkInstaller] Running:', cmd);

        // On Linux: yes | cmd
        const yesCmd = os.platform() === 'win32' ? 'echo y |' : 'yes |';

        return new Promise((resolve, reject) => {
            const child = exec(`${yesCmd} ${cmd}`, {
                env: this.getEnv(),
                maxBuffer: 1024 * 1024 * 10 // 10MB buffer
            });

            child.stdout.on('data', (data) => {
                const text = data.toString();
                if (onProgress && text.includes('%')) {
                    onProgress(text.trim());
                }
            });

            child.stderr.on('data', (data) => console.error('[SDK Install Error]', data.toString()));

            child.on('exit', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`sdkmanager failed with code ${code}`));
            });
        });
    }

    async createAvd() {
        if (!this.cmdlineToolsPath) throw new Error('SDK tools not found');

        // Ensure AVD root exists
        if (!fs.existsSync(this.avdRoot)) {
            fs.mkdirSync(this.avdRoot, { recursive: true });
        }

        const avdmanager = path.join(this.cmdlineToolsPath, 'avdmanager');

        const cmd = `echo no | "${avdmanager}" create avd -n "${this.avdName}" -k "${this.systemImage}" --force`;

        console.log('[SdkInstaller] Creating AVD:', cmd);

        await execAsync(cmd, { env: this.getEnv() });
        return true;
    }
}

module.exports = new SdkInstaller();
