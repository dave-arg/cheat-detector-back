const express = require("express");
const cors = require("cors");

const {
  initializeDatabase,
  insertEvidenceHistory,
  getStudentByBPMonitorEui,
  getStudentByHRMonitorEui,
  getStudents,
  getEvidenceByStudentEui,
  updateStudentAsCheater,
} = require("./database");
const {
  isSuspiciousHREvidence,
  isSuspiciousBPEvidence,
  checkEvidence,
  getEvidence,
  isBloodPressureMonitor,
} = require("./helpers");

const app = express();

app.use(express.json());
app.use(cors());

const SuspiciousHREByStudent = new Map();
const SuspiciousBPEByStudent = new Map();

//Initialize database and preload students
//Start server
initializeDatabase()
  .then(() => {
    console.log("STUDENTS PRELOADED");
    getStudents().then((students) => {
      students.forEach((student) => {
        SuspiciousHREByStudent.set(student.eui, []);
        SuspiciousBPEByStudent.set(student.eui, []);
      });
    });
    app.listen(5000, () => {
      console.log(`API ON: http://localhost:5000`);
    });
  })
  .catch((err) => {
    console.error("FAILED TO INITIALIZE DATABASE:", err);
    process.exit(1);
  });

//Route to handle sensor data ingestion, we asume that every data request received is valid
//all data comes from a blood pressure/heart rate monitor asigned toa student
//we re no considering the case of package loosing or data corruption
app.post("/api/data", async (req, res) => {
  try {
    const data = req.body;

    //Check if data is a blood pressure monitor evidence
    //or a heart rate monitor evidence
    const isBPE = isBloodPressureMonitor(data);

    //Get current device owner student by monitor EUI
    //regarding the monitor type
    let currentStudent = isBPE
      ? await getStudentByBPMonitorEui(data.eui)
      : await getStudentByHRMonitorEui(data.eui);
    currentStudent = currentStudent?.dataValues;

    //This should never happen
    if (!currentStudent) {
      return res
        .status(404)
        .send({ message: "Student not found, invalid student or monitor eui" });
    }

    //Check if data is suspicious using student base values
    //regarding the monitor type
    const suspiciousEvidence = isBPE
      ? isSuspiciousBPEvidence(data, currentStudent.baseBloodPressure)
      : isSuspiciousHREvidence(data, currentStudent.baseHeartRate);

    if (!suspiciousEvidence) {
      return res.status(200).send({
        message: "No worries data discarded, the evidence has normal values",
      });
    }

    //Now we have a suspicious evidence
    //we create an evidence object from the data
    //with the current student eui for future storage
    //at this point evidence should be always truthy
    const evidence = getEvidence(data, currentStudent.eui);

    const confirmedEvidence = checkEvidence(
      evidence,
      SuspiciousBPEByStudent.get(evidence.studentEui),
      SuspiciousHREByStudent.get(evidence.studentEui)
    );

    //Not all conditions are met to confirm cheating
    //due to several reasons like no previous evidence
    //or no consecutive evidence
    if (!confirmedEvidence) {
      res.status(200).send({
        message: "Cheating not confirmed",
      });
      //All conditions are met to confirm cheating
      //we store all the evidence for future display
    } else {
      insertEvidenceHistory(
        SuspiciousBPEByStudent.get(evidence.studentEui),
        SuspiciousHREByStudent.get(evidence.studentEui)
      );
      updateStudentAsCheater(evidence.studentEui, true);
      res.status(200).send({
        message: "Cheating confirmed, the cheater has been reported",
        data: currentStudent,
      });
    }
  } catch (err) {
    res.status(500).send({ message: "Internal server error" });
  }
});

app.get("/api/student", async (req, res) => {
  try {
    const students = await getStudents();
    res.status(200).send(students);
  } catch (err) {
    res.status(500).send({ message: "Internal server error" });
  }
});

app.get("/api/evidence/:studentEui", async (req, res) => {
  try {
    const { studentEui } = req.params;

    const evidence = await getEvidenceByStudentEui(studentEui);

    if (evidence.length === 0) {
      return res
        .status(200)
        .send({ message: "No evidence found for this student" });
    }

    res.status(200).send(evidence);
  } catch (err) {
    res.status(500).send({ message: "Internal server error" });
  }
});

module.exports = app;
