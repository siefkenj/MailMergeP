#!/usr/bin/env bash
#
# Install Thunderbird and Mailpit (a test mail server) for the end-to-end tests in
# packages/thunderbird-extension/e2e (`npm run test:thunderbird`). The downloads are
# pinned and checked against these SHA-256 hashes.

set -euo pipefail

THUNDERBIRD_VERSION=140.17.0esr
# From https://download-installer.cdn.mozilla.net/pub/thunderbird/releases/$THUNDERBIRD_VERSION/SHA256SUMS
THUNDERBIRD_SHA256_X86_64=217edda8359412f13d76765802ed946b94b3cf95db5a4c8d9386f1f62f9391de

MAILPIT_VERSION=v1.31.2
MAILPIT_SHA256_AMD64=397a14cad03ae34d7c5f13215fd24971fed5ce48bf4237554829b0a10d4306ad
MAILPIT_SHA256_ARM64=91f4e7d94ac302470dbe59379af10222a43ff1625b7aea65f35890daa456817d

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

download() {
    local url=$1 file=$2 sha256=$3
    curl --fail --silent --show-error --location --output "$file" "$url"
    echo "$sha256  $file" | sha256sum --check --quiet
}

# Thunderbird runs on a virtual display
sudo apt-get update
sudo apt-get install --yes --no-install-recommends xvfb

case "$(uname -m)" in
x86_64)
    download \
        "https://download-installer.cdn.mozilla.net/pub/thunderbird/releases/$THUNDERBIRD_VERSION/linux-x86_64/en-US/thunderbird-$THUNDERBIRD_VERSION.tar.xz" \
        "$tmp/thunderbird.tar.xz" "$THUNDERBIRD_SHA256_X86_64"
    sudo rm -rf /opt/thunderbird
    sudo tar --extract --xz --file "$tmp/thunderbird.tar.xz" --directory /opt
    sudo ln --symbolic --force /opt/thunderbird/thunderbird /usr/local/bin/thunderbird
    mailpit_arch=amd64
    mailpit_sha256=$MAILPIT_SHA256_AMD64
    ;;
aarch64)
    echo "WARNING: Mozilla doesn't publish Thunderbird for Linux on ARM, so it isn't installed and \`npm run test:thunderbird\` won't work." >&2
    mailpit_arch=arm64
    mailpit_sha256=$MAILPIT_SHA256_ARM64
    ;;
*)
    echo "WARNING: Unsupported architecture $(uname -m); not installing Thunderbird or Mailpit." >&2
    exit 0
    ;;
esac

download \
    "https://github.com/axllent/mailpit/releases/download/$MAILPIT_VERSION/mailpit-linux-$mailpit_arch.tar.gz" \
    "$tmp/mailpit.tar.gz" "$mailpit_sha256"
tar --extract --gzip --file "$tmp/mailpit.tar.gz" --directory "$tmp" mailpit
sudo install "$tmp/mailpit" /usr/local/bin/mailpit
