#!/bin/bash
# Deploy script for prediction market contracts
# Usage: ./deploy-contracts.sh [xpredicting|xpredprofit|all|clearmarkets]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="$SCRIPT_DIR/assembly/target"
DEPLOY_DIR="$SCRIPT_DIR/deploy"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

echo_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

echo_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Build contracts
build_contracts() {
    echo_info "Building contracts..."
    cd "$SCRIPT_DIR"
    
    # Install dependencies if node_modules doesn't exist or package.json is newer
    if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
        echo_info "Installing dependencies..."
        npm install
    fi
    
    npm run build:all
    echo_info "Build complete!"
}

# Prepare deployment directories
prepare_deploy_dirs() {
    echo_info "Preparing deployment directories..."
    
    # Create deploy directories
    mkdir -p "$DEPLOY_DIR/xpredicting"
    mkdir -p "$DEPLOY_DIR/xpredprofit"
    
    # Copy xpredicting contract files
    cp "$TARGET_DIR/prediction.contract.wasm" "$DEPLOY_DIR/xpredicting/"
    cp "$TARGET_DIR/prediction.contract.abi" "$DEPLOY_DIR/xpredicting/"
    
    # Copy xpredprofit contract files
    cp "$TARGET_DIR/profitshare.contract.wasm" "$DEPLOY_DIR/xpredprofit/"
    cp "$TARGET_DIR/profitshare.contract.abi" "$DEPLOY_DIR/xpredprofit/"
    
    echo_info "Deployment files ready in $DEPLOY_DIR"
}

# Deploy xpredicting contract
deploy_xpredicting() {
    echo_info "Deploying xpredicting contract..."
    npx @proton/cli contract:set xpredicting "$DEPLOY_DIR/xpredicting"
    echo_info "xpredicting deployed successfully!"
}

# Deploy xpredprofit contract
deploy_xpredprofit() {
    echo_info "Deploying xpredprofit contract..."
    npx @proton/cli contract:set xpredprofit "$DEPLOY_DIR/xpredprofit"
    echo_info "xpredprofit deployed successfully!"
}

# Clear markets (one-time migration action)
clear_markets() {
    echo_warn "This will DELETE ALL MARKETS from the xpredicting contract!"
    echo_warn "This action is IRREVERSIBLE!"
    read -p "Are you sure you want to continue? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        echo_info "Aborted."
        exit 0
    fi
    
    echo_info "Clearing markets..."
    npx @proton/cli action:push xpredicting clearmarkets '{"admin":"xpredicting"}' -p xpredicting@active
    echo_info "Markets cleared successfully!"
}

# Show usage
show_usage() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  build         - Build all contracts"
    echo "  xpredicting   - Deploy xpredicting contract only"
    echo "  xpredprofit   - Deploy xpredprofit contract only"
    echo "  all           - Build and deploy both contracts"
    echo "  clearmarkets  - Clear all markets (one-time migration)"
    echo "  help          - Show this help message"
    echo ""
    echo "Example workflow for TESTIES migration:"
    echo "  1. ./deploy-contracts.sh all"
    echo "  2. ./deploy-contracts.sh clearmarkets"
    echo "  3. Disconnect and reconnect wallet in the app"
    echo "  4. Redeploy frontend: ~/proton-prediction-market/deploy-to-cpanel.sh"
}

# Main
case "${1:-help}" in
    build)
        build_contracts
        prepare_deploy_dirs
        ;;
    xpredicting)
        build_contracts
        prepare_deploy_dirs
        deploy_xpredicting
        ;;
    xpredprofit)
        build_contracts
        prepare_deploy_dirs
        deploy_xpredprofit
        ;;
    all)
        build_contracts
        prepare_deploy_dirs
        deploy_xpredicting
        deploy_xpredprofit
        echo ""
        echo_info "Both contracts deployed!"
        echo_warn "IMPORTANT: After deploying, users must disconnect and reconnect their wallets to refresh the ABI cache."
        ;;
    clearmarkets)
        clear_markets
        ;;
    help|*)
        show_usage
        ;;
esac
