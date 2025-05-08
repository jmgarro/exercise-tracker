const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const cors = require('cors');

const User = require('./models/User');

dotenv.config();
const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Create user
app.post('/api/users', async (req, res) => {
  try {
    console.log('POST /api/users raw req.body:', req.body);
    const { username } = req.body;
    console.log('POST /api/users parsed username:', username);
    if (!username || typeof username !== 'string' || username.trim() === '') {
      console.log('Validation failed: Username invalid');
      return res.status(400).json({ error: 'Username is required' });
    }
    const user = new User({ username: username.trim() });
    await user.save();
    console.log('User saved:', user);
    res.json({ username: user.username, _id: user._id });
  } catch (err) {
    console.error('POST /api/users error:', err);
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Username already taken' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, '_id username');
    console.log('Users found:', users);
    res.json(users);
  } catch (err) {
    console.error('GET /api/users error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add exercise
app.post('/api/users/:_id/exercises', async (req, res) => {
  try {
    console.log('POST /api/users/:_id/exercises raw req.body:', req.body, 'req.params:', req.params);
    if (!mongoose.Types.ObjectId.isValid(req.params._id)) {
      console.log('Validation failed: Invalid user ID');
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const user = await User.findById(req.params._id);
    if (!user) {
      console.log('User not found:', req.params._id);
      return res.status(404).json({ error: 'User not found' });
    }

    const { description, duration, date } = req.body;
    console.log('Parsed inputs:', { description, duration, date });

    if (!description || typeof description !== 'string' || description.trim() === '') {
      console.log('Validation failed: Description invalid');
      return res.status(400).json({ error: 'Description is required' });
    }
    const durationNum = parseInt(duration);
    if (isNaN(durationNum) || durationNum <= 0) {
      console.log('Validation failed: Duration invalid');
      return res.status(400).json({ error: 'Duration must be a positive number' });
    }

    let exerciseDate;
    if (!date || date === '') {
      exerciseDate = new Date();
    } else {
      exerciseDate = new Date(date);
      if (isNaN(exerciseDate.getTime())) {
        console.log('Validation failed: Invalid date format');
        return res.status(400).json({ error: 'Invalid date format' });
      }
    }

    const exercise = {
      description: description.trim(),
      duration: durationNum,
      date: exerciseDate
    };

    user.log.push(exercise);
    await user.save();
    console.log('Exercise added to user.log:', exercise);

    res.json({
      username: user.username,
      description: exercise.description,
      duration: exercise.duration,
      date: exercise.date.toDateString(),
      _id: user._id
    });
  } catch (err) {
    console.error('POST /api/users/:_id/exercises error:', err);
    res.status(400).json({ error: err.message });
  }
});

// Get exercise logs
app.get('/api/users/:_id/logs', async (req, res) => {
  try {
    console.log('GET /api/users/:_id/logs req.params:', req.params, 'req.query:', req.query);
    if (!mongoose.Types.ObjectId.isValid(req.params._id)) {
      console.log('Validation failed: Invalid user ID');
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const user = await User.findById(req.params._id);
    if (!user) {
      console.log('User not found:', req.params._id);
      return res.status(404).json({ error: 'User not found' });
    }

    let log = user.log || [];
    const { from, to, limit } = req.query;

    if (from && !isNaN(Date.parse(from))) {
      log = log.filter(ex => ex.date >= new Date(from));
    }

    if (to && !isNaN(Date.parse(to))) {
      log = log.filter(ex => ex.date <= new Date(to));
    }

    if (limit && !isNaN(parseInt(limit))) {
      log = log.slice(0, parseInt(limit));
    }

    console.log('Filtered log:', log);

    const formattedLog = log.map(ex => ({
      description: ex.description,
      duration: ex.duration,
      date: ex.date.toDateString()
    }));

    res.json({
      username: user.username,
      _id: user._id,
      count: formattedLog.length,
      log: formattedLog
    });
  } catch (err) {
    console.error('GET /api/users/:_id/logs error:', err);
    res.status(400).json({ error: err.message });
  }
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log(`Your app is listening on port ${listener.address().port}`);
});