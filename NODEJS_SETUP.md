# 🚀 Node.js Setup Guide for TourTaxi Backend

## 📥 Install Node.js

### **Option 1: Download from Official Website (Recommended)**

1. Go to [nodejs.org](https://nodejs.org/)
2. Download the **LTS version** (Long Term Support)
3. Run the installer and follow the setup wizard
4. Make sure to check "Add to PATH" during installation

### **Option 2: Using Package Manager**

#### **Windows (Chocolatey):**
```powershell
# Install Chocolatey first (if not installed)
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install Node.js
choco install nodejs
```

#### **Windows (Winget):**
```powershell
winget install OpenJS.NodeJS
```

#### **Windows (Scoop):**
```powershell
# Install Scoop first (if not installed)
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex

# Install Node.js
scoop install nodejs
```

## ✅ Verify Installation

Open a new PowerShell/Command Prompt window and run:

```bash
node --version
npm --version
```

You should see version numbers like:
```
v18.17.0
9.6.7
```

## 🔧 Install Backend Dependencies

1. **Navigate to backend folder:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create environment file:**
   ```bash
   copy env.example .env
   ```

4. **Edit .env file with your credentials:**
   ```env
   PORT=3000
   NODE_ENV=development
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_ANON_KEY=your-supabase-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   GOOGLE_MAPS_API_KEY=your-google-maps-api-key
   ```

## 🚀 Start Backend Server

### **Development Mode:**
```bash
npm run dev
```

### **Production Mode:**
```bash
npm start
```

## 🧪 Test Backend Server

### **1. Check Server Status:**
Open browser and go to: `http://localhost:3000`

You should see:
```json
{
  "message": "TourTaxi Backend Server",
  "version": "1.0.0",
  "status": "running",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "stats": {
    "activeDrivers": 0,
    "pendingRides": 0,
    "completedRides": 0,
    "totalConnections": 0
  }
}
```

### **2. Test API Endpoints:**
```bash
# Test drivers endpoint
curl http://localhost:3000/drivers

# Test rides endpoint
curl http://localhost:3000/rides

# Test completed rides
curl http://localhost:3000/completed-rides
```

### **3. Test Socket.io Connection:**
The server should show:
```
🚗 TourTaxi Backend Server Started
📡 Server running on port 3000
🌐 API available at http://localhost:3000
🔌 Socket.io ready for connections
⏰ Cron jobs scheduled for maintenance
🗺️  Google Maps API configured for accurate distances
=====================================
```

## 🚨 Troubleshooting

### **"npm is not recognized" Error:**
- Restart your terminal/command prompt
- Check if Node.js is in your PATH
- Reinstall Node.js with "Add to PATH" option

### **"Port 3000 already in use" Error:**
```bash
# Find process using port 3000
netstat -ano | findstr :3000

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F

# Or change port in .env file
PORT=3001
```

### **"Module not found" Error:**
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rmdir /s node_modules
del package-lock.json
npm install
```

### **"Permission denied" Error:**
- Run PowerShell as Administrator
- Or use a different port (3001, 3002, etc.)

## 📱 Next Steps

1. ✅ **Node.js Installation Complete**
2. 🔄 **Install Backend Dependencies**
3. 🔄 **Configure Environment Variables**
4. 🔄 **Start Backend Server**
5. 🔄 **Test Flutter App Integration**

## 🔗 Useful Commands

```bash
# Install specific package
npm install package-name

# Install development dependency
npm install --save-dev package-name

# Update all packages
npm update

# Check for outdated packages
npm outdated

# Run tests
npm test

# Build for production
npm run build

# View package scripts
npm run
```

## 📚 Additional Resources

- [Node.js Official Documentation](https://nodejs.org/docs/)
- [npm Documentation](https://docs.npmjs.com/)
- [Express.js Guide](https://expressjs.com/)
- [Socket.io Documentation](https://socket.io/docs/)

---

**Node.js is now ready for your TourTaxi Backend! 🚗✨**

