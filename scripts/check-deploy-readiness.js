#!/usr/bin/env node

/**
 * Script untuk mengecek kesiapan deploy via GitHub
 * Memastikan semua komponen akan berjalan normal setelah git clone + npm install
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

class DeployReadinessChecker {
    constructor() {
        this.projectRoot = path.join(__dirname, '..');
        this.requiredFiles = [
            'package.json',
            'app.js',
            'settings.json',
            'config/billing.js',
            'config/whatsapp.js',
            'config/mikrotik.js',
            'config/genieacs.js',
            'config/logger.js',
            'config/settingsManager.js'
        ];
        this.requiredDirs = [
            'config',
            'routes',
            'views',
            'public',
            'data',
            'logs',
            'whatsapp-session'
        ];
    }

    async checkRequiredFiles() {
        console.log('ðŸ“ Mengecek file yang diperlukan...');
        
        const missingFiles = [];
        
        this.requiredFiles.forEach(file => {
            const filePath = path.join(this.projectRoot, file);
            if (!fs.existsSync(filePath)) {
                missingFiles.push(file);
            }
        });

        if (missingFiles.length === 0) {
            console.log('âœ… Semua file yang diperlukan tersedia');
        } else {
            console.log('âŒ File yang hilang:');
            missingFiles.forEach(file => console.log(`  - ${file}`));
        }

        return missingFiles.length === 0;
    }

    async checkRequiredDirectories() {
        console.log('ðŸ“‚ Mengecek direktori yang diperlukan...');
        
        const missingDirs = [];
        
        this.requiredDirs.forEach(dir => {
            const dirPath = path.join(this.projectRoot, dir);
            if (!fs.existsSync(dirPath)) {
                missingDirs.push(dir);
            }
        });

        if (missingDirs.length === 0) {
            console.log('âœ… Semua direktori yang diperlukan tersedia');
        } else {
            console.log('âŒ Direktori yang hilang:');
            missingDirs.forEach(dir => console.log(`  - ${dir}`));
        }

        return missingDirs.length === 0;
    }

    async checkPackageJson() {
        console.log('ðŸ“¦ Mengecek package.json...');
        
        try {
            const packageJson = JSON.parse(fs.readFileSync(path.join(this.projectRoot, 'package.json'), 'utf8'));
            
            // Cek dependencies penting
            const criticalDeps = [
                'express',
                'sqlite3',
                'axios',
                'ejs',
                'exceljs',
                'multer',
                'node-cron',
                'winston'
            ];

            const missingDeps = criticalDeps.filter(dep => !packageJson.dependencies[dep]);
            
            if (missingDeps.length === 0) {
                console.log('âœ… Semua dependencies penting tersedia');
            } else {
                console.log('âŒ Dependencies yang hilang:');
                missingDeps.forEach(dep => console.log(`  - ${dep}`));
            }

            return missingDeps.length === 0;
        } catch (error) {
            console.log('âŒ Error membaca package.json:', error.message);
            return false;
        }
    }

    async checkSettingsJson() {
        console.log('âš™ï¸ Mengecek settings.json...');
        
        try {
            const settings = JSON.parse(fs.readFileSync(path.join(this.projectRoot, 'settings.json'), 'utf8'));
            
            // Cek setting penting
            const criticalSettings = [
                'server_host',
                'server_port',
                'admin_username',
                'admin_password',
                'genieacs_url',
                'mikrotik_host'
            ];

            const missingSettings = criticalSettings.filter(setting => !settings[setting]);
            
            if (missingSettings.length === 0) {
                console.log('âœ… Semua setting penting tersedia');
            } else {
                console.log('âŒ Setting yang hilang:');
                missingSettings.forEach(setting => console.log(`  - ${setting}`));
            }

            return missingSettings.length === 0;
        } catch (error) {
            console.log('âŒ Error membaca settings.json:', error.message);
            return false;
        }
    }

    async checkDatabaseStructure() {
        console.log('ðŸ—„ï¸ Mengecek struktur database...');
        
        const dbPath = path.join(this.projectRoot, 'data/billing.db');
        
        if (!fs.existsSync(dbPath)) {
            console.log('âš ï¸  Database tidak ditemukan, akan dibuat otomatis saat pertama kali run');
            return true;
        }

        try {
            const db = new sqlite3.Database(dbPath);
            
            // Cek tabel penting
            const tables = await new Promise((resolve, reject) => {
                db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows.map(row => row.name));
                });
            });

            const requiredTables = ['customers', 'packages', 'technicians', 'odps', 'invoices'];
            const missingTables = requiredTables.filter(table => !tables.includes(table));
            
            if (missingTables.length === 0) {
                console.log('âœ… Semua tabel database tersedia');
            } else {
                console.log('âŒ Tabel yang hilang:');
                missingTables.forEach(table => console.log(`  - ${table}`));
            }

            db.close();
            return missingTables.length === 0;
        } catch (error) {
            console.log('âŒ Error mengecek database:', error.message);
            return false;
        }
    }

    async checkBackupRestoreFunctionality() {
        console.log('ðŸ’¾ Mengecek fitur backup/restore...');
        
        // Cek apakah route backup/restore ada
        const adminSettingFile = path.join(this.projectRoot, 'routes/adminSetting.js');
        
        if (!fs.existsSync(adminSettingFile)) {
            console.log('âŒ File routes/adminSetting.js tidak ditemukan');
            return false;
        }

        const content = fs.readFileSync(adminSettingFile, 'utf8');
        
        const requiredRoutes = [
            'router.post(\'/backup\'',
            'router.post(\'/restore\'',
            'router.get(\'/backups\''
        ];

        const missingRoutes = requiredRoutes.filter(route => !content.includes(route));
        
        if (missingRoutes.length === 0) {
            console.log('âœ… Fitur backup/restore tersedia');
        } else {
            console.log('âŒ Route backup/restore yang hilang:');
            missingRoutes.forEach(route => console.log(`  - ${route}`));
        }

        return missingRoutes.length === 0;
    }

    async checkExportFunctionality() {
        console.log('ðŸ“Š Mengecek fitur export Excel...');
        
        const adminBillingFile = path.join(this.projectRoot, 'routes/adminBilling.js');
        
        if (!fs.existsSync(adminBillingFile)) {
            console.log('âŒ File routes/adminBilling.js tidak ditemukan');
            return false;
        }

        const content = fs.readFileSync(adminBillingFile, 'utf8');
        
        const requiredExports = [
            'router.get(\'/export/customers.xlsx\'',
            'ExcelJS',
            'workbook.xlsx.write'
        ];

        const missingExports = requiredExports.filter(exportFeature => !content.includes(exportFeature));
        
        if (missingExports.length === 0) {
            console.log('âœ… Fitur export Excel tersedia');
        } else {
            console.log('âŒ Fitur export yang hilang:');
            missingExports.forEach(exportFeature => console.log(`  - ${exportFeature}`));
        }

        return missingExports.length === 0;
    }

    async generateDeployChecklist() {
        console.log('ðŸ“‹ Membuat checklist deploy...');
        
        const checklist = `
# ðŸ“‹ CHECKLIST DEPLOY VIA GITHUB

## âœ… Pre-Deploy Checklist

### 1. File & Direktori
- [ ] Semua file source code sudah di-commit ke GitHub
- [ ] File settings.json sudah dikonfigurasi untuk server
- [ ] File .gitignore sudah mengabaikan file sensitif (database, logs, session)

### 2. Dependencies
- [ ] package.json sudah lengkap dengan semua dependencies
- [ ] Node.js version >= 14.0.0 (direkomendasikan v18+)
- [ ] npm atau yarn tersedia di server

### 3. Database
- [ ] Database akan dibuat otomatis saat pertama kali run
- [ ] Atau upload database backup ke server
- [ ] Pastikan direktori data/ ada dan writable

### 4. Konfigurasi Server
- [ ] settings.json sudah disesuaikan dengan server
- [ ] IP address, port, dan credentials sudah benar
- [ ] WhatsApp session akan dibuat otomatis

## ðŸš€ Deploy Steps

### 1. Clone dari GitHub
\`\`\`bash
git clone https://github.com/alijayanet/MGS
cd MGS
\`\`\`

### 2. Install Dependencies
\`\`\`bash
npm install
\`\`\`

### 3. Konfigurasi
\`\`\`bash
# Edit settings.json sesuai server
nano settings.json
\`\`\`

### 4. Setup Database (jika belum ada)
\`\`\`bash
# Database akan dibuat otomatis saat pertama kali run
# Atau restore dari backup:
# cp backup/billing.db data/billing.db
\`\`\`

### 5. Jalankan Aplikasi
\`\`\`bash
# Development
npm run dev

# Production
npm start

# Atau dengan PM2
pm2 start app.js --name MGS
\`\`\`

## ðŸ”§ Post-Deploy Verification

### 1. Cek Aplikasi
- [ ] Aplikasi berjalan tanpa error
- [ ] Web interface bisa diakses
- [ ] Database terhubung dengan baik

### 2. Cek Fitur Backup/Restore
- [ ] Halaman admin settings bisa diakses
- [ ] Fitur backup database berfungsi
- [ ] Fitur restore database berfungsi

### 3. Cek Fitur Export
- [ ] Export customers ke Excel berfungsi
- [ ] Export financial report berfungsi
- [ ] File Excel bisa didownload

### 4. Cek WhatsApp Bot
- [ ] WhatsApp bot terhubung
- [ ] QR code bisa di-scan
- [ ] Commands berfungsi

## âš ï¸ Troubleshooting

### Database Error
- Cek permissions direktori data/
- Restore dari backup jika perlu
- Cek log aplikasi untuk error detail

### Dependencies Error
- Jalankan npm install --force
- Cek Node.js version
- Update npm jika perlu

### WhatsApp Error
- Hapus folder whatsapp-session/
- Restart aplikasi
- Scan QR code ulang

### Backup/Restore Error
- Cek permissions direktori backup/
- Cek disk space
- Cek log aplikasi
`;

        const checklistFile = path.join(this.projectRoot, 'DEPLOY_CHECKLIST.md');
        fs.writeFileSync(checklistFile, checklist);
        
        console.log(`ðŸ“‹ Checklist deploy tersimpan: ${path.basename(checklistFile)}`);
        return checklistFile;
    }

    async runFullCheck() {
        console.log('ðŸš€ Memulai pengecekan kesiapan deploy...\n');
        
        const results = {
            files: await this.checkRequiredFiles(),
            directories: await this.checkRequiredDirectories(),
            packageJson: await this.checkPackageJson(),
            settingsJson: await this.checkSettingsJson(),
            database: await this.checkDatabaseStructure(),
            backupRestore: await this.checkBackupRestoreFunctionality(),
            export: await this.checkExportFunctionality()
        };

        console.log('\nðŸ“Š HASIL PENGECEKAN:');
        console.log(`Files: ${results.files ? 'âœ…' : 'âŒ'}`);
        console.log(`Directories: ${results.directories ? 'âœ…' : 'âŒ'}`);
        console.log(`Package.json: ${results.packageJson ? 'âœ…' : 'âŒ'}`);
        console.log(`Settings.json: ${results.settingsJson ? 'âœ…' : 'âŒ'}`);
        console.log(`Database: ${results.database ? 'âœ…' : 'âŒ'}`);
        console.log(`Backup/Restore: ${results.backupRestore ? 'âœ…' : 'âŒ'}`);
        console.log(`Export: ${results.export ? 'âœ…' : 'âŒ'}`);

        const allPassed = Object.values(results).every(result => result);
        
        if (allPassed) {
            console.log('\nðŸŽ‰ SEMUA PENGECEKAN BERHASIL!');
            console.log('âœ… Aplikasi siap untuk deploy via GitHub');
        } else {
            console.log('\nâš ï¸  ADA MASALAH YANG PERLU DIPERBAIKI!');
            console.log('âŒ Perbaiki masalah di atas sebelum deploy');
        }

        // Generate checklist
        await this.generateDeployChecklist();
        
        return allPassed;
    }
}

// Main execution
async function main() {
    const checker = new DeployReadinessChecker();
    await checker.runFullCheck();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = DeployReadinessChecker;

