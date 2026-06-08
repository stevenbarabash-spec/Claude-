#!/bin/bash
# Usage: ./run_lease.sh --tenant "Name" --address "Addr" --start "Date" --end "Date" --rent "4,500" --deposit "9,000" --output "file.docx"
NODE_PATH=/opt/node22/lib/node_modules node "$(dirname "$0")/generate_lease.js" "$@"
