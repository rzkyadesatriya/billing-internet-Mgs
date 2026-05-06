// mikrotik-commands.js - Module for handling Mikrotik commands via WhatsApp
const logger = require('./logger');
const { getSetting } = require('./settingsManager');
const {
    addHotspotUser,
    addPPPoESecret,
    setPPPoEProfile,
    getResourceInfo,
    getActiveHotspotUsers,
    getActivePPPoEConnections,
    getInactivePPPoEUsers,
    deleteHotspotUser,
    deletePPPoESecret,
    getInterfaces,
    getInterfaceDetail,
    setInterfaceStatus,
    getIPAddresses,
    addIPAddress,
    deleteIPAddress,
    getRoutes,
    addRoute,
    deleteRoute,
    getDHCPLeases,
    getDHCPServers,
    pingHost,
    getSystemLogs,
    getPPPoEProfiles,
    getHotspotProfiles,
    getFirewallRules,
    restartRouter,
    getRouterIdentity,
    setRouterIdentity,
    getRouterClock,
    getAllUsers
} = require('./mikrotik');

let sock = null;

// Fungsi untuk set instance sock
function setSock(sockInstance) {
    sock = sockInstance;
}

// Handler untuk menambah user hotspot
async function handleAddHotspotUser(remoteJid, params) {
    if (!sock) {
        console.error('Sock instance not set');
        return;
    }

    if (params.length < 2) {
        await sock.sendMessage(remoteJid, { 
            text: `❌ *Format Salah!*\n\n` +
                  `Format yang benar:\n` +
                  `addhotspot [username] [password] [profile]\n\n` +
                  `Contoh:\n` +
                  `• addhotspot user123 pass123\n` +
                  `• addhotspot user123 pass123 default`
        });
        return;
    }

    const [username, password, profile = "default"] = params;
    const result = await addHotspotUser(username, password, profile);

    await sock.sendMessage(remoteJid, { 
        text: `${result && result.success ? '✅' : '❌'} ${result && result.message ? result.message : 'Terjadi kesalahan'}\n\n` +
              `Username: ${username}\n` +
              `Profile: ${profile}`
    });
}

// Handler untuk menambah secret PPPoE
async function handleAddPPPoESecret(remoteJid, params) {
    if (!sock) {
        console.error('Sock instance not set');
        return;
    }

    if (params.length < 2) {
        await sock.sendMessage(remoteJid, { 
            text: `❌ *Format Salah!*\n\n` +
                  `Format yang benar:\n` +
                  `addpppoe [username] [password] [profile] [ip]\n\n` +
                  `Contoh:\n` +
                  `• addpppoe user123 pass123\n` +
                  `• addpppoe user123 pass123 default\n` +
                  `• addpppoe user123 pass123 default 10.0.0.1`
        });
        return;
    }

    const [username, password, profile = "default", localAddress = ""] = params;
    const result = await addPPPoESecret(username, password, profile, localAddress);

    await sock.sendMessage(remoteJid, { 
        text: `${result && result.success ? '✅' : '❌'} ${result && result.message ? result.message : 'Terjadi kesalahan'}\n\n` +
              `Username: ${username}\n` +
              `Profile: ${profile}\n` +
              `IP: ${localAddress || 'Menggunakan IP dari pool'}`
    });
}

// Handler untuk mengubah profile PPPoE
async function handleChangePPPoEProfile(remoteJid, params) {
    if (!sock) {
        console.error('Sock instance not set');
        return;
    }

    if (params.length < 2) {
        await sock.sendMessage(remoteJid, { 
            text: `❌ *Format Salah!*\n\n` +
                  `Format yang benar:\n` +
                  `setprofile [username] [new-profile]\n\n` +
                  `Contoh:\n` +
                  `setprofile user123 premium`
        });
        return;
    }

    const [username, newProfile] = params;
    const result = await setPPPoEProfile(username, newProfile);

    await sock.sendMessage(remoteJid, { 
        text: `${result && result.success ? '✅' : '❌'} ${result && result.message ? result.message : 'Terjadi kesalahan'}\n\n` +
              `Username: ${username}\n` +
              `Profile Baru: ${newProfile}`
    });
}

