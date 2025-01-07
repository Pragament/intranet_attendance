const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const moment = require('moment-timezone');
const app = express();
const path = require('path');
const fs = require('fs'); // To work with file system
const PORT = 5000;

// Your GitHub Token and Repo Details
const GITHUB_TOKEN = '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';
const REPO_OWNER = 'Pragament';
const REPO_NAME = 'intranet_attendance'; // Your repo name
const FILE_PATH = 'attendance.json'; // File inside your repo to store attendance

// Middleware
app.use(bodyParser.json());

// Serve static files (e.g., index.html, styles.css, scripts.js)
app.use(express.static(path.join(__dirname, 'public')));

// Optionally, you can define the root route (GET '/') to serve the index.html file explicitly
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Function to create or update the attendance file in GitHub
const updateGitHubFile = async (filename, content) => {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filename}`;

  // Get the current file from GitHub to get the sha (if it exists)
  const fileResponse = await axios.get(url, {
    headers: { Authorization: `token ${GITHUB_TOKEN}` }
  }).catch(() => null);

  const sha = fileResponse ? fileResponse.data.sha : null; // Get sha if file exists, else null

  const base64Content = Buffer.from(content).toString('base64');

  const commitMessage = `Update attendance data`;

  // Prepare request payload
  const data = {
    message: commitMessage,
    content: base64Content,
    sha: sha // Only include sha if the file exists
  };

  // Post request to update file on GitHub
  const response = await axios.put(url, data, {
    headers: { Authorization: `token ${GITHUB_TOKEN}` }
  });

  return response.data;
};

// Helper function to get today's date in the format "DD-MM-YYYY"
const getTodayDate = () => {
  const nowInIST = moment().tz('Asia/Kolkata');
  return nowInIST.format('DD-MM-YYYY'); // Format date as DD-MM-YYYY
};

// Route to handle punch-in
app.post('/punchIn', async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Please provide a name' });
  }

  try {
    const date = getTodayDate(); // Get today's date
    const punchInTime = moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss'); // Current time in IST

    // Fetch existing attendance data from GitHub (if any)
    let existingData = {};
    try {
      const fileResponse = await axios.get(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
        {
          headers: { Authorization: `token ${GITHUB_TOKEN}` }
        }
      );
      const base64Content = fileResponse.data.content;
      existingData = JSON.parse(Buffer.from(base64Content, 'base64').toString());
    } catch (error) {
      // If no file exists, initialize with an empty object
      existingData = {};
    }

    // Check if the student has already punched in for the current day
    const todayData = existingData[date] || [];
    const existingRecord = todayData.find(
      (record) => record.name === name && record.punchInTime
    );

    if (existingRecord) {
      return res.status(400).json({ message: 'You have already punched in today' });
    }

    // Prepare attendance data
    const punchInData = {
      name: name,
      date: date,
      punchInTime: punchInTime,
      punchOutTime: null, // Initially, no punch-out time
    };

    // Add the new punch-in data to the existing data for today
    todayData.push(punchInData);
    existingData[date] = todayData;

    // Update the attendance file with the new data
    const updateResponse = await updateGitHubFile(FILE_PATH, JSON.stringify(existingData, null, 2));

    res.status(200).json({
      message: 'Punched in successfully',
      punchInTime: punchInTime,
    });
  } catch (error) {
    console.error('Error punching in:', error);
    res.status(500).json({ message: 'Error punching in', error });
  }
});

// Route to handle punch-out
app.post('/punchOut', async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Please provide a name' });
  }

  try {
    const date = getTodayDate(); // Get today's date
    const punchOutTime = moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss'); // Current time in IST

    // Fetch existing attendance data from GitHub (if any)
    let existingData = {};
    try {
      const fileResponse = await axios.get(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
        {
          headers: { Authorization: `token ${GITHUB_TOKEN}` }
        }
      );
      const base64Content = fileResponse.data.content;
      existingData = JSON.parse(Buffer.from(base64Content, 'base64').toString());
    } catch (error) {
      // If no file exists, initialize with an empty object
      existingData = {};
    }

    // Check if the student has punched in today
    const todayData = existingData[date] || [];
    const existingRecord = todayData.find(
      (record) => record.name === name && record.punchInTime && !record.punchOutTime
    );

    if (!existingRecord) {
      return res.status(400).json({ message: 'You need to punch in first before punching out' });
    }

    // Update punch-out time for the student
    existingRecord.punchOutTime = punchOutTime;
    existingData[date] = todayData;

    // Update the attendance file for the day on GitHub
    const updateResponse = await updateGitHubFile(FILE_PATH, JSON.stringify(existingData, null, 2));

    res.status(200).json({
      message: 'Punched out successfully',
      punchOutTime: punchOutTime,
    });
  } catch (error) {
    console.error('Error punching out:', error);
    res.status(500).json({ message: 'Error punching out', error });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
