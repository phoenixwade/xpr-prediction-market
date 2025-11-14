# Testing Guide

This guide provides comprehensive instructions for testing the Proton Prediction Market platform locally before deploying changes to production.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Running the App Locally](#running-the-app-locally)
4. [Testing PR Changes](#testing-pr-changes)
5. [Testing Checklist](#testing-checklist)
6. [Common Testing Scenarios](#common-testing-scenarios)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before you can test the application locally, ensure you have:

- **Node.js v22.x** installed (use `nvm use 22`)
- **npm** package manager
- **Git** for version control
- A **Proton blockchain account** (testnet or mainnet)
- Basic familiarity with React development

---

## Initial Setup

### 1. Clone the Repository (if not already done)

```bash
git clone https://github.com/phoenixwade/proton-prediction-market.git
cd proton-prediction-market
```

### 2. Install Node.js 22

```bash
# Using nvm (Node Version Manager)
nvm install 22
nvm use 22

# Verify installation
node --version  # Should show v22.x.x
```

### 3. Install Dependencies

#### Smart Contract Dependencies

```bash
cd contracts
npm install
cd ..
```

#### Frontend Dependencies

```bash
cd frontend
npm install
cd ..
```

### 4. Configure Environment Variables

```bash
cd frontend
cp example.env .env
```

Edit the `.env` file with your configuration:

**For Testnet Testing:**
```env
REACT_APP_NAME=Proton Prediction Market
REACT_APP_PROTON_ENDPOINT=https://testnet.protonchain.com
REACT_APP_CONTRACT_NAME=your-testnet-contract
REACT_APP_CHAIN_ID=71ee83bcf52142d61019d95f9cc5427ba6a0d7ff8accd9e2088ae2abeaf3d3dd
REACT_APP_RPC_ENDPOINT=https://testnet.protonchain.com
REACT_APP_TOKEN_CONTRACT=eosio.token
```

**For Mainnet Testing:**
```env
REACT_APP_NAME=Proton Prediction Market
REACT_APP_PROTON_ENDPOINT=https://proton.greymass.com
REACT_APP_CONTRACT_NAME=xpredicting
REACT_APP_CHAIN_ID=384da888112027f0321850a169f737c33e53b388aad48b5adace4bab97f437e0
REACT_APP_RPC_ENDPOINT=https://proton.greymass.com
REACT_APP_TOKEN_CONTRACT=eosio.token
```

**Important:** Replace `your-testnet-contract` or `xpredicting` with your actual deployed contract account name.

---

## Running the App Locally

### Start the Development Server

```bash
cd frontend
npm start
```

The app will automatically open in your browser at `http://localhost:3000`.

**What to expect:**
- The app should load without errors
- You should see the "Proton Prediction Market" header
- The "Connect Wallet" button should be visible
- Navigation tabs (Markets, Portfolio, Admin) should be present
- The footer should display with XPR Network and HomeBloks branding

### Development Server Features

- **Hot Reload**: Changes to source files automatically reload the browser
- **Error Overlay**: Compilation errors appear as an overlay in the browser
- **Console Logging**: Check browser console (F12) for runtime errors

### Stop the Development Server

Press `Ctrl+C` in the terminal to stop the server.

---

## Testing PR Changes

When testing a new PR before merging, follow this workflow:

### 1. Fetch the Latest Changes

```bash
cd proton-prediction-market
git fetch origin
```

### 2. Check Out the PR Branch

```bash
# Replace 'branch-name' with the actual PR branch name
git checkout branch-name
```

**Tip:** You can find the branch name in the PR description on GitHub.

### 3. Install/Update Dependencies

```bash
# Frontend dependencies (if package.json changed)
cd frontend
npm install
cd ..

# Smart contract dependencies (if contracts changed)
cd contracts
npm install
npm run build
cd ..
```

### 4. Verify Environment Configuration

```bash
# Ensure .env file exists and is configured correctly
cat frontend/.env
```

### 5. Start the Development Server

```bash
cd frontend
npm start
```

### 6. Test the Changes

Follow the [Testing Checklist](#testing-checklist) below to verify the changes work as expected.

### 7. Check for Errors

- **Browser Console**: Press F12 and check the Console tab for JavaScript errors
- **Network Tab**: Check for failed API requests
- **Terminal**: Look for compilation warnings or errors

### 8. Return to Main Branch

After testing, switch back to main:

```bash
git checkout main
git pull origin main
```

---

## Testing Checklist

Use this checklist to verify the application works correctly:

### Basic Functionality

- [ ] **App Loads**: Application loads without errors at `http://localhost:3000`
- [ ] **UI Renders**: All components render correctly (header, navigation, footer)
- [ ] **No Console Errors**: Browser console shows no critical errors
- [ ] **Responsive Design**: App displays correctly on different screen sizes

### Wallet Connection

- [ ] **Connect Button**: "Connect Wallet" button is visible and clickable
- [ ] **WebAuth Popup**: Clicking "Connect Wallet" opens Proton WebAuth popup
- [ ] **Login Success**: Can successfully log in with Proton account
- [ ] **Account Display**: Account name appears in header after login
- [ ] **Session Persistence**: Refreshing page maintains wallet connection
- [ ] **Disconnect**: Can successfully disconnect wallet

### Markets List

- [ ] **Markets Display**: Markets list loads and displays correctly
- [ ] **Filter Buttons**: "All", "Active", "Resolved" filter buttons work
- [ ] **Category Filter**: Can filter markets by category
- [ ] **Market Cards**: Each market card shows question, category, and status
- [ ] **Click to View**: Clicking a market navigates to market detail page
- [ ] **Tooltips**: Hover tooltips display helpful information

### Market Detail Page

- [ ] **Market Info**: Market question, category, and expiry display correctly
- [ ] **Order Book**: Buy and sell orders display in the order book
- [ ] **Order Form**: Can enter price and quantity for orders
- [ ] **Yes/No Toggle**: Can switch between Yes and No outcomes
- [ ] **Place Order**: "Place Order" button is functional
- [ ] **Order Validation**: Invalid orders show appropriate error messages

### Portfolio Page

- [ ] **Balance Display**: XPR balance displays correctly
- [ ] **Positions List**: User positions in markets display correctly
- [ ] **Open Orders**: User's open orders display correctly
- [ ] **Claim Winnings**: Can claim winnings from resolved markets
- [ ] **Withdraw**: Can withdraw XPR from internal balance

### Admin Panel (if admin account)

- [ ] **Create Market Tab**: Can access market creation form
- [ ] **Market Form**: All fields (question, category, expiry) work correctly
- [ ] **Create Market**: Can successfully create a new market
- [ ] **Resolve Market Tab**: Can access market resolution interface
- [ ] **Market Dropdown**: Dropdown shows eligible markets to resolve
- [ ] **Market Selection**: Can select a market from dropdown
- [ ] **Outcome Selection**: Can choose Yes/No outcome
- [ ] **Resolve Market**: Can successfully resolve a market

### Footer

- [ ] **XPR Logo**: XPR Network logo displays correctly
- [ ] **HomeBloks Logo**: HomeBloks logo displays correctly
- [ ] **Social Icons**: Telegram and Twitter/X icons display correctly
- [ ] **Links Work**: All footer links navigate to correct destinations
- [ ] **How to Use**: "How to Use" link opens instructions page

### Instructions Page

- [ ] **Page Loads**: Instructions page loads when clicking "How to Use"
- [ ] **Content Display**: All sections and steps display correctly
- [ ] **Formatting**: Text formatting and layout are correct
- [ ] **Navigation**: Can navigate back to main app

---

## Common Testing Scenarios

### Scenario 1: Testing UI Changes

**When to use:** Testing changes to components, styling, or layout.

1. Check out the PR branch
2. Start the development server
3. Navigate to the affected component/page
4. Verify the visual changes match the PR description
5. Test on different screen sizes (desktop, tablet, mobile)
6. Check browser console for errors

### Scenario 2: Testing Smart Contract Changes

**When to use:** Testing changes to contract actions or data structures.

1. Check out the PR branch
2. Rebuild the smart contract:
   ```bash
   cd contracts
   npm run build
   ```
3. Deploy to testnet (if available):
   ```bash
   proton contract deploy your-testnet-account ./assembly/target/prediction.contract.wasm ./assembly/target/prediction.contract.abi
   ```
4. Update frontend `.env` with testnet contract name
5. Start frontend development server
6. Test the affected contract actions (create market, place order, etc.)

### Scenario 3: Testing New Features

**When to use:** Testing newly added functionality.

1. Check out the PR branch
2. Read the PR description to understand the new feature
3. Install dependencies if needed
4. Start the development server
5. Follow the feature workflow step-by-step
6. Test edge cases and error handling
7. Verify the feature works as described in the PR

### Scenario 4: Testing Bug Fixes

**When to use:** Verifying a bug has been fixed.

1. Check out the main branch first
2. Reproduce the bug to confirm it exists
3. Document the steps to reproduce
4. Check out the PR branch
5. Follow the same steps to reproduce
6. Verify the bug no longer occurs
7. Test related functionality to ensure no regressions

### Scenario 5: Testing Inline Transfer Feature

**When to use:** Testing order placement with inline XPR transfer.

1. Connect wallet with a funded Proton account
2. Navigate to a market
3. Place a buy order (Yes or No)
4. Verify the transaction includes both transfer and placeorder actions
5. Check that the order appears in the order book
6. Verify no pre-deposit was required

### Scenario 6: Testing Market Resolution Dropdown

**When to use:** Testing the admin market resolution interface.

1. Connect wallet with an admin account
2. Create a test market (or use existing unresolved market)
3. Navigate to Admin Panel → Resolve Market tab
4. Verify dropdown shows only unresolved markets where you are admin
5. Select a market from dropdown
6. Choose Yes or No outcome
7. Resolve the market
8. Verify the market is marked as resolved

---

## Troubleshooting

### Issue: "Cannot find module" errors

**Solution:**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### Issue: Port 3000 already in use

**Solution:**
```bash
# Use a different port
PORT=3001 npm start
```

Or kill the process using port 3000:
```bash
# Find the process
lsof -ti:3000

# Kill the process
kill -9 $(lsof -ti:3000)
```

### Issue: "Invalid contract" errors

**Solution:**
- Verify `REACT_APP_CONTRACT_NAME` in `.env` matches your deployed contract
- Ensure the contract is deployed to the correct network (testnet/mainnet)
- Check that `REACT_APP_CHAIN_ID` matches the network

### Issue: Wallet connection fails

**Solution:**
- Clear browser cache and cookies
- Try a different browser (Chrome or Firefox recommended)
- Verify `REACT_APP_PROTON_ENDPOINT` is correct
- Check browser console for specific error messages

### Issue: Markets not loading

**Solution:**
- Verify the contract account has markets created
- Check `REACT_APP_RPC_ENDPOINT` is correct
- Open browser console and check for API errors
- Verify the contract is deployed and accessible

### Issue: Hot reload not working

**Solution:**
```bash
# Stop the dev server (Ctrl+C)
# Clear the cache
rm -rf node_modules/.cache

# Restart
npm start
```

### Issue: Environment variables not updating

**Solution:**
- Environment variables are compiled at build time
- After changing `.env`, restart the dev server:
  ```bash
  # Stop with Ctrl+C
  npm start
  ```
- For production builds, rebuild:
  ```bash
  npm run build
  ```

### Issue: Compilation warnings about React Hooks

**Solution:**
These are ESLint warnings and don't affect functionality. They can be safely ignored during testing. To fix them permanently, add the missing dependencies to the useEffect dependency arrays.

---

## Best Practices

### Before Testing a PR

1. **Read the PR description** to understand what changed
2. **Check the files changed** to see which components were modified
3. **Review any testing notes** provided by the PR author
4. **Ensure your local environment is up to date**

### During Testing

1. **Test systematically** using the checklist
2. **Document any issues** you find with steps to reproduce
3. **Test edge cases** and error scenarios
4. **Check browser console** for warnings or errors
5. **Test on multiple browsers** if possible

### After Testing

1. **Leave feedback** on the PR with your testing results
2. **Report any bugs** found during testing
3. **Verify the PR description** matches the actual changes
4. **Switch back to main branch** when done

---

## Additional Resources

- **README.md**: Project overview and features
- **INSTALLATION.md**: Detailed installation and deployment instructions
- **GitHub Issues**: Report bugs and request features
- **Proton Documentation**: https://docs.protonchain.com
- **React Documentation**: https://react.dev

---

## Quick Reference Commands

```bash
# Switch to a PR branch
git fetch origin
git checkout branch-name

# Install dependencies
cd frontend && npm install && cd ..

# Start development server
cd frontend && npm start

# Stop development server
# Press Ctrl+C

# Return to main branch
git checkout main
git pull origin main

# Check Node.js version
node --version

# Switch Node.js version
nvm use 22

# View environment variables
cat frontend/.env

# Rebuild smart contract
cd contracts && npm run build && cd ..

# Check for compilation errors
cd frontend && npm run build && cd ..
```

---

## Testing Workflow Summary

```
1. Fetch latest changes → git fetch origin
2. Checkout PR branch → git checkout branch-name
3. Install dependencies → cd frontend && npm install
4. Verify .env config → cat frontend/.env
5. Start dev server → npm start
6. Test functionality → Follow checklist
7. Check for errors → Browser console + terminal
8. Return to main → git checkout main
```

---

## Support

If you encounter issues not covered in this guide:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review the browser console for error messages
3. Check the terminal output for compilation errors
4. Consult the [INSTALLATION.md](INSTALLATION.md) guide
5. Open an issue on GitHub with detailed information

---

**Happy Testing! 🧪**
