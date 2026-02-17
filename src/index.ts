import express from 'express';
import path from 'path';
import { config } from './config';
import walletRoutes from './routes/walletRoutes';

const app = express();
app.use(express.json());

app.get('/health', (_, res) => res.json({ status: 'ok' }));
app.use('/wallet', walletRoutes);

// Serve frontend demo
app.use(express.static(path.join(__dirname, '../frontend')));

app.listen(config.port, () => {
  console.log(`Wallet service running on port ${config.port}`);
  console.log(`Demo UI: http://localhost:${config.port}/`);
});