// Handler untuk monitoring resource
async function handleResourceInfo(remoteJid) {
    if (!sock) {
        console.error('Sock instance not set');
        return;
    }

    // Kirim pesan loading
    await sock.sendMessage(remoteJid, {
        text: `⏳ *Mengambil Info Resource Router*\n\nSedang memproses...`
    });

    const result = await getResourceInfo();
    if (!result.success || !result.data) {
        await sock.sendMessage(remoteJid, { text: `❌ ${result.message}` });
        return;
    }

    const data = result.data;

    // Format CPU info
    let cpuInfo = `💻 *CPU*\n• Load: ${data.cpuLoad}%\n`;
    if (data.cpuCount > 0) cpuInfo += `• Count: ${data.cpuCount}\n`;
    if (data.cpuFrequency > 0) cpuInfo += `• Frequency: ${data.cpuFrequency} MHz\n`;

    // Format Memory info dengan penanganan data tidak tersedia
    let memoryInfo = `💾 *MEMORY*\n`;
    if (data.totalMemory > 0) {
        const memUsagePercent = ((data.memoryUsed / data.totalMemory) * 100).toFixed(1);
        memoryInfo += `• Free: ${data.memoryFree.toFixed(2)} MB\n`;
        memoryInfo += `• Total: ${data.totalMemory.toFixed(2)} MB\n`;
        memoryInfo += `• Used: ${data.memoryUsed.toFixed(2)} MB\n`;
        memoryInfo += `• Usage: ${memUsagePercent}%\n`;
    } else {
        memoryInfo += `• Status: ⚠️ Data tidak tersedia\n`;
        if (data.rawTotalMem) memoryInfo += `• Raw Total: ${data.rawTotalMem}\n`;
        if (data.rawFreeMem) memoryInfo += `• Raw Free: ${data.rawFreeMem}\n`;
    }

    // Format Disk info
    let diskInfo = `💿 *DISK*\n`;
    if (data.totalDisk > 0) {
        const diskUsagePercent = ((data.diskUsed / data.totalDisk) * 100).toFixed(1);
        diskInfo += `• Total: ${data.totalDisk.toFixed(2)} MB\n`;
        diskInfo += `• Free: ${data.diskFree.toFixed(2)} MB\n`;
        diskInfo += `• Used: ${data.diskUsed.toFixed(2)} MB\n`;
        diskInfo += `• Usage: ${diskUsagePercent}%\n`;
    } else {
        diskInfo += `• Status: ⚠️ Data tidak tersedia\n`;
    }

    // Format Traffic info
    let trafficInfo = `📶 *TRAFFIC* (${getSetting('main_interface', 'ether1')})\n`;
    trafficInfo += `• RX: ${data.trafficRX} Mbps\n`;
    trafficInfo += `• TX: ${data.trafficTX} Mbps\n`;

    // Format System info
    let systemInfo = `⏰ *UPTIME*\n• ${data.uptime}\n\n`;
    systemInfo += `🔧 *SYSTEM INFO*\n`;
    if (data.model !== 'N/A') systemInfo += `• Model: ${data.model}\n`;
    if (data.architecture !== 'N/A') systemInfo += `• Architecture: ${data.architecture}\n`;
    if (data.version !== 'N/A') systemInfo += `• Version: ${data.version}\n`;
    if (data.boardName !== 'N/A') systemInfo += `• Board: ${data.boardName}\n`;
    if (data.serialNumber !== 'N/A') systemInfo += `• Serial: ${data.serialNumber}\n`;
    if (data.temperature !== 'N/A') systemInfo += `• Temperature: ${data.temperature}°C\n`;
    if (data.voltage !== 'N/A') systemInfo += `• Voltage: ${data.voltage}V\n`;
    if (data.badBlocks !== 'N/A') systemInfo += `• Bad Blocks: ${data.badBlocks}\n`;

    const message = `📊 *INFO RESOURCE ROUTER*\n\n${cpuInfo}\n${memoryInfo}\n${diskInfo}\n${trafficInfo}\n${systemInfo}`;

    await sock.sendMessage(remoteJid, { text: message });
}

// Handler untuk melihat user hotspot aktif
async function handleActiveHotspotUsers(remoteJid) {
    if (!sock) {
        console.error('Sock instance not set');
        return;
    }
    const result = await getActiveHotspotUsers();
    if (!result.success) {
        await sock.sendMessage(remoteJid, { text: `❌ ${result.message}` });
        return;
    }
    const users = result.data;
    let message = '👥 *DAFTAR USER HOTSPOT AKTIF*\n\n';
    if (!users || users.length === 0) {
        message += 'Tidak ada user hotspot yang aktif';
    } else {
        message += `Total: ${users.length} user\n\n`;
        users.forEach((user, index) => {
            if (index < 20) {
                message += `${index + 1}. *User: ${user.user || 'N/A'}*\n` +
                          `   • IP: ${user.address || 'N/A'}\n` +
                          `   • Uptime: ${user.uptime || 'N/A'}\n`;

                // Parse bytes data dengan validasi yang lebih baik
                if (user['bytes-in'] !== undefined && user['bytes-out'] !== undefined) {
                    // Helper function untuk parsing bytes
                    const parseBytes = (value) => {
                        if (value === null || value === undefined || value === '') return 0;

                        // Jika sudah berupa number
                        if (typeof value === 'number') return value;

                        // Jika berupa string, parse sebagai integer
                        if (typeof value === 'string') {
                            const parsed = parseInt(value.replace(/[^0-9]/g, ''));
                            return isNaN(parsed) ? 0 : parsed;
                        }

                        return 0;
                    };

                    const bytesIn = parseBytes(user['bytes-in']);
                    const bytesOut = parseBytes(user['bytes-out']);

                    message += `   • Download: ${(bytesIn/1024/1024).toFixed(2)} MB\n` +
                              `   • Upload: ${(bytesOut/1024/1024).toFixed(2)} MB\n`;
                } else {
                    message += `   • Download: 0.00 MB\n` +
                              `   • Upload: 0.00 MB\n`;
                }
                message += '\n';
            }
        });
        if (users.length > 20) {
            message += `... dan ${users.length - 20} user lainnya`;
        }
    }
    await sock.sendMessage(remoteJid, { text: message });
}

