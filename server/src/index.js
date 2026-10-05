const { createApp } = require('./app');
const pool = require('./db');

const port = process.env.PORT || 3000;
const server = createApp(pool).listen(port, () => console.log(`API listening on ${port}`));

process.on('SIGTERM', () => server.close(() => pool.end().then(() => process.exit(0))));