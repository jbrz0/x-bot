# DigitalOcean Deployment Guide

## Prerequisites
- DigitalOcean account
- Docker installed on your droplet
- TwitterAPI.io API key
- OpenAI API key

## Quick Deployment Steps

### 1. Create DigitalOcean Droplet
```bash
# Create a new droplet with Docker pre-installed
# Recommended: Ubuntu 22.04 with Docker, 1GB RAM minimum
```

### 2. Clone and Setup
```bash
# SSH into your droplet
ssh root@your-droplet-ip

# Clone the repository
git clone https://github.com/yourusername/x-bot.git
cd x-bot

# Copy environment file
cp .env.example .env
```

### 3. Configure Environment Variables
Edit `.env` file with your credentials:
```bash
nano .env
```

Required variables:
- `TWITTERAPI_IO_KEY` - Your TwitterAPI.io API key
- `TWITTERAPI_IO_USER_ID` - Your Twitter user ID
- `OPENAI_API_KEY` - Your OpenAI API key
- `SIMULATE_MODE` - Set to "false" for production

### 4. Build and Run with Docker
```bash
# Build the Docker image
docker build -t x-bot .

# Run the container
docker run -d \
  --name x-bot \
  --env-file .env \
  --restart unless-stopped \
  x-bot

# Check logs
docker logs x-bot -f
```

### 5. Alternative: Using Docker Compose
```bash
# Start with docker-compose
docker-compose up -d

# View logs
docker-compose logs -f
```

## Important Notes

⚠️ **TwitterAPI.io Limitations**: This API is read-only. The bot can search and analyze tweets but cannot post, reply, or retweet.

🔄 **For Full Functionality**: If you need posting capabilities, you'll need to:
1. Get official Twitter API access
2. Update the `xClient.ts` to use the official API
3. Add the official API credentials to your environment

## Monitoring and Maintenance

```bash
# Check bot status
docker ps

# View recent logs
docker logs x-bot --tail 50

# Restart bot
docker restart x-bot

# Update bot
git pull
docker build -t x-bot .
docker stop x-bot
docker rm x-bot
docker run -d --name x-bot --env-file .env --restart unless-stopped x-bot
```

## Troubleshooting

### Common Issues:
1. **API Key Errors**: Verify your TwitterAPI.io and OpenAI keys are correct
2. **Database Issues**: Check if SQLite file has proper permissions
3. **Memory Issues**: Upgrade to a larger droplet if needed

### Debug Mode:
```bash
# Run in debug mode
docker run --rm --env-file .env -e LOG_LEVEL=debug x-bot
```
