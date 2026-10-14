#!/usr/bin/env bash

set -eu

# Use VIM as the command line git editor. Not everyone's preference, but oh well...
git config core.editor vim

# Install the npm dependencies, and Firefox (plus its system libraries) for the
# end-to-end tests run by `npm run test:e2e`
npm ci
npx playwright install --with-deps firefox

# Thunderbird and a test mail server, for `npm run test:thunderbird`. (Thunderbird
# uses the same system libraries as Firefox, installed above.)
bash .devcontainer/install-thunderbird.sh
