#!/bin/bash
if [ -z "$GITHUB_TOKEN" ]; then
  echo "ERROR: GITHUB_TOKEN secret is not set."
  exit 1
fi
echo "Token length: ${#GITHUB_TOKEN} (good if 40+)"
echo "Pushing to GitHub..."
git push "https://filefos:${GITHUB_TOKEN}@github.com/filefos/ma-erp-crm.git" main
