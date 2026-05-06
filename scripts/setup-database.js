#!/usr/bin/env node

/**
 * Backward compatibility script for setup-database.js
 * This script simply calls the new-server-setup.js script
 */

console.log('🔄 Redirecting to new setup script...');

// Import and run the new server setup
const newServerSetup = require('./new-server-setup.js');

// Run the setup
newServerSetup()
    .then(() => {
        console.log('✅ Setup completed successfully');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Setup failed:', error);
        process.exit(1);
    });
