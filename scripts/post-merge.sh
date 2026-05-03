#!/bin/bash
set -e
pnpm install --frozen-lockfile
# drizzle-kit push occasionally asks an interactive yes/no question (e.g.
# "this table has N rows — truncate?"). The first option is always the safe,
# non-destructive default, so feed it Enter and keep going.
printf '\n\n\n\n\n' | pnpm --filter db push
