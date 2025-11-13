#!/bin/bash


set -e  # Exit on any error

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

CPANEL_USER="pawnline"
CPANEL_HOME="/home/${CPANEL_USER}"
PUBLIC_HTML="${CPANEL_HOME}/public_html"
PROJECT_DIR="${CPANEL_HOME}/proton-prediction-market"
FRONTEND_DIR="${PROJECT_DIR}/frontend"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Proton Prediction Market - cPanel Deployment${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

if [ ! -d "$CPANEL_HOME" ]; then
    echo -e "${RED}Error: cPanel home directory not found at $CPANEL_HOME${NC}"
    echo -e "${YELLOW}This script should be run on the cPanel server.${NC}"
    echo -e "${YELLOW}If running locally, use the local-build.sh script instead.${NC}"
    exit 1
fi

if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}Error: Project directory not found at $PROJECT_DIR${NC}"
    echo -e "${YELLOW}Please upload the project to $PROJECT_DIR first.${NC}"
    exit 1
fi

echo -e "${YELLOW}Navigating to frontend directory...${NC}"
cd "$FRONTEND_DIR"

if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed or not in PATH${NC}"
    echo -e "${YELLOW}Please enable Node.js in cPanel's 'Setup Node.js App' section.${NC}"
    exit 1
fi

echo -e "${GREEN}Node.js version: $(node --version)${NC}"
echo -e "${GREEN}npm version: $(npm --version)${NC}"
echo ""

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
    echo -e "${GREEN}Dependencies installed successfully!${NC}"
    echo ""
else
    echo -e "${GREEN}Dependencies already installed.${NC}"
    echo ""
fi

if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Warning: .env file not found!${NC}"
    echo -e "${YELLOW}Using default environment variables.${NC}"
    echo -e "${YELLOW}Create a .env file with your configuration for production.${NC}"
    echo ""
fi

echo -e "${YELLOW}Building React application...${NC}"
npm run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Build completed successfully!${NC}"
    echo ""
else
    echo -e "${RED}Build failed!${NC}"
    exit 1
fi

if [ -d "$PUBLIC_HTML" ] && [ "$(ls -A $PUBLIC_HTML)" ]; then
    BACKUP_DIR="${CPANEL_HOME}/public_html_backup"
    
    if [ -d "$BACKUP_DIR" ]; then
        echo -e "${YELLOW}Removing old backup...${NC}"
        rm -rf "$BACKUP_DIR"
    fi
    
    echo -e "${YELLOW}Backing up existing public_html to $BACKUP_DIR${NC}"
    cp -r "$PUBLIC_HTML" "$BACKUP_DIR"
    echo -e "${GREEN}Backup created successfully!${NC}"
    echo ""
fi

mkdir -p "$PUBLIC_HTML"

echo -e "${YELLOW}Deploying to $PUBLIC_HTML...${NC}"
rsync -av --delete build/ "$PUBLIC_HTML/"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Deployment completed successfully!${NC}"
    echo ""
else
    echo -e "${RED}Deployment failed!${NC}"
    exit 1
fi

HTACCESS_FILE="${PUBLIC_HTML}/.htaccess"
if [ ! -f "$HTACCESS_FILE" ]; then
    echo -e "${YELLOW}Creating .htaccess file for React Router...${NC}"
    cat > "$HTACCESS_FILE" << 'EOF'
Options -MultiViews
RewriteEngine On
RewriteBase /


RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ index.html [L]

<IfModule mod_headers.c>
    Header set X-Content-Type-Options "nosniff"
    Header set X-Frame-Options "SAMEORIGIN"
    Header set X-XSS-Protection "1; mode=block"
</IfModule>

<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript application/json
</IfModule>

<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType image/jpg "access plus 1 year"
    ExpiresByType image/jpeg "access plus 1 year"
    ExpiresByType image/gif "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/svg+xml "access plus 1 year"
    ExpiresByType text/css "access plus 1 month"
    ExpiresByType application/javascript "access plus 1 month"
    ExpiresByType text/javascript "access plus 1 month"
    ExpiresByType application/pdf "access plus 1 month"
    ExpiresByType text/html "access plus 0 seconds"
</IfModule>
EOF
    echo -e "${GREEN}.htaccess file created successfully!${NC}"
    echo ""
else
    echo -e "${GREEN}.htaccess file already exists.${NC}"
    echo ""
fi

echo -e "${YELLOW}Setting file permissions...${NC}"
find "$PUBLIC_HTML" -type f -exec chmod 644 {} \;
find "$PUBLIC_HTML" -type d -exec chmod 755 {} \;
echo -e "${GREEN}Permissions set successfully!${NC}"
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Summary${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "Project Directory: ${YELLOW}$PROJECT_DIR${NC}"
echo -e "Public HTML: ${YELLOW}$PUBLIC_HTML${NC}"
echo -e "Build Size: ${YELLOW}$(du -sh $PUBLIC_HTML | cut -f1)${NC}"
echo -e "Files Deployed: ${YELLOW}$(find $PUBLIC_HTML -type f | wc -l)${NC}"
echo ""
echo -e "${GREEN}✓ Deployment completed successfully!${NC}"
echo -e "${GREEN}Your app should now be live at: ${YELLOW}https://pawnline.io${NC}"
echo ""
