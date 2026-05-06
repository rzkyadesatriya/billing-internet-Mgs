const logger = require('./logger');

// Helper function to get settings with cache
function getSettingsWithCache() {
    try {
        const settingsManager = require('./settingsManager');
        if (settingsManager && typeof settingsManager.getSettingsWithCache === 'function') {
            return settingsManager.getSettingsWithCache();
        }
        return {};
    } catch (error) {
        logger.error('Error getting settings:', error);
        return {};
    }
}

class AgentWhatsAppManager {
    constructor() {
        this.sock = null;
        
        // Try to get socket from global if available
        if (typeof global !== 'undefined') {
            if (global.whatsappSocket) {
                this.sock = global.whatsappSocket;
            } else if (typeof global.getWhatsAppSocket === 'function') {
                this.sock = global.getWhatsAppSocket();
            }
        }
    }

    setSocket(sock) {
        this.sock = sock;
    }

    getActiveSocket() {
        // Prefer current instance socket if still valid
        if (this.sock && typeof this.sock.sendMessage === 'function') {
            return this.sock;
        }

        // Try global helpers
        if (typeof global !== 'undefined') {
            if (typeof global.getWhatsAppSocket === 'function') {
                const gsock = global.getWhatsAppSocket();
                if (gsock && typeof gsock.sendMessage === 'function') {
                    this.sock = gsock;
                    return gsock;
                }
            }

            if (global.whatsappSocket && typeof global.whatsappSocket.sendMessage === 'function') {
                this.sock = global.whatsappSocket;
                return global.whatsappSocket;
            }
        }

        // Fallback to whatsapp module socket
        try {
            const whatsapp = require('./whatsapp');
            if (whatsapp && typeof whatsapp.getSock === 'function') {
                const wsock = whatsapp.getSock();
                if (wsock && typeof wsock.sendMessage === 'function') {
                    this.sock = wsock;
                    return wsock;
                }
            }
        } catch (err) {
            logger.debug('Unable to get socket from whatsapp module:', err.message);
        }

        return null;
    }

    async sendTextToPhone(phone, text) {
        const formatted = this.formatPhoneNumber(phone);
        if (!formatted || formatted.length < 10) {
            throw new Error('Nomor WhatsApp tidak valid');
        }

        const jid = `${formatted}@s.whatsapp.net`;
        let activeSock = this.getActiveSocket();
        if (!activeSock) {
            throw new Error('WhatsApp socket tidak tersedia');
        }

        try {
            await activeSock.sendMessage(jid, { text });
            return true;
        } catch (err) {
            // Retry once with a freshly resolved socket
            this.sock = null;
            activeSock = this.getActiveSocket();
            if (!activeSock) throw err;
            await activeSock.sendMessage(jid, { text });
            return true;
        }
    }

    // ===== VOUCHER NOTIFICATIONS =====