// Handler untuk melihat koneksi PPPoE aktif
async function handleActivePPPoE(remoteJid) {
    if (!sock) {
        console.error('Sock instance not set');
        return;
    }
    const result = await getActivePPPoEConnections();
    if (!result.success) {
        await sock.sendMessage(remoteJid, { text: `❌ ${result.message}` });
        return;
    }
    const connections = result.data;
    let message = '📡 *DAFTAR KONEKSI PPPoE AKTIF*\n\n';
    if (!connections || connections.length === 0) {
        message += 'Tidak ada koneksi PPPoE yang aktif';
    } else {
        message += `Total: ${connections.length} koneksi\n\n`;
        const maxDisplay = 20;
        const displayConnections = connections.slice(0, maxDisplay);
        displayConnections.forEach((conn, index) => {
            message += `${index + 1}. *User: ${conn.name || 'N/A'}*\n`;
            if (conn.service) message += `   • Service: ${conn.service}\n`;
            if (conn.address) message += `   • IP: ${conn.address}\n`;
            if (conn.uptime) message += `   • Uptime: ${conn.uptime}\n`;
            if (conn.caller) message += `   • Caller ID: ${conn.caller}\n`;
            message += '\n';
        });
        if (connections.length > maxDisplay) {
            message += `... dan ${connections.length - maxDisplay} koneksi lainnya`;
        }
    }
    await sock.sendMessage(remoteJid, { text: message });
}

// Handler untuk menghapus user hotspot
async function handleDeleteHotspotUser(remoteJid, params) {
    if (!sock) {
        console.error('Sock instance not set');
        return;
    }

    if (params.length < 1) {
        await sock.sendMessage(remoteJid, { 
            text: `❌ *Format Salah!*\n\n` +
                  `Format yang benar:\n` +
                  `delhotspot [username]\n\n` +
                  `Contoh:\n` +
                  `• delhotspot user123`
        });
        return;
    }

    const [username] = params;
    const result = await deleteHotspotUser(username);

    await sock.sendMessage(remoteJid, { 
        text: `${result && result.success ? '✅' : '❌'} ${result && result.message ? result.message : 'Terjadi kesalahan'}\n\n` +
              `Username: ${username}`
    });
}

// Handler untuk menghapus PPPoE secret
async function handleDeletePPPoESecret(remoteJid, params) {
    if (!sock) {
        console.error('Sock instance not set');
        return;
    }

    if (params.length < 1) {
        await sock.sendMessage(remoteJid, { 
            text: `❌ *Format Salah!*\n\n` +
                  `Format yang benar:\n` +
                  `delpppoe [username]\n\n` +
                  `Contoh:\n` +
                  `• delpppoe user123`
        });
        return;
    }

    const [username] = params;
    const result = await deletePPPoESecret(username);

    await sock.sendMessage(remoteJid, { 
        text: `${result && result.success ? '✅' : '❌'} ${result && result.message ? result.message : 'Terjadi kesalahan'}\n\n` +
              `Username: ${username}`
    });
}

