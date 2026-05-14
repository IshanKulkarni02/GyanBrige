#!/usr/bin/env node
/**
 * Network Setup Script
 * Detects your local IP and updates the network configuration
 * 
 * Usage: node scripts/setup-network.js
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

const log = {
  info: (msg) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  title: (msg) => console.log(`\n${colors.bright}${colors.blue}${msg}${colors.reset}\n`),
};

// Get all local IPv4 addresses
function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  
  for (const [name, ifaces] of Object.entries(interfaces)) {
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({
          name,
          address: iface.address,
        });
      }
    }
  }
  
  return addresses;
}

// Update the network config file
function updateNetworkConfig(ip) {
  const configPath = path.join(__dirname, '..', 'src', 'config', 'network.js');
  
  if (!fs.existsSync(configPath)) {
    log.error(`Config file not found: ${configPath}`);
    return false;
  }
  
  let content = fs.readFileSync(configPath, 'utf-8');
  
  // Replace the SERVER_IP line
  const regex = /const SERVER_IP = '[^']*';/;
  const newLine = `const SERVER_IP = '${ip}';`;
  
  if (regex.test(content)) {
    content = content.replace(regex, newLine);
    fs.writeFileSync(configPath, content);
    return true;
  }
  
  log.error('Could not find SERVER_IP in config file');
  return false;
}

// Main
async function main() {
  console.log(`
${colors.bright}${colors.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}
${colors.bright}${colors.green}   📱 GyanBrige Network Setup${colors.reset}
${colors.bright}${colors.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}
`);

  // Find local IPs
  const ips = getLocalIPs();
  
  if (ips.length === 0) {
    log.error('No network interfaces found!');
    log.info('Make sure you are connected to a Wi-Fi network.');
    process.exit(1);
  }
  
  log.title('🌐 Available Network Interfaces:');
  
  ips.forEach((ip, index) => {
    console.log(`   ${colors.cyan}${index + 1}.${colors.reset} ${ip.address} ${colors.bright}(${ip.name})${colors.reset}`);
  });
  
  // If only one IP, use it automatically
  let selectedIP;
  
  if (ips.length === 1) {
    selectedIP = ips[0].address;
    log.info(`\nUsing: ${colors.bright}${selectedIP}${colors.reset}`);
  } else {
    // Ask user to select
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    const answer = await new Promise((resolve) => {
      rl.question(`\n${colors.yellow}Select interface (1-${ips.length}):${colors.reset} `, resolve);
    });
    
    rl.close();
    
    const index = parseInt(answer, 10) - 1;
    if (index >= 0 && index < ips.length) {
      selectedIP = ips[index].address;
    } else {
      log.error('Invalid selection');
      process.exit(1);
    }
  }
  
  // Update config
  log.title('📝 Updating Configuration:');
  
  if (updateNetworkConfig(selectedIP)) {
    log.success(`Updated src/config/network.js with IP: ${selectedIP}`);
  } else {
    log.error('Failed to update config file');
    process.exit(1);
  }
  
  // Print instructions
  console.log(`
${colors.bright}${colors.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}
${colors.bright}${colors.green}   ✅ Setup Complete!${colors.reset}
${colors.bright}${colors.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}

${colors.bright}Your server IP:${colors.reset} ${colors.cyan}${selectedIP}${colors.reset}

${colors.bright}${colors.yellow}Next Steps:${colors.reset}

${colors.bright}1. Start the backend server:${colors.reset}
   ${colors.cyan}cd server && node transcriptionServer.js${colors.reset}

${colors.bright}2. Start the video server (optional):${colors.reset}
   ${colors.cyan}node scripts/videoProcessor.js serve${colors.reset}

${colors.bright}3. Start Expo:${colors.reset}
   ${colors.cyan}npx expo start${colors.reset}

${colors.bright}4. On your mobile device:${colors.reset}
   - Connect to the ${colors.yellow}same Wi-Fi network${colors.reset}
   - Scan the QR code with Expo Go
   - The app will connect to: ${colors.cyan}http://${selectedIP}:3001${colors.reset}

${colors.bright}${colors.yellow}Troubleshooting:${colors.reset}
   - Make sure firewall allows connections on ports 3001, 8080
   - Both devices must be on the same network
   - Try disabling VPN if connected

`);
}

main().catch(console.error);
