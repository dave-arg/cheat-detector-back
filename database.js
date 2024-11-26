const { Sequelize, DataTypes } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: "cheat-detector.db",
  logging: false,
});

const Student = sequelize.define("Student", {
  eui: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  baseBloodPressure: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  baseHeartRate: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  heartRateMonitorEui: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  bloodPressureMonitorEui: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  isCheating: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
  },
});

const Evidence = sequelize.define("Evidence", {
  id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  studentEui: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  timestamp: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  isBloodPressureMonitor: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
  },
  value: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
});

// Preload Students, we avoid a Device
// table for simplicity and asume that
// every student has a pair of valid
// devices registered also define the
// Evidence model to store suspicious
// data in the future as a proof of cheating

async function initializeDatabase() {
  await sequelize.sync({ force: true });

  for (let i = 1; i <= 10; i++) {
    await Student.create({
      eui: uuidv4(),
      name: `Student ${i}`,
      baseBloodPressure: Math.floor(Math.random() * (120 - 80 + 1)) + 80, // Random value between 80-120
      baseHeartRate: Math.floor(Math.random() * (100 - 60 + 1)) + 60, // Random value between 60-100
      heartRateMonitorEui: uuidv4(),
      bloodPressureMonitorEui: uuidv4(),
      isCheating: false,
    });
  }
}

async function insertEvidenceHistory(HREHistory, BPEHistory) {
  for (const evidence of BPEHistory) {
    await Evidence.create(evidence);
  }
  for (const evidence of HREHistory) {
    await Evidence.create(evidence);
  }
}

async function getEvidenceByStudentEui(studentEui) {
  return await Evidence.findAll({
    where: {
      studentEui: studentEui,
    },
  });
}

async function getStudents() {
  return await Student.findAll();
}

async function getStudentByBPMonitorEui(bloodPressureMonitorEui) {
  return await Student.findOne({ where: { bloodPressureMonitorEui } });
}

async function getStudentByHRMonitorEui(heartRateMonitorEui) {
  return await Student.findOne({ where: { heartRateMonitorEui } });
}

async function updateStudentAsCheater(studentEui, isCheating) {
  return await Student.update(
    { isCheating },
    {
      where: {
        eui: studentEui,
      },
    }
  );
}

module.exports = {
  Student,
  Evidence,
  sequelize,
  initializeDatabase,
  insertEvidenceHistory,
  getEvidenceByStudentEui,
  updateStudentAsCheater,
  getStudents,
  getStudentByBPMonitorEui,
  getStudentByHRMonitorEui,
};