// Handler untuk melihat user PPPoE offline
async function handleOfflineUsers(remoteJid) {
    if (!sock) {
        console.error('Sock instance not set');
        return;
    }

    // Kirim pesan sedang memproses
    await sock.sendMessage(remoteJid, { 
        text: `⏳ *Memproses Permintaan*\n\nSedang mengambil daftar user PPPoE offline...`
    });
    
    const result = await getInactivePPPoEUsers();

    if (result && result.success) {
        let message = `📊 *DAFTAR USER PPPoE OFFLINE*\n\n`;
        message += `Total User: ${result.totalSecrets}\n`;
        message += `User Aktif: ${result.totalActive} (${((result.totalActive/result.totalSecrets)*100).toFixed(2)}%)\n`;
        message += `User Offline: ${result.totalInactive} (${((result.totalInactive/result.totalSecrets)*100).toFixed(2)}%)\n\n`;
        
        if (result.data.length === 0) {
            message += 'Tidak ada user PPPoE yang offline';
        } else {
            // Batasi jumlah user yang ditampilkan untuk menghindari pesan terlalu panjang
            const maxUsers = 30;
            const displayUsers = result.data.slice(0, maxUsers);
            
            displayUsers.forEach((user, index) => {
                message += `${index + 1}. *${user.name}*${user.comment ? ` (${user.comment})` : ''}\n`;
            });
            
            if (result.data.length > maxUsers) {
                message += `\n... dan ${result.data.length - maxUsers} user lainnya`;
            }
        }
        
        await sock.sendMessage(remoteJid, { text: message });
    } else {
        await sock.sendMessage(remoteJid, { 
            text: `❌ Gagal mendapatkan daftar user PPPoE offline: ${result ? result.message : 'Terjadi kesalahan'}`
        });
    }
}

// Handler untuk melihat daftar interface
async function handleInterfaces(remoteJid) {
    if (!sock) {
        console.error('Sock instance not set');
        return;
    }

    const result = await getInterfaces();
    if (!result.success) {
        await sock.sendMessage(remoteJid, { text: `❌ ${result.message}` });
        return;
    }

    const interfaces = result.data;
    let message = '🔌 *DAFTAR INTERFACE*\n\n';

    if (!interfaces || interfaces.length === 0) {
        message += 'Tidak ada interface ditemukan';
    } else {
        message += `Total: ${interfaces.length} interface\n\n`;
        interfaces.forEach((iface, index) => {
            if (index < 15) { // Batasi tampilan
                const status = iface.disabled === 'true' ? '🔴 Disabled' : '🟢 Enabled';
                const running = iface.running === 'true' ? '▶️ Running' : '⏸️ Not Running';
                message += `${index + 1}. *${iface.name}*\n` +
                          `   • Type: ${iface.type || 'N/A'}\n` +
                          `   • Status: ${status}\n` +
                          `   • Running: ${running}\n`;
                if (iface['mac-address']) {
                    message += `   • MAC: ${iface['mac-address']}\n`;
                }
                message += '\n';
            }
        });
        if (interfaces.length > 15) {
            message += `... dan ${interfaces.length - 15} interface lainnya`;
        }
    }

    await sock.sendMessage(remoteJid, { text: message });
}

// Handler untuk detail interface tertentu
async function handleInterfaceDetail(remoteJid, params) {
    if (!sock) {
        console.error('Sock instance not set');
        return;
    }

    if (params.length < 1) {
        await sock.sendMessage(remoteJid, {
            text: `❌ *Format Salah!*\n\n` +
                  `Format yang benar:\n` +
                  `interface [nama_interface]\n\n` +
                  `Contoh:\n` +
                  `• interface ether1\n` +
                  `• interface wlan1`
        });
        return;
    }

    const [interfaceName] = params;
    const result = await getInterfaceDetail(interfaceName);

    if (!result.success) {
        await sock.sendMessage(remoteJid, { text: `❌ ${result.message}` });
        return;
    }

    const iface = result.data;
    const status = iface.disabled === 'true' ? '🔴 Disabled' : '🟢 Enabled';
    const running = iface.running === 'true' ? '▶️ Running' : '⏸️ Not Running';

    let message = `🔌 *DETAIL INTERFACE: ${iface.name}*\n\n`;
    message += `• Type: ${iface.type || 'N/A'}\n`;
    message += `• Status: ${status}\n`;
    message += `• Running: ${running}\n`;
    if (iface['mac-address']) message += `• MAC: ${iface['mac-address']}\n`;
    if (iface.mtu) message += `• MTU: ${iface.mtu}\n`;
    if (iface['actual-mtu']) message += `• Actual MTU: ${iface['actual-mtu']}\n`;
    if (iface['rx-byte']) message += `• RX Bytes: ${iface['rx-byte']}\n`;
    if (iface['tx-byte']) message += `• TX Bytes: ${iface['tx-byte']}\n`;
    if (iface['rx-packet']) message += `• RX Packets: ${iface['rx-packet']}\n`;
    if (iface['tx-packet']) message += `• TX Packets: ${iface['tx-packet']}\n`;

    await sock.sendMessage(remoteJid, { text: message });
}

