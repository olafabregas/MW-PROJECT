import { createServer } from 'http';
import app from './src/app.js';
import { connectDB } from './src/config/db.js';
import './src/config/env.js';

const port = process.env.PORT || 4000;

await connectDB();
const server = createServer(app);

server.listen(port, () => {
  console.log(`✅ Olympia API listening on http://localhost:${port}`);
});