    async sendVoucherNotification(agent, customer, voucherData) {
        try {
            if (!this.getActiveSocket()) {
                logger.warn('WhatsApp socket not available for voucher notification');
                return { success: false, message: 'WhatsApp tidak tersedia' };
            }

            const settings = getSettingsWithCache();
            const companyHeader = settings.company_header || settings.app_name || 'MGS-Billing';
            const formattedHeader = companyHeader.includes('📱') ? companyHeader + '\n\n' : `📱 ${companyHeader} 📱\n\n`;
            const footerInfo = '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' + (settings.footer_info || 'Powered by Alijaya Digital Network');
            const voucherPrice = Number(voucherData?.price || 0);
            const voucherCommission = Number(voucherData?.commission || 0);

            // Message untuk agent
            const agentMessage = `${formattedHeader}🎫 **VOUCHER BERHASIL DIJUAL**

📋 **Detail Voucher:**
• Kode: \`${voucherData.voucherCode}\`
• Paket: ${voucherData.packageName}
• Harga: Rp ${voucherPrice.toLocaleString('id-ID')}
• Komisi: Rp ${voucherCommission.toLocaleString('id-ID')}

👤 **Pelanggan:**
• Nama: ${customer.name}
• HP: ${customer.phone || 'Tidak ada'}

✅ Voucher telah berhasil dijual dan komisi telah ditambahkan ke saldo Anda.${footerInfo}`;

            // Message untuk pelanggan
            const customerMessage = `${formattedHeader}🎫 **VOUCHER HOTSPOT ANDA**

📋 **Detail Voucher:**
• Kode: \`${voucherData.voucherCode}\`
• Paket: ${voucherData.packageName}
• Harga: Rp ${voucherPrice.toLocaleString('id-ID')}

🔑 **Cara Menggunakan:**
1. Hubungkan ke WiFi hotspot
2. Masukkan kode voucher: \`${voucherData.voucherCode}\`
3. Nikmati akses internet sesuai paket

📞 **Bantuan:** Hubungi ${settings.contact_phone || 'Admin'} jika ada masalah.${footerInfo}`;

            let agentSent = false;
            let customerSent = false;
            let agentError = null;
            let customerError = null;

            // Kirim ke agent (jangan blokir kirim ke customer jika gagal)
            if (agent?.phone) {
                try {
                    await this.sendTextToPhone(agent.phone, agentMessage);
                    agentSent = true;
                } catch (err) {
                    agentError = err?.message || 'Gagal kirim ke agent';
                    logger.warn(`Failed sending voucher WA to agent ${agent.phone}: ${agentError}`);
                }
            }

            // Kirim ke pelanggan jika ada nomor HP
            if (customer?.phone) {
                try {
                    await this.sendTextToPhone(customer.phone, customerMessage);
                    customerSent = true;
                } catch (err) {
                    customerError = err?.message || 'Gagal kirim ke customer';
                    logger.warn(`Failed sending voucher WA to customer ${customer.phone}: ${customerError}`);
                }
            }

            if (customer?.phone) {
                if (customerSent) {
                    return { success: true, message: 'Voucher berhasil dikirim ke customer via WhatsApp' };
                }
                return {
                    success: false,
                    message: customerError || 'Gagal mengirim voucher ke customer via WhatsApp'
                };
            }

            // Jika tidak ada customer phone, minimal agent tetap dianggap sukses jika terkirim
            return {
                success: !!agentSent,
                message: agentSent
                    ? 'Notifikasi voucher terkirim ke agent'
                    : (agentError || 'Tidak ada nomor customer dan notifikasi agent gagal')
            };
        } catch (error) {
            logger.error('Send voucher notification error:', error);
            return { success: false, message: 'Gagal mengirim notifikasi' };
        }
    }

    // Send voucher directly to customer
    async sendVoucherToCustomer(customerPhone, customerName, voucherCode, packageName, price, agentInfo = null) {
        try {
            if (!this.getActiveSocket()) {
                logger.warn('WhatsApp socket not available for customer voucher');
                return { success: false, message: 'WhatsApp tidak tersedia' };
            }

            const settings = getSettingsWithCache();
            const companyHeader = settings.company_header || settings.app_name || 'MGS-Billing';
            const formattedHeader = companyHeader.includes('📱') ? companyHeader + '\n\n' : `📱 ${companyHeader} 📱\n\n`;
            const footerInfo = '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' + (settings.footer_info || 'Powered by Alijaya Digital Network');

            // Create agent info text
            let agentInfoText = '';
            if (agentInfo && agentInfo.name) {
                agentInfoText = `\n👤 **Dibeli melalui Agent:** ${agentInfo.name}`;
                if (agentInfo.phone) {
                    agentInfoText += `\n📞 **Kontak Agent:** ${agentInfo.phone}`;
                }
            }

            // Message untuk customer (tanpa harga internal)
            const customerMessage = `${formattedHeader}🎫 **VOUCHER HOTSPOT ANDA**

📋 **Detail Voucher:**
• Kode: \`${voucherCode}\`
• Paket: ${packageName}
• Harga: Rp ${safePrice.toLocaleString('id-ID')}${agentInfoText}

🔑 **Cara Menggunakan:**
1. Hubungkan ke WiFi hotspot
2. Masukkan kode voucher: \`${voucherCode}\`
3. Nikmati akses internet sesuai paket

📞 **Bantuan:** Hubungi ${settings.contact_phone || 'Admin'} jika ada masalah.${footerInfo}`;

            // Kirim ke customer
            await this.sendTextToPhone(customerPhone, customerMessage);
            
            logger.info(`Voucher sent to customer: ${customerPhone}`);
            return { success: true, message: 'Voucher berhasil dikirim ke customer' };
        } catch (error) {
            logger.error('Send voucher to customer error:', error);
            return { success: false, message: 'Gagal mengirim voucher ke customer' };
        }
    }

    // ===== PAYMENT NOTIFICATIONS =====

