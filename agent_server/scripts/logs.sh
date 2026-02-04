#!/bin/bash

# View live logs from the Claude Server

SERVER_HOST="${CLAUDE_SERVER_HOST:-root@161.35.138.83}"

echo "📜 Streaming logs from LARS Agent Server..."
echo "Press Ctrl+C to exit"
echo ""

ssh $SERVER_HOST 'sudo journalctl -u lars-agent -f --no-pager'

