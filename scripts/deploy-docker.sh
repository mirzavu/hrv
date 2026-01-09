#!/bin/bash

# Deploy script for HRV App
# Usage: ./scripts/deploy-docker.sh

SERVER_IP="104.168.98.204"
USER="dev"
export SSHPASS='i9l6+x42AMY35twRSVPymw=='
DEST_DIR="~/web/hrv.demotesting.co.uk/private/docker"
# Using HestiaCP structure, or just a home folder location?
# User's home is /home/dev.
# Let's put it in ~/apps/hrv-docker to differ from Hestia's web root slightly or strictly inside private.
# Implementation plan said "Copy docker files to server".
# Let's use ~/apps/hrv for clarity.
TARGET_DIR="/home/dev/apps/hrv"

echo "Deploying to $USER@$SERVER_IP:$TARGET_DIR..."

# Create directory
sshpass -e ssh -o StrictHostKeyChecking=no $USER@$SERVER_IP "mkdir -p $TARGET_DIR/pb_migrations $TARGET_DIR/pb_data"

# Rsync files
# Exclude node_modules, .next, etc. to keep it light. check .dockerignore behavior?
# We are copying CONTEXT.
# We need to copy: Dockerfile, Dockerfile.pocketbase, docker-compose.yml, .env.production, and pb_migrations.
# We do NOT need full source if we build locally, BUT the plan says "SSH -> docker-compose up --build", implies REMOTE build.
# If remote build, we need SOURCE.
# So we must rsync the whole project (respecting .gitignore).

echo "Syncing files..."
sshpass -e rsync -avhz --delete \
    --exclude '/node_modules' \
    --exclude '.git' \
    --exclude 'pb.log' \
    --exclude '.env.local' \
    . $USER@$SERVER_IP:$TARGET_DIR

# Sync build artifacts explicitly if they exist locally?
# Actually, if we remove exclude .next, rsync will try to sync .next
# But we want ONLY standalone and static.
# Be careful with --delete.
# Let's just allow .next for now if we built locally.
# But .next cache is huge.
# Better strategy: Sync standalone and static separately?
# Or just use include/exclude.
# For simplicity, let's sync everything except node_modules.
# Next.js build produces .next.
# The Dockerfile.prebuilt expects .next/standalone at ./
# Wait! Dockerfile.prebuilt RUNs in context.
# COPY .next/standalone ./
# This means .next/standalone must be in context root.
# So on Server: /home/dev/apps/hrv/.next/standalone.
# Yes.
# So if I sync .next folder to server, it works.


# Run Docker Compose
echo "Starting application..."
# We use 'docker compose' (plugin) syntax as requested.
# We also rename .env.production to .env for docker-compose to pick it up easily, or specify it.
# docker-compose.yml already has `env_file: .env.production`.

sshpass -e ssh $USER@$SERVER_IP "cd $TARGET_DIR && docker compose down && docker compose up -d --build"

echo "Deployment triggered!"
