#!/bin/bash

# Database Migration Script (Remote to Remote)
# Moves all data from one PostgreSQL database to another using connection strings
# Usage: ./migrate-database.sh <source_url> <target_url>
#
# Example:
#   ./migrate-database.sh "postgres://user:pass@host1/afterclass-old" "postgres://user:pass@host2/afterclass"

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SOURCE_URL="$1"
TARGET_URL="$2"
DUMP_FILE="/tmp/afterclass_dump_$(date +%Y%m%d_%H%M%S).sql"

if [ -z "$SOURCE_URL" ] || [ -z "$TARGET_URL" ]; then
    echo -e "${RED}Error: Both source and target connection strings are required${NC}"
    echo ""
    echo "Usage: ./migrate-database.sh <source_url> <target_url>"
    echo ""
    echo "Example:"
    echo "  ./migrate-database.sh \\"
    echo "    \"postgres://user:pass@ep-xxx.us-east-2.aws.neon.tech/afterclass-old\" \\"
    echo "    \"postgres://user:pass@ep-xxx.us-east-2.aws.neon.tech/afterclass\""
    exit 1
fi

echo -e "${YELLOW}=== Database Migration Script ===${NC}"
echo ""
echo "Source: ${SOURCE_URL%%@*}@***" # Hide credentials in output
echo "Target: ${TARGET_URL%%@*}@***"
echo "Dump file: $DUMP_FILE"
echo ""

# Step 1: Test source connection
echo -e "${YELLOW}[1/4] Testing source database connection...${NC}"
if ! psql "$SOURCE_URL" -c "SELECT 1" > /dev/null 2>&1; then
    echo -e "${RED}Error: Cannot connect to source database${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Source database connected${NC}"

# Step 2: Dump the source database
echo ""
echo -e "${YELLOW}[2/4] Dumping source database...${NC}"
pg_dump --no-owner --no-acl "$SOURCE_URL" > "$DUMP_FILE"
echo -e "${GREEN}✓ Database dumped to $DUMP_FILE ($(du -h "$DUMP_FILE" | cut -f1))${NC}"

# Step 3: Restore data to target database
echo ""
echo -e "${YELLOW}[3/4] Restoring data to target database...${NC}"
psql "$TARGET_URL" < "$DUMP_FILE"
echo -e "${GREEN}✓ Data restored${NC}"

# Step 4: Verify migration
echo ""
echo -e "${YELLOW}[4/4] Verifying migration...${NC}"
echo ""
echo "Tables in target database:"
psql "$TARGET_URL" -c "\dt"

echo ""
echo "Row counts:"
psql "$TARGET_URL" -c "
SELECT
    schemaname,
    relname as table_name,
    n_live_tup as row_count
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;
"

echo ""
echo -e "${GREEN}=== Migration Complete ===${NC}"
echo ""
echo "Next steps:"
echo "1. Update your .env.local DATABASE_RUNTIME_URL to point to the new database"
echo ""
echo "2. Delete the dump file:"
echo "   rm $DUMP_FILE"