// Handler untuk enable/disable interface
async function handleInterfaceStatus(remoteJid, params, enable) {
    if (!sock) {
        console.error('Sock instance not set');
        return;
    }

    if (params.length < 1) {
        const action = enable ? 'enable' : 'disable';
        await sock.sendMessage(remoteJid, {
            text: `❌ *Format Salah!*\n\n` +
                  `Format yang benar:\n` +
                  `${action}if [nama_interface]\n\n` +
                  `Contoh:\n` +
                  `• ${action}if ether1\n` +
                  `• ${action}if wlan1`
        });
        return;
    }

    const [interfaceName] = params;
    const result = await setInterfaceStatus(interfaceName, enable);

    await sock.sendMessage(remoteJid, {
        text: `${result && result.success ? '✅' : '❌'} ${result && result.message ? result.message : 'Terjadi kesalahan'}\n\n` +
              `Interface: ${interfaceName}`
    });
}

// Handler untuk melihat IP addresses
async function handleIPAddresses(remoteJid) {
    if (!sock) {
        console.error('Sock instance not set');
        return;
    }

    const result = await getIPAddresses();
    if (!result.success) {
        await sock.sendMessage(remoteJid, { text: `❌ ${result.message}` });
        return;
    }

    const addresses = result.data;
    let message = '🌐 *DAFTAR IP ADDRESS*\n\n';

    if (!addresses || addresses.length === 0) {
        message += 'Tidak ada IP address ditemukan';
    } else {
        message += `Total: ${addresses.length} IP address\n\n`;
        addresses.forEach((addr, index) => {
            if (index < 20) { // Batasi tampilan
                const status = addr.disabled === 'true' ? '🔴 Disabled' : '🟢 Enabled';
                message += `${index + 1}. *${addr.address}*\n` +
                          `   • Interface: ${addr.interface || 'N/A'}\n` +
                          `   • Status: ${status}\n`;
                if (addr.network) message += `   • Network: ${addr.network}\n`;
                message += '\n';
            }
        });
        if (addresses.length > 20) {
            message += `... dan ${addresses.length - 20} IP address lainnya`;
        }
    }

    await sock.sendMessage(remoteJid, { text: message });
}

// Handler untuk melihat routing table
async function handleRoutes(remoteJid) {
    if (!sock) {
        console.error('Sock instance not set');
        return;
    }

    const result = await getRoutes();
    if (!result.success) {
        await sock.sendMessage(remoteJid, { text: `❌ ${result.message}` });
        return;
    }

    const routes = result.data;
    let message = '🛣️ *ROUTING TABLE*\n\n';

    if (!routes || routes.length === 0) {
        message += 'Tidak ada route ditemukan';
    } else {
        message += `Total: ${routes.length} route\n\n`;
        routes.forEach((route, index) => {
            if (index < 15) { // Batasi tampilan
                const status = route.disabled === 'true' ? '🔴 Disabled' : '🟢 Enabled';
                const active = route.active === 'true' ? '✅ Active' : '❌ Inactive';
                message += `${index + 1}. *${route['dst-address'] || 'N/A'}*\n` +
                          `   • Gateway: ${route.gateway || 'N/A'}\n` +
                          `   • Distance: ${route.distance || 'N/A'}\n` +
                          `   • Status: ${status}\n` +
                          `   • Active: ${active}\n`;
                if (route.interface) message += `   • Interface: ${route.interface}\n`;
                message += '\n';
            }
        });
        if (routes.length > 15) {
            message += `... dan ${routes.length - 15} route lainnya`;
        }
    }

    await sock.sendMessage(remoteJid, { text: message });
}

// Handler untuk DHCP leases
async function handleDHCPLeases(remoteJid) {
    if (!sock) {
        console.error('Sock instance not set');
        return;
    }

    const result = await getDHCPLeases();
    if (!result.success) {
        await sock.sendMessage(remoteJid, { text: `❌ ${result.message}` });
        return;
    }

    const leases = result.data;
    let message = '📋 *DHCP LEASES*\n\n';

    if (!leases || leases.length === 0) {
        message += 'Tidak ada DHCP lease ditemukan';
    } else {
        message += `Total: ${leases.length} lease\n\n`;
        leases.forEach((lease, index) => {
            if (index < 20) { // Batasi tampilan
                const status = lease.status || 'N/A';
                message += `${index + 1}. *${lease.address || 'N/A'}*\n` +
                          `   • MAC: ${lease['mac-address'] || 'N/A'}\n` +
                          `   • Status: ${status}\n`;
                if (lease['host-name']) message += `   • Hostname: ${lease['host-name']}\n`;
                if (lease.server) message += `   • Server: ${lease.server}\n`;
                message += '\n';
            }
        });
        if (leases.length > 20) {
            message += `... dan ${leases.length - 20} lease lainnya`;
        }
    }

    await sock.sendMessage(remoteJid, { text: message });
}

