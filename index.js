const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');  // Import path module to resolve file paths
const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Serve static files (e.g., index.html, styles.css, scripts.js)
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB
mongoose.connect('mongodb://127.0.0.1/punchInPunchOut')
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('Failed to connect to MongoDB', err));

// Employee Punch Schema
const employeeSchema = new mongoose.Schema({
  name: String,
  punchInTime: Date,
  punchOutTime: Date,
  date: { type: String, unique: true },
});

const EmployeePunch = mongoose.model('EmployeePunch', employeeSchema);

// Route to handle punch-in
app.post('/punchIn', async (req, res) => {
  const { name } = req.body;
  const date = new Date().toLocaleDateString();
  
  try {
    const existingRecord = await EmployeePunch.findOne({ name, date });

    if (existingRecord) {
      return res.status(400).json({ message: 'Already punched in for today' });
    }

    const newPunch = new EmployeePunch({
      name,
      punchInTime: new Date(),
      date,
    });
    
    await newPunch.save();
    res.status(200).json({ message: 'Punched in successfully', data: newPunch });
  } catch (error) {
    res.status(500).json({ message: 'Error punching in', error });
  }
});

// Route to handle punch-out
app.post('/punchOut', async (req, res) => {
  const { name } = req.body;
  const date = new Date().toLocaleDateString();
  
  try {
    const record = await EmployeePunch.findOne({ name, date, punchOutTime: { $exists: false } });

    if (!record) {
      return res.status(400).json({ message: 'No punch-in record found or already punched out' });
    }

    record.punchOutTime = new Date();
    await record.save();

    res.status(200).json({ message: 'Punched out successfully', data: record });
  } catch (error) {
    res.status(500).json({ message: 'Error punching out', error });
  }
});

// Start server
app.listen(5000, () => {
  console.log("Server running on http://localhost:${PORT}");
});