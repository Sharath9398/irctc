const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const sdkInstaller = require('./sdk-installer');

const execAsync = promisify(exec);

class EmulatorManager {

    getEmulatorPath() {
        const sdkRoot = sdkInstaller.getSdkRoot();
        if (!sdkRoot) throw new Error('SDK not initialized');
        return path.join(sdkRoot, 'emulator', 'emulator');
    }

    getAdbPath() {
        const sdkRoot = sdkInstaller.getSdkRoot();
        if (!sdkRoot) throw new Error('SDK not initialized');
        return path.join(sdkRoot, 'platform-tools', 'adb');
    }

    getEnv() {
        return sdkInstaller.getEnv();
    }

    async listAvds() {
        try {
            const emulatorBin = this.getEmulatorPath();
            const { stdout } = await execAsync(`"${emulatorBin}" -list-avds`, {
                env: this.getEnv()
            });
            return stdout.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        } catch (error) {
            console.error('[EmulatorManager] listAvds error:', error.message);
            return [];
        }
    }

    async launchAvd(avdName) {
        const emulatorBin = this.getEmulatorPath();
        console.log(`[EmulatorManager] Launching AVD: ${avdName}`);

        // Launch detached process
        // -gpu swiftshader_indirect might be safer for headless/cloud envs, but for local user 'auto' is fine or 'host'
        // -no-boot-anim speeds up boot time perception
        const args = ['-avd', avdName, '-no-boot-anim'];

        const child = spawn(emulatorBin, args, {
            detached: true,
            stdio: 'ignore',
            env: this.getEnv()
        });

        child.unref(); // Allow parent to exit independent of child

        return { success: true, pid: child.pid };
    }

    async waitForBoot(timeoutMs = 60000) {
        const adbBin = this.getAdbPath();
        const startTime = Date.now();

        console.log('[EmulatorManager] Waiting for boot...');

        while (Date.now() - startTime < timeoutMs) {
            try {
                // Check 1: Is device visible?
                const devicesOut = await execAsync(`"${adbBin}" devices`);
                if (!devicesOut.stdout.includes('emulator-')) {
                    await new Promise(r => setTimeout(r, 1000));
                    continue;
                }

                // Check 2: Bool completed prop
                // We use the first emulator found for simplicity
                const { stdout } = await execAsync(`"${adbBin}" -e shell getprop sys.boot_completed`, {
                    env: this.getEnv()
                });

                if (stdout.trim() === '1') {
                    console.log('[EmulatorManager] Boot completed!');
                    return true;
                }
            } catch (e) {
                // Ignore transient errors
            }
            await new Promise(r => setTimeout(r, 1000));
        }

        throw new Error('Timeout waiting for emulator boot');
    }
}

module.exports = new EmulatorManager();