// Handler untuk ping
async function handlePing(remoteJid, params) {
    if (!sock) {
        console.error('Sock instance not set');
        return;
    }

    if (params.length < 1) {
        await sock.sendMessage(remoteJid, {
            text: `❌ *Format Salah!*\n\n` +
                  `Format yang benar:\n` +
                  `ping [host] [count]\n\n` +
                  `Contoh:\n` +
                  `• ping 8.8.8.8\n` +
                  `• ping google.com 5`
        });
        return;
    }

    const [host, count = '4'] = params;

    // Kirim pesan sedang memproses
    await sock.sendMessage(remoteJid, {
        text: `⏳ *Ping ke ${host}*\n\nSedang melakukan ping...`
    });

    const result = await pingHost(host, count);

    if (!result.success) {
        await sock.sendMessage(remoteJid, { text: `❌ ${result.message}` });
        return;
    }

    let message = `🏓 *PING RESULT: ${host}*\n\n`;

    if (result.data && result.data.length > 0) {
        const pingData = result.data[0];
        if (pingData.status === 'timeout') {
            message += '❌ Request timeout\n';
        } else {
            message += `✅ Reply from ${pingData.host || host}\n`;
            if (pingData.time) message += `• Time: ${pingData.time}\n`;
            if (pingData.ttl) message += `• TTL: ${pingData.ttl}\n`;
            if (pingData.size) message += `• Size: ${pingData.size} bytes\n`;
        }
    } else {
        message += 'Ping selesai, tidak ada data response';
    }

    await sock.sendMessage(remoteJid, { text: message });
}

// Handler untuk system logs
async function handleSystemLogs(remoteJid, params) {
    if (!sock) {
        console.error('Sock instance not set');
        return;
    }

    const [topics = '', count = '20'] = params;

    // Kirim pesan sedang memproses
    await sock.sendMessage(remoteJid, {
        text: `⏳ *Mengambil System Logs*\n\nSedang memproses...`
    });

    const result = await getSystemLogs(topics, count);

    if (!result.success) {
        await sock.sendMessage(remoteJid, { text: `❌ ${result.message}` });
        return;
    }

    const logs = result.data;
    let message = `📝 *SYSTEM LOGS*${topics ? ` (${topics})` : ''}\n\n`;

    if (!logs || logs.length === 0) {
        message += 'Tidak ada log ditemukan';
    } else {
        message += `Menampilkan ${logs.length} log terbaru:\n\n`;
        logs.forEach((log, index) => {
            if (index < 15) { // Batasi tampilan untuk WhatsApp
                message += `${index + 1}. *${log.time || 'N/A'}*\n` +
                          `   ${log.message || 'N/A'}\n`;
                if (log.topics) message += `   Topics: ${log.topics}\n`;
                message += '\n';
            }
        });
        if (logs.length > 15) {
            message += `... dan ${logs.length - 15} log lainnya`;
        }
    }

    await sock.sendMessage(remoteJid, { text: message });
}

// Handler untuk melihat profiles
async function handleProfiles(remoteJid, params) {
    if (!sock) {
        console.error('Sock instance not set');
        return;
    }

    const [type = 'all'] = params;

    let message = '👥 *DAFTAR PROFILES*\n\n';

    if (type === 'pppoe' || type === 'all') {
        const pppoeResult = await getPPPoEProfiles();
        if (pppoeResult.success && pppoeResult.data.length > 0) {
            message += '🔗 *PPPoE Profiles:*\n';
            pppoeResult.data.forEach((profile, index) => {
                if (index < 10) {
                    message += `${index + 1}. *${profile.name}*\n`;
                    if (profile['rate-limit']) message += `   • Rate Limit: ${profile['rate-limit']}\n`;
                    if (profile['local-address']) message += `   • Local Address: ${profile['local-address']}\n`;
                    if (profile['remote-address']) message += `   • Remote Address: ${profile['remote-address']}\n`;
                    message += '\n';
                }
            });
            if (pppoeResult.data.length > 10) {
                message += `... dan ${pppoeResult.data.length - 10} profile lainnya\n`;
            }
            message += '\n';
        }
    }

    if (type === 'hotspot' || type === 'all') {
        const hotspotResult = await getHotspotProfiles();
        if (hotspotResult.success && hotspotResult.data.length > 0) {
            message += '🌐 *Hotspot Profiles:*\n';
            hotspotResult.data.forEach((profile, index) => {
                if (index < 10) {
                    message += `${index + 1}. *${profile.name}*\n`;
                    if (profile['rate-limit']) message += `   • Rate Limit: ${profile['rate-limit']}\n`;
                    if (profile['session-timeout']) message += `   • Session Timeout: ${profile['session-timeout']}\n`;
                    if (profile['idle-timeout']) message += `   • Idle Timeout: ${profile['idle-timeout']}\n`;
                    message += '\n';
                }
            });
            if (hotspotResult.data.length > 10) {
                message += `... dan ${hotspotResult.data.length - 10} profile lainnya\n`;
            }
        }
    }

    await sock.sendMessage(remoteJid, { text: message });
}

