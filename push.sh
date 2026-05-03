#!/bin/bash
echo "Paste your GitHub token (ghp_...) and press Enter:"
read -r RAW_TOKEN
TOKEN=$(echo "$RAW_TOKEN" | tr -d '\r\n ')
if [ ${#TOKEN} -lt 20 ]; then
  echo "ERROR: token too short (got ${#TOKEN} chars). Try again."
  exit 1
fi
echo "Token received (length: ${#TOKEN}). Pushing to GitHub..."
git push "https://filefos:${TOKEN}@github.com/filefos/ma-erp-crm.git" main
