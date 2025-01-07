const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const moment = require('moment-timezone'); // Import moment-timezone for IST timezone handling
const path = require('path'); // Import path module to resolve file paths
const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Serve static files (e.g., index.html, styles.css, scripts.js)
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB
mongoose
  .connect('mongodb://127.0.0.1/punchInPunchOut')
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('Failed to connect to MongoDB', err));

// Employee Punch Schema
const employeeSchema = new mongoose.Schema(
  {
    name: String,
    punchInTime: { type: String }, // Store time in IST format as a string
    punchOutTime: { type: String }, // Store time in IST format as a string
    date: { type: String, unique: true }, // Ensure date is unique per user
    createdAt: { type: Date, default: Date.now }, // Store createdAt as Date in IST
    updatedAt: { type: Date, default: Date.now }, // Store updatedAt as Date in IST
  },
  {
    timestamps: false, // Disable default timestamps from Mongoose
  }
);

// Middleware to handle manually setting `createdAt` and `updatedAt` in IST for each save
employeeSchema.pre('save', function (next) {
  const nowInIST = moment().tz('Asia/Kolkata').toDate(); // Get the current time in IST

  if (this.isNew) {
    // Set createdAt and updatedAt manually for new documents
    this.createdAt = nowInIST;
    this.updatedAt = nowInIST;
  } else {
    // Update the updatedAt for existing documents
    this.updatedAt = nowInIST;
  }

  next();
});

// Middleware to convert createdAt and updatedAt to IST format when sending responses
employeeSchema.methods.toJSON = function () {
  const obj = this.toObject();
  const timeZone = 'Asia/Kolkata';

  // Convert createdAt and updatedAt to IST (only when sending to the client)
  if (obj.createdAt) {
    obj.createdAt = moment(obj.createdAt).tz(timeZone).format('YYYY-MM-DD HH:mm:ss');
  }
  if (obj.updatedAt) {
    obj.updatedAt = moment(obj.updatedAt).tz(timeZone).format('YYYY-MM-DD HH:mm:ss');
  }
  return obj;
};

const EmployeePunch = mongoose.model('EmployeePunch', employeeSchema);

// Route to handle punch-in
app.post('/punchIn', async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Please provide a name' });
  }

  try {
    // Get current time in IST
    const nowInIST = moment().tz('Asia/Kolkata');
    const date = nowInIST.format('DD/MM/YYYY'); // Format date as DD/MM/YYYY
    const punchInTime = nowInIST.format('YYYY-MM-DD HH:mm:ss'); // Format time as a string in IST

    // Check if a record already exists for the user on the same date
    const existingRecord = await EmployeePunch.findOne({ name, date });

    if (existingRecord) {
      return res.status(400).json({ message: 'Already punched in for today' });
    }

    // Create a new punch-in record
    const newPunch = new EmployeePunch({
      name,
      punchInTime, // Save IST punch-in time as a string
      date, // Save IST date
    });

    // Save the record to MongoDB
    await newPunch.save();

    // Respond with punch-in time formatted in IST
    return res.status(200).json({
      message: 'Punched in successfully',
      punchInTime: nowInIST.format('h:mm:ss A'), // Send the time in IST format to the frontend
    });
  } catch (error) {
    console.error('Error punching in:', error);
    return res.status(500).json({ message: 'Error punching in', error });
  }
});

// Route to handle punch-out
app.post('/punchOut', async (req, res) => {
  const { name } = req.body;
  const date = moment().tz('Asia/Kolkata').format('DD/MM/YYYY'); // Use IST date format

  try {
    const record = await EmployeePunch.findOne({ name, date, punchOutTime: { $exists: false } });

    if (!record) {
      return res.status(400).json({ message: 'No punch-in record found or already punched out' });
    }

    // Get current punch-out time in IST
    const nowInIST = moment().tz('Asia/Kolkata');
    record.punchOutTime = nowInIST.format('YYYY-MM-DD HH:mm:ss'); // Save punch-out time as a string in IST format

    await record.save();

    // Respond with punch-out time formatted in IST
    res.status(200).json({
      message: 'Punched out successfully',
      punchOutTime: nowInIST.format('h:mm:ss A'), // Send the time in IST format to the frontend
    });
  } catch (error) {
    console.error('Error punching out:', error);
    res.status(500).json({ message: 'Error punching out', error });
  }
});

// Route to fetch all employee records
app.get('/records', async (req, res) => {
  try {
    const records = await EmployeePunch.find({});
    res.status(200).json(records);
  } catch (error) {
    console.error('Error fetching records:', error);
    res.status(500).json({ message: 'Error fetching records', error });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