// Handler untuk firewall rules
async function handleFirewall(remoteJid, params) {
    if (!sock) {
        console.error('Sock instance not set');
        return;
    }

    const [chain = ''] = params;

    const result = await getFirewallRules(chain);
    if (!result.success) {
        await sock.sendMessage(remoteJid, { text: `❌ ${result.message}` });
        return;
    }

    const rules = result.data;
    let message = `🛡️ *FIREWALL RULES*${chain ? ` (${chain})` : ''}\n\n`;

    if (!rules || rules.length === 0) {
        message += 'Tidak ada firewall rule ditemukan';
    } else {
        message += `Total: ${rules.length} rule\n\n`;
        rules.forEach((rule, index) => {
            if (index < 10) { // Batasi tampilan
                const status = rule.disabled === 'true' ? '🔴 Disabled' : '🟢 Enabled';
                message += `${index + 1}. *Chain: ${rule.chain || 'N/A'}*\n` +
                          `   • Action: ${rule.action || 'N/A'}\n` +
                          `   • Status: ${status}\n`;
                if (rule['src-address']) message += `   • Src: ${rule['src-address']}\n`;
                if (rule['dst-address']) message += `   • Dst: ${rule['dst-address']}\n`;
                if (rule.protocol) message += `   • Protocol: ${rule.protocol}\n`;
                message += '\n';
            }
        });
        if (rules.length > 10) {
            message += `... dan ${rules.length - 10} rule lainnya`;
        }
    }

    await sock.sendMessage(remoteJid, { text: message });
}

// Handler untuk restart router
async function handleRestartRouter(remoteJid) {
    if (!sock) {
        console.error('Sock instance not set');
        return;
    }

    // Konfirmasi restart
    await sock.sendMessage(remoteJid, {
        text: `⚠️ *PERINGATAN!*\n\n` +
              `Anda akan me-restart router MikroTik.\n` +
              `Semua koneksi akan terputus sementara.\n\n` +
              `Ketik "confirm restart" untuk melanjutkan.`
    });
}

// Handler untuk konfirmasi restart router
async function handleConfirmRestart(remoteJid) {
    if (!sock) {
        console.error('Sock instance not set');
        return;
    }

    const result = await restartRouter();

    await sock.sendMessage(remoteJid, {
        text: `${result && result.success ? '✅' : '❌'} ${result && result.message ? result.message : 'Terjadi kesalahan'}`
    });
}

// Handler untuk router identity
async function handleRouterIdentity(remoteJid, params) {
    if (!sock) {
        console.error('Sock instance not set');
        return;
    }

    if (params.length === 0) {
        // Tampilkan identity saat ini
        const result = await getRouterIdentity();
        if (!result.success) {
            await sock.sendMessage(remoteJid, { text: `❌ ${result.message}` });
            return;
        }

        const identity = result.data;
        let message = `🏷️ *ROUTER IDENTITY*\n\n`;
        message += `Name: ${identity.name || 'N/A'}`;

        await sock.sendMessage(remoteJid, { text: message });
    } else {
        // Set identity baru
        const newName = params.join(' ');
        const result = await setRouterIdentity(newName);

        await sock.sendMessage(remoteJid, {
            text: `${result && result.success ? '✅' : '❌'} ${result && result.message ? result.message : 'Terjadi kesalahan'}`
        });
    }
}

// Handler untuk clock router
async function handleRouterClock(remoteJid) {
    if (!sock) {
        console.error('Sock instance not set');
        return;
    }

    const result = await getRouterClock();
    if (!result.success) {
        await sock.sendMessage(remoteJid, { text: `❌ ${result.message}` });
        return;
    }

    const clock = result.data;
    let message = `🕐 *ROUTER CLOCK*\n\n`;
    message += `Date: ${clock.date || 'N/A'}\n`;
    message += `Time: ${clock.time || 'N/A'}\n`;
    if (clock['time-zone-name']) message += `Timezone: ${clock['time-zone-name']}\n`;

    await sock.sendMessage(remoteJid, { text: message });
}