    async sendPaymentNotification(agent, customer, paymentData) {
        try {
            if (!this.sock) {
                logger.warn('WhatsApp socket not available for payment notification');
                return { success: false, message: 'WhatsApp tidak tersedia' };
            }

            const settings = getSettingsWithCache();
            const companyHeader = settings.company_header || settings.app_name || 'MGS-Billing';
            const formattedHeader = companyHeader.includes('📱') ? companyHeader + '\n\n' : `📱 ${companyHeader} 📱\n\n`;
            const footerInfo = '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' + (settings.footer_info || 'Powered by Alijaya Digital Network');

            // Message untuk agent
            const agentMessage = `${formattedHeader}💰 **PEMBAYARAN BERHASIL DIPROSES**

📋 **Detail Pembayaran:**
• Jumlah: Rp ${paymentData.amount.toLocaleString()}
• Metode: ${paymentData.method}
• Komisi: Rp ${paymentData.commission.toLocaleString()}

👤 **Pelanggan:**
• Nama: ${customer.name}
• HP: ${customer.phone || 'Tidak ada'}

✅ Pembayaran telah berhasil diproses dan komisi telah ditambahkan ke saldo Anda.${footerInfo}`;

            // Message untuk pelanggan
            const customerMessage = `${formattedHeader}✅ **PEMBAYARAN DITERIMA**

📋 **Detail Pembayaran:**
• Jumlah: Rp ${paymentData.amount.toLocaleString()}
• Metode: ${paymentData.method}
• Tanggal: ${new Date().toLocaleString('id-ID')}

👤 **Diproses oleh:** ${agent.name}

✅ Terima kasih atas pembayaran Anda. Tagihan telah lunas.${footerInfo}`;

            // Kirim ke agent
            if (agent.phone) {
                const formattedAgentPhone = this.formatPhoneNumber(agent.phone) + '@s.whatsapp.net';
                await this.sock.sendMessage(formattedAgentPhone, { text: agentMessage });
            }

            // Kirim ke pelanggan jika ada nomor HP
            if (customer.phone) {
                const formattedCustomerPhone = this.formatPhoneNumber(customer.phone) + '@s.whatsapp.net';
                await this.sock.sendMessage(formattedCustomerPhone, { text: customerMessage });
            }

            return { success: true, message: 'Notifikasi berhasil dikirim' };
        } catch (error) {
            logger.error('Send payment notification error:', error);
            return { success: false, message: 'Gagal mengirim notifikasi' };
        }
    }

    // ===== BALANCE NOTIFICATIONS =====

    async sendBalanceUpdateNotification(agent, balanceData) {
        try {
            if (!this.sock) {
                logger.warn('WhatsApp socket not available for balance notification');
                return { success: false, message: 'WhatsApp tidak tersedia' };
            }

            const settings = getSettingsWithCache();
            const companyHeader = settings.company_header || settings.app_name || 'MGS-Billing';
            const formattedHeader = companyHeader.includes('📱') ? companyHeader + '\n\n' : `📱 ${companyHeader} 📱\n\n`;
            const footerInfo = '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' + (settings.footer_info || 'Powered by Alijaya Digital Network');

            const message = `${formattedHeader}💰 **SALDO TELAH DIUPDATE**

📋 **Detail Saldo:**
• Saldo Sebelumnya: Rp ${balanceData.previousBalance.toLocaleString()}
• Perubahan: ${balanceData.change > 0 ? '+' : ''}Rp ${balanceData.change.toLocaleString()}
• Saldo Sekarang: Rp ${balanceData.currentBalance.toLocaleString()}

📝 **Keterangan:** ${balanceData.description}

✅ Saldo Anda telah berhasil diupdate.${footerInfo}`;

            if (agent.phone) {
                const formattedAgentPhone = this.formatPhoneNumber(agent.phone) + '@s.whatsapp.net';
                await this.sock.sendMessage(formattedAgentPhone, { text: message });
            }

            return { success: true, message: 'Notifikasi berhasil dikirim' };
        } catch (error) {
            logger.error('Send balance notification error:', error);
            return { success: false, message: 'Gagal mengirim notifikasi' };
        }
    }

    // ===== REQUEST NOTIFICATIONS =====

