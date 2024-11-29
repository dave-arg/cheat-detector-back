function getEvidence(data, studentEui) {
  return {
    studentEui: studentEui,
    timestamp: data.ts,
    isBloodPressureMonitor: isBloodPressureMonitor(data),
    value: getValue(data),
  };
}

function isSuspiciousBPEvidence(data, baseValue) {
  const systolicBP = data.payload.bp_sys;
  //systolicBP always should be truthy
  return systolicBP ? systolicBP > baseValue * 1.2 : false;
}

function isSuspiciousHREvidence(data, baseValue) {
  const heartRate = data.payload?.hr || data.pulse * 60;
  //heartRate always should be truthy
  return heartRate ? heartRate > baseValue * 1.3 : false;
}

function isBloodPressureMonitor(data) {
  //if true we are dealing with a blood pressure
  //if false we are dealing with a heart rate monitor
  return data.model === "BPA";
}

function getValue(data) {
  let value = 0;
  if (isBloodPressureMonitor(data)) {
    value = data.payload.bp_sys;
  } else if (data?.payload?.hr) {
    value = data.payload.hr;
  } else {
    value = data.pulse * 60;
  }
  return value;
}

function isConsecutive(t1, t2) {
  const difference = Math.abs(t1 - t2);
  return difference <= 30 * 1000;
}

function checkEvidence(evidence, BPEHistory, HREHistory) {
  let lastBPE = null;
  let lastHRE = null;

  //caso base inicial , llega una evidencia BP
  //y no hay nada antes , la guardamos
  //si llega una evidencia HR y no hay evidencias BP registradas
  //descartamos la evidencia
  if (BPEHistory.length === 0) {
    if (evidence.isBloodPressureMonitor) {
      BPEHistory.push(evidence);
      return false;
    } else {
      return false;
    }
    //caso intermedio , llega una evidencia BP
    //y ya tenemos registrada alguna evidencia BP
    //si es consecutiva la guardamos
    //si no es consecutiva descartamos la evidencia
  } else if (evidence.isBloodPressureMonitor) {
    lastBPE = BPEHistory[BPEHistory.length - 1];
    if (isConsecutive(lastBPE.timestamp, evidence.timestamp)) {
      BPEHistory.push(evidence);
      return false;
    } else {
      return false;
    }
    //llega una evidencia HR , ya tenemos
    //alguna evidencia BP registrada , necesitamos que haya
    //almenos 2 evidencias BP para seguir considerando el caso
  } else if (BPEHistory.length < 3) {
    return false;
    //caso intermedio tibio
    //ya tenemos almenos 2 evidencias BP
    //y llega una evidencia HR
  } else if (HREHistory.length === 0) {
    //si es la primera HR chequeamos temporalidad
    //con respecto a la ultima evidencia BP y seguimos en camino
    //sino descartamos la evidencia
    lastBPE = BPEHistory[BPEHistory.length - 1];
    if (isConsecutive(lastBPE.timestamp, evidence.timestamp)) {
      HREHistory.push(evidence);
      return false;
    } else {
      return false;
    }
    //llega una evidencia HR y ya tenemos alguna evidencia HR registrada
    //ademas de tener 2 evidencias BP registradas
    //si aun no tenemos 3 evidencias HR guardadas
    //chequeamos temporalidad con respecto a la ultima evidencia HR y seguimos en camino
  } else if (HREHistory.length < 3) {
    lastHRE = HREHistory[HREHistory.length - 1];
    if (isConsecutive(lastHRE.timestamp, evidence.timestamp)) {
      HREHistory.push(evidence);
      return false;
    } else {
      return false;
    }
    //llega una evidencia HR y ya tenemos 2 evidencias BP registradas consecutivas y
    //2 evidencias HR registradas consecutivas, cuya 1ra HRE es consecutiva con la 2da BPE
    //chequeamos temporalidad con respecto a la ultima evidencia HR
    //si no es consecutiva descartamos la evidencia
  } else {
    lastHRE = HREHistory[HREHistory.length - 1];
    if (!isConsecutive(lastHRE.timestamp, evidence.timestamp)) {
      return false;
      //tenemos 3 evidencias HR registradas consecutivas
    } else {
      HREHistory.push(evidence);
      //tenemos un tramposo
      if (BPEHistory.length >= 4 && HREHistory.length >= 3) {
        return true;
      } else {
        return false;
      }
    }
  }
}

module.exports = {
  isSuspiciousHREvidence,
  isSuspiciousBPEvidence,
  checkEvidence,
  isBloodPressureMonitor,
  getEvidence,
};