// Handler untuk semua user
async function handleAllUsers(remoteJid) {
    if (!sock) {
        console.error('Sock instance not set');
        return;
    }

    // Kirim pesan sedang memproses
    await sock.sendMessage(remoteJid, {
        text: `⏳ *Mengambil Data Semua User*\n\nSedang memproses...`
    });

    const result = await getAllUsers();
    if (!result.success) {
        await sock.sendMessage(remoteJid, { text: `❌ ${result.message}` });
        return;
    }

    const data = result.data;
    let message = `👥 *RINGKASAN SEMUA USER*\n\n`;
    message += `📊 *Statistik:*\n`;
    message += `• Total Aktif: ${data.totalActive}\n`;
    message += `• Total Offline: ${data.totalOffline}\n`;
    message += `• Hotspot Aktif: ${data.hotspotActive.length}\n`;
    message += `• PPPoE Aktif: ${data.pppoeActive.length}\n`;
    message += `• PPPoE Offline: ${data.pppoeOffline.length}\n\n`;

    // Tampilkan beberapa user aktif
    if (data.hotspotActive.length > 0) {
        message += `🌐 *Hotspot Aktif (${Math.min(5, data.hotspotActive.length)} dari ${data.hotspotActive.length}):*\n`;
        data.hotspotActive.slice(0, 5).forEach((user, index) => {
            message += `${index + 1}. ${user.user || 'N/A'} (${user.address || 'N/A'})\n`;
        });
        message += '\n';
    }

    if (data.pppoeActive.length > 0) {
        message += `🔗 *PPPoE Aktif (${Math.min(5, data.pppoeActive.length)} dari ${data.pppoeActive.length}):*\n`;
        data.pppoeActive.slice(0, 5).forEach((user, index) => {
            message += `${index + 1}. ${user.name || 'N/A'} (${user.address || 'N/A'})\n`;
        });
    }

    await sock.sendMessage(remoteJid, { text: message });
}

// Handler untuk debug resource (admin only)
async function handleDebugResource(remoteJid) {
    if (!sock) {
        console.error('Sock instance not set');
        return;
    }

    // Kirim pesan loading
    await sock.sendMessage(remoteJid, {
        text: `🔍 *DEBUG RESOURCE ROUTER*\n\nMengambil raw data...`
    });

    try {
        const { getRouterResources } = require('./mikrotik');
        const rawData = await getRouterResources();

        if (!rawData) {
            await sock.sendMessage(remoteJid, {
                text: `❌ *DEBUG RESOURCE*\n\nTidak ada data yang dikembalikan dari MikroTik.`
            });
            return;
        }

        // Format raw data untuk ditampilkan
        let message = `🔍 *DEBUG RAW RESOURCE DATA*\n\n`;
        message += `📋 *Available Fields:*\n`;

        const fields = Object.keys(rawData);
        fields.forEach((field, index) => {
            if (index < 30) { // Batasi untuk menghindari pesan terlalu panjang
                const value = rawData[field];
                message += `${index + 1}. ${field}: ${value}\n`;
            }
        });

        if (fields.length > 30) {
            message += `... dan ${fields.length - 30} field lainnya\n`;
        }

        message += `\n📊 *Memory Related Fields:*\n`;
        const memoryFields = fields.filter(f =>
            f.toLowerCase().includes('memory') ||
            f.toLowerCase().includes('mem') ||
            f.toLowerCase().includes('ram')
        );

        if (memoryFields.length > 0) {
            memoryFields.forEach(field => {
                message += `• ${field}: ${rawData[field]}\n`;
            });
        } else {
            message += `• Tidak ada field memory yang ditemukan\n`;
        }

        message += `\n💿 *Disk Related Fields:*\n`;
        const diskFields = fields.filter(f =>
            f.toLowerCase().includes('disk') ||
            f.toLowerCase().includes('hdd') ||
            f.toLowerCase().includes('storage')
        );

        if (diskFields.length > 0) {
            diskFields.forEach(field => {
                message += `• ${field}: ${rawData[field]}\n`;
            });
        } else {
            message += `• Tidak ada field disk yang ditemukan\n`;
        }

        await sock.sendMessage(remoteJid, { text: message });

    } catch (error) {
        await sock.sendMessage(remoteJid, {
            text: `❌ *DEBUG ERROR*\n\nTerjadi kesalahan: ${error.message}`
        });
    }
}

module.exports = {
    setSock,
    handleAddHotspotUser,
    handleAddPPPoESecret,
    handleChangePPPoEProfile,
    handleResourceInfo,
    handleActiveHotspotUsers,
    handleActivePPPoE,
    handleDeleteHotspotUser,
    handleDeletePPPoESecret,
    handleOfflineUsers,
    handleInterfaces,
    handleInterfaceDetail,
    handleInterfaceStatus,
    handleIPAddresses,
    handleRoutes,
    handleDHCPLeases,
    handlePing,
    handleSystemLogs,
    handleProfiles,
    handleFirewall,
    handleRestartRouter,
    handleConfirmRestart,
    handleRouterIdentity,
    handleRouterClock,
    handleAllUsers,
    handleDebugResource
};