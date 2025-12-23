const { exec } = require('child_process');
const { promisify } = require('util');
const os = require('os');
const execAsync = promisify(exec);

class PrerequisiteChecker {
  /**
   * Check if Java is installed and accessible in PATH
   * Android SDK tools require Java (JDK 8+)
   */
  async checkJava() {
    try {
      const { stdout } = await execAsync('java -version');
      // Note: java -version output often goes to stderr, so we check both or rely on exit code 0
      return { success: true, message: 'Java is installed' };
    } catch (error) {
      // Often java -version writes version info to stderr even on success, 
      // but execAsync throws only on non-zero exit code.
      // If code is 0, it's fine. If it throws, check if it's because command not found.
      if (error.stderr && error.stderr.includes('version')) {
        return { success: true, message: 'Java is installed (detected in stderr)' };
      }
      return { 
        success: false, 
        message: 'Java (JDK) not found. Please install Java 8 or newer and ensuring it is in your system PATH.',
        details: error.message
      };
    }
  }

  /**
   * Check if Hardware Virtualization is supported (Required for Emulator)
   * Linux: KVM
   * Windows: Hyper-V or HAXM
   */
  async checkVirtualization() {
    const platform = os.platform();

    try {
      if (platform === 'linux') {
        try {
          // On Linux, we check kvm-ok (from cpu-checker) or check /dev/kvm
          await execAsync('kvm-ok');
          return { success: true, message: 'KVM acceleration is usable' };
        } catch (e) {
            // Fallback: check if /dev/kvm exists and is readable
            try {
                await execAsync('test -r /dev/kvm');
                return { success: true, message: '/dev/kvm is accessible' };
            } catch (kError) {
                return { success: false, message: 'KVM is not accessible. Please install `cpu-checker` and ensure your user is in the `kvm` group.' };
            }
        }
      } else if (platform === 'win32') {
        // Simple check: systeminfo 
        // Real check is complex on Windows (Hyper-V vs HAXM), but we rely on valid exit of checks
        // Usually, the emulator installer will fail if HAXM/Hyper-V isn't possible, 
        // but checking beforehand is hard without admin scripts.
        // We will optimistically assume yes for now or check specifically if needed.
        return { success: true, message: 'Virtualization check skipped for Windows (handled by installer)' };
      } else if (platform === 'darwin') {
          return { success: true, message: 'Virtualization presumed available on macOS' };
      }
      
      return { success: true, message: 'Virtualization check not implemented for this OS' };
    } catch (error) {
      return { success: false, message: 'Virtualization check failed', error: error.message };
    }
  }

  async checkAll() {
    const java = await this.checkJava();
    const virt = await this.checkVirtualization();

    return {
      success: java.success && virt.success,
      java,
      virtualization: virt
    };
  }
}

module.exports = new PrerequisiteChecker();