    async sendRequestApprovedNotification(agent, requestData) {
        try {
            if (!this.sock) {
                logger.warn('WhatsApp socket not available for request notification');
                return { success: false, message: 'WhatsApp tidak tersedia' };
            }

            const settings = getSettingsWithCache();
            const companyHeader = settings.company_header || settings.app_name || 'MGS-Billing';
            const formattedHeader = companyHeader.includes('📱') ? companyHeader + '\n\n' : `📱 ${companyHeader} 📱\n\n`;
            const footerInfo = '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' + (settings.footer_info || 'Powered by Alijaya Digital Network');

            const message = `${formattedHeader}✅ **REQUEST SALDO DISETUJUI**

📋 **Detail Request:**
• Jumlah: Rp ${requestData.amount.toLocaleString()}
• Tanggal Request: ${new Date(requestData.requestedAt).toLocaleString('id-ID')}
• Tanggal Disetujui: ${new Date().toLocaleString('id-ID')}

💰 **Saldo Anda:**
• Sebelumnya: Rp ${requestData.previousBalance.toLocaleString()}
• Sekarang: Rp ${requestData.newBalance.toLocaleString()}

📝 **Catatan Admin:** ${requestData.adminNotes || 'Tidak ada catatan'}

✅ Request saldo Anda telah disetujui dan saldo telah ditambahkan.${footerInfo}`;

            if (agent.phone) {
                const formattedAgentPhone = this.formatPhoneNumber(agent.phone) + '@s.whatsapp.net';
                await this.sock.sendMessage(formattedAgentPhone, { text: message });
            }

            return { success: true, message: 'Notifikasi berhasil dikirim' };
        } catch (error) {
            logger.error('Send request approved notification error:', error);
            return { success: false, message: 'Gagal mengirim notifikasi' };
        }
    }

    async sendRequestRejectedNotification(agent, requestData) {
        try {
            if (!this.sock) {
                logger.warn('WhatsApp socket not available for request notification');
                return { success: false, message: 'WhatsApp tidak tersedia' };
            }

            const settings = getSettingsWithCache();
            const companyHeader = settings.company_header || settings.app_name || 'MGS-Billing';
            const formattedHeader = companyHeader.includes('📱') ? companyHeader + '\n\n' : `📱 ${companyHeader} 📱\n\n`;
            const footerInfo = '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' + (settings.footer_info || 'Powered by Alijaya Digital Network');

            const message = `${formattedHeader}❌ **REQUEST SALDO DITOLAK**

📋 **Detail Request:**
• Jumlah: Rp ${requestData.amount.toLocaleString()}
• Tanggal Request: ${new Date(requestData.requestedAt).toLocaleString('id-ID')}
• Tanggal Ditolak: ${new Date().toLocaleString('id-ID')}

📝 **Alasan Penolakan:**
${requestData.rejectReason}

💡 **Saran:**
• Pastikan request saldo sesuai dengan kebutuhan bisnis
• Hubungi admin untuk informasi lebih lanjut

📞 **Bantuan:** Hubungi ${settings.contact_phone || 'Admin'} untuk konsultasi.${footerInfo}`;

            if (agent.phone) {
                const formattedAgentPhone = this.formatPhoneNumber(agent.phone) + '@s.whatsapp.net';
                await this.sock.sendMessage(formattedAgentPhone, { text: message });
            }

            return { success: true, message: 'Notifikasi berhasil dikirim' };
        } catch (error) {
            logger.error('Send request rejected notification error:', error);
            return { success: false, message: 'Gagal mengirim notifikasi' };
        }
    }

    // ===== BULK NOTIFICATIONS =====

    async sendBulkNotifications(notifications) {
        try {
            if (!this.sock) {
                logger.warn('WhatsApp socket not available for bulk notifications');
                return { success: false, message: 'WhatsApp tidak tersedia' };
            }

            let sent = 0;
            let failed = 0;

            for (const notification of notifications) {
                try {
                    if (notification.phone) {
                        const formattedPhone = this.formatPhoneNumber(notification.phone) + '@s.whatsapp.net';
                        await this.sock.sendMessage(formattedPhone, { text: notification.message });
                        sent++;
                        
                        // Delay between messages to avoid rate limiting
                        await this.delay(1000);
                    }
                } catch (error) {
                    failed++;
                    logger.error('Bulk notification error:', error);
                }
            }

            return { success: true, sent, failed };
        } catch (error) {
            logger.error('Send bulk notifications error:', error);
            return { success: false, message: 'Gagal mengirim notifikasi bulk' };
        }
    }

    // ===== UTILITY METHODS =====

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Format phone number for WhatsApp
    formatPhoneNumber(phone) {
        if (!phone) return null;
        
        // Remove all non-digit characters
        let cleanPhone = phone.replace(/\D/g, '');
        
        // Add country code if not present
        if (cleanPhone.startsWith('0')) {
            cleanPhone = '62' + cleanPhone.substring(1);
        } else if (!cleanPhone.startsWith('62')) {
            cleanPhone = '62' + cleanPhone;
        }
        
        return cleanPhone;
    }
}

module.exports = AgentWhatsAppManager;

