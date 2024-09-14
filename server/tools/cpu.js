import os from "os";

/**
 * Function to get cpu info
 * @returns {object} Cpu information as an object
 */
export const getCpuInfo = () => {
  const numCPUs = os.cpus().length;

  let modelName;
  let modelSpeed;
  let displayed = false;
  os.cpus().forEach(cpu => {
    if (displayed) return;
    modelName = cpu.model;
    modelSpeed = cpu.speed;
    return displayed = true;
  })

  return {
    cpuSpeed: formatHertz(modelSpeed),
    cpuModel: modelName,
    cpuCores: numCPUs,
    cpuParallelism: os.availableParallelism(),
  }
}

/**
 * 
 * @param {number} megaHertz the value for converting
 * @returns {number} returns the formatted Mhz value in Ghz
 */

function formatHertz(megaHertz) {
  try {
    let hertz = Number(megaHertz);
    let Ghz = hertz / 1000;
    return `${Ghz.toFixed(2)} Ghz`; // Round to 2 decimal places
  } catch (err) {
    return err;
  }
}