import os from "os";

/**
 * Function to check some specs of the host machine
 * @returns {object} returns the host machine's information as an object
 */

export const getHostInfo = () => {
    const hostname = os.hostname();
    const hostOS = detectPlatform();
    const arch = os.arch;
    const hostMachine = os.machine();
    const osRelease = os.release();
    const osType = os.type();
    const osUptime = os.uptime();

    return {
        hostname: hostname,
        hostOS: hostOS,
        arch: arch,
        hostMachine: hostMachine,
        osRelease: osRelease,
        osType: osType,
        osUptime: formatUptime(osUptime)
    }
}

/**
 * 
 * @param {number} seconds the seconds you want to format 
 * @returns {string} returns formatted string
 */
function formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secondsRemaning = seconds % 60;

    return `${hours}h ${minutes}m ${secondsRemaning.toFixed(2)}s`;
}

/**
 * 
 * @returns {string} returns the platform where Nodejs is running
 */

function detectPlatform() {
    if (os.platform() === "win32") return "Windows";
    if (os.platform() === "linux") return "Linux";
    if (os.platform() === "darwin") return "MacOS";
    if (os.platform() === "android") return "Android";
    if (os.platform() === "freebsd") return "FreeBSD";
    if (os.platform() === "openbsd") return "OpenBSD";
    if (os.platform() === "haiku") return "Haiku OS";
    if (os.platform() === "aix") return "IBM AIX";
    if (os.platform() === "sunos") return "SunOS";
    if (os.platform() === "cygwin") return "Cygwin";
    if (os.platform() === "netbsd") return "NetBSD";
    else return "Unknown OS";
}