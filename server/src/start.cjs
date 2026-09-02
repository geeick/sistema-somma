const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { installFinancialGuards } = require('./financial-guard.cjs');

(async () => {
  try {
    await installFinancialGuards();
  } catch (error) {
    console.error('[financial-guard] failed to install protections:', error);
    process.exit(1);
  }

  require('./metrics-auto-sync.cjs');
  require('./index.js');
})();
