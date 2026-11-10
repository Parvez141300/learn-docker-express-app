import dotenv from "dotenv";
import express from 'express';
import path from 'path';
import { MongoClient, ServerApiVersion } from 'mongodb';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

const directoryName = path.dirname(fileURLToPath(import.meta.url));

// ---------- Middleware ----------
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve public/index.html at /sign-up
app.use('/sign-up', express.static(path.join(directoryName, 'public')));


// ---------- MongoDB (Stable API v1) ----------
const mongoDBUserName = process.env.MONGO_DB_USER;
const mongoDBPassword = process.env.MONGO_DB_PASS;

const uri = `mongodb+srv://${encodeURIComponent(mongoDBUserName)}:${encodeURIComponent(mongoDBPassword)}@cluster0.shcxnwl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// this is from mongo and mongo-express image container
// const uri = "mongodb://admin:qwerty@localhost:27017";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Module-level — routes close over this, set inside start()
let userCollection;

// ============================================================
// ROUTES — declared synchronously at top level
// ============================================================

app.get('/', (req, res) => {
  res.send('hello world from Docker!');
});

app.post('/sign-up', async (req, res) => {
  try {
    const { fullname, email, password, confirm_password } = req.body;

    // 1. Required fields
    if (!fullname || !email || !password || !confirm_password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // 2. Password match (before DB hit)
    if (password !== confirm_password) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    // 3. Duplicate check — findOne returns null when not found
    const existingUser = await userCollection.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // 4. Insert (hash password with bcrypt before storing in production)
    const result = await userCollection.insertOne({
      fullname,
      email,
      password,
      createdAt: new Date(),
    });

    return res.status(201).json({
      message: 'Signup successful',
      insertedId: result.insertedId,
    });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: 'Signup failed' });
  }
});

app.get('/users', async (req, res) => {
  try {
    // .toArray() is mandatory — find() returns a cursor
    const users = await userCollection
      .find({}, { projection: { password: 0 } })
      .toArray();

    res.status(200).json(users);
  } catch (err) {
    console.error('Users error:', err);
    res.status(500).json({ error: 'Failed to find users' });
  }
});

// ============================================================
// START — connect first, then listen
// ============================================================
async function start() {
  try {
    await client.connect();

    // Verify connection (per MongoDB official docs)
    await client.db('admin').command({ ping: 1 });
    console.log('✅ Pinged deployment — connected to MongoDB (Stable API v1)');

    userCollection = client.db('exampleDB').collection('user');
    // this is from mongo and mongo-express image conatiner
    // userCollection = client.db('exampleDB').collection('users');

    app.listen(port, () => {
      console.log(`🚀 Server running: http://localhost:${port}`);
      console.log(`📝 Signup form:  http://localhost:${port}/sign-up`);
    });
  } catch (err) {
    console.error('❌ Startup failed — could not reach MongoDB:', err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nClosing MongoDB connection...');
  await client.close();
  process.exit(0);
});

start();