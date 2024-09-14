import os from "os";


/**
 * 
 * @returns {object} returns the host machine's memory info as an object
 */
export const calculateMemoryUsage = () => {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const memoryUsage = ((totalMemory - freeMemory) / totalMemory * 100).toFixed(2);
    return {
        totalMemory: formatBytes(totalMemory),
        freeMemory: formatBytes(freeMemory),
        memoryUsage: memoryUsage
    };
}

/**
 * 
 * @param {number} bytes the bytes you want to convert 
 * @returns {string} returns the formatted bytes
 */
function formatBytes(bytes) {
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}
