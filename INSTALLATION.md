# Installation Guide

This guide provides step-by-step instructions for installing and deploying the Proton Prediction Market platform.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Smart Contract Setup](#smart-contract-setup)
3. [Smart Contract Deployment](#smart-contract-deployment)
4. [Frontend Setup](#frontend-setup)
5. [Frontend Deployment](#frontend-deployment)
   - [cPanel Deployment](#cpanel-deployment)
   - [Other Hosting Providers](#other-hosting-providers)
6. [User Testing Guide](#user-testing-guide)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

- **Node.js v22.x** (recommended for production) or v16.x/v18.x/v20.x
  - Use [nvm](https://github.com/nvm-sh/nvm) to manage Node.js versions
  - For AlmaLinux/RHEL: `gcc-c++`, `make`, `python3`, `openssl-devel` (for native module compilation)
- **npm** (comes with Node.js) or **yarn**
- **Proton blockchain account** with XPR tokens
  - Testnet: Create at https://testnet.protonchain.com
  - Mainnet: Create at https://proton.org

### AlmaLinux/RHEL System Packages

If deploying on AlmaLinux 8/9 or RHEL, install these system packages for native module compilation (particularly secp256k1):

```bash
# AlmaLinux 8/9 / RHEL
sudo dnf install -y gcc-c++ make python3 openssl-devel

# Verify installations
gcc --version
make --version
python3 --version
```

### Node.js Installation

Install Node.js 22 using nvm (Node Version Manager):

```bash
# Install nvm (if not already installed)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Reload shell configuration
source ~/.bashrc  # or ~/.zshrc for zsh

# Install Node.js 22
nvm install 22
nvm use 22

# Verify installation
node --version  # Should show v22.x.x
npm --version
```

---

## Smart Contract Setup

### 1. Clone the Repository

```bash
git clone https://github.com/phoenixwade/proton-prediction-market.git
cd proton-prediction-market
```

### 2. Install Node.js 22

```bash
# Using nvm (Node Version Manager)
nvm install 22
nvm use 22
```

### 3. Navigate to Contracts Directory

```bash
cd contracts
```

### 4. Install Dependencies

```bash
npm install
```

This will install:
- `proton-asc` - AssemblyScript compiler for Proton smart contracts
- `proton-tsc` - Proton TypeScript SDK
- Other required dependencies

### 5. Compile the Smart Contract

```bash
npm run build
```

This runs `proton-asc assembly/prediction.contract.ts --target release` to compile the contract.

### 6. Verify the Build

The compiled WASM and ABI files will be in `assembly/target/`:
- `prediction.contract.wasm` - Compiled WebAssembly binary
- `prediction.contract.abi` - Contract ABI (Application Binary Interface)

```bash
ls -lh assembly/target/
```

You should see both files listed.

---

## Smart Contract Deployment

### 1. Create a Proton Account

**For Testnet:**
- Visit https://testnet.protonchain.com
- Create an account and fund it with testnet XPR tokens

**For Mainnet:**
- Visit https://proton.org
- Create an account and purchase XPR tokens

### 2. Install Proton CLI

```bash
npm install -g @proton/cli
```

### 3. Deploy the Contract

```bash
cd contracts
proton contract deploy your-contract-account ./assembly/target/prediction.contract.wasm ./assembly/target/prediction.contract.abi
```

Replace `your-contract-account` with your Proton account name.

### 4. Set Contract Permissions

Configure the contract to allow inline actions and set appropriate permissions for admin operations. This is typically done through the Proton blockchain explorer or CLI.

### 5. Note Your Contract Account

Save your contract account name - you'll need it for the frontend configuration:
```
your-contract-account
```

---

## Frontend Setup

### 1. Ensure Node.js 22 is Active

```bash
nvm use 22
node --version  # Should show v22.x.x
```

### 2. Navigate to Frontend Directory

```bash
cd frontend  # From project root
```

### 3. Install Dependencies

```bash
npm install
```

This will:
- Install React, @proton/web-sdk, and other dependencies
- Automatically apply patches via `patch-package` to fix Node.js 22 compatibility issues

### 4. Configure Environment Variables

Copy the example environment file and configure it:

```bash
cp example.env .env
```

Edit the `.env` file with your preferred text editor:

```bash
nano .env  # or vim, code, etc.
```

**For Testnet:**
```env
REACT_APP_PROTON_ENDPOINT=https://testnet.protonchain.com
REACT_APP_CONTRACT_NAME=your-contract-account
REACT_APP_CHAIN_ID=71ee83bcf52142d61019d95f9cc5427ba6a0d7ff8accd9e2088ae2abeaf3d3dd
```

**For Mainnet:**
```env
REACT_APP_PROTON_ENDPOINT=https://proton.greymass.com
REACT_APP_CONTRACT_NAME=your-contract-account
REACT_APP_CHAIN_ID=384da888112027f0321850a169f737c33e53b388aad48b5adace4bab97f437e0
```

Replace `your-contract-account` with your deployed contract account name.

**Important Notes:**
- Environment variables are compiled into the JavaScript bundle during `npm run build`
- Changes to `.env` require rebuilding the app
- Never commit `.env` files to version control (already in `.gitignore`)

### 5. Test Locally (Optional)

Start the development server to test locally:

```bash
npm start
```

The app will be available at `http://localhost:3000` and will automatically reload when you make changes.

Press `Ctrl+C` to stop the development server when done testing.

---

## Frontend Deployment

### Build the Production Bundle

Before deploying to any hosting provider, build the production bundle:

```bash
cd frontend  # From project root
npm run build
```

This creates an optimized production build in the `build/` directory with:
- Minified JavaScript and CSS
- Optimized assets
- Environment variables baked into the bundle

**Important:** The `.env` file is only used during build time. Environment variables are compiled into the JavaScript bundle and cannot be changed after building.

---

## cPanel Deployment

### Overview

cPanel is a popular web hosting control panel. This section provides detailed instructions for deploying the React frontend to a cPanel-based hosting account.

### Prerequisites for cPanel

- cPanel hosting account with file manager or SSH access
- Domain or subdomain configured in cPanel
- FTP/SFTP credentials (if using FTP client)

### Deployment Steps

#### Step 1: Build the Frontend Locally

On your local machine (with Node.js 22 installed):

```bash
cd frontend
npm run build
```

This creates the `build/` directory with all static files.

#### Step 2: Prepare the Build Directory

The `build/` directory contains:
```
build/
├── index.html
├── static/
│   ├── css/
│   ├── js/
│   └── media/
├── manifest.json
├── favicon.ico
└── other assets
```

#### Step 3: Upload to cPanel

**Option A: Using cPanel File Manager**

1. Log in to your cPanel account
2. Navigate to **File Manager**
3. Go to the `public_html` directory (or your domain's document root)
4. **Clear existing files** (if this is a fresh deployment):
   - Select all files in `public_html`
   - Click **Delete**
5. Click **Upload** button
6. Upload ALL files and folders from your local `frontend/build/` directory
   - Upload `index.html`
   - Upload the entire `static/` folder
   - Upload all other files (`manifest.json`, `favicon.ico`, etc.)

**Option B: Using FTP/SFTP Client (FileZilla, Cyberduck, etc.)**

1. Connect to your cPanel hosting via FTP/SFTP
   - Host: Your domain or server IP
   - Username: Your cPanel username
   - Password: Your cPanel password
   - Port: 21 (FTP) or 22 (SFTP)
2. Navigate to `public_html` directory
3. Upload ALL contents of `frontend/build/` to `public_html`
   - Do NOT upload the `build` folder itself
   - Upload the CONTENTS of the build folder

**Option C: Using SSH/Terminal (if SSH access is enabled)**

```bash
# On your local machine, compress the build directory
cd frontend
tar -czf build.tar.gz -C build .

# Upload to server via SCP
scp build.tar.gz username@yourdomain.com:~/

# SSH into server
ssh username@yourdomain.com

# Extract to public_html
cd ~/public_html
tar -xzf ~/build.tar.gz
rm ~/build.tar.gz

# Set proper permissions
chmod 755 .
find . -type f -exec chmod 644 {} \;
find . -type d -exec chmod 755 {} \;
```

#### Step 4: Configure .htaccess for React Router (Important!)

React apps use client-side routing. You need to configure Apache to redirect all requests to `index.html`.

Create or edit `.htaccess` in your `public_html` directory:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteCond %{REQUEST_FILENAME} !-l
  RewriteRule . /index.html [L]
</IfModule>
```

This ensures that:
- Direct navigation to routes (e.g., `/markets`, `/portfolio`) works correctly
- Browser refresh doesn't result in 404 errors
- All routes are handled by React Router

#### Step 5: Verify Deployment

1. Visit your domain in a web browser (e.g., `https://yourdomain.com`)
2. The React app should load
3. Check browser console (F12) for any errors
4. Verify the app connects to the correct Proton endpoint

#### Step 6: Test Wallet Connection

1. Click "Connect Wallet" button
2. Proton WebAuth popup should appear
3. Log in with your Proton account
4. Verify wallet connects successfully

### Updating the Deployment

When you make changes to the frontend:

1. Update `.env` file if needed (environment variables)
2. Rebuild: `npm run build`
3. Upload new files to `public_html` (overwrite existing files)
4. Clear browser cache and test

### Domain Configuration

**Subdomain Deployment:**

If deploying to a subdomain (e.g., `predict.yourdomain.com`):

1. In cPanel, go to **Subdomains**
2. Create subdomain: `predict`
3. Set document root to a new directory (e.g., `public_html/predict`)
4. Upload build files to that directory instead of `public_html`
5. Update `.htaccess` in that directory

**Custom Domain:**

If using a custom domain:

1. Point domain DNS to your cPanel server
2. In cPanel, go to **Addon Domains**
3. Add your domain
4. Set document root
5. Upload build files to the document root

---

## Other Hosting Providers

### Vercel

```bash
cd frontend
npm install -g vercel
vercel deploy
```

Follow the prompts to configure your deployment.

### Netlify

**Option 1: Drag and Drop**
1. Visit https://app.netlify.com
2. Drag the `build/` folder to the deployment area

**Option 2: Netlify CLI**
```bash
cd frontend
npm install -g netlify-cli
netlify deploy --prod --dir=build
```

### GitHub Pages

```bash
cd frontend
npm install -g gh-pages

# Add to package.json:
# "homepage": "https://yourusername.github.io/repo-name"

# Deploy
npm run build
gh-pages -d build
```

### Environment Variables for Hosting Providers

**Important:** Environment variables must be set BEFORE building. They are compiled into the JavaScript bundle during `npm run build`.

For hosting providers that support environment variables (Vercel, Netlify):
1. Set environment variables in the hosting provider's dashboard
2. Trigger a rebuild
3. The new environment variables will be compiled into the bundle

---

## User Testing Guide

Once deployed, users can test the application following these steps:

### For End Users (Traders)

#### 1. Access the Application

Visit your deployed domain (e.g., `https://yourdomain.com` or `https://predict.yourdomain.com`)

#### 2. Create a Proton Account (if needed)

**Testnet:**
- Visit https://testnet.protonchain.com
- Click "Create Account"
- Follow the registration process
- Fund account with testnet XPR tokens (free)

**Mainnet:**
- Visit https://proton.org
- Create an account
- Purchase XPR tokens from an exchange

#### 3. Connect Wallet

1. Click **"Connect Wallet"** button in the app
2. Proton WebAuth popup will appear
3. Log in with your Proton account credentials
4. Authorize the connection
5. Your account name should appear in the app

#### 4. Fund Trading Account

Before trading, you need to deposit XPR into the smart contract:

1. In your Proton wallet, navigate to the contract account
2. Transfer XPR tokens to the contract
3. In the memo field, specify your action (if required)
4. Confirm the transaction
5. Your internal balance will update in the app

#### 5. Browse Markets

1. View the list of available prediction markets
2. Filter by category or status
3. Click on a market to view details

#### 6. Place Orders

1. Select a market
2. Choose **Yes** or **No** outcome
3. Enter **price** (0-1 XPR per share)
4. Enter **quantity** (number of shares)
5. Click **"Place Order"**
6. Confirm the transaction in Proton WebAuth
7. Order appears in the order book

#### 7. View Portfolio

1. Navigate to **Portfolio** section
2. View your positions (Yes/No shares held)
3. View your available balance
4. View your open orders

#### 8. Claim Winnings

After a market is resolved:

1. Navigate to resolved market
2. If you hold winning shares, click **"Claim"**
3. Confirm the transaction
4. Winnings are added to your internal balance

#### 9. Withdraw Funds

1. Navigate to **Portfolio** section
2. Click **"Withdraw"**
3. Enter amount to withdraw
4. Confirm the transaction
5. XPR tokens are sent back to your Proton wallet

### For Admins

#### 1. Create Markets

1. Navigate to **Admin Panel**
2. Click **"Create Market"**
3. Enter market details:
   - Question (e.g., "Will Bitcoin reach $100k by end of 2025?")
   - Category (e.g., "Crypto")
   - Expiration date
4. Click **"Create"**
5. Confirm the transaction
6. Market becomes active immediately

#### 2. Resolve Markets

After a market expires:

1. Navigate to **Admin Panel**
2. Select the expired market
3. Choose the correct outcome (**Yes** or **No**)
4. Click **"Resolve"**
5. Confirm the transaction
6. Users can now claim winnings

#### 3. Collect Fees

1. Navigate to **Admin Panel**
2. View accumulated platform fees
3. Click **"Collect Fees"**
4. Confirm the transaction
5. Fees are transferred to admin account

---

## Troubleshooting

### Common Issues

#### Issue: "Connect Wallet" button doesn't work

**Solution:**
- Check browser console (F12) for errors
- Verify Proton WebAuth is not blocked by browser
- Try a different browser (Chrome, Firefox recommended)
- Disable browser extensions that might interfere

#### Issue: App shows "Cannot connect to blockchain"

**Solution:**
- Verify `REACT_APP_PROTON_ENDPOINT` is correct in your `.env` file
- Rebuild the app: `npm run build`
- Redeploy to hosting provider
- Check if Proton RPC endpoint is online

#### Issue: Transactions fail with "Invalid contract"

**Solution:**
- Verify `REACT_APP_CONTRACT_NAME` matches your deployed contract account
- Rebuild the app: `npm run build`
- Redeploy to hosting provider
- Verify contract is deployed correctly on blockchain

#### Issue: 404 errors when navigating to routes

**Solution:**
- Verify `.htaccess` file is configured correctly (for cPanel/Apache)
- For Nginx, configure `try_files $uri /index.html`
- For other hosting providers, enable SPA (Single Page Application) mode

#### Issue: App loads but shows blank page

**Solution:**
- Check browser console (F12) for JavaScript errors
- Verify all files from `build/` directory were uploaded
- Check file permissions (644 for files, 755 for directories)
- Clear browser cache and reload

#### Issue: Environment variables not working

**Solution:**
- Remember: `.env` file is only used during `npm run build`
- Environment variables are compiled into the JavaScript bundle
- To change environment variables:
  1. Update `.env` file
  2. Run `npm run build` again
  3. Redeploy the new `build/` directory

#### Issue: Smart contract build fails

**Solution:**
- Verify Node.js 22 is active: `node --version`
- Clear node_modules and reinstall:
  ```bash
  rm -rf node_modules package-lock.json
  npm install
  npm run build
  ```
- Check for system package dependencies (gcc-c++, make, python3)

#### Issue: Frontend build fails with "Cannot resolve module"

**Solution:**
- Verify all dependencies are installed: `npm install`
- Check that `patch-package` ran successfully during postinstall
- Clear cache and rebuild:
  ```bash
  rm -rf node_modules package-lock.json
  npm install
  npm run build
  ```

### Getting Help

If you encounter issues not covered here:

1. Check the browser console (F12) for error messages
2. Check the GitHub repository issues: https://github.com/phoenixwade/proton-prediction-market/issues
3. Open a new issue with:
   - Detailed description of the problem
   - Steps to reproduce
   - Browser and OS information
   - Screenshots or error messages

---

## Additional Resources

- **Proton Documentation**: https://docs.protonchain.com
- **Proton WebAuth SDK**: https://github.com/ProtonProtocol/proton-web-sdk
- **React Documentation**: https://react.dev
- **Node.js Documentation**: https://nodejs.org/docs

---

## Security Notes

- Never commit `.env` files to version control
- Keep your Proton account credentials secure
- Test thoroughly on testnet before mainnet deployment
- Regularly update dependencies for security patches
- Use HTTPS for production deployments
- Implement rate limiting for API endpoints if needed

---

## Next Steps

After successful installation and deployment:

1. Test all features thoroughly on testnet
2. Create test markets and simulate trading
3. Verify all transactions work correctly
4. Test with multiple user accounts
5. Monitor for any errors or issues
6. When ready, deploy to mainnet with real XPR tokens

For questions or support, please open an issue on GitHub.
